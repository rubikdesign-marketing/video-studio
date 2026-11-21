import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { scratchStudio } from '../../plan/tests/helpers.mjs';
import { createServer, serveStdio } from '../lib/rpc.mjs';

const SERVER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../server.mjs');

/** Writes a JSON line to the child and resolves with the reply that has the same id. */
function lineClient(child) {
  const waiting = new Map();
  const seen = [];
  let buf = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      const msg = JSON.parse(line); // anything that is not JSON on stdout fails the test here
      seen.push(msg);
      const w = waiting.get(msg.id);
      if (w) { waiting.delete(msg.id); w(msg); }
    }
  });
  const ask = (msg) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`no reply to ${JSON.stringify(msg)}`)), 5000);
    waiting.set(msg.id, (m) => { clearTimeout(t); resolve(m); });
    child.stdin.write(JSON.stringify(msg) + '\n');
  });
  ask.seen = seen;
  return ask;
}

test('rpc: initialize, list and call over a real child process', async () => {
  const root = scratchStudio();
  fs.writeFileSync(path.join(root, 'RELEASE.json'), JSON.stringify({ version: '1.2.3' }));
  const child = spawn(process.execPath, [SERVER], { env: { ...process.env, DAMEX_STUDIO_ROOT: root } });
  try {
    const ask = lineClient(child);
    const init = await ask({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } });
    assert.equal(init.result.protocolVersion, '2025-06-18');
    assert.equal(init.result.serverInfo.name, 'damex-engine');
    assert.equal(init.result.serverInfo.version, '1.2.3');
    assert.deepEqual(init.result.capabilities, { tools: {} });
    const list = await ask({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    assert.equal(list.result.tools.length, 6);
    const ctx = await ask({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'studio_context', arguments: {} } });
    assert.equal(ctx.result.structuredContent.brands[0].name, 'acme');
    assert.equal(JSON.parse(ctx.result.content[0].text).brands[0].name, 'acme');
    const bad = await ask({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'brief_check', arguments: { job: '../.env' } } });
    assert.equal(bad.result.isError, true);
    assert.equal(typeof bad.result.content[0].text, 'string');
    const unknown = await ask({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'nope' } });
    assert.equal(unknown.result.isError, true);
    assert.equal(unknown.result.content[0].text, 'Unknown tool nope');
    child.stdin.write('{ not json\n');
    child.stdin.write('   \n\n');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    const ping = await ask({ jsonrpc: '2.0', id: 6, method: 'ping' });
    assert.deepEqual(ping.result, {});
    // the parse error came back (id null), the notification and blank lines got nothing
    assert.equal(ask.seen.filter((m) => m.id === null && m.error.code === -32700).length, 1);
    assert.equal(ask.seen.length, 7);
  } finally { child.kill(); }
});

test('rpc: version falls back to 0.0.0 without RELEASE.json', async () => {
  const root = scratchStudio();
  const child = spawn(process.execPath, [SERVER], { env: { ...process.env, DAMEX_STUDIO_ROOT: root } });
  try {
    const ask = lineClient(child);
    const init = await ask({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1999-01-01' } });
    assert.equal(init.result.serverInfo.version, '0.0.0');
    assert.equal(init.result.protocolVersion, '2025-06-18');
  } finally { child.kill(); }
});

test('rpc: an unknown method gets -32601, notifications get nothing', () => {
  const s = createServer({ name: 'x', version: '1', tools: [], handlers: {} });
  assert.equal(s.handle({ jsonrpc: '2.0', id: 9, method: 'nope' }).error.code, -32601);
  assert.equal(s.handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  assert.equal(s.handle({ jsonrpc: '2.0', method: 'nope' }), null);
});

test('rpc: protocol versions and tools/call details', () => {
  const s = createServer({ name: 'x', version: '1', tools: [{ name: 't' }], handlers: { t: (a) => ({ got: a }), boom: () => { throw 'plain string'; }, err: () => { throw new Error('bad thing'); } } });
  for (const v of ['2025-03-26', '2024-11-05']) assert.equal(s.handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: v } }).result.protocolVersion, v);
  assert.equal(s.handle({ jsonrpc: '2.0', id: 1, method: 'initialize' }).result.protocolVersion, '2025-06-18');
  assert.deepEqual(s.handle({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 't' } }).result.structuredContent, { got: {} });
  assert.equal(s.handle({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'boom' } }).result.content[0].text, 'plain string');
  const e = s.handle({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'err' } }).result;
  assert.deepEqual(e, { content: [{ type: 'text', text: 'bad thing' }], isError: true });
  assert.equal(s.handle({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'toString' } }).result.isError, true);
  assert.equal(s.handle({ jsonrpc: '2.0', id: 6, method: 'tools/call' }).result.isError, true);
  assert.equal(s.handle({ jsonrpc: '2.0', id: 7, method: 'tools/list' }).result.tools.length, 1);
  assert.equal(s.handle({ jsonrpc: '2.0', id: 8 }).error.code, -32600);
  assert.equal(s.handle([]).error.code, -32600);
});

test('rpc: serveStdio handles split lines, several lines per chunk, blank lines and a last line without newline', async () => {
  const s = createServer({ name: 'x', version: '1', tools: [], handlers: {} });
  const input = new PassThrough(); const output = new PassThrough();
  const lines = [];
  let buf = '';
  output.setEncoding('utf8');
  output.on('data', (d) => { buf += d; });
  serveStdio(s, input, output);
  const a = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' });
  const b = JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'ping' });
  const c = JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'ping' });
  input.write(a.slice(0, 7));
  input.write(a.slice(7) + '\n\r\n  \n' + b + '\n' + c.slice(0, 5));
  input.write(c.slice(5)); // no trailing newline
  input.end();
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  for (const l of buf.split('\n').filter(Boolean)) lines.push(JSON.parse(l));
  assert.deepEqual(lines.map((m) => m.id), [1, 2, 3]);
});
