// The dispatch ledger: jobs/<job>/dispatch.jsonl, append-only. One line per event:
//   { event: 'claim', id, at, stage, task, worker, model, writes, paid }
//   { event: 'release', id, at, status: done|failed|partial, tokens? }
//   { event: 'interrupted', id, at }          written by resume for a claim that never got a release
// State is always derived from the lines, so nothing is edited in place. Every decision runs under the job lock.
import fs from 'node:fs';
import path from 'node:path';
import { loadSettings, modelStatus } from './models.mjs';
import { check as gateCheck, status as gateStatus } from './receipts.mjs';
import { policy, withLock } from './util.mjs';

export const ledgerPath = (jobDir) => path.join(jobDir, 'dispatch.jsonl');
export const RELEASE = ['done', 'failed', 'partial'];

export function events(jobDir) {
  const f = ledgerPath(jobDir);
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
}
// A killed writer can leave a last line without its newline. Start a fresh line so the new event is never glued to
// the torn one (events() skips the torn line on its own).
function endsTorn(f) {
  if (!fs.existsSync(f)) return false;
  const size = fs.statSync(f).size;
  if (size === 0) return false;
  const fd = fs.openSync(f, 'r');
  try { const b = Buffer.alloc(1); fs.readSync(fd, b, 0, 1, size - 1); return b[0] !== 0x0a; } finally { fs.closeSync(fd); }
}
const append = (jobDir, ev) => {
  const f = ledgerPath(jobDir);
  fs.appendFileSync(f, (endsTorn(f) ? '\n' : '') + JSON.stringify({ at: new Date().toISOString(), ...ev }) + '\n');
};

/** Claims in order, each with status: active | done | failed | partial | interrupted. */
export function claims(jobDir) {
  const list = []; const byId = new Map();
  for (const e of events(jobDir)) {
    if (e.event === 'claim') { const c = { ...e, status: 'active', released_at: null, tokens: null }; list.push(c); byId.set(e.id, c); }
    else if (e.event === 'release' && byId.has(e.id)) { const c = byId.get(e.id); c.status = e.status; c.released_at = e.at; if (e.tokens) c.tokens = e.tokens; }
    else if (e.event === 'interrupted' && byId.has(e.id) && byId.get(e.id).status === 'active') { const c = byId.get(e.id); c.status = 'interrupted'; c.released_at = e.at; }
  }
  return list;
}

const norm = (p) => p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
export const overlaps = (a, b) => { a = norm(a); b = norm(b); return a === b || a.startsWith(b + '/') || b.startsWith(a + '/'); };

/** Decide and, if allowed, record. Returns { ok: true, id } or { ok: false, reason, code }. */
export function claim(jobDir, { stage, task, worker, model, writes = [], paid = false }, { settings = loadSettings() } = {}) {
  for (const [k, v] of Object.entries({ stage, task, worker, model })) if (!v) throw new Error(`claim needs --${k}`);
  const caps = policy().caps;
  return withLock(jobDir, () => {
    const all = claims(jobDir);
    const stop = (code, reason) => ({ ok: false, code, reason });

    const m = modelStatus(model, settings);
    if (!m.allowed) return stop('model_blocked', `model "${model}" is blocked: ${m.reason}. Not switched to another model. Alternative: do this task in the lead session.`);

    if (paid) {
      const g = gateCheck(jobDir, policy().paid_gate);
      if (g.state !== 'ok') return stop('paid_unapproved', `paid work needs a recorded approval (gate ${policy().paid_gate} is ${g.state}). Ask the owner, then: gate.mjs approve <job_dir> ${policy().paid_gate} --inputs <file naming what may be spent>`);
    }

    const active = all.filter((c) => c.status === 'active');
    if (active.length >= caps.max_active_workers) return stop('active_cap', `active cap: ${active.length} of ${caps.max_active_workers} workers already active (${active.map((c) => `${c.id} ${c.worker}`).join(', ')}). Release one first.`);

    const stageCap = caps.stage_dispatch_cap[stage] ?? caps.stage_dispatch_cap.default;
    const inStage = all.filter((c) => c.stage === stage).length;
    if (inStage >= stageCap) return stop('stage_cap', `stage cap: ${inStage} of ${stageCap} dispatches already used in stage "${stage}".`);

    // Retries: earlier failed, partial or interrupted claims of this task since its last done.
    let tries = 0;
    for (const c of all.filter((x) => x.stage === stage && x.task === task)) tries = c.status === 'done' ? 0 : c.status === 'active' ? tries : tries + 1;
    if (tries >= 1 + caps.max_retries_per_task) return stop('retry_cap', `retry cap: task "${task}" in stage "${stage}" has failed or stopped ${tries} times (limit: 1 try + ${caps.max_retries_per_task} retry). Take it to the lead.`);

    for (const w of writes) for (const c of active) for (const cw of c.writes || []) {
      if (overlaps(w, cw)) return stop('write_overlap', `write overlap: "${w}" collides with "${cw}" held by active claim ${c.id} (${c.worker}, task ${c.task}).`);
    }

    const id = `c${all.length + 1}`;
    append(jobDir, { event: 'claim', id, stage, task, worker, model, writes: writes.map(norm), paid: !!paid });
    return { ok: true, id };
  });
}

