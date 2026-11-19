// The render lock, shared by every tool that starts a Remotion bundle (render.sh speaks the same format).
//
// The lock is a folder, engine/out/.render.lock: making a folder either works or fails, never half. Inside it:
//   pid         the holder's process id (render.sh reads only this)
//   owner.json  { pid, tool, job, started }   so a person can see who holds it
//
// A lock is stale, and is cleared without asking, when its holder's process no longer exists, or when it has no pid
// file and is older than STALE_EMPTY_SECONDS (a holder writes its pid the moment it makes the folder, so an empty lock
// that old was left by a process killed in between). A process we may not signal (EPERM) is treated as alive.
import fs from 'node:fs';
import path from 'node:path';

export const STALE_EMPTY_SECONDS = 30;
// A live-looking holder older than this is taken to be a reused process id (the render was killed and the number was
// given to another program). The longest render on record is well under an hour.
export const STALE_HELD_SECONDS = 6 * 3600;

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** Is this process alive? EPERM means it exists but belongs to someone we may not signal. */
export function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

/** Who holds the lock, or null. { pid, tool, job, started, stale, why } */
export function holder(lock, { now = Date.now() } = {}) {
  let stat;
  try { stat = fs.statSync(lock); } catch { return null; }
  let owner = {};
  try { owner = JSON.parse(fs.readFileSync(path.join(lock, 'owner.json'), 'utf8')); } catch {}
  let pid = owner.pid;
  try { pid = Number(fs.readFileSync(path.join(lock, 'pid'), 'utf8').trim()) || pid; } catch {}
  const age = (now - stat.mtimeMs) / 1000;
  if (!pid) {
    const stale = age > STALE_EMPTY_SECONDS;
    return { ...owner, pid: null, stale, why: stale ? `no owner recorded and ${Math.round(age)} s old` : 'being taken' };
  }
  const started = owner.started ? Date.parse(owner.started) : stat.mtimeMs;
  if (alive(pid) && (now - started) / 1000 <= STALE_HELD_SECONDS) return { ...owner, pid, stale: false, why: `process ${pid} is running` };
  return { ...owner, pid, stale: true, why: alive(pid) ? `held for over ${STALE_HELD_SECONDS / 3600} hours, so process ${pid} is not the render that took it` : `process ${pid} has ended` };
}

/**
 * Take the lock, waiting while another live render holds it. Returns release().
 * wait: false gives up at once and returns null if the lock is held.
 */
export function acquire(lock, { tool = 'unknown', job = null, wait = true, every = 2000, log = (m) => console.log(m) } = {}) {
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  let told = false;
  for (;;) {
    try {
      fs.mkdirSync(lock);
      fs.writeFileSync(path.join(lock, 'pid'), String(process.pid));
      fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, tool, job, started: new Date().toISOString() }));
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const h = holder(lock);
      if (h?.stale) {
        // Move it aside first: only one waiting render can win the rename, and if the lock was taken afresh in the
        // meantime (its pid is not the one judged stale) it goes back untouched.
        const tomb = `${lock}.stale-${process.pid}-${Date.now()}`;
        try { fs.renameSync(lock, tomb); } catch { continue; }
        let pidNow = null; try { pidNow = Number(fs.readFileSync(path.join(tomb, 'pid'), 'utf8').trim()) || null; } catch {}
        if (pidNow !== (h.pid || null)) { try { fs.renameSync(tomb, lock); } catch {} continue; }
        fs.rmSync(tomb, { recursive: true, force: true });
        log(`Cleared a render lock left behind (${h.why}).`);
        continue;
      }
      if (!wait) return null;
      if (!told) { log(`Another render is running (${h ? `${h.tool || 'a render'}${h.job ? ` for ${h.job}` : ''}, ${h.why}` : 'starting'}). Waiting for it to finish.`); told = true; }
      sleep(every);
    }
  }
  let released = false;
  const release = () => {
    if (released) return; released = true;
    try { if (Number(fs.readFileSync(path.join(lock, 'pid'), 'utf8')) === process.pid) fs.rmSync(lock, { recursive: true, force: true }); } catch {}
  };
  process.on('exit', release);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.once(sig, () => { release(); process.exit(130); });
  return release;
}
