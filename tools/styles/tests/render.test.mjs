import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, rmSync, readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLibrary } from '../lib/library.mjs';
import { planRender, previewSize, sceneNames, classify, captureStatus, defaultCapture, defaultPhoneCapture, isPhoneCapture, DEMO_JOB, remotionCli, main } from '../render-previews.mjs';
import { SIZES, kebab, isCaptureMove, CAPTURE_STANDS_IN, MAX_MOVES, isPhoneMove, previewSlots, sceneStart, LEAD_S } from '../../../engine/src/library/styles/rules.mjs';
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

test('render: shader entries are rendered with --gl=angle, others without', async () => {
  const root = scratch();
  try {
    const lib = loadLibrary(root);
    lib.byId.get('demo-soft-arrive').engine = ['shader-god-rays'];
    const plan = planRender(lib, { root, force: true, only: 'demo-soft-arrive' });
    assert.equal(plan.render[0].gpu, true);
    assert.equal(planRender(loadLibrary(root), { root, force: true, only: 'demo-paper-world' }).render[0].gpu, false);
    const seen = {};
    const run = async (cmd, args) => { if (cmd === process.execPath) seen[args[5] ? args[4].split(/[\\/]/).pop() : '?'] = args; return { code: 1, stdout: '', stderr: 'stop' }; };
    writeFileSync(join(root, 'library', 'styles', 'motion.json'), JSON.stringify([...lib.tabs.motion.map((e) => (e.id === 'demo-soft-arrive' ? { ...e, engine: ['shader-god-rays'] } : e))]));
    await main(['--root', root, '--force', '--only', 'demo-soft-arrive'], { run, log: () => {} });
    assert.ok(seen['demo-soft-arrive.mp4'].includes('--gl=angle'));
    for (const k of Object.keys(seen)) delete seen[k];
    await main(['--root', root, '--force', '--only', 'demo-paper-world'], { run, log: () => {} });
    const args = Object.values(seen)[0];
    assert.ok(args && !args.includes('--gl=angle'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------- the phone take, the moment and pointer settings (Task 5c)

/** A published capture as the capture tool leaves it in engine/public: its cursor.json carries the page size. */
const publish = (root, capture, page) => {
  const [job, id] = capture.split('/');
  const dir = join(root, 'engine', 'public', 'jobs', job, 'capture', id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'cursor.json'), JSON.stringify({ page, seconds: 10, events: [] }));
};
const phoneRow = { capture: 'demo-previews/phone', job: 'jobs/_demo-previews', id: 'phone', take: 1, brand: 'demo' };
/** Two demo takes listed, the phone one newest, each published with its page size. */
const twoTakes = (root, { phone = true } = {}) => {
  addJob(root, '_demo-previews', 'demo');
  listCaptures(root, phone ? [phoneRow, demoRow] : [demoRow]);
  publish(root, demoRow.capture, { width: 1920, height: 1080 });
  if (phone) publish(root, phoneRow.capture, { width: 390, height: 844 });
};
const familyOf = (n) => (n.startsWith('cursor-') ? 'capture-pointer' : n.startsWith('relayout-') ? 'capture-relayout' : n.startsWith('stage-') ? 'capture-staging' : /^(product|join)-/.test(n) ? 'capture-product' : 'text');

test('rules: phone moves are the ones made for a take recorded at phone size', () => {
  assert.equal(isPhoneMove('relayout-phone-take', ''), true);
  assert.equal(isPhoneMove('relayout-phone-take-framed', ''), true);
  assert.equal(isPhoneMove('some-move', 'A take recorded at phone size placed full frame.'), true);
  // a wide take shown in a phone frame is not a phone move
  assert.equal(isPhoneMove('stage-phone', 'A generic phone slab showing a tall crop of a wide take.'), false);
  assert.equal(isPhoneMove('relayout-vertical-phone-frame', 'A wide take followed inside a generic phone frame.'), false);
});

test('rules: a pointer beside a capture move is a setting, not a slot', () => {
  // (Task 5d) the phone re-layout and its mark are one composed slot
  const mobile = previewSlots(['relayout-phone-take', 'cursor-hidden', 'product-ring'], { familyOf, phone: true });
  assert.deepEqual(mobile, { moves: ['relayout-phone-take+product-ring'], pointer: 'hidden', refused: null });
  assert.deepEqual(previewSlots(['cursor-presenter', 'product-steps'], { familyOf, phone: false }), { moves: ['product-steps'], pointer: 'presenter', refused: null });
  // a pointer alone still plays its own scene
  assert.deepEqual(previewSlots(['cursor-classic'], { familyOf, phone: false }), { moves: ['cursor-classic'], pointer: null, refused: null });
  // beside only standalone scenes, a pointer is a scene too
  assert.deepEqual(previewSlots(['cursor-classic', 'blur-in'], { familyOf, phone: false }), { moves: ['cursor-classic', 'blur-in'], pointer: null, refused: null });
  // on the phone take with no pointer named, the pointer is hidden (its own default, touch, is a dot)
  assert.deepEqual(previewSlots(['relayout-phone-take'], { familyOf, phone: true }), { moves: ['relayout-phone-take'], pointer: 'hidden', refused: null });
  // a desktop capture move with no pointer named keeps its own
  assert.deepEqual(previewSlots(['product-ring'], { familyOf, phone: false }), { moves: ['product-ring'], pointer: null, refused: null });
  // never more than MAX_MOVES slots
  assert.equal(previewSlots(['blur-in', 'blur-in', 'blur-in', 'blur-in'], { familyOf, phone: false }).moves.length, MAX_MOVES);
});

test('rules: each scene starts just before its defining moment, clamped to its length', () => {
  const fps = 30;
  assert.equal(LEAD_S, 0.3);
  // a product mark 1.3 s into its scene, in a 1.5 s slot: start at 1.0 s
  assert.equal(sceneStart({ cue: 1.3, seconds: 6, slot: 45, fps }), 30);
  // no cue: from the start
  assert.equal(sceneStart({ cue: null, seconds: 6, slot: 45, fps }), 0);
  assert.equal(sceneStart({ cue: undefined, slot: 45, fps }), 0);
  // a cue in the first 0.3 s: from the start, never before it
  assert.equal(sceneStart({ cue: 0.1, seconds: 6, slot: 45, fps }), 0);
  // a cue near the end: the slot still ends with the scene
  assert.equal(sceneStart({ cue: 5.9, seconds: 6, slot: 45, fps }), 135);
  // a scene shorter than its slot plays from the start
  assert.equal(sceneStart({ cue: 1, seconds: 1, slot: 45, fps }), 0);
  // an unknown length only clamps at the start
  assert.equal(sceneStart({ cue: 2.3, slot: 30, fps }), 60);
});

test('phone capture: a demo take whose page is taller than wide; the desktop default skips it', () => {
  const root = scratch();
  try {
    twoTakes(root);
    assert.equal(isPhoneCapture(root, 'demo-previews/phone'), true);
    assert.equal(isPhoneCapture(root, 'demo-previews/walkthrough'), false);
    assert.equal(isPhoneCapture(root, 'demo-previews/missing'), false);
    assert.equal(defaultPhoneCapture(root), 'demo-previews/phone');
    assert.equal(defaultCapture(root), 'demo-previews/walkthrough', 'the newest desktop take, not the newer phone take');
    // a phone take of a job that is not demo is never used
    addJob(root, '_demo-previews', 'acme');
    assert.equal(defaultPhoneCapture(root), null);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

const mobileEntry = (lib, engine = ['relayout-phone-take', 'cursor-hidden', 'product-ring']) => { lib.byId.get('demo-soft-arrive').engine = engine; return lib; };

test('render plan: a phone-move entry plays on the phone take, a desktop entry on the desktop take', () => {
  const root = scratch();
  try {
    twoTakes(root);
    const opts = { root, force: true, capture: 'demo-previews/walkthrough', phoneCapture: 'demo-previews/phone' };
    const phone = planRender(mobileEntry(loadLibrary(root)), { ...opts, only: 'demo-soft-arrive' }).render[0];
    assert.equal(phone.capture, 'demo-previews/phone');
    assert.deepEqual(phone.moves, ['relayout-phone-take+product-ring'], 'the pointer takes no slot; the re-layout and its mark are one scene');
    assert.equal(phone.pointer, 'hidden');
    assert.equal(phone.entry.pointer, 'hidden');
    const desk = planRender(mobileEntry(loadLibrary(root), ['product-ring', 'cursor-classic']), { ...opts, only: 'demo-soft-arrive' }).render[0];
    assert.equal(desk.capture, 'demo-previews/walkthrough');
    assert.deepEqual(desk.moves, ['product-ring']);
    assert.equal(desk.pointer, 'classic');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('render plan: with no phone take, only phone entries need attention', async () => {
  const root = scratch();
  try {
    twoTakes(root, { phone: false });
    const lib = mobileEntry(loadLibrary(root));
    lib.byId.get('demo-snappy').engine = ['product-ring'];
    const plan = planRender(lib, { root, force: true, capture: 'demo-previews/walkthrough', phoneCapture: null });
    assert.deepEqual(plan.attention.filter((a) => a.id === 'demo-soft-arrive'), [{ id: 'demo-soft-arrive', reason: 'no demo phone capture yet' }]);
    assert.ok(!ids(plan.attention).includes('demo-snappy'));
    assert.ok(ids(plan.render).includes('demo-snappy'));
    // a desktop take named as the phone take is refused
    const wrong = planRender(mobileEntry(loadLibrary(root)), { root, force: true, only: 'demo-soft-arrive', capture: 'demo-previews/walkthrough', phoneCapture: 'demo-previews/walkthrough' });
    assert.match(wrong.attention[0].reason, /^no demo phone capture yet/);
    // and through main, by default
    const file = join(root, 'library', 'styles', 'motion.json');
    writeFileSync(file, JSON.stringify(loadLibrary(root).tabs.motion.map((e) => (e.id === 'demo-soft-arrive' ? { ...e, engine: ['relayout-phone-take', 'cursor-hidden'] } : e))));
    const lines = [];
    await main(['--root', root, '--dry-run', '--force', '--only', 'demo-soft-arrive'], { log: (l) => lines.push(l) });
    assert.ok(lines.includes('needs attention: demo-soft-arrive: no demo phone capture yet'), lines.join('\n'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('render: main finds the phone take by default and hands it and the pointer to the composition', async () => {
  const root = scratch();
  try {
    twoTakes(root);
    const file = join(root, 'library', 'styles', 'motion.json');
    writeFileSync(file, JSON.stringify(loadLibrary(root).tabs.motion.map((e) => (e.id === 'demo-soft-arrive' ? { ...e, engine: ['relayout-phone-take', 'cursor-hidden', 'product-ring'] } : e))));
    let props = null;
    const run = async (cmd, args) => {
      if (cmd === process.execPath) { props = JSON.parse(readFileSync(args.find((a) => a.startsWith('--props=')).slice(8), 'utf8')); return { code: 1, stdout: '', stderr: 'stop here' }; }
      return { code: 0, stdout: '', stderr: '' };
    };
    await main(['--root', root, '--force', '--only', 'demo-soft-arrive'], { run, log: () => {} });
    assert.equal(props.capture, 'demo-previews/phone');
    assert.equal(props.entry.pointer, 'hidden');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------- composed slots and measured starts (Task 5d)

const timingFile = (root, scenes) => {
  mkdirSync(join(root, 'library', 'motion'), { recursive: true });
  writeFileSync(join(root, 'library', 'motion', 'scene-timing.json'), JSON.stringify({ fps: 30, size: [480, 270], scenes }));
};
const deskPlan = (root, engine, o = {}) => {
  o = { studio: root, ...o };
  addJob(root, '_demo-previews', 'demo');
  listCaptures(root, [demoRow]);
  const lib = loadLibrary(root);
  lib.byId.get('demo-soft-arrive').engine = engine;
  return planRender(lib, { root, force: true, only: 'demo-soft-arrive', capture: 'demo-previews/walkthrough', ...o });
};

test('render plan: a staging named beside its mark plays as one composed slot', () => {
  const root = scratch();
  try {
    const plan = deskPlan(root, ['stage-split', 'product-ring']);
    assert.deepEqual(plan.render[0].moves, ['stage-split+product-ring']);
    assert.deepEqual(plan.render[0].entry.engine, ['stage-split', 'product-ring'], 'the composition reads the same names and composes them the same way');
    assert.deepEqual(plan.attention, []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('render plan: a pairing that cannot share one take is reported, not rendered', async () => {
  const root = scratch();
  try {
    const plan = deskPlan(root, ['stage-wall', 'product-isolate']);
    assert.deepEqual(ids(plan.render), []);
    assert.equal(plan.attention.length, 1);
    assert.match(plan.attention[0].reason, /^staging and mark cannot compose: stage-wall/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('render plan: a scene with no measured timing is noted as starting at the safe offset', () => {
  const root = scratch();
  try {
    timingFile(root, {});
    const plan = deskPlan(root, ['blur-in']);
    assert.equal(plan.render.length, 1);
    assert.ok(plan.notes.some((n) => n.includes('demo-soft-arrive') && n.includes('blur-in') && /safe offset/.test(n)), plan.notes.join('\n'));
    assert.deepEqual(plan.render[0].starts, [{ name: 'blur-in', start: 18, safe: true, freeze: null }]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('render plan: each slot\'s start comes from the measured timing; a scene with blanks in every window holds its end', () => {
  const root = scratch();
  try {
    timingFile(root, {
      'blur-in': { seconds: 4, built: 0.9, cue: null, empty: [[0, 0.6]], extent: 0.6 },
      'bar-grow': { seconds: 3.5, built: 0.5, cue: null, empty: [[0, 0.3], [1, 1.3], [2, 2.3]], extent: 0.6 },
    });
    const ok = deskPlan(root, ['blur-in']);
    assert.deepEqual(ok.render[0].starts, [{ name: 'blur-in', start: 18, safe: false, freeze: null }]);
    assert.deepEqual(ok.attention, []);
    const held = deskPlan(root, ['blur-in', 'bar-grow']);
    assert.deepEqual(held.render[0].starts[1], { name: 'bar-grow', start: 69, safe: false, freeze: 105 });
    assert.deepEqual(held.attention, []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('render plan: timing comes from the studio\'s own table (the one the composition bundles), not the --root copy', () => {
  const root = scratch();
  const studio = mkdtempSync(join(tmpdir(), 'studio-'));
  try {
    timingFile(root, { 'blur-in': { seconds: 4, built: 3, cue: null, empty: [[0, 2.7]] } });
    timingFile(studio, { 'blur-in': { seconds: 4, built: 0.9, cue: null, empty: [[0, 0.6]] } });
    assert.deepEqual(deskPlan(root, ['blur-in'], { studio }).render[0].starts, [{ name: 'blur-in', start: 18, safe: false, freeze: null }]);
  } finally { rmSync(root, { recursive: true, force: true }); rmSync(studio, { recursive: true, force: true }); }
});

test('render plan: a stale row (another length) is unmeasured: safe offset and a note', () => {
  const root = scratch();
  try {
    timingFile(root, { 'blur-in': { seconds: 3, built: 0.9, cue: null, empty: [[0, 0.6]] } });
    const plan = deskPlan(root, ['blur-in']);
    assert.equal(plan.render[0].starts[0].safe, true);
    assert.ok(plan.notes.some((n) => n.includes('blur-in') && /safe offset/.test(n)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('render plan: a change that cannot fit its slot, and a scene with nothing to show, are reported for what they are', () => {
  const root = scratch();
  try {
    timingFile(root, {
      'blur-in': { seconds: 4, built: 0.9, cue: null, empty: [[0, 0.6]] },
      'feather-wipe': { seconds: 4.5, built: 0.5, cue: 2, empty: [[0, 0.3], [1.9, 2.2]] },
      'bar-grow': { seconds: 3.5, built: 0, cue: null, empty: [[0, 3.5]] },
    });
    const change = deskPlan(root, ['blur-in', 'feather-wipe']);
    assert.deepEqual(change.attention.map((a) => a.reason), ['feather-wipe cannot show its change in its slot']);
    const content = deskPlan(root, ['blur-in', 'bar-grow']);
    assert.deepEqual(content.attention.map((a) => a.reason), ['bar-grow has not enough content for its slot']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('render plan: slots are weighed by what each scene needs; a transition with no change point, and needs past 3 s, are reported', () => {
  const root = scratch();
  try {
    timingFile(root, {
      'bar-grow': { seconds: 3.5, built: 1, cue: null, empty: [[0, 0.333]] },
      'line-draw': { seconds: 3.5, built: 1.133, cue: null, empty: [[0, 0.8]] },
      'feather-wipe': { seconds: 4.5, built: 0.6, cue: null, empty: [[0, 0.267]] },
      'type-on': { seconds: 4.5, built: 2.5, cue: null, empty: [[0, 0.233]] },
      'human-type': { seconds: 5.5, built: 3, cue: null, empty: [[0, 0.5]] },
    });
    const bars = deskPlan(root, ['bar-grow', 'line-draw']);
    assert.deepEqual(bars.render[0].slots, [55, 35]);
    assert.deepEqual(bars.attention, []);
    const wipe = deskPlan(root, ['feather-wipe']);
    assert.deepEqual(wipe.attention.map((a) => a.reason), ['feather-wipe is a transition with no measured change point']);
    const long = deskPlan(root, ['type-on', 'human-type']);
    assert.equal(long.attention.length, 1);
    assert.match(long.attention[0].reason, /^its scenes need 5\.\d s together, more than the clip's 3 s$/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
