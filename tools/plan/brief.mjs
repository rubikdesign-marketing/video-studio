#!/usr/bin/env node
// The brief: what the creator asked for, in their words and in decisions, kept in jobs/<job>/brief.json.
//
//   brief.mjs new <job_dir> "<the creator's own description>"   starts brief.json from templates/brief.json and names
//                                         the closest motion-graphics recipe (tools/plan/recipe.mjs)
//   brief.mjs check <job_dir> [--json]    the pre-flight checklist (brand, product, audience, angle, look, hook, type
//                                         with references, delivery), then the questions that would change the film
//                                         (at most three, most consequential first) and the shots that cannot yet
//                                         prove what they promise
//   brief.mjs set <job_dir> <field> <value>   records one answer in brief.json, so check stops asking it.
//                                         kind, for, viewer_should, voice, length_cap_seconds and size are checked
//                                         and normalised; any other field is set as given (dotted fields like
//                                         hook.family; a JSON value for lists, e.g. must_show '[{"what":"…","evidence":"…"}]')
//   brief.mjs plan <job_dir> [--json]     the plan in brief with a timed scene outline, written to jobs/<job>/plan.md;
//                                         refuses until every checklist item is known
//   brief.mjs show <job_dir>              the short version for a stage session: brief, decisions, open revision notes
//   brief.mjs set <job_dir> <field> "<value>"   answers one question from check, so it is not asked again
//                                         fields: kind, for, viewer_should, voice, length_cap_seconds, size
//   brief.mjs pick <job_dir> <tab> <id> [--off]   picks (or with --off removes) one style from the library; a pick that
//                                         clashes with another is refused with the reason
//   brief.mjs direct <job_dir> <parts.json>   records the director's brief (the eight parts and engine) after checking it
//   brief.mjs decide <job_dir> "<what was decided>" [--applies S03,S04] [--by owner]
//                                         records any other answer once, for every later stage
//
// The questions are worded for a person; Claude asks them in its own words, with the recommended answer, and only
// these. Anything the studio can look up or decide on its own is not asked. Nothing is captured, generated or
// proposed until `check` shows all eight items known and the creator has confirmed the plan.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assumptions, checkDirectorBrief, picksOf, preflight, questions, setField, setPick, SETTABLE, shotProblems, summary } from './lib/brief.mjs';
import { decide, loadBrief, loadJob, saveBrief, setDotted, startBrief, studioContext, writePlan } from './lib/brief-store.mjs';
import { loadRecipes, matchRecipes } from './lib/recipes.mjs';

const STUDIO = process.env.BRIEF_STUDIO_ROOT ? path.resolve(process.env.BRIEF_STUDIO_ROOT) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'); // the env var points the tests at a scratch studio
const [cmd, jobArg, ...rest] = process.argv.slice(2);
const flag = (name) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : undefined; };
if (!cmd || !jobArg) {
  const lines = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1);
  console.log(lines.slice(0, lines.findIndex((l) => !l.startsWith('//'))).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(cmd ? 2 : 0);
}
const jobDir = path.resolve(jobArg);
const file = path.join(jobDir, 'brief.json');
const read = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
const context = () => studioContext(STUDIO);

if (cmd === 'new') {
  if (fs.existsSync(file)) { console.log(`${path.relative(STUDIO, file)} exists already; edit it, or use set or decide.`); process.exit(1); }
  const t = startBrief(STUDIO, jobDir, rest.filter((a) => !a.startsWith('--')).join(' '));
  console.log(`Started ${path.relative(STUDIO, file)}. Next: node tools/plan/brief.mjs check ${jobArg}`);
  try {
    const m = matchRecipes(t.in_their_words, loadRecipes());
    const [top, second] = m.ranked;
    if (m.verdict === 'clear') console.log(`Closest motion-graphics recipe: ${top.name} (${top.id}). See it: node tools/plan/recipe.mjs show ${top.id}; use it: node tools/plan/recipe.mjs apply ${jobArg} ${top.id}`);
    else if (m.verdict === 'close') console.log(`Two recipes fit about equally: ${top.id} and ${second.id}. Decide from the brief or ask which: node tools/plan/recipe.mjs match "<their words>"`);
  } catch { /* no recipe catalogue in this copy */ }
  process.exit(0);
}

