#!/usr/bin/env node
// Approval receipts. An approval holds while the files it covered are unchanged.
//   gate.mjs approve <job_dir> <gate> --inputs a,b [--by owner] [--mode guided|grouped] [--folds g1,g2]
//   gate.mjs check   <job_dir> <gate>      exit 0 satisfied, 3 stale (inputs changed), 1 missing
//   gate.mjs status  <job_dir> [--mode m]  one line per gate
// Inputs are paths relative to the job folder; folders are hashed recursively. Only run approve after a person said yes.
import path from 'node:path';
import { approve, check, status } from './lib/receipts.mjs';
import { csv, parseArgs, usageExit } from './lib/util.mjs';

const USAGE = `gate.mjs approve <job_dir> <gate> --inputs a,b [--by owner] [--mode guided|grouped] [--folds g1,g2]
gate.mjs check <job_dir> <gate>      (exit 0 satisfied, 3 stale, 1 missing)
gate.mjs status <job_dir> [--mode guided|grouped]`;
try {
  const a = parseArgs(process.argv.slice(2));
  const [cmd, job, gate] = a._;
  if (!cmd || !job) usageExit(USAGE, cmd ? 2 : 0);
  const dir = path.resolve(job);
  if (cmd === 'approve') {
    if (!gate) usageExit(USAGE);
    const r = approve(dir, gate, { inputs: csv(a.inputs), by: a.by || 'owner', mode: a.mode || null, folds: csv(a.folds) });
    console.log(`APPROVED ${gate} by ${r.by} (${r.files} files, ${r.hash.slice(0, 12)}, mode ${r.mode})`);
  } else if (cmd === 'check') {
    if (!gate) usageExit(USAGE);
    const r = check(dir, gate);
    const via = r.via ? ` (via ${r.via})` : '';
    if (r.state === 'ok') { console.log(`OK ${gate}${via}: approved ${r.receipt.approved_at}`); process.exit(0); }
    if (r.state === 'stale') { console.log(`STALE ${gate}${via}: inputs changed since approval; ask again`); process.exit(3); }
    console.log(`MISSING ${gate}: no approval recorded`); process.exit(1);
  } else if (cmd === 'status') {
    const s = status(dir, a.mode);
    console.log(`mode: ${s.mode}`);
    for (const r of s.rows) console.log(`${r.id.padEnd(18)} ${r.state.toUpperCase().padEnd(8)} ${r.state === 'missing' ? (r.optional ? 'optional' : '') : `${r.via ? `via ${r.via}, ` : ''}${r.receipt.approved_at} by ${r.receipt.by}`}`.trimEnd());
  } else usageExit(USAGE);
} catch (e) { console.error(e.message); process.exit(2); }
