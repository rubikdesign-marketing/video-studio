// A job's plan, read from its files (LIBRARY-PLAN.md phase 2): the script with its line times, the framework, the
// beat sheet and the shot list's scenes. Shared by tools/plan/beats.mjs and tools/plan/retention.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { beatSheet, energyProblems, perBeat, sceneBeats, textHolds } from './beats.mjs';
import { defaultFor, loadFrameworks } from './frameworks.mjs';
import { lineTimes } from './timing.mjs';

const read = (f) => { if (!fs.existsSync(f)) return null; try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { throw new Error(`${f} cannot be read: ${e.message}`); } };

export function loadPlan(jobDir, { framework: fid = null, platform = null } = {}) {
  const script = read(path.join(jobDir, 'audio', 'script.json'));
  if (!Array.isArray(script) || !script.length) throw new Error(`No script at ${path.join(jobDir, 'audio', 'script.json')}.`);
  const job = read(path.join(jobDir, 'job.json')) || {};
  const lines = read(path.join(jobDir, 'audio', 'lines.json'));
  const shots = read(path.join(jobDir, 'shots.json'));
  const lib = loadFrameworks();
  const id = fid || defaultFor(job.type);
  const framework = lib.frameworks.find((f) => f.id === id);
  if (!framework) throw new Error(`No framework "${id}". The frameworks: ${lib.frameworks.map((f) => f.id).join(', ')}`);
  const timed = lineTimes(script, { lines: Array.isArray(lines) ? lines : null });
  // Silent scenes come after the voice (templates/shots.json); only those at the end add to the film's length.
  const sc = shots?.scenes || []; let tail = sc.length; while (tail > 0 && sc[tail - 1].silent) tail--;
  const silent = sc.slice(tail).reduce((a, s) => a + (Number(s.seconds) || 0), 0);
  const misplaced = sc.slice(0, tail).filter((s) => s.silent).map((s) => s.id);
  const lastEnd = timed.lines.at(-1).end;
  // A film ends with its close: the silent end scenes when the shot list has them, otherwise half a second of rest.
  const duration = Number(job.length_seconds) > lastEnd ? Number(job.length_seconds) : lastEnd + (silent || 0.5);
  const where = platform || job.platform || null;
  const sheet = beatSheet({ lines: timed.lines, framework, duration, cap: Number(job.length_cap_seconds) || null, platform: where, lengths: framework.suits.lengths });
  let scenes = null;
  if (shots?.scenes?.length) {
    scenes = sceneBeats(shots.scenes, sheet.lines.map((l) => ({ ...l, text: timed.lines.find((t) => t.id === l.id)?.text || '' })), duration);
    sheet.problems.push(...scenes.problems, ...textHolds(scenes.scenes));
    // With no energy on the script's lines, the shot list's scene energies are the map.
    // A silent scene at the end is the logo's rest, which 01-direction.md lets sit below the call to action.
    if (!timed.lines.some((l) => Number.isFinite(l.energy))) sheet.problems.push(...energyProblems(perBeat(scenes.scenes.slice(0, tail))));
    if (misplaced.length) sheet.problems.push({ what: 'silent scene before the end', detail: `${misplaced.join(', ')} ${misplaced.length > 1 ? 'are' : 'is'} silent but not at the end; a silent beat between lines is a pause in the voice script (templates/shots.json)` });
  }
  const lengthFrom = Number(job.length_seconds) > lastEnd ? 'job.json length_seconds' : silent ? 'the voice and the end scenes in shots.json' : 'assumed: the voice plus half a second';
  return { job, framework, platform: where, timed, duration, lengthFrom, sheet, scenes };
}
