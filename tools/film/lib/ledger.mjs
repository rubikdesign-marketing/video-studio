// The paid-generation ledger: every chargeable request is written down before it is sent, and its provider task id the
// moment it comes back. A retry with the same settings looks here first, so a crash, a closed session or a re-run never
// pays twice for the same thing.
//
// One studio-wide file, .generations/ledger.json (never synced): { requests: { <key>: entry } }.
// entry: { key, provider, kind, route, job, take, units, status, task_id, external_id, sent_at, updated_at, message, outputs }
// status: sending (written before the request; no answer yet) | submitted | running | succeeded | failed | refused
//
// The key is a hash of the provider, the route, the request body (images included) and the take number. Asking for
// another take of the same settings is a deliberate choice: pass a new take number.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ledgerPath = (studio) => process.env.VIDEO_STUDIO_LEDGER || path.join(studio, '.generations', 'ledger.json');

const stable = (v) => (Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])])) : v);

export function requestKey({ provider, route, body, take = 1 }) {
  return crypto.createHash('sha256').update(JSON.stringify(stable({ provider, route, body, take: Number(take) }))).digest('hex').slice(0, 24);
}

export function load(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return { requests: {} }; throw new Error(`The generation ledger ${file} could not be read (${e.message}). Fix or move it before sending paid requests.`); }
}

function save(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  fs.renameSync(tmp, file);
}

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** Holds <file>.lock (a folder) while fn runs, so two tools updating the ledger at once never lose an entry. */
function locked(file, fn) {
  const lock = `${file}.lock`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let i = 0; ; i++) {
    try { fs.mkdirSync(lock); break; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      // A ledger update takes milliseconds: a lock older than 30 s was left by a killed process.
      try { if (Date.now() - fs.statSync(lock).mtimeMs > 30_000) { fs.rmSync(lock, { recursive: true, force: true }); continue; } } catch {}
      if (i > 1500) throw new Error(`The generation ledger is locked (${lock}). If nothing is running, delete that folder.`);
      sleep(20);
    }
  }
  try { return fn(); } finally { fs.rmSync(lock, { recursive: true, force: true }); }
}

/** Merge a patch into one entry, re-reading the file under the ledger's lock so concurrent tools keep every entry. */
export function update(file, key, patch) {
  return locked(file, () => {
    const data = load(file);
    data.requests[key] = { ...(data.requests[key] || { key }), ...patch, updated_at: new Date().toISOString() };
    save(file, data);
    return data.requests[key];
  });
}

/**
 * Marks a request as being sent, but only if it may still be sent (checked again under the lock, so two runs of the same
 * request at the same moment cannot both pay). force: send even an unanswered one (--resend). Returns { ok, why }.
 */
export function claim(file, key, patch, { force = false } = {}) {
  return locked(file, () => {
    const data = load(file);
    const prior = data.requests[key];
    const d = decide(prior);
    if (!d.send && !(force && prior?.status === 'sending')) return { ok: false, why: d.why, task_id: d.task_id };
    data.requests[key] = { ...(prior || { key }), ...patch, updated_at: new Date().toISOString() };
    save(file, data);
    return { ok: true };
  });
}

export const findByTask = (data, taskId) => Object.values(data.requests).find((e) => e.task_id === taskId) || null;

/**
 * Whether a request may be sent. { send: true } or { send: false, why, task_id }.
 * A failed or refused request may be sent again (nothing came of it). One that was sent without an answer may have been
 * charged, so it is never re-sent on its own: the person checks the provider's task list first.
 */
export function decide(entry) {
  if (!entry) return { send: true };
  switch (entry.status) {
    case 'failed': case 'refused':
      return { send: true, why: `the last attempt ${entry.status === 'failed' ? 'failed' : 'was refused'}${entry.message ? ` (${entry.message})` : ''}` };
    case 'sending':
      return { send: false, why: `the same request was sent at ${entry.sent_at} but no task id came back, so it may have been charged. Look for "${entry.external_id || entry.key}" in the provider's task list. If it is not there, send it again with --resend` };
    default:
      return { send: false, task_id: entry.task_id, why: `the same request is already ${entry.status} as task ${entry.task_id}` };
  }
}
