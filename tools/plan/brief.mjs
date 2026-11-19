#!/usr/bin/env node
// The brief: what the creator asked for, in their words and in decisions, kept in jobs/<job>/brief.json.
//
//   brief.mjs new <job_dir> "<the creator's own description>"   starts brief.json from templates/brief.json
//   brief.mjs check <job_dir> [--json]    the questions that would change the film (at most three, most consequential
//                                         first) and the shots that cannot yet prove what they promise
//   brief.mjs show <job_dir>              the short version for a stage session: brief, decisions, open revision notes
//   brief.mjs decide <job_dir> "<what was decided>" [--applies S03,S04] [--by owner]
//                                         records an answer once, for every later stage
//
// The questions are worded for a person; Claude asks them in its own words, with the recommended answer, and only
// these. Anything the studio can look up or decide on its own is not asked.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assumptions, questions, shotProblems, summary } from './lib/brief.mjs';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [cmd, jobArg, ...rest] = process.argv.slice(2);
const flag = (name) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : undefined; };
if (!cmd || !jobArg) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 14).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(cmd ? 2 : 0); }
const jobDir = path.resolve(jobArg);
const file = path.join(jobDir, 'brief.json');
const read = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
const write = (data) => { fs.writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 1) + '\n'); fs.renameSync(`${file}.tmp`, file); };

if (cmd === 'new') {
  if (fs.existsSync(file)) { console.log(`${path.relative(STUDIO, file)} exists already; edit it, or use decide.`); process.exit(1); }
  fs.mkdirSync(jobDir, { recursive: true });
  const t = read(path.join(STUDIO, 'templates', 'brief.json'));
  delete t._about;
  t.in_their_words = rest.filter((a) => !a.startsWith('--')).join(' ');
  write(t);
  console.log(`Started ${path.relative(STUDIO, file)}. Next: node tools/plan/brief.mjs check ${jobArg}`);
  process.exit(0);
}

const brief = read(file);
if (!brief) { console.log(`No brief yet. Start one: node tools/plan/brief.mjs new ${jobArg} "<the creator's description>"`); process.exit(1); }
const job = read(path.join(jobDir, 'job.json')) || {};
const shots = read(path.join(jobDir, 'shots.json'));
const revisions = read(path.join(jobDir, 'revisions.json'));

if (cmd === 'decide') {
  const what = rest.filter((a, i) => !a.startsWith('--') && !rest[i - 1]?.startsWith('--')).join(' ');
  if (!what) { console.log('What was decided?'); process.exit(2); }
  brief.decisions = [...(brief.decisions || []), { what, by: flag('by') || 'owner', date: new Date().toISOString().slice(0, 10), applies_to: flag('applies') ? flag('applies').split(',') : 'all' }];
  write(brief);
  console.log(`Recorded: ${what}`);
} else if (cmd === 'check') {
  const q = questions(brief, { job });
  const p = shots ? shotProblems(brief, shots) : [];
  const a = assumptions(brief);
  if (rest.includes('--json')) { console.log(JSON.stringify({ assumed: a, questions: q, shot_problems: p }, null, 1)); process.exit(0); }
  if (a.length) console.log(`Taken from their words (say it back; they can correct it): ${a.map((x) => `${x.id} ${x.value} ("${x.because}")`).join(', ')}.\n`);
  if (q.length) {
    console.log(`Ask${q.length > 3 ? ' these three first' : ''}:`);
    for (const x of q.slice(0, 3)) console.log(`  - ${x.question}\n    why: ${x.why}${x.recommended ? `\n    recommended: ${x.recommended}` : ''}`);
    if (q.length > 3) console.log(`  (${q.length - 3} more after these: ${q.slice(3).map((x) => x.id).join(', ')})`);
  } else console.log('Nothing in the brief needs asking.');
  if (shots) {
    if (p.length) { console.log(`\nShots that cannot yet prove what they promise (${p.length}):`); for (const x of p) console.log(`  - ${x.where}: ${x.what}. ${x.fix}.`); }
    else console.log('\nEvery shot has a point, an eye, and a proof moment where it shows an action.');
  }
  process.exit(q.length || p.length ? 1 : 0);
} else if (cmd === 'show') {
  console.log(summary(brief, { revisions }).join('\n'));
} else { console.log(`Unknown command ${cmd}.`); process.exit(2); }
