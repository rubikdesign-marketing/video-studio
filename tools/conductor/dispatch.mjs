#!/usr/bin/env node
// Allow or stop a dispatch, and recover after a restart. Ledger: <job_dir>/dispatch.jsonl (append-only).
//   dispatch.mjs claim   <job_dir> --stage s --task t --worker name --model alias --writes p1,p2 [--paid]
//        prints "ALLOW <id>" (exit 0) or "STOP <reason>" (exit 4)
//   dispatch.mjs release <job_dir> <id> --status done|failed|partial [--tokens N | in:out]
//   dispatch.mjs resume  <job_dir> [--mode guided|grouped]
//   dispatch.mjs usage   <job_dir> [--json]
// Tokens are "not recorded" unless a release supplied --tokens. Nothing is estimated.
import path from 'node:path';
import { claim, release, resume, usage } from './lib/dispatch.mjs';
import { csv, parseArgs, usageExit } from './lib/util.mjs';

const USAGE = `dispatch.mjs claim <job_dir> --stage s --task t --worker name --model alias --writes p1,p2 [--paid]
dispatch.mjs release <job_dir> <id> --status done|failed|partial [--tokens N|in:out]
dispatch.mjs resume <job_dir> [--mode guided|grouped]
dispatch.mjs usage <job_dir> [--json]`;

function tokens(s) {
  if (!s) return null;
  const [i, o] = String(s).split(':');
  const inp = Number(i); const out = o === undefined ? null : Number(o);
  if (!Number.isFinite(inp) || (out !== null && !Number.isFinite(out))) throw new Error('--tokens is N or in:out');
  return out === null ? { total: inp } : { input: inp, output: out, total: inp + out };
}

try {
  const a = parseArgs(process.argv.slice(2), ['paid', 'json']);
  const [cmd, job, id] = a._;
  if (!cmd || !job) usageExit(USAGE, cmd ? 2 : 0);
  const dir = path.resolve(job);
  if (cmd === 'claim') {
    const r = claim(dir, { stage: a.stage, task: a.task, worker: a.worker, model: a.model, writes: csv(a.writes), paid: !!a.paid });
    if (r.ok) console.log(`ALLOW ${r.id}`); else { console.log(`STOP ${r.reason}`); process.exit(4); }
  } else if (cmd === 'release') {
    if (!id || !a.status) usageExit(USAGE);
    const c = release(dir, id, a.status, { tokens: tokens(a.tokens) });
    console.log(`RELEASED ${id} ${a.status}${a.status === 'partial' ? ` (outputs kept: ${c.writes.join(', ') || 'none declared'}; counts toward the retry cap)` : ''}`);
  } else if (cmd === 'resume') {
    const r = resume(dir, { mode: a.mode || null });
    console.log(`RESUME mode ${r.mode}`);
    if (!r.interrupted.length) console.log('interrupted: none');
    for (const c of r.interrupted) console.log(`interrupted ${c.id} stage=${c.stage} task=${c.task} worker=${c.worker}; partial work preserved at: ${c.writes.join(', ') || '(no write set declared)'}; retries left: ${c.retries_left}`);
    if (r.interrupted.length) console.log('Keep that partial work. Look at it before any retry; do not delete it.');
    console.log(`gates already satisfied (skipped): ${r.skipped.join(', ') || 'none'}`);
    console.log(`NEXT: ${r.next}`);
  } else if (cmd === 'usage') {
    const u = usage(dir);
    if (a.json) { console.log(JSON.stringify(u, null, 2)); process.exit(0); }
    console.log(`claims: ${u.claims}`);
    for (const r of u.rows) {
      const tk = r.token_claims ? `${r.tokens}${r.token_claims < r.claims ? ` (recorded for ${r.token_claims} of ${r.claims})` : ''}` : 'not recorded';
      console.log(`${r.stage.padEnd(16)} ${r.model.padEnd(8)} claims ${r.claims} (done ${r.done}, failed ${r.failed}, partial ${r.partial}, interrupted ${r.interrupted}, active ${r.active})  elapsed ${r.seconds}s  tokens ${tk}`);
    }
  } else usageExit(USAGE);
} catch (e) { console.error(e.message); process.exit(2); }
