// Shared helpers: policy, atomic JSON writes, a small cross-process lock, argument parsing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../../..');
export const policy = () => JSON.parse(fs.readFileSync(path.join(HERE, '..', 'policy.json'), 'utf8'));

export function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return fallback; throw new Error(`${file} cannot be read: ${e.message}`); }
}
/** Write to a temp file in the same folder, then rename: a reader sees the old file or the new one, never half. */
export function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmp, file);
}

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const alive = (pid) => { if (!Number.isInteger(pid) || pid <= 0) return false; try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };

/** Run fn while holding <dir>/.conductor.lock (a folder; mkdir is all-or-nothing). A lock whose process has ended is cleared. */
export function withLock(dir, fn, { waitMs = 10000 } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const lock = path.join(dir, '.conductor.lock');
  const until = Date.now() + waitMs;
  for (;;) {
    try { fs.mkdirSync(lock); fs.writeFileSync(path.join(lock, 'pid'), String(process.pid)); break; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let pid = null; let age = 0;
      try { pid = Number(fs.readFileSync(path.join(lock, 'pid'), 'utf8')) || null; } catch {}
      try { age = (Date.now() - fs.statSync(lock).mtimeMs) / 1000; } catch { continue; }
      if ((pid && !alive(pid)) || (!pid && age > 30)) {
        const tomb = `${lock}.stale-${process.pid}-${Date.now()}`;
        try { fs.renameSync(lock, tomb); fs.rmSync(tomb, { recursive: true, force: true }); } catch {}
        continue;
      }
      if (Date.now() > until) throw new Error(`The job is locked by process ${pid || 'unknown'}; try again.`);
      sleep(50);
    }
  }
  try { return fn(); } finally { fs.rmSync(lock, { recursive: true, force: true }); }
}

/** { _: positionals, flag: value | true }. Names in `bools` take no value. */
export function parseArgs(argv, bools = []) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      if (bools.includes(k)) out[k] = true;
      else { if (i + 1 >= argv.length) throw new Error(`--${k} needs a value`); out[k] = argv[++i]; }
    } else out._.push(a);
  }
  return out;
}
export const csv = (s) => (s ? String(s).split(',').map((x) => x.trim()).filter(Boolean) : []);
export const usageExit = (text, code = 2) => { console.log(text); process.exit(code); };
export const isMain = (url) => process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(url);
