// Tests for style picks, what they settle, energy and length reading, and the director's brief (tools/plan/lib/brief.mjs).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { applyAnswer, assumptions, checkDirectorBrief, questions, reopen, DIRECTOR_PARTS, ENERGIES, CHECKLIST_LABELS, LABELS, picksOf, plan, preflight, setPick, summary, understood } from '../lib/brief.mjs';
import { confirmPlan, loadJob, saveBrief, writePlan } from '../lib/brief-store.mjs';
import { completeBrief, scratchStudio } from './helpers.mjs';

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../brief.mjs');
const entry = (o) => ({ id: 'x', tab: 'motion', name: 'X', line: 'x', family: 'f', filters: { energy: ['confident'], kinds: [], sizes: [], ready: true }, engine: [], ...o });
const lib = (...list) => new Map(list.map((e) => [e.id, e]));
const pick = (e) => ({ tab: e.tab, id: e.id });

const arrive = entry({ id: 'soft-arrive', name: 'Soft arrive', family: 'arrival', engine: ['BlurIn', 'Card'] });
const arrive2 = entry({ id: 'pop-arrive', name: 'Pop arrive', family: 'arrival' });

test('constants: energies, director parts and checklist labels', () => {
  assert.deepEqual(ENERGIES, ['calm', 'confident', 'hype']);
  assert.deepEqual(DIRECTOR_PARTS.map((p) => LABELS[p]), ['Logline', 'First three seconds', 'Timed beats', 'Camera', 'Motion', 'Type', 'Sound', 'Ending']);
  assert.deepEqual(CHECKLIST_LABELS, ['Brand', 'Product', 'Audience', 'Message angle', 'Style and look', 'Hook', 'Video type and references', 'Size, length and voice']);
  assert.deepEqual(preflight({}, {}).map((c) => c.label), CHECKLIST_LABELS);
});

test('setPick: second pick in one family refused with its reason', () => {
  const styles = lib(arrive, arrive2);
  const b = setPick({}, arrive, true, styles);
  assert.deepEqual(b.style_picks, [pick(arrive)]);
  assert.throws(() => setPick(b, arrive2, true, styles), /^Error: You already picked Soft arrive from arrival: one per family$/);
});

test('setPick: fourth pick in a tab refused', () => {
  const list = [1, 2, 3, 4].map((n) => entry({ id: `m${n}`, name: `Move ${n}`, family: `fam${n}` }));
  const styles = lib(...list);
  let b = {};
  for (const e of list.slice(0, 3)) b = setPick(b, e, true, styles);
  assert.throws(() => setPick(b, list[3], true, styles), /^Error: Three Motion picks already: remove one first$/);
});

test('setPick: avoid_with refused in both directions', () => {
  const a = entry({ id: 'a', name: 'Alpha', family: 'fa', avoid_with: ['b'] });
  const b2 = entry({ id: 'b', name: 'Beta', family: 'fb' });
  const styles = lib(a, b2);
  assert.throws(() => setPick(setPick({}, a, true, styles), b2, true, styles), /^Error: Beta does not go with Alpha$/);
  assert.throws(() => setPick(setPick({}, b2, true, styles), a, true, styles), /^Error: Alpha does not go with Beta$/);
});

test('setPick: no shared energy refused', () => {
  const calm = entry({ id: 'c', name: 'Calm one', family: 'fc', filters: { energy: ['calm'] } });
  const hype = entry({ id: 'h', name: 'Hype one', family: 'fh', filters: { energy: ['hype'] } });
  const styles = lib(calm, hype);
  assert.throws(() => setPick(setPick({}, calm, true, styles), hype, true, styles), /^Error: Hype one is for hype films and your picks are calm$/);
});

test('setPick: removing always works', () => {
  const styles = lib(arrive);
  const b = setPick({}, arrive, true, styles);
  assert.deepEqual(setPick(b, arrive, false, styles).style_picks, []);
  assert.deepEqual(setPick(b, { tab: 'motion', id: 'gone' }, false, new Map()).style_picks, [pick(arrive)]);
  assert.deepEqual(setPick(b, pick(arrive), false, new Map()).style_picks, []);
});

test('picksOf: an id no longer in the library is stale', () => {
  const b = { style_picks: [pick(arrive), { tab: 'sound', id: 'gone' }] };
  assert.deepEqual(picksOf(b, lib(arrive)), [{ tab: 'motion', id: 'soft-arrive', name: 'Soft arrive', stale: false }, { tab: 'sound', id: 'gone', name: 'gone', stale: true }]);
});

