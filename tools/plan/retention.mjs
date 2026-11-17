#!/usr/bin/env node
// A YouTube Studio audience-retention export read against the film's beats and lines (LIBRARY-PLAN.md phase 2;
// knowledge/craft/16-structure-and-retention.md, "Reading a retention graph"). For stage 6, "Learn".
//
//   node tools/plan/retention.mjs <export.csv> --job jobs/<job> [--framework <id>] [--duration <s>] [--json]
//
// Get the export in YouTube Studio: Analytics, the video, Engagement, the audience-retention chart, the download icon.
// It reads the film's beats and line times the way tools/plan/beats.mjs does, finds where viewers left (the early
// drop, cliffs and dips) and where more of them watched (spikes: rewatching or skipping to a part), names the beat and
// the line playing at each, and writes jobs/<job>/learn/retention.json.
// Not yet checked on a real export: the reader takes every layout the export could plausibly have and refuses others
// with the reason. Exit code 0 when read, 2 when it could not be.
import fs from 'node:fs';
import path from 'node:path';
import { loadPlan } from './lib/job.mjs';
import { parseRetention, readRetention } from './lib/retention.mjs';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); const v = i >= 0 ? args[i + 1] : undefined; return v === undefined || v.startsWith('--') ? undefined : v; };
const say = (s = '') => process.stdout.write(`${s}\n`);
const stop = (msg) => { say(msg); process.exit(2); };
const file = args[0] && !args[0].startsWith('--') ? args[0] : null; const jobDir = opt('job');
if (!file || !jobDir) stop('Usage: node tools/plan/retention.mjs <export.csv> --job jobs/<job> [--framework <id>] [--duration <s>] [--json]');
if (!fs.existsSync(file)) stop(`No such file: ${file}`);
let plan; try { plan = loadPlan(jobDir, { framework: opt('framework') }); } catch (e) { stop(e.message); }
const duration = Number(opt('duration')) || plan.duration;
let parsed; try { parsed = parseRetention(fs.readFileSync(file, 'utf8'), { duration }); } catch (e) { stop(`Could not read the export: ${e.message}.`); }
const lines = plan.timed.lines.map(({ id, start, end, text }) => ({ id, start, end, text }));
const beats = plan.sheet.beats.filter((b) => b.start !== null).map((b) => ({ id: b.id, name: b.name, start: b.start === plan.sheet.beats[0].start ? 0 : b.start, end: b.end }));
const r = readRetention(parsed.points, { duration, beats, lines });
const lengthFrom = opt('duration') ? '--duration' : plan.lengthFrom;
const report = { export: file, job: jobDir, film_seconds: duration, film_length_from: lengthFrom, line_times: plan.timed.measured ? 'measured from the voice' : 'estimated at 2.5 words a second', framework: plan.framework.id, read_as: { position: parsed.position, share: parsed.share, column: parsed.column }, notes: parsed.notes,
  checked_on_a_real_export: false, ...r };
const out = path.join(jobDir, 'learn'); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'retention.json'), `${JSON.stringify(report, null, 2)}\n`);
if (args.includes('--json')) { say(JSON.stringify(report, null, 2)); process.exit(0); }
const name = (id) => beats.find((b) => b.id === id)?.name || id || 'no beat';
say(`Read ${parsed.points.length} points (positions as a ${parsed.position}, viewers as a ${parsed.share}, one every ${r.step} s) against a ${Math.round(duration * 10) / 10} s film.`);
say(`The film's length: ${lengthFrom}${lengthFrom.startsWith('assumed') ? ' (if the published film is longer, pass --duration, or every moment shifts)' : ''}. Line times: ${report.line_times}.`);
for (const n of parsed.notes) say(`Note: ${n}.`);
say(`Watching: ${r.start}% at the start, ${r.at_3s}% at 3 s${r.at_30s !== null ? `, ${r.at_30s}% at 30 s` : ''}, ${r.end}% at the end.`);
if (!r.moments.length) say('No early drop, cliff, dip or spike stands out: a steady slope.');
const said = (id) => plan.timed.lines.find((l) => l.id === id)?.text || '';
for (const m of r.moments) {
  const where = m.beat ? `, in ${name(m.beat)}` : ' (across the opening)';
  const ls = m.lines.length === 1 ? `, line ${m.lines[0]}: "${said(m.lines[0])}"` : m.lines.length ? `, lines ${m.lines.join(', ')}` : '';
  say(`- ${m.kind} from ${m.from} to ${m.to} s (${m.change > 0 ? '+' : ''}${m.change} points)${where}${ls}`);
}
say(`Written: ${path.join(out, 'retention.json')}. Not yet checked on a real export: if the numbers look wrong, open the file and check its two columns.`);
