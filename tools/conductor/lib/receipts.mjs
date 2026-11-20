// Approval receipts: an approval is kept with a hash of the files it covered, so it holds only while they are unchanged.
// jobs/<job>/receipts.json: { version, mode, gates: { <gate>: { approved_at, by, mode, inputs, hash, folds } } }
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { policy, readJson, writeJsonAtomic, withLock } from './util.mjs';

const SKIP = new Set(['.DS_Store']);
const rel = (jobDir, p) => path.relative(jobDir, p).split(path.sep).join('/');

function walk(p, out) {
  const st = fs.statSync(p);
  if (st.isDirectory()) { for (const n of fs.readdirSync(p).sort()) if (!SKIP.has(n)) walk(path.join(p, n), out); } else out.push(p);
}

/** sha256 over the sorted input files. Folders are hashed recursively; each file counts by its path relative to the job. */
export function hashInputs(jobDir, inputs) {
  const files = new Set(); const missing = [];
  for (const i of inputs) {
    const abs = path.resolve(jobDir, i);
    if (!fs.existsSync(abs)) { missing.push(rel(jobDir, abs)); continue; }
    const list = []; walk(abs, list); list.forEach((f) => files.add(f));
  }
  const lines = [...files].map((f) => `${rel(jobDir, f)}\0${crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')}`).sort();
  for (const m of missing.sort()) lines.push(`${m}\0MISSING`);
  return { hash: crypto.createHash('sha256').update(lines.join('\n')).digest('hex'), files: files.size, missing };
}

export const receiptsPath = (jobDir) => path.join(jobDir, 'receipts.json');
export const load = (jobDir) => readJson(receiptsPath(jobDir), { version: 1, mode: null, gates: {} });

export function gatesFor(mode) {
  const m = policy().approval_modes[mode];
  if (!m) throw new Error(`Unknown mode "${mode}". Modes: ${Object.keys(policy().approval_modes).join(', ')}`);
  return m.gates;
}
export function modeOf(jobDir, given) {
  if (given) return given;
  const r = load(jobDir); if (r.mode) return r.mode;
  return readJson(path.join(jobDir, 'job.json'), {})?.approval_mode || 'guided';
}

/**
 * Inputs are paths inside the job. Also accept the same file written from the studio folder (`jobs/<job>/a.md`) or as
 * an absolute path, as long as it lies inside the job: it is stored job-relative. Anything else is left as given (and
 * reported missing if it is not in the job).
 */
function inJob(jobDir, i) {
  if (fs.existsSync(path.resolve(jobDir, i))) return i;
  const abs = path.resolve(i); const root = path.resolve(jobDir);
  if (fs.existsSync(abs) && (abs === root || abs.startsWith(root + path.sep))) return rel(root, abs) || '.';
  return i;
}

export function approve(jobDir, gate, { inputs, by = 'owner', mode = null, folds = [] }) {
  if (!fs.existsSync(jobDir)) throw new Error(`No job folder ${jobDir}`);
  if (!inputs?.length) throw new Error('approve needs --inputs a,b (the files this approval covers)');
  inputs = inputs.map((i) => inJob(jobDir, i));
  const h = hashInputs(jobDir, inputs);
  if (h.missing.length) throw new Error(`Cannot approve: input not found: ${h.missing.join(', ')}`);
  return withLock(jobDir, () => {
    const r = load(jobDir);
    const m = mode || r.mode || 'guided';
    const def = gatesFor(m).find((g) => g.id === gate);
    r.mode = m; r.version = 1;
    r.gates[gate] = { approved_at: new Date().toISOString(), by, mode: m, inputs: inputs.map((i) => rel(jobDir, path.resolve(jobDir, i))).sort(), hash: h.hash, files: h.files, folds: [...new Set([...(def?.folds || []), ...folds])] };
    writeJsonAtomic(receiptsPath(jobDir), r);
    return r.gates[gate];
  });
}

const valid = (jobDir, rec) => rec && hashInputs(jobDir, rec.inputs).hash === rec.hash;

/** { state: 'ok' | 'stale' | 'missing', via?, receipt? }. A gate is also satisfied by a valid receipt that folds it in. */
export function check(jobDir, gate) {
  const r = load(jobDir); const own = r.gates[gate];
  if (valid(jobDir, own)) return { state: 'ok', receipt: own };
  for (const [g, rec] of Object.entries(r.gates)) if (g !== gate && rec.folds?.includes(gate) && valid(jobDir, rec)) return { state: 'ok', via: g, receipt: rec };
  if (own) return { state: 'stale', receipt: own };
  for (const [g, rec] of Object.entries(r.gates)) if (rec.folds?.includes(gate)) return { state: 'stale', via: g, receipt: rec };
  return { state: 'missing' };
}

export function status(jobDir, mode) {
  const m = modeOf(jobDir, mode); const defs = gatesFor(m);
  const extra = Object.keys(load(jobDir).gates).filter((g) => !defs.some((d) => d.id === g)).map((id) => ({ id, stage: '-' }));
  return { mode: m, rows: [...defs, ...extra].map((d) => ({ ...d, ...check(jobDir, d.id) })) };
}
