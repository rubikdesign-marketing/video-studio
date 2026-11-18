#!/usr/bin/env node
// What a job has cost so far, in time and money, kept apart by kind: AI tokens, paid generation, rendering, retries.
//
//   costs.mjs <job_dir> [--json]
//
// Reads jobs/<job>/runs.jsonl (every render, storyboard and master, written by the tools themselves) and the studio's
// generation ledger (.generations/ledger.json, filtered to this job). AI token use is recorded by the session that did
// the work, when the app shows it:
//   node tools/film/lib/runlog.mjs add <job_dir> tool=ai stage=storyboard input_tokens=... cached_input_tokens=... output_tokens=... model=...
// Anything not recorded is listed as "not recorded", never estimated. Waiting for a person's approval is not machine
// time: it is shown from the approval dates in job.json, apart from everything else.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { read } from './lib/runlog.mjs';
import { ledgerPath, load } from './lib/ledger.mjs';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function costs(jobDir) {
  const job = path.basename(jobDir);
  const runs = read(jobDir);
  const sum = (xs, f) => +xs.reduce((a, x) => a + (Number(f(x)) || 0), 0).toFixed(1);
  const group = (pred) => { const xs = runs.filter(pred); return { runs: xs.length, failed: xs.filter((x) => x.ok === false).length, seconds: sum(xs, (x) => x.seconds) }; };

  const rendering = {
    storyboard: group((r) => r.tool === 'storyboard'),
    preview: group((r) => r.tool === 'render' && r.mode === 'preview'),
    scene: group((r) => r.tool === 'render' && r.mode === 'scene'),
    master: group((r) => r.tool === 'render' && r.mode === 'master'),
  };
  rendering.total_seconds = +Object.values(rendering).reduce((a, g) => a + g.seconds, 0).toFixed(1);
  const firstPreview = runs.find((r) => r.tool === 'render' && r.mode === 'preview' && r.ok);
  const sceneRevisions = runs.filter((r) => r.tool === 'render' && r.mode === 'scene' && r.splice && r.ok).map((r) => r.seconds);

  const ai = runs.filter((r) => r.tool === 'ai');
  const tokens = ai.length ? {
    sessions: ai.length,
    input_tokens: sum(ai, (x) => x.input_tokens), cached_input_tokens: sum(ai, (x) => x.cached_input_tokens), output_tokens: sum(ai, (x) => x.output_tokens),
    by_stage: Object.fromEntries([...new Set(ai.map((x) => x.stage))].map((s) => [s, sum(ai.filter((x) => x.stage === s), (x) => (x.input_tokens || 0) + (x.output_tokens || 0))])),
  } : 'not recorded';

  const gens = Object.values(load(ledgerPath(STUDIO)).requests).filter((e) => e.job === job);
  const generation = gens.length ? {
    requests: gens.length,
    succeeded: gens.filter((e) => e.status === 'succeeded').length,
    failed_or_refused: gens.filter((e) => ['failed', 'refused'].includes(e.status)).length,
    unanswered: gens.filter((e) => e.status === 'sending').length,
    extra_takes: gens.filter((e) => (e.take || 1) > 1).length,
    video_seconds: sum(gens.filter((e) => e.kind === 'video' && e.status !== 'refused'), (e) => e.units?.seconds),
    images: sum(gens.filter((e) => e.kind === 'image' && e.status !== 'refused'), (e) => e.units?.images),
    credits: gens.some((e) => e.credits != null) ? sum(gens, (e) => e.credits) : 'not recorded (the provider does not return it; read it from the account)',
  } : 'none through the ledger';

  let approvals = 'no job.json';
  const jobFile = path.join(jobDir, 'job.json');
  if (fs.existsSync(jobFile)) {
    const j = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
    approvals = Object.fromEntries(Object.entries(j.approvals || {}).map(([k, v]) => [k, v?.date || (v ? 'yes, no date' : 'not yet')]));
  }

  return {
    job, machine: runs.at(-1)?.machine || null,
    time: {
      first_preview_render_seconds: firstPreview?.seconds ?? null,
      one_scene_revisions_seconds: sceneRevisions,
      rendering,
      retries: { failed_renders: runs.filter((r) => r.ok === false).length },
    },
    ai_tokens: tokens,
    paid_generation: generation,
    approvals_waiting_on_a_person: approvals,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  if (!arg) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 12).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(0); }
  const c = costs(path.resolve(arg));
  if (process.argv.includes('--json')) { console.log(JSON.stringify(c, null, 1)); process.exit(0); }
  const r = c.time.rendering;
  const line = (name, g) => `  ${name.padEnd(11)} ${String(g.runs).padStart(3)} runs  ${String(g.seconds).padStart(7)} s${g.failed ? `  (${g.failed} failed)` : ''}`;
  console.log(`${c.job}${c.machine ? ` on ${c.machine}` : ''}`);
  console.log(`Rendering, ${r.total_seconds} s of machine time:`);
  for (const k of ['storyboard', 'preview', 'scene', 'master']) console.log(line(k, r[k]));
  console.log(`First full preview: ${c.time.first_preview_render_seconds ?? 'none yet'} s. One-scene revisions: ${c.time.one_scene_revisions_seconds.length ? c.time.one_scene_revisions_seconds.join(', ') + ' s' : 'none yet'}.`);
  console.log(`AI tokens: ${typeof c.ai_tokens === 'string' ? c.ai_tokens : `${c.ai_tokens.input_tokens} in (${c.ai_tokens.cached_input_tokens} cached), ${c.ai_tokens.output_tokens} out, over ${c.ai_tokens.sessions} sessions`}`);
  const g = c.paid_generation;
  console.log(`Paid generation: ${typeof g === 'string' ? g : `${g.requests} requests (${g.succeeded} succeeded, ${g.failed_or_refused} failed or refused, ${g.unanswered} unanswered, ${g.extra_takes} extra takes), ${g.video_seconds} s of video, ${g.images} images; credits ${g.credits}`}`);
  console.log(`Approvals (time waiting on a person, by date): ${JSON.stringify(c.approvals_waiting_on_a_person)}`);
}