test('assumptions: a pick that settles look is assumed with "picked <name>"', () => {
  const paper = entry({ id: 'p', name: 'Paper world', family: 'world', settles: { look: 'paper', voice: 'none' } });
  const a = assumptions({ style_picks: [pick(paper)] }, { styles: lib(paper) });
  assert.deepEqual(a.find((x) => x.id === 'look'), { id: 'look', value: 'paper', because: 'picked Paper world' });
  assert.equal(a.find((x) => x.id === 'voice').because, 'picked Paper world');
});

test('assumptions: a typed look wins over a pick', () => {
  const paper = entry({ id: 'p', name: 'Paper world', family: 'world', settles: { look: 'paper', voice: 'none' } });
  const styles = lib(paper);
  assert.equal(assumptions({ look: 'night', style_picks: [pick(paper)] }, { styles }).some((x) => x.id === 'look'), false);
  assert.equal(assumptions({ style: 'saved', style_picks: [pick(paper)] }, { styles }).some((x) => x.id === 'look'), false);
  // the words win over a pick for the same field
  const a = assumptions({ in_their_words: 'no voice please', style_picks: [pick(paper)] }, { styles });
  assert.equal(a.find((x) => x.id === 'voice').because, 'no voice');
});

test('assumptions: length and energy come from their words', () => {
  const a = assumptions({ in_their_words: 'a calm 30 seconds film' }, {});
  assert.equal(a.find((x) => x.id === 'length_cap_seconds').value, 30);
  assert.equal(a.find((x) => x.id === 'energy').value, 'calm');
  assert.equal(assumptions({ in_their_words: 'a calm 30 seconds film', energy: 'hype', length_cap_seconds: 15 }, {}).length, 0);
});

test('understood: "a punchy 20 s vertical demo for agency owners"', () => {
  assert.deepEqual(understood('a punchy 20 s vertical demo for agency owners'), { size: '9:16', kind: 'product-demo', length: 20, energy: 'hype', audience: 'agency owners' });
});

test('understood: "the demo brand" is not read as a demo', () => {
  assert.equal(understood('the demo brand').kind, undefined);
  assert.equal(understood('a 400 s film').length, undefined);
  assert.equal(understood('a 2 s flash').length, undefined);
});

const parts = () => ({ logline: 'A founder exports a board in one click.', first_three_seconds: 'The export button pulses, then the file lands.', beats: [{ at_s: 0, what: 'button' }, { at_s: 1.5, what: 'file' }], camera: 'Held wide.', motion: 'Soft arrivals.', type: 'One line at a time.', sound: 'Quiet pulse.', ending: 'The logo settles.' });

test('checkDirectorBrief: names the missing part', () => {
  const p = parts(); delete p.camera;
  const r = checkDirectorBrief(p, { energy: 'confident', names: new Set() });
  assert.equal(r.ok, false);
  assert.equal(r.part, 'camera');
  assert.match(r.reason, /Camera/);
  assert.equal(checkDirectorBrief(parts(), { energy: 'confident', names: new Set() }).ok, true);
});

test('checkDirectorBrief: refuses an engine name in the text', () => {
  const p = parts(); p.motion = 'Use BlurIn for every arrival.';
  const r = checkDirectorBrief(p, { energy: 'confident', names: new Set(['BlurIn']) });
  assert.equal(r.ok, false);
  assert.equal(r.part, 'motion');
  assert.match(r.reason, /BlurIn/);
});

test('checkDirectorBrief: refuses beats too tight for calm', () => {
  const p = parts(); p.beats = [{ at_s: 0, what: 'a' }, { at_s: 0.5, what: 'b' }];
  const r = checkDirectorBrief(p, { energy: 'calm', names: new Set() });
  assert.equal(r.ok, false);
  assert.equal(r.part, 'beats');
  assert.equal(checkDirectorBrief(p, { energy: 'hype', names: new Set() }).ok, true);
});

