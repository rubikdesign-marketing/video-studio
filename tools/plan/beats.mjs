#!/usr/bin/env node
// The timed beat sheet (LIBRARY-PLAN.md phase 2; knowledge/craft/16-structure-and-retention.md). Lays a job's script
// against a beat framework and names what does not fit, before anything is built.
//
//   node tools/plan/beats.mjs jobs/<job> [--framework <id>] [--platform reels|tiktok|shorts|youtube|linkedin|x] [--json]
//   node tools/plan/beats.mjs frameworks          the frameworks, and which film type starts from which
//
// It reads jobs/<job>/audio/script.json (each line may say its "beat" and "energy"), audio/lines.json when the voice
// has been made (real times; otherwise times are estimated at 2.5 words a second), job.json (the film type, which picks
// the playbook's framework, and length_cap_seconds) and shots.json when there is one (each scene's beat, energy and
// on-screen text). A line with no beat is placed by time, and the sheet says the beats were guessed.
// Exit code 0 with nothing to fix, 1 with problems, 2 when it could not run.
import { loadFrameworks } from './lib/frameworks.mjs';
import { loadPlan } from './lib/job.mjs';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); const v = i >= 0 ? args[i + 1] : undefined; return v === undefined || v.startsWith('--') ? undefined : v; };
const say = (s = '') => process.stdout.write(`${s}\n`);
const stop = (msg) => { say(msg); process.exit(2); };
const lib = loadFrameworks();

if (args[0] === 'frameworks') {
  for (const f of lib.frameworks) say(`${f.id.padEnd(22)} ${f.beats.map((b) => b.id).join(' > ')}\n${''.padEnd(22)} ${f.what} (${f.suits.types.join(', ')}; ${f.suits.lengths.join(', ')} s)`);
  process.exit(0);
}
const jobDir = args[0] && !args[0].startsWith('--') ? args[0] : null;
if (!jobDir) stop('Usage: node tools/plan/beats.mjs jobs/<job> [--framework <id>] [--platform <platform>] [--json] | frameworks');
let plan; try { plan = loadPlan(jobDir, { framework: opt('framework'), platform: opt('platform') }); } catch (e) { stop(e.message); }
const { job, framework, platform, timed, sheet } = plan;
const report = { job: jobDir, framework: framework.id, platform, times: timed.measured ? 'measured from the voice' : 'estimated at 2.5 words a second', estimated_lines: timed.estimated, ...sheet };
if (args.includes('--json')) { say(JSON.stringify(report, null, 2)); process.exit(sheet.problems.length ? 1 : 0); }

say(`Beat sheet: ${framework.name}, ${sheet.duration} s${job.length_cap_seconds ? ` (cap ${job.length_cap_seconds} s)` : ''}${platform ? `, for ${platform}` : ''}.`);
if (!plan.scenes) say('No shot list yet: the film is taken to end half a second after the voice, so the close may read short until the end scenes are in shots.json.');
say(`Times ${report.times}${timed.estimated.length && timed.measured ? `, except lines ${timed.estimated.join(', ')} (not in the voice yet)` : ''}.${sheet.guessed ? ' Some lines had no beat and were placed by time: say each line\'s beat in script.json to be sure.' : ''}${sheet.stretched ? ` This framework was written for ${framework.suits.lengths.join(', ')} s films; at ${sheet.duration} s it is stretched.` : ''}`);
say();
say('| Beat | Lines | From | Seconds | Given | |');
say('|---|---|---|---|---|---|');
for (const b of sheet.beats) say(`| ${b.name} | ${b.lines.join(', ') || '-'} | ${b.start === null ? '-' : `${b.start} s`} | ${b.seconds || '-'} | ${b.allowed[0]} to ${b.allowed[1]} s | ${b.verdict} |`);
say();
if (!sheet.problems.length) say('Nothing to fix.');
else { say(`${sheet.problems.length} to look at:`); for (const p of sheet.problems) say(`- ${p.what}: ${p.detail}`); }
process.exit(sheet.problems.length ? 1 : 0);