export function release(jobDir, id, status, { tokens = null } = {}) {
  if (!RELEASE.includes(status)) throw new Error(`--status must be one of ${RELEASE.join(', ')}`);
  return withLock(jobDir, () => {
    const c = claims(jobDir).find((x) => x.id === id);
    if (!c) throw new Error(`No claim ${id}`);
    if (c.status !== 'active') throw new Error(`Claim ${id} is already ${c.status}`);
    append(jobDir, { event: 'release', id, status, ...(tokens ? { tokens } : {}) });
    return { ...c, status };
  });
}

/** Mark unreleased claims interrupted. Their write sets are partial work to keep. Run once at the start of a session. */
export function resume(jobDir, { mode = null } = {}) {
  const interrupted = withLock(jobDir, () => {
    const act = claims(jobDir).filter((c) => c.status === 'active');
    for (const c of act) append(jobDir, { event: 'interrupted', id: c.id });
    return act;
  });
  const all = claims(jobDir);
  const retriesLeft = (c) => { let tries = 0; for (const x of all.filter((y) => y.stage === c.stage && y.task === c.task)) tries = x.status === 'done' ? 0 : tries + 1; return Math.max(0, 1 + policy().caps.max_retries_per_task - tries); };
  const gates = gateStatus(jobDir, mode);
  const todo = gates.rows.find((r) => r.state !== 'ok' && !r.optional);
  const skipped = gates.rows.filter((r) => r.state === 'ok').map((r) => r.id);
  const next = todo
    ? `run stage "${todo.stage}", then ask the owner to approve "${todo.id}"${todo.state === 'stale' ? ' (its inputs changed since the last approval)' : ''}`
    : 'every gate is satisfied; go to delivery and learning';
  return { mode: gates.mode, interrupted: interrupted.map((c) => ({ ...c, status: 'interrupted', retries_left: retriesLeft(c) })), skipped, next };
}

const secs = (a, b) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 1000));
export function usage(jobDir) {
  const all = claims(jobDir); const rows = {};
  for (const c of all) {
    const k = `${c.stage}\t${c.model}`;
    const r = (rows[k] ||= { stage: c.stage, model: c.model, claims: 0, done: 0, failed: 0, partial: 0, interrupted: 0, active: 0, seconds: 0, tokens: 0, token_claims: 0 });
    r.claims++; r[c.status]++;
    if (c.released_at) r.seconds += secs(c.at, c.released_at);
    if (c.tokens) { r.tokens += c.tokens.total; r.token_claims++; }
  }
  return { claims: all.length, rows: Object.values(rows).sort((a, b) => a.stage.localeCompare(b.stage) || a.model.localeCompare(b.model)) };
}