test('plan: lists picks and returns engine groups without stale picks', () => {
  const click = entry({ id: 'tap', tab: 'sound', name: 'Soft tap', family: 'taps', engine: ['soft-tap-01'] });
  const b = { ...completeBrief(), style_picks: [pick(arrive), pick(click), { tab: 'motion', id: 'gone' }] };
  const names = { moves: new Set(['BlurIn']), registry: new Set(['Card']), sounds: new Set(['soft-tap-01']) };
  const out = plan(b, { ctx: { styles: lib(arrive, click), engineNames: names } });
  assert.ok(out.lines.includes('Picked styles, as strong preferences: Motion Soft arrive; Sound Soft tap.'));
  assert.deepEqual(out.engine.ui, ['Card']);
  assert.deepEqual(out.engine.motion, ['BlurIn']);
  assert.deepEqual(out.engine.sound, ['soft-tap-01']);
  assert.ok(out.engine.skills.includes('video-studio'));
  const bare = plan(b, { ctx: { styles: lib(arrive, click) } });
  assert.deepEqual(bare.engine.motion, ['BlurIn', 'Card', 'soft-tap-01']);
  assert.deepEqual(plan(completeBrief(), {}).engine.ui, []);
});

test('summary: shows picks and the logline', () => {
  const b = { kind: 'promo', style_picks: [pick(arrive)], director_brief: { ...parts(), engine: [] } };
  const lines = summary(b, { styles: lib(arrive) });
  assert.ok(lines.includes('Picked: Motion Soft arrive.'));
  assert.ok(lines.includes("Director's brief: A founder exports a board in one click."));
});

test('CLI pick: a clash exits 1 with the reason', () => {
  const root = scratchStudio();
  fs.mkdirSync(path.join(root, 'library', 'styles'), { recursive: true });
  fs.writeFileSync(path.join(root, 'library', 'styles', 'motion.json'), JSON.stringify([arrive, arrive2]));
  const jobDir = path.join(root, 'jobs', 'j');
  const run = (...a) => spawnSync(process.execPath, [CLI, ...a], { encoding: 'utf8', env: { ...process.env, BRIEF_STUDIO_ROOT: root } });
  assert.equal(run('new', jobDir, 'a demo').status, 0);
  const first = run('pick', jobDir, 'motion', 'soft-arrive');
  assert.equal(first.status, 0, first.stdout);
  const second = run('pick', jobDir, 'motion', 'pop-arrive');
  assert.equal(second.status, 1);
  assert.match(second.stdout, /You already picked Soft arrive from arrival: one per family/);
  assert.equal(run('pick', jobDir, 'motion', 'soft-arrive', '--off').status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(jobDir, 'brief.json'), 'utf8')).style_picks, []);
});

test('reopen: "Size, length and voice" asks the length again though their words say it', () => {
  const b = { ...completeBrief(), in_their_words: 'a 20 s vertical demo' };
  const open = reopen(b, 'delivery');
  assert.equal(assumptions(open, {}).some((x) => x.id === 'length_cap_seconds'), false);
  assert.ok(questions(open, {}).some((q) => q.id === 'length'));
  assert.equal(preflight(open, {}).find((c) => c.id === 'delivery').done, false);
  // answering it settles it, and clears the reopening
  const answered = applyAnswer(open, 'length', { words: '25' });
  assert.equal(answered.length_cap_seconds, 25);
  assert.equal((answered.ask_again || []).includes('length_cap_seconds'), false);
});

test('reopen: "Style and look" asks the look again though a pick settles it', () => {
  const paper = entry({ id: 'p', name: 'Paper world', family: 'world', settles: { look: 'paper' } });
  const styles = lib(paper);
  const b = { ...completeBrief(), look: '', style_picks: [pick(paper)] };
  assert.equal(preflight(b, { ctx: { styles } }).find((c) => c.id === 'look').done, true);
  const open = reopen(b, 'look');
  assert.equal(assumptions(open, { styles }).some((x) => x.id === 'look'), false);
  assert.ok(questions(open, { ctx: { styles } }).some((q) => q.id === 'look'));
  const answered = applyAnswer(open, 'look', { value: 'night' });
  assert.equal(answered.look, 'night');
  assert.equal(answered.ask_again, undefined);
});

test('confirmPlan: job.json takes the length their words gave', () => {
  const root = scratchStudio();
  const jobDir = path.join(root, 'jobs', 'j');
  fs.mkdirSync(jobDir, { recursive: true });
  const b = { ...completeBrief(), in_their_words: 'a 20 s demo' };
  delete b.length_cap_seconds;
  saveBrief(jobDir, b);
  assert.ok(writePlan(root, jobDir));
  assert.equal(confirmPlan(root, jobDir).length_cap_seconds, 20);
  assert.equal(loadJob(jobDir).job.length_cap_seconds, 20);
});
