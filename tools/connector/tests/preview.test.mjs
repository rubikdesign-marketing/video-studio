// The preview server (tools/connector/preview.mjs) runs the real connector handlers, so it answers only this machine's
// own page: the right Host, JSON posts, no foreign Origin. It needs a studio named, or --scratch for a throwaway one.
// Binding a local port can be blocked (a sandbox): those tests skip then.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scratchStudio } from '../../plan/tests/helpers.mjs';

const PREVIEW = fileURLToPath(new URL('../preview.mjs', import.meta.url));

const bindBlocked = () => new Promise((resolve) => {
  const s = net.createServer();
  s.once('error', (e) => resolve(e.code || 'error'));
  s.listen(0, '127.0.0.1', () => s.close(() => resolve(null)));
});

/** Starts the preview; resolves with { child, port, root, out } once it prints its address, or { code, err } if it exits. */
function start(args, env = {}) {
  const e = { ...process.env, ...env };
  if (!('DAMEX_STUDIO_ROOT' in env)) delete e.DAMEX_STUDIO_ROOT;
  const child = spawn(process.execPath, [PREVIEW, ...args], { env: e, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  return new Promise((resolve) => {
    child.stdout.on('data', (d) => {
      out += d;
      const m = /http:\/\/127\.0\.0\.1:(\d+)\/ \(studio: (.+)\)/.exec(out);
      if (m) resolve({ child, port: Number(m[1]), root: m[2], out });
    });
    child.stderr.on('data', (d) => { err += d; });
    child.on('exit', (code) => resolve({ code, err }));
  });
}

function call(port, { method = 'GET', url = '/', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: url, headers }, (res) => {
      let text = '';
      res.on('data', (d) => { text += d; });
      res.on('end', () => resolve({ status: res.statusCode, text }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

test('preview: refuses to start without a studio named, with a one-line hint', async () => {
  const r = await start(['--port', '0']);
  r.child?.kill(); // an old preview that starts anyway must not keep the test run open
  assert.notEqual(r.code, 0);
  assert.match(r.err, /--root/);
  assert.match(r.err, /--scratch/);
  assert.equal(r.err.split('\n').filter((l) => /studio/i.test(l)).length, 1); // one line (a sandbox may add its own noise)
});

test('preview: answers only its own host, JSON posts and its own origin', async (t) => {
  const blocked = await bindBlocked();
  if (blocked) { t.skip(`binding a local port is blocked here (${blocked})`); return; }
  const root = scratchStudio();
  const p = await start(['--root', root, '--port', '0']);
  assert.ok(p.port, p.err);
  t.after(() => p.child.kill());
  const json = { 'content-type': 'application/json' };
  const body = JSON.stringify({ tool: 'studio_context', input: {} });
  assert.equal((await call(p.port)).status, 200);
  assert.equal((await call(p.port, { headers: { host: `localhost:${p.port}` } })).status, 200);
  assert.equal((await call(p.port, { headers: { host: 'studio.example.com' } })).status, 421);
  assert.equal((await call(p.port, { method: 'POST', url: '/call', headers: { host: `evil.example:${p.port}`, ...json }, body })).status, 421);
  assert.equal((await call(p.port, { method: 'POST', url: '/call', headers: { 'content-type': 'text/plain' }, body })).status, 415);
  assert.equal((await call(p.port, { method: 'POST', url: '/call', headers: { origin: 'https://evil.example', ...json }, body })).status, 403);
  const ok = await call(p.port, { method: 'POST', url: '/call', headers: { origin: `http://127.0.0.1:${p.port}`, ...json }, body });
  assert.equal(ok.status, 200);
  assert.deepEqual(JSON.parse(ok.text).payload.brands.map((b) => b.name), ['acme']);
});

test('preview: --scratch runs against a throwaway studio, never this one', async (t) => {
  const blocked = await bindBlocked();
  if (blocked) { t.skip(`binding a local port is blocked here (${blocked})`); return; }
  const p = await start(['--scratch', '--port', '0']);
  assert.ok(p.port, p.err);
  t.after(() => p.child.kill());
  assert.ok([os.tmpdir(), fs.realpathSync(os.tmpdir())].some((t) => p.root.startsWith(t)), p.root);
  const r = await call(p.port, { method: 'POST', url: '/call', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tool: 'brief_start', input: { words: 'a vertical demo for acme' } }) });
  assert.equal(r.status, 200);
  assert.match(JSON.parse(r.text).payload.job, /vertical-demo-acme/);
  assert.notEqual(path.resolve(p.root), path.resolve(fileURLToPath(new URL('../../..', import.meta.url))));
});

test('preview: serves the page and its publish set from the dist folder, and nothing outside it', async (t) => {
  const blocked = await bindBlocked();
  if (blocked) { t.skip(`binding a local port is blocked here (${blocked})`); return; }
  const top = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-dist-'));
  const dist = path.join(top, 'dist');
  fs.mkdirSync(path.join(dist, 'styles'), { recursive: true });
  fs.mkdirSync(path.join(dist, 'previews'), { recursive: true });
  fs.writeFileSync(path.join(dist, 'index.html'), '<title>Dist page</title>\n<script>const x = 1;</script>\n');
  fs.writeFileSync(path.join(dist, 'styles', 'meta.json'), '{"counts":{}}');
  fs.writeFileSync(path.join(dist, 'previews', 'a.mp4'), Buffer.from('0123456789'));
  fs.writeFileSync(path.join(top, 'outside.txt'), 'secret');
  const p = await start(['--root', scratchStudio(), '--dist', dist, '--port', '0']);
  assert.ok(p.port, p.err);
  t.after(() => p.child.kill());
  const page = await call(p.port);
  assert.equal(page.status, 200);
  assert.match(page.text, /Dist page/);
  assert.match(page.text, /window\.claude = /); // the stand-in is still put in front of the page's script
  const meta = await call(p.port, { url: '/styles/meta.json' });
  assert.equal(meta.status, 200);
  assert.deepEqual(JSON.parse(meta.text), { counts: {} });
  const part = await call(p.port, { url: '/previews/a.mp4', headers: { range: 'bytes=2-4' } });
  assert.equal(part.status, 206);
  assert.equal(part.text, '234');
  assert.equal((await call(p.port, { url: '/styles/../../outside.txt' })).status, 404);
  assert.equal((await call(p.port, { url: '/%2e%2e/outside.txt' })).status, 404);
  assert.equal((await call(p.port, { url: '/styles/missing.json' })).status, 404);
});
