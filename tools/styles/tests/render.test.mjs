import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, rmSync, readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLibrary } from '../lib/library.mjs';
import { planRender, previewSize, sceneNames, classify, captureStatus, defaultCapture, DEMO_JOB, remotionCli, main } from '../render-previews.mjs';
import { SIZES, kebab, isCaptureMove, CAPTURE_STANDS_IN } from '../../../engine/src/library/styles/rules.mjs';
import { buildSprite, SPRITE_MAX_S } from '../lib/sprite.mjs';

const FIX = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'lib');
const scratch = () => { const dir = mkdtempSync(join(tmpdir(), 'render-')); cpSync(FIX, dir, { recursive: true }); return dir; };
const clipOf = (root, id) => join(root, 'library', 'styles', 'previews', `${id}.mp4`);
const planFor = (root, o = {}) => planRender(loadLibrary(root), { root, ...o });
const ids = (list) => list.map((x) => x.id);

test('sizes: first size sets the clip size', () => {
  assert.deepEqual(previewSize('9:16'), { width: 270, height: 480 });
  assert.deepEqual(previewSize('16:9'), { width: 480, height: 270 });
  assert.deepEqual(previewSize('1:1'), { width: 480, height: 480 });
  assert.deepEqual(previewSize('4:5'), { width: 384, height: 480 });
});

