import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { connectorNode, registerConnector, probeConnector } from './connector.mjs';
import { buildReport } from './doctor.mjs';
import { STUDIO } from './resolve.mjs';

const scratch = () => fs.mkdtempSync(path.join(os.tmpdir(), 'connector-test-'));
const write = (root, rel, text = 'x') => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), text);
};
const readMcp = (root) => JSON.parse(fs.readFileSync(path.join(root, '.mcp.json'), 'utf8'));

/** The server imports tools/plan and reads templates, so a working copy needs them too. */
function copyConnector(from, to) {
  for (const rel of ['tools/connector', 'tools/plan', 'templates', 'library/structure']) {
    if (fs.existsSync(path.join(from, rel))) fs.cpSync(path.join(from, rel), path.join(to, rel), { recursive: true });
  }
}

test('connector: register adds the entry and keeps other servers', () => {
  const root = scratch();
  write(root, '.mcp.json', JSON.stringify({ mcpServers: { viralhooks: { type: 'http', url: 'https://example.com/mcp/' } } }));
  assert.equal(registerConnector(root, '/x/node'), 'added');
  const m = readMcp(root);
  assert.ok(m.mcpServers.viralhooks);
  assert.deepEqual(m.mcpServers['damex-engine'], { type: 'stdio', command: '/x/node', args: [path.join(root, 'tools', 'connector', 'server.mjs')] });
  assert.equal(registerConnector(root, '/x/node'), 'unchanged');
  assert.equal(registerConnector(root, '/y/node'), 'updated');
});

test('connector: register creates .mcp.json when missing and keeps other keys', () => {
  const root = scratch();
  assert.equal(registerConnector(root, '/x/node'), 'added');
  assert.ok(readMcp(root).mcpServers['damex-engine']);
  const other = scratch();
  write(other, '.mcp.json', JSON.stringify({ note: 'keep', mcpServers: {} }));
  registerConnector(other, '/x/node');
  assert.equal(readMcp(other).note, 'keep');
});

test('connector: a moved folder is caught by the probe and fixed by registering again', async () => {
  const root = scratch(), oldRoot = scratch();
  copyConnector(STUDIO, oldRoot);
  copyConnector(STUDIO, root);
  registerConnector(oldRoot, process.execPath);
  fs.cpSync(path.join(oldRoot, '.mcp.json'), path.join(root, '.mcp.json'));   // still points at oldRoot
  fs.rmSync(oldRoot, { recursive: true });
  assert.equal((await probeConnector(root)).ok, false);
  const report = await buildReport({ root });
  const stale = report.checks.find((c) => c.id === 'brief-page');
  assert.equal(stale.tier, 'capability'); assert.equal(stale.status, 'skip');
  assert.match(stale.fix, /start step again/);
  assert.match(stale.fix, /powershell -ExecutionPolicy Bypass -File setup\\start\.ps1/);
  assert.equal(registerConnector(root, process.execPath), 'updated');
  const p = await probeConnector(root);
  assert.equal(p.ok, true); assert.equal(p.tools.length, 7);
  const fixed = (await buildReport({ root })).checks.find((c) => c.id === 'brief-page');
  assert.equal(fixed.status, 'pass'); assert.equal(fixed.found, "the brief page's connector starts (7 tools)");
});

test('connector: probe resolves with ok false for a missing entry, bad command, bad output and timeout', async () => {
  const root = scratch();
  assert.equal((await probeConnector(root)).ok, false);            // no .mcp.json
  write(root, '.mcp.json', '{ not json');
  assert.equal((await probeConnector(root)).ok, false);            // unreadable
  write(root, '.mcp.json', JSON.stringify({ mcpServers: {} }));
  assert.equal((await probeConnector(root)).ok, false);            // no entry
  write(root, '.mcp.json', JSON.stringify({ mcpServers: { 'damex-engine': { type: 'stdio', command: '/no/such/node', args: [] } } }));
  assert.equal((await probeConnector(root)).ok, false);            // command does not exist
  write(root, 'junk.mjs', 'console.log("not json"); setInterval(() => {}, 1000);');
  write(root, '.mcp.json', JSON.stringify({ mcpServers: { 'damex-engine': { type: 'stdio', command: process.execPath, args: [path.join(root, 'junk.mjs')] } } }));
  assert.equal((await probeConnector(root, { timeoutMs: 3000 })).ok, false);   // bad JSON from the server
  write(root, 'slow.mjs', 'setInterval(() => {}, 1000);');
  write(root, '.mcp.json', JSON.stringify({ mcpServers: { 'damex-engine': { type: 'stdio', command: process.execPath, args: [path.join(root, 'slow.mjs')] } } }));
  const t = await probeConnector(root, { timeoutMs: 400 });
  assert.equal(t.ok, false); assert.match(t.error, /time/i);
});

test('connector: the Node it registers is the studio\'s own, else the one on PATH (as found there), else this one', () => {
  const has = (...hits) => (p) => hits.includes(p);
  const mac = { platform: 'darwin', execPath: '/run/node' };
  assert.equal(connectorNode('/studio', { ...mac, env: { PATH: '/usr/local/bin' }, exists: has('/studio/.runtime/node/bin/node', '/usr/local/bin/node') }), '/studio/.runtime/node/bin/node');
  assert.equal(connectorNode('/studio', { ...mac, env: { PATH: '/nope:/opt/homebrew/bin' }, exists: has('/opt/homebrew/bin/node') }), '/opt/homebrew/bin/node');
  assert.equal(connectorNode('/studio', { ...mac, env: { PATH: '/nope' }, exists: has() }), '/run/node');
  const win = { platform: 'win32', execPath: 'C:\\run\\node.exe' };
  assert.equal(connectorNode('C:\\studio', { ...win, env: { PATH: 'C:\\nodejs', PATHEXT: '.EXE' }, exists: has('C:\\studio\\.runtime\\node\\node.exe', 'C:\\nodejs\\node.EXE') }), 'C:\\studio\\.runtime\\node\\node.exe');
  assert.equal(connectorNode('C:\\studio', { ...win, env: { PATH: 'C:\\nodejs', PATHEXT: '.EXE' }, exists: has('C:\\nodejs\\node.EXE') }), 'C:\\nodejs\\node.EXE');
});

test('connector: register with no Node given uses the studio\'s own Node when it is there', { skip: process.platform === 'win32' }, () => {
  const root = scratch();
  write(root, '.runtime/node/bin/node', '#!/bin/sh\n');
  registerConnector(root);
  assert.equal(readMcp(root).mcpServers['damex-engine'].command, path.join(root, '.runtime', 'node', 'bin', 'node'));
});
