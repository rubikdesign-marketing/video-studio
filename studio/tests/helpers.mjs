// Shared by the server tests: a temporary studio folder with one small job in it, and the real server started
// on a spare port against that folder (STUDIO_ROOT), so no real job is ever read or changed.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server.mjs');

export const film = () => ({
  job: 'demo', slug: 'demo', fps: 30, width: 1920, height: 1080, brand: 'tulvo', preset: 'confident', stage: 'dark', duration: 8,
  audio: 'jobs/demo/audio.wav',
  scenes: [
    { id: 'S01', title: 'Opening', start: 0, end: 3, energy: 3,
      lines: [{ id: '01', start: 0.2, end: 2.8, text: 'Meet [warm] Toolvo today.' }],
      texts: [{ lines: ['A *sample* film.'], at: 0.3, out: 2.5 }] },
    { id: 'S02', title: 'Closing', start: 3, end: 8, energy: 5,
      lines: [{ id: '02', start: 3.2, end: 7.5, text: 'That is all.' }],
      texts: [{ lines: ['First cue.'], at: 0.2, out: 2 }, { lines: ['Second', 'cue here.'], at: 2.5, out: 4.5 }] },
  ],
});

/** The bytes of the pretend film: 0, 1, 2 ... so a byte range can be checked exactly. */
export const videoBytes = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 256));

export function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-server-test-'));
  const write = (rel, data) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data, null, 1)); return f; };
  write('jobs/demo/job.json', { name: 'Demo film', type: 'promo', stage_next: 'review' });
  write('jobs/demo/out/preview.mp4', videoBytes);
  write('jobs/demo/out/raw.mp4', videoBytes);                       // never listed as a version
  write('jobs/novideo/job.json', { name: 'No video yet' });         // a job with nothing rendered
  write('engine/src/jobs/demo/film.json', film());
  return { root, write, path: (rel) => path.join(root, rel), read: (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')), remove: () => fs.rmSync(root, { recursive: true, force: true }) };
}

const sparePort = () => new Promise((resolve, reject) => {
  const s = net.createServer(); s.unref(); s.on('error', reject);
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

/** Starts the server and resolves once it is listening. `env` adds to the environment. */
export async function startServer(root, env = {}) {
  const port = await sparePort();
  const child = spawn(process.execPath, [SERVER, String(port)], { env: { ...process.env, STUDIO_ROOT: root, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let errors = '';
  child.stderr.on('data', (d) => { errors += d; });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`The server did not start. ${errors}`)), 10000);
    child.stdout.on('data', (d) => { if (String(d).includes(String(port))) { clearTimeout(timer); resolve(); } });
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`The server stopped with code ${code}. ${errors}`)); });
  });
  const base = `http://127.0.0.1:${port}`;
  return {
    base, port,
    get: (p, init) => fetch(base + p, init),
    post: (p, data) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    stop: () => new Promise((resolve) => { child.once('exit', resolve); child.kill(); }),
  };
}
