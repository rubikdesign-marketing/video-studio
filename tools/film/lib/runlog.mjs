#!/usr/bin/env node
// The job's run log: one JSON line per render, still batch, master or paid generation, in jobs/<job>/runs.jsonl.
// It is what "time to first preview", "time to revise one shot" and "cost per approved video" are measured from.
//
//   import { record } from './lib/runlog.mjs'; record(jobDir, { tool: 'render', mode: 'preview', seconds: 41.2, ok: true })
//   node tools/film/lib/runlog.mjs add <job_dir> tool=render mode=preview seconds=41.2 ok=true output=out/preview.mp4
//
// Every entry gets "at" (ISO time) and "machine" (so speed figures are only compared on the same Mac).
// Values that look like numbers or true/false are stored as such. Missing counters are left out, never guessed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// No host name: job folders are shared, and the chip and memory are what speed depends on.
export const machine = () => `${os.cpus()[0]?.model || os.arch()}, ${os.cpus().length} cores, ${Math.round(os.totalmem() / 2 ** 30)} GB, ${os.platform()} ${os.release()}`;

export function record(jobDir, entry) {
  if (!jobDir || !fs.existsSync(jobDir)) return;
  const line = JSON.stringify({ at: new Date().toISOString(), machine: machine(), ...entry });
  fs.appendFileSync(path.join(jobDir, 'runs.jsonl'), line + '\n');
}

export function read(jobDir) {
  const file = path.join(jobDir, 'runs.jsonl');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
}

const coerce = (v) => (v === 'true' ? true : v === 'false' ? false : v !== '' && Number.isFinite(Number(v)) ? Number(v) : v);

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, job, ...pairs] = process.argv.slice(2);
  if (cmd !== 'add' || !job) { console.log('node tools/film/lib/runlog.mjs add <job_dir> key=value ...'); process.exit(cmd ? 2 : 0); }
  record(path.resolve(job), Object.fromEntries(pairs.map((p) => { const i = p.indexOf('='); return [p.slice(0, i), coerce(p.slice(i + 1))]; })));
}
