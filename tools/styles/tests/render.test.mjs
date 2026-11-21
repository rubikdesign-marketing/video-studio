import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLibrary } from '../lib/library.mjs';
import { planRender, previewSize } from '../render-previews.mjs';
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
    // demo-slow-push uses DollyIn (a camera move, cannot render alone); demo-kinetic-type uses WordRise (a registry component)
    // so only entries with a renderable move are in the plan. demo-paper-world has its clip.
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
    assert.deepEqual(job.moves, ['BlurIn']);
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

const stubRunner = (durations, calls = []) => async (cmd, args) => {
  calls.push([cmd, ...args]);
  if (cmd === 'ffprobe') {
    const file = args.find((a) => a.endsWith('.mp3') || a.endsWith('.wav')) ?? '';
    const key = Object.keys(durations).find((k) => file.includes(k));
    return { code: 0, stdout: String(durations[key] ?? 1) };
  }
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