const brief = loadBrief(jobDir);
if (!brief) { console.log(`No brief yet. Start one: node tools/plan/brief.mjs new ${jobArg} "<the creator's description>"`); process.exit(1); }
const { job } = loadJob(jobDir);
const shots = read(path.join(jobDir, 'shots.json'));
const revisions = read(path.join(jobDir, 'revisions.json'));

const printChecklist = (checks) => {
  console.log(`Pre-flight: ${checks.filter((c) => c.done).length} of ${checks.length} known.`);
  for (const c of checks) console.log(`  [${c.done ? 'x' : ' '}] ${c.label}: ${c.done ? c.known : c.todo}`);
};

if (cmd === 'decide') {
  const what = rest.filter((a, i) => !a.startsWith('--') && !rest[i - 1]?.startsWith('--')).join(' ');
  if (!what) { console.log('What was decided?'); process.exit(2); }
  decide(jobDir, what, { by: flag('by') || 'owner', applies: flag('applies') ? flag('applies').split(',') : 'all' });
  console.log(`Recorded: ${what}`);
} else if (cmd === 'set') {
  const [field, ...words] = rest.filter((a) => !a.startsWith('--'));
  if (!field || !words.length) { console.log('Usage: brief.mjs set <job_dir> <field> <value>'); process.exit(2); }
  const raw = words.join(' ');
  let next;
  if (SETTABLE.includes(field)) {
    // The answers check asks for directly are checked and normalised (a kind from the list, seconds as a number,
    // a size on the master delivery).
    try { next = setField(brief, field, raw); } catch (e) { console.log(e.message); process.exit(2); }
  } else {
    let value = raw;
    try { value = JSON.parse(raw); } catch { /* plain words */ }
    next = brief;
    setDotted(next, field, value);
  }
  saveBrief(jobDir, next);
  const left = questions(next, { job, ctx: context() }).length;
  console.log(`Set ${field}. ${left ? `${left} question(s) left: node tools/plan/brief.mjs check ${jobArg}` : 'Nothing in the brief needs asking.'}`);
} else if (cmd === 'check') {
  const ctx = context();
  const checks = preflight(brief, { job, ctx });
  const q = questions(brief, { job, ctx });
  const p = shots ? shotProblems(brief, shots) : [];
  const a = assumptions(brief, { jobBrand: job.brand, ...ctx });
  if (rest.includes('--json')) { console.log(JSON.stringify({ preflight: checks, assumed: a, questions: q, shot_problems: p }, null, 1)); process.exit(0); }
  printChecklist(checks);
  console.log('');
  if (a.length) console.log(`Taken as given (say it back; they can correct it): ${a.map((x) => `${x.id} ${x.value} ("${x.because}")`).join(', ')}. Record each with set.\n`);
  if (q.length) {
    console.log(`Ask${q.length > 3 ? ' these three first' : ''}:`);
    for (const x of q.slice(0, 3)) {
      console.log(`  - ${x.question}\n    why: ${x.why}${x.recommended ? `\n    recommended: ${x.recommended}` : ''}`);
      for (const e of x.examples || []) console.log(`    example (${e.type}): ${e.title}${e.brand ? `, ${e.brand}` : ''}${e.seconds ? `, ${e.seconds} s` : ''} (${e.file})`);
    }
    if (q.length > 3) console.log(`  (${q.length - 3} more after these: ${q.slice(3).map((x) => x.id).join(', ')})`);
  } else console.log('Nothing in the brief needs asking.');
  const blocked = checks.filter((c) => !c.done && /run stage/.test(c.todo || ''));
  if (blocked.length) console.log(`\nBefore anything else: ${blocked.map((c) => c.todo).join('; ')}.`);
  if (!q.length && checks.every((c) => c.done)) console.log(`\nAll eight known. Next: node tools/plan/brief.mjs plan ${jobArg}`);
  if (shots) {
    if (p.length) { console.log(`\nShots that cannot yet prove what they promise (${p.length}):`); for (const x of p) console.log(`  - ${x.where}: ${x.what}. ${x.fix}.`); }
    else console.log('\nEvery shot has a point, an eye, and a proof moment where it shows an action.');
  }
  process.exit(q.length || p.length || checks.some((c) => !c.done) ? 1 : 0);
} else if (cmd === 'plan') {
  const ctx = context();
  const out = writePlan(STUDIO, jobDir, { dryRun: rest.includes('--json') });
  if (!out) {
    console.log('Not yet: the plan needs every checklist item known.\n');
    printChecklist(preflight(brief, { job, ctx }));
    console.log(`\nAsk what is open: node tools/plan/brief.mjs check ${jobArg}`);
    process.exit(1);
  }
  if (rest.includes('--json')) { { const { md, ...data } = out; console.log(JSON.stringify(data, null, 1)); } process.exit(0); }
  console.log(out.md);
  console.log(`Written to ${path.relative(STUDIO, path.join(jobDir, 'plan.md'))}. Show it to the creator; on their yes, record it: node tools/plan/brief.mjs decide ${jobArg} "plan confirmed"`);
} else if (cmd === 'pick') {
  const [tab, id] = rest.filter((a) => !a.startsWith('--'));
  if (!tab || !id) { console.log('Usage: brief.mjs pick <job_dir> <tab> <id> [--off]'); process.exit(2); }
  const { styles } = context();
  const entry = styles.get(id);
  const off = rest.includes('--off');
  if (!off && (!entry || entry.tab !== tab)) { console.log(`There is no style ${id} in ${tab}.`); process.exit(1); }
  try {
    const next = setPick(brief, entry && entry.tab === tab ? entry : { tab, id }, !off, styles);
    saveBrief(jobDir, next);
    console.log(`${off ? 'Removed' : 'Picked'} ${entry?.name || id}. Picks now: ${picksOf(next, styles).map((x) => x.name).join('; ') || 'none'}.`);
  } catch (e) { console.log(e.message); process.exit(1); }
} else if (cmd === 'direct') {
  const [partsFile] = rest.filter((a) => !a.startsWith('--'));
  if (!partsFile) { console.log('Usage: brief.mjs direct <job_dir> <parts.json>'); process.exit(2); }
  let parts;
  try { parts = JSON.parse(fs.readFileSync(path.resolve(partsFile), 'utf8')); } catch { console.log(`${partsFile} cannot be read as JSON.`); process.exit(1); }
  const ctx = context();
  const energy = brief.energy || assumptions(brief, { jobBrand: job.brand, ...ctx }).find((x) => x.id === 'energy')?.value;
  const e = ctx.engineNames;
  const names = new Set([...(e?.moves || []), ...(e?.registry || []), ...(e?.backgrounds || []), ...(e?.sounds || [])]);
  const allowed = picksOf(brief, ctx.styles).filter((x) => !x.stale).flatMap((x) => ctx.styles.get(x.id).engine || []);
  const r = checkDirectorBrief(parts, { energy, names, allowed });
  if (!r.ok) { console.log(r.reason); process.exit(1); }
  saveBrief(jobDir, { ...brief, director_brief: parts });
  console.log(`Recorded the director's brief: ${parts.logline}`);
} else if (cmd === 'show') {
  console.log(summary(brief, { revisions, styles: context().styles }).join('\n'));
} else { console.log(`Unknown command ${cmd}.`); process.exit(2); }