test('render plan: skips entries that have a clip, made-on-request entries and sound entries', () => {
  const root = scratch();
  try {
    rmSync(clipOf(root, 'demo-slow-push'));
    rmSync(clipOf(root, 'demo-kinetic-type'));
    const plan = planFor(root);
    // demo-slow-push and demo-kinetic-type name items with no demo scene, so they are not in the plan.
    const planned = ids(plan.render);
    assert.ok(!planned.includes('demo-clay-hero'), 'made on request');
    assert.ok(!planned.includes('acme-soft-tap'), 'sound');
    assert.ok(!planned.includes('demo-paper-world'), 'has a clip');
    assert.ok(!planned.includes('demo-held-wide'), 'has a clip');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('render plan: a renderable entry without a clip is planned at its size; unrenderable moves are noted and reported', () => {
  const root = scratch();
  try {
    const lib = loadLibrary(root);
    lib.byId.get('demo-soft-arrive').preview.clip = 'library/styles/previews/demo-soft-arrive.mp4';
    rmSync(clipOf(root, 'demo-soft-arrive'));
    rmSync(clipOf(root, 'demo-slow-push'));
    const plan = planRender(lib, { root });
    assert.deepEqual(ids(plan.render), ['demo-soft-arrive']);
    const job = plan.render[0];
    assert.equal(job.width, 270);
    assert.equal(job.height, 480);
    assert.equal(job.out, clipOf(root, 'demo-soft-arrive'));
    assert.deepEqual(job.moves, ['blur-in']);
    // demo-slow-push: DollyIn cannot render alone, so it is skipped with a note and needs attention
    assert.ok(plan.notes.some((n) => n.includes('demo-slow-push') && n.includes('DollyIn')));
    assert.ok(ids(plan.attention).includes('demo-slow-push'));
    assert.ok(!ids(plan.render).includes('demo-slow-push'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('render plan: --force includes all ready ones', () => {
  const root = scratch();
  try {
    const normal = planFor(root);
    const forced = planFor(root, { force: true });
    const all = [...forced.render, ...forced.attention].map((x) => x.id);
    for (const id of ['demo-soft-arrive', 'demo-snappy', 'demo-slow-push', 'demo-kinetic-type', 'demo-paper-world']) assert.ok(all.includes(id), id);
    assert.ok(!all.includes('demo-clay-hero') && !all.includes('acme-soft-tap'));
    assert.ok(forced.render.length > normal.render.length);
    assert.ok(ids(forced.render).includes('demo-soft-arrive'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('render plan: --only picks one id and --tab one tab; a clip path off the convention needs attention', () => {
  const root = scratch();
  try {
    assert.deepEqual(ids(planFor(root, { only: 'demo-soft-arrive', force: true }).render), ['demo-soft-arrive']);
    const tabbed = planFor(root, { tab: 'animation', force: true });
    assert.ok(tabbed.render.every((j) => ['demo-kinetic-type', 'demo-paper-world'].includes(j.id)));
    const lib = loadLibrary(root);
    lib.byId.get('demo-soft-arrive').preview.clip = 'library/styles/previews/other.mp4';
    const plan = planRender(lib, { root, force: true });
    assert.ok(plan.attention.some((a) => a.id === 'demo-soft-arrive' && /previews\/demo-soft-arrive\.mp4/.test(a.reason)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

const addJob = (root, job, brand) => {
  mkdirSync(join(root, 'jobs', job), { recursive: true });
  writeFileSync(join(root, 'jobs', job, 'job.json'), JSON.stringify({ name: job, brand }));
};
const onCapture = (root) => {
  const lib = loadLibrary(root);
  const e = lib.byId.get('demo-soft-arrive');
  e.engine = ['cursor-classic'];
  return { lib, e };
};

test('scenes: the plan reads the motion library, not a hand-kept list', () => {
  const scenes = sceneNames();
  for (const n of ['blur-in', 'push-through', 'camera', 'mask-rise']) assert.ok(scenes.has(n), n);
  // moves that play on a real capture have no standalone scene
  for (const n of ['cursor-classic', 'stage-card', 'join-cut', 'relayout-vertical-follow']) assert.ok(!scenes.has(n), n);
  assert.equal(classify('push-through').kind, 'scene');
  assert.equal(classify('BlurIn').kind, 'scene');
  assert.equal(classify('Paper').kind, 'background');
  assert.equal(classify('cursor-classic').kind, 'capture');
  assert.equal(classify('join-cut').kind, 'capture');
  assert.equal(classify('NoSuchMove').kind, null);
});

test('capture: only a job whose brand is demo is accepted', () => {
  const root = scratch();
  try {
    addJob(root, 'client-test', 'acme');
    addJob(root, 'demo-test', 'demo');
    assert.equal(captureStatus(root, null).ok, false);
    assert.equal(captureStatus(root, '').ok, false);
    assert.equal(captureStatus(root, 'missing-job/take-1').ok, false);
    const refused = captureStatus(root, 'client-test/take-1');
    assert.equal(refused.ok, false);
    assert.match(refused.reason, /no demo capture yet/);
    assert.match(refused.reason, /acme/);
    assert.equal(captureStatus(root, 'demo-test/take-1').ok, true);
    assert.equal(captureStatus(root, '../demo-test/take-1').ok, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('render plan: capture-family entries need a demo capture and are otherwise not rendered', () => {
  const root = scratch();
  try {
    addJob(root, 'client-test', 'acme');
    addJob(root, 'demo-test', 'demo');
    // no --capture
    let { lib } = onCapture(root);
    let plan = planRender(lib, { root, force: true, only: 'demo-soft-arrive' });
    assert.deepEqual(plan.render, []);
    assert.deepEqual(plan.attention, [{ id: 'demo-soft-arrive', reason: 'no demo capture yet' }]);
    // a capture of a non-demo job is refused
    ({ lib } = onCapture(root));
    plan = planRender(lib, { root, force: true, only: 'demo-soft-arrive', capture: 'client-test/take-1' });
    assert.deepEqual(plan.render, []);
    assert.match(plan.attention[0].reason, /no demo capture yet/);
    // a demo capture is passed on as the capture prop
    ({ lib } = onCapture(root));
    plan = planRender(lib, { root, force: true, only: 'demo-soft-arrive', capture: 'demo-test/take-1' });
    assert.deepEqual(plan.attention, []);
    assert.equal(plan.render.length, 1);
    assert.equal(plan.render[0].capture, 'demo-test/take-1');
    // an entry with no capture move never carries one
    plan = planRender(loadLibrary(root), { root, force: true, only: 'demo-paper-world', capture: 'demo-test/take-1' });
    assert.equal(plan.render[0].capture, null);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

const stubRunner = (durations, calls = []) => async (cmd, args) => {
  calls.push([cmd, ...args]);
  if (cmd === 'ffprobe') {
    const file = args.find((a) => a.endsWith('.mp3') || a.endsWith('.wav')) ?? '';
    const key = Object.keys(durations).find((k) => file.includes(k));
    return { code: 0, stdout: String(durations[key] ?? 1) };
  }
  if (cmd === 'ffmpeg') writeFileSync(args[args.length - 1], 'SPRITE');
  return { code: 0, stdout: '' };
};

test('sprite map: offsets are contiguous and lengths at most 4', async () => {
  const root = scratch();
  try {
    const lib = loadLibrary(root);
    const entries = lib.tabs.sound.map((e, i) => ({ ...e, preview: { sound: e.preview.sound, from_s: i === 0 ? 0 : 1 } }));
    const calls = [];
    const { file, map } = await buildSprite(entries, root, { run: stubRunner({ 'soft-tap-01': 6 }, calls) });
    assert.equal(file, 'library/styles/previews/sound-sprite.mp3');
    const rows = Object.entries(map);
    assert.equal(rows.length, 2);
    let at = 0;
    for (const [, [start, len]] of rows) {
      assert.ok(len > 0 && len <= SPRITE_MAX_S);
      assert.ok(Math.abs(start - at) < 1e-9, 'contiguous');
      at += len;
    }
    assert.equal(map['acme-soft-tap'][1], 4);
    assert.equal(map['acme-bright-pulse'][1], 4, 'from_s 1 of a 6 s sound still gives 4');
    const json = JSON.parse(readFileSync(join(root, 'library', 'styles', 'previews', 'sound-sprite.json'), 'utf8'));
    assert.deepEqual(json, map);
    const ff = calls.find((c) => c[0] === 'ffmpeg');
    assert.ok(ff && ff.includes('-t') && ff.includes('4'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('sprite map: a short sound keeps its own length and a missing file is left out with a note', async () => {
  const root = scratch();
  try {
    const lib = loadLibrary(root);
    const entries = [
      { ...lib.tabs.sound[0], preview: { sound: 'click/soft-tap-01', from_s: 0.5 } },
      { ...lib.tabs.sound[1], preview: { sound: 'click/nope', from_s: 0 } },
    ];
    const out = await buildSprite(entries, root, { run: stubRunner({ 'soft-tap-01': 1.5 }) });
    assert.deepEqual(Object.keys(out.map), ['acme-soft-tap']);
    assert.equal(out.map['acme-soft-tap'][1], 1);
    assert.ok(out.notes.some((n) => n.includes('acme-bright-pulse')));
    assert.ok(existsSync(join(root, 'library', 'styles', 'previews', 'sound-sprite.json')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('capture: the whole value is checked, two safe segments', () => {
  const root = scratch();
  try {
    addJob(root, 'client-test', 'acme');
    addJob(root, 'demo-test', 'demo');
    for (const bad of ['demo-test/../client-test/take', 'demo-test/..', 'demo-test/.', 'demo-test/a/b', 'demo-test', 'demo-test/', '/take', 'demo-test/ta ke', 'demo-test\\..\\client-test', './demo-test/take']) {
      assert.equal(captureStatus(root, bad).ok, false, bad);
    }
    assert.equal(captureStatus(root, 'demo-test/take_1.2-b').ok, true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('render plan: a background beside a move with no scene is not a clip of only a backdrop', () => {
  const root = scratch();
  try {
    const lib = loadLibrary(root);
    lib.byId.get('demo-soft-arrive').engine = ['Paper', 'NoSuchMove'];
    const plan = planRender(lib, { root, force: true, only: 'demo-soft-arrive' });
    assert.deepEqual(plan.render, []);
    assert.equal(plan.attention.length, 1);
    assert.ok(plan.notes.some((n) => n.includes('NoSuchMove')));
    // a background alone is the point of the entry and is fine
    lib.byId.get('demo-soft-arrive').engine = ['Paper'];
    assert.equal(planRender(lib, { root, force: true, only: 'demo-soft-arrive' }).render.length, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('rules: one shared table of sizes, kebab and the capture-move rule', () => {
  assert.deepEqual(SIZES['9:16'], { width: 270, height: 480 });
  assert.deepEqual(previewSize('4:5'), SIZES['4:5']);
  assert.equal(kebab('BlurIn'), 'blur-in');
  assert.equal(isCaptureMove('cursor-classic', 'capture-pointer'), true);
  assert.equal(isCaptureMove('join-cut', 'transition'), true);
  assert.equal(isCaptureMove('blur-in', 'type'), false);
});

test('remotion: the CLI is run through node, not a .bin shim', async () => {
  const cli = remotionCli();
  assert.ok(cli.endsWith('.js') && existsSync(cli));
  const root = scratch();
  try {
    const calls = [];
    const run = async (cmd, args) => { calls.push([cmd, ...args]); return { code: 1, stdout: '', stderr: 'boom' }; };
    await main(['--root', root, '--force', '--only', 'demo-soft-arrive'], { run, log: () => {} });
    assert.equal(calls[0][0], process.execPath);
    assert.equal(calls[0][1], cli);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

const clipStub = (remotionCode, ffmpegCode) => async (cmd, args) => {
  if (cmd === process.execPath) { if (remotionCode === 0) writeFileSync(args[4], 'RAW'); return { code: remotionCode, stdout: '', stderr: 'render failed' }; }
  if (cmd === 'ffmpeg') { writeFileSync(args[args.length - 1], 'NEWCLIP'); return { code: ffmpegCode, stdout: '', stderr: 'ffmpeg failed' }; }
  return { code: 0, stdout: '', stderr: '' };
};

test('render: a failing re-render keeps the existing clip and leaves no temp file', async () => {
  for (const [remotionCode, ffmpegCode] of [[1, 0], [0, 1]]) {
    const root = scratch();
    try {
      const clip = clipOf(root, 'demo-soft-arrive');
      writeFileSync(clip, 'GOODCLIP');
      const code = await main(['--root', root, '--force', '--only', 'demo-soft-arrive'], { run: clipStub(remotionCode, ffmpegCode), log: () => {} });
      assert.equal(code, 1);
      assert.equal(readFileSync(clip, 'utf8'), 'GOODCLIP');
      assert.deepEqual(readdirSync(join(root, 'library', 'styles', 'previews')).filter((f) => f.includes('tmp')), []);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});

test('render: a good re-render replaces the clip in place', async () => {
  const root = scratch();
  try {
    const clip = clipOf(root, 'demo-soft-arrive');
    writeFileSync(clip, 'GOODCLIP');
    const code = await main(['--root', root, '--force', '--only', 'demo-soft-arrive'], { run: clipStub(0, 0), log: () => {} });
    assert.equal(code, 0);
    assert.equal(readFileSync(clip, 'utf8'), 'NEWCLIP');
    assert.deepEqual(readdirSync(join(root, 'library', 'styles', 'previews')).filter((f) => f.includes('tmp')), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('sprite: a failing build keeps the old sprite and map together', async () => {
  const root = scratch();
  try {
    const dir = join(root, 'library', 'styles', 'previews');
    writeFileSync(join(dir, 'sound-sprite.mp3'), 'OLDMP3');
    writeFileSync(join(dir, 'sound-sprite.json'), '{"old":[0,1]}');
    const lib = loadLibrary(root);
    const run = async (cmd, args) => {
      if (cmd === 'ffprobe') return { code: 0, stdout: '3' };
      writeFileSync(args[args.length - 1], 'PARTIAL');
      return { code: 1, stdout: '', stderr: 'bad' };
    };
    await assert.rejects(buildSprite(lib.tabs.sound, root, { run }));
    assert.equal(readFileSync(join(dir, 'sound-sprite.mp3'), 'utf8'), 'OLDMP3');
    assert.equal(readFileSync(join(dir, 'sound-sprite.json'), 'utf8'), '{"old":[0,1]}');
    assert.deepEqual(readdirSync(dir).filter((f) => f.includes('tmp')), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------- the demo capture (Task 5b)

/** engine/public/captures.json as the capture tool writes it: newest first, the job folder and the brand. */
const listCaptures = (root, rows) => {
  mkdirSync(join(root, 'engine', 'public'), { recursive: true });
  writeFileSync(join(root, 'engine', 'public', 'captures.json'), JSON.stringify(rows));
};
const demoRow = { capture: 'demo-previews/walkthrough', job: 'jobs/_demo-previews', id: 'walkthrough', take: 1, brand: 'demo' };
const clientRow = { capture: 'client-test/boards', job: 'jobs/_client-test', id: 'boards', take: 3, brand: 'acme' };

test('capture: a capture is named by its job folder as the capture tool writes it (no leading underscore)', () => {
  const root = scratch();
  try {
    addJob(root, '_demo-previews', 'demo');
    addJob(root, '_client-test', 'acme');
    assert.equal(DEMO_JOB, '_demo-previews');
    assert.equal(captureStatus(root, 'demo-previews/walkthrough').ok, true);
    const refused = captureStatus(root, 'client-test/boards');
    assert.equal(refused.ok, false);
    assert.match(refused.reason, /acme/);
    // two job folders that name the same capture, one of them not demo: refused, never guessed
    addJob(root, 'client-test', 'demo');
    assert.equal(captureStatus(root, 'client-test/boards').ok, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('capture: one the engine lists under another brand is refused, whatever its job folder says', () => {
  const root = scratch();
  try {
    addJob(root, '_demo-previews', 'demo');
    listCaptures(root, [{ ...demoRow, brand: 'acme' }]);
    const refused = captureStatus(root, 'demo-previews/walkthrough');
    assert.equal(refused.ok, false);
    assert.match(refused.reason, /acme/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('default capture: the demo job\'s newest listed capture, never another job\'s', () => {
  const root = scratch();
  try {
    assert.equal(defaultCapture(root), null, 'nothing listed');
    addJob(root, '_demo-previews', 'demo');
    addJob(root, '_client-test', 'acme');
    listCaptures(root, [clientRow]);
    assert.equal(defaultCapture(root), null, 'only a client capture is listed');
    listCaptures(root, [clientRow, demoRow, { ...demoRow, capture: 'demo-previews/older', id: 'older' }]);
    assert.equal(defaultCapture(root), 'demo-previews/walkthrough');
    // the demo job's folder must still say demo
    addJob(root, '_demo-previews', 'acme');
    assert.equal(defaultCapture(root), null);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

const captureEntryOnDisk = (root) => {
  const file = join(root, 'library', 'styles', 'product-ui.json');
  const rows = JSON.parse(readFileSync(file, 'utf8'));
  rows.find((e) => e.id === 'demo-click-trace').engine = ['cursor-classic'];
  writeFileSync(file, JSON.stringify(rows, null, 2));
};

test('render plan: with a demo capture listed, capture entries are planned on it without --capture', async () => {
  const root = scratch();
  try {
    captureEntryOnDisk(root);
    addJob(root, '_demo-previews', 'demo');
    listCaptures(root, [clientRow, demoRow]);
    const lines = [];
    const code = await main(['--root', root, '--dry-run', '--force', '--only', 'demo-click-trace'], { log: (l) => lines.push(l) });
    assert.equal(code, 0);
    assert.ok(lines.some((l) => /^render demo-click-trace .*cursor-classic/.test(l)), lines.join('\n'));
    assert.ok(lines.some((l) => l.includes('demo-previews/walkthrough')), 'says which capture it plays on');
    assert.ok(!lines.some((l) => l.includes('needs attention: demo-click-trace')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('render plan: without a demo capture, capture entries still need attention', async () => {
  const root = scratch();
  try {
    captureEntryOnDisk(root);
    listCaptures(root, [clientRow]);
    addJob(root, '_client-test', 'acme');
    const lines = [];
    await main(['--root', root, '--dry-run', '--force', '--only', 'demo-click-trace'], { log: (l) => lines.push(l) });
    assert.ok(lines.some((l) => l === 'needs attention: demo-click-trace: no demo capture yet'), lines.join('\n'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('render: the capture prop reaches the composition', async () => {
  const root = scratch();
  try {
    captureEntryOnDisk(root);
    addJob(root, '_demo-previews', 'demo');
    listCaptures(root, [demoRow]);
    let props = null;
    const run = async (cmd, args) => {
      if (cmd === process.execPath) { props = JSON.parse(readFileSync(args.find((a) => a.startsWith('--props=')).slice(8), 'utf8')); return { code: 1, stdout: '', stderr: 'stop here' }; }
      return { code: 0, stdout: '', stderr: '' };
    };
    await main(['--root', root, '--force', '--only', 'demo-click-trace'], { run, log: () => {} });
    assert.equal(props.capture, 'demo-previews/walkthrough');
    assert.deepEqual(props.entry.engine, ['cursor-classic']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('capture scenes: every capture move in the motion library has a gallery scene to play in a preview', () => {
  const studio = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const motion = join(studio, 'engine', 'src', 'library', 'motion');
  const read = (f) => readFileSync(join(motion, f), 'utf8');
  const names = new Set();
  // capture.tsx and product.tsx: entries named in place; relayout.tsx: "relayout-" + its entries; joins.tsx: "join-" + every transition.
  for (const f of ['capture.tsx', 'product.tsx']) for (const m of read(f).matchAll(/name: '([a-z0-9-]+)',\s*title:/g)) names.add(m[1]);
  for (const m of read('product.tsx').matchAll(/stage\('([a-z0-9-]+)'/g)) names.add(`stage-${m[1]}`);
  for (const m of read('capture.tsx').matchAll(/pointerEntry\('([a-z0-9-]+)'/g)) names.add(`cursor-${m[1]}`);
  for (const m of read('relayout.tsx').matchAll(/\{ name: '([a-z0-9-]+)', title:/g)) names.add(`relayout-${m[1]}`);
  const looks = readFileSync(join(studio, 'engine', 'src', 'kit', 'capture', 'looks.ts'), 'utf8');
  const list = looks.slice(looks.indexOf('export const transitionNames'), looks.indexOf(']', looks.indexOf('export const transitionNames')));
  for (const m of list.matchAll(/'([a-z0-9-]+)'/g)) names.add(`join-${m[1]}`);
  const index = JSON.parse(readFileSync(join(studio, 'library', 'motion', 'index.json'), 'utf8')).moves.filter((m) => isCaptureMove(m.name, m.family));
  assert.ok(index.length >= 100, `${index.length} capture moves`);
  const missing = index.map((m) => m.name).filter((n) => !names.has(CAPTURE_STANDS_IN[n] ?? n));
  assert.deepEqual(missing, []);
});

test('render plan: previews play at the first listed energy', () => {
  const root = scratch();
  try {
    const lib = loadLibrary(root);
    const e = lib.byId.get('demo-soft-arrive');
    e.filters.energy = ['calm', 'confident'];
    const job = planRender(lib, { root, force: true, only: 'demo-soft-arrive' }).render[0];
    assert.equal(job.energy, 'calm');
    assert.equal(job.entry.energy, 'calm');
    e.filters.energy = ['hype', 'calm'];
    assert.equal(planRender(lib, { root, force: true, only: 'demo-soft-arrive' }).render[0].entry.energy, 'hype');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
