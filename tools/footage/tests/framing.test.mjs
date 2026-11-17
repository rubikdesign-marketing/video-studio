// Tests for the footage camera and the framing check (FOOTAGE-PLAN.md phase 4). Fast and pure.
// Run: node --test tools/footage/tests/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captionChars, captionSlot, checkSize, placeCaptions } from '../lib/framecheck.mjs';
import { captionLines } from '../lib/paper.mjs';
import { RULES, frameFace, limits, planCut, planPiece } from '../lib/framing.mjs';

const SRC4K = { w: 3840, h: 2160 }; const SRC = { w: 1920, h: 1080 };
const OUT = { w: 1920, h: 1080 }; const TALL = { w: 1080, h: 1920 };
/** A face 350 px tall (hairline to chin) with its eyes at (x, y). */
const face = (x, y, yaw = 0, h = 350) => ({ eyes: [x, y], top: [x, y - 0.42 * h], chin: [x, y + 0.58 * h], box: [x - 0.35 * h, y - 0.42 * h, 0.7 * h, h], yaw });

test('sharpness limits: what a size unavoidably needs, plus 15%, never under 390 source pixels', () => {
  const wide = limits(SRC4K, OUT);
  assert.equal(wide.base, 1); assert.equal(wide.allowed, 1.15);
  const tall = limits(SRC, TALL);
  assert.ok(tall.base > 1.7 && tall.base < 1.8); // 1080p landscape into 1080x1920 needs about 1.78x anyway
  assert.ok(tall.minW >= 390);
  assert.ok(limits(SRC, OUT, 1.05).allowed < 1.1); // steadying used part of the budget
});

test('a face is framed with its eyes a third of the way down, chin and hairline inside, room on the side it faces', () => {
  const f = face(2000, 900);
  const c = frameFace(f, SRC4K, OUT);
  assert.ok(Math.abs((f.eyes[1] - c.y) / c.h - 1 / 3) < 0.01);
  assert.ok(f.top[1] > c.y && f.chin[1] < c.y + c.h);
  assert.ok(Math.abs((f.chin[1] - f.top[1]) / c.h - RULES.wideFace.landscape) < 0.01);
  const right = frameFace(face(2000, 900, 0.3), SRC4K, OUT);
  assert.ok(right.x + right.w / 2 > f.eyes[0]); // looking right: more room on the right
});

test('a punch-in is 1.22 times tighter than the wide framing actually used, and never past the limits', () => {
  const f = face(1900, 900);
  const wide = frameFace(f, SRC4K, OUT); const close = frameFace(f, SRC4K, OUT, { close: true });
  assert.ok(Math.abs(wide.w / close.w - RULES.close) < 0.01);
  assert.ok(Math.abs((f.eyes[1] - close.y) / close.h - 1 / 3) < 0.01); // the eye line stays at the same height
  const big = face(960, 500, 0, 600); // a big face in a 1080p source: the wide framing is already the whole frame
  const c2 = frameFace(big, SRC, OUT, { close: true });
  assert.ok(OUT.w / c2.w <= limits(SRC, OUT).allowed + 1e-6);
});

test('two people in a wide frame are both kept in', () => {
  const a = face(600, 450); const b = face(1400, 450);
  const c = frameFace(a, SRC, OUT, { people: [a, b] });
  assert.ok(c.x < a.box[0] && c.x + c.w > b.box[0] + b.box[2]);
});

test('the camera holds still while the face sways inside the calm zone, and moves once it leaves', () => {
  const still = planPiece({ src: SRC4K, out: OUT, at: 0, dur: 3, inT: 0, who: (s) => ({ face: face(1900 + 20 * Math.sin(s * 3), 900), people: [face(1900, 900)] }) });
  assert.equal(new Set(still.map((k) => k.x)).size, 1);
  const moving = planPiece({ src: SRC4K, out: OUT, at: 0, dur: 4, inT: 0, who: (s) => { const f = face(s < 1 ? 1500 : 2500, 900); return { face: f, people: [f] }; } });
  assert.ok(moving.at(-1).x > moving[0].x + 500);
  const steps = moving.slice(1).map((k, i) => k.x - moving[i].x);
  assert.ok(steps.every((d) => d >= -1e-6)); // one way only
});

test('the framing check catches a cut-off chin, too much enlargement, and a caption over a face', () => {
  const f = face(960, 400);
  const people = [{ id: 1, side: 'centre', frames: [{ ...f, t: 0, mouth: 0 }], smooth: [{ t: 0, ...f }] }];
  const clips = { a: { src: SRC, steadyZoom: 1, faces: { people }, speakers: null } };
  const cut = { pieces: [{ kind: 'speech', clip: 'a', in: 0, at: 0, dur: 1 }], joins: [] };
  const good = frameFace(f, SRC, OUT);
  assert.equal(checkSize('16:9', OUT, cut, [[{ t: 0, ...good }, { t: 1, ...good }]], clips).pass, true);
  const chinCut = { x: 560, y: 150, w: 800, h: 450 }; // the chin (y 603) is below this frame
  assert.ok(checkSize('16:9', OUT, cut, [[{ t: 0, ...chinCut }, { t: 1, ...chinCut }]], clips).problems.some((p) => p.what === 'face cut off'));
  const tiny = { x: 700, y: 200, w: 500, h: 281 };
  assert.ok(checkSize('16:9', OUT, cut, [[{ t: 0, ...tiny }, { t: 1, ...tiny }]], clips).problems.some((p) => p.what === 'sharpness'));
  const low = { x: 0, y: -380, w: 1920, h: 1080 }; // the face pushed down into the caption band
  assert.ok(checkSize('16:9', OUT, cut, [[{ t: 0, ...low }, { t: 1, ...low }]], clips).problems.some((p) => p.what === 'caption over a face' || p.what === 'face cut off'));
});

test('captions are split to fit each size, and a line too wide for the frame is caught', () => {
  assert.equal(captionChars('16:9', OUT), 42);
  const tallMax = captionChars('9:16', TALL);
  assert.ok(tallMax >= 14 && tallMax <= 20);
  assert.ok(captionSlot('9:16').to < 0.7); // tall captions sit at the bottom of the platforms' free band, not the frame
  const text = 'Every project starts with a board and the whole team sees it right away';
  const words = text.split(' ').map((w, i) => ({ text: w, start: i * 0.3, end: i * 0.3 + 0.25 }));
  const tall = captionLines(words, { max: tallMax });
  assert.ok(tall.every((l) => l.words.map((w) => w.text).join(' ').length <= tallMax));
  const f = face(960, 400);
  const people = [{ id: 1, side: 'centre', frames: [{ ...f, t: 0, mouth: 0 }], smooth: [{ t: 0, ...f }] }];
  const clips = { a: { src: SRC, steadyZoom: 1, faces: { people }, speakers: null } };
  const cut = { pieces: [{ kind: 'speech', clip: 'a', in: 0, at: 0, dur: 1 }], joins: [] };
  const crop = frameFace(f, SRC, TALL); const plan = [[{ t: 0, ...crop }, { t: 1, ...crop }]];
  const wide = captionLines(words, { max: 42 });
  assert.ok(checkSize('9:16', TALL, cut, plan, clips, { lines: wide }).problems.some((p) => p.what === 'caption wider than the frame'));
  assert.ok(!checkSize('9:16', TALL, cut, plan, clips, { lines: tall }).problems.some((p) => p.what === 'caption wider than the frame'));
});

test('a caption line moves to the top when a big face in a tall frame would be under it, and the check then passes', () => {
  const big = face(960, 430, 0, 330); // a 1080p source with a face 30% of its height: in 9:16 the chin lands in the caption slot
  const people = [{ id: 1, side: 'centre', frames: [{ ...big, t: 0, mouth: 0 }], smooth: [{ t: 0, ...big }] }];
  const clips = { a: { src: SRC, steadyZoom: 1, faces: { people }, speakers: null } };
  const cut = { pieces: [{ kind: 'speech', clip: 'a', in: 0, at: 0, dur: 2 }], joins: [] };
  const crop = frameFace(big, SRC, TALL); const plan = [[{ t: 0, ...crop }, { t: 2, ...crop }]];
  const lines = [{ start: 0.2, end: 1.2, words: [{ text: 'Every project', start: 0.2, end: 1.2 }] }];
  assert.ok(checkSize('9:16', TALL, cut, plan, clips, { lines }).problems.some((p) => p.what === 'caption over a face'));
  const placed = placeCaptions('9:16', TALL, cut, plan, clips, lines);
  assert.equal(placed[0].position, 'top');
  assert.ok(!checkSize('9:16', TALL, cut, plan, clips, { lines: placed }).problems.some((p) => p.what === 'caption over a face'));
  assert.equal(placeCaptions('16:9', OUT, cut, [[{ t: 0, ...frameFace(big, SRC, OUT) }, { t: 2, ...frameFace(big, SRC, OUT) }]], clips, lines)[0].position, undefined);
});

test('inside one take the eye line holds across punch-ins; a cut across the footage\'s own camera change is not a punch-in', () => {
  // The head drifts down 60 px across the take; each cut puts the eyes where they were at the end of the last piece.
  const smooth = Array.from({ length: 101 }, (_, i) => ({ t: i * 0.1, ...face(1900, 860 + 0.6 * i) }));
  const people = [{ id: 1, side: 'centre', frames: smooth.map((f) => ({ ...f, mouth: 0 })), smooth }];
  const pieces = [0, 3, 6].map((s0, i) => ({ kind: 'speech', clip: 'a', in: s0 + 0.3 * i, at: 2.4 * i, dur: 2.4 })); // under 2.5 s: no opening push
  const cut = { pieces, joins: [{ after: 0, kind: 'pause' }, { after: 1, kind: 'filler' }] };
  const clips = { a: { src: SRC4K, steadyZoom: 1, faces: { people }, speakers: null, shots: { cuts: [] } } };
  const plan = planCut(cut, clips, OUT);
  assert.ok(Math.abs(plan[1][0].w * RULES.close - plan[0].at(-1).w) < 60 || Math.abs(plan[0].at(-1).w * RULES.close - plan[1][0].w) < 60); // a punch-in
  const r = checkSize('16:9', OUT, cut, plan, clips, { captions: false });
  assert.ok(!r.problems.some((p) => p.what === 'eye line jumps at a punch-in'), JSON.stringify(r.problems));
  // The same cut with a camera change in the footage between the pieces: both pieces framed wide.
  const changed = { a: { ...clips.a, shots: { cuts: [2.8] } } };
  const plan2 = planCut(cut, changed, OUT);
  assert.ok(Math.abs(plan2[1][0].w - plan2[0].at(-1).w) < 0.05 * plan2[0].at(-1).w);
});

test('a face outside the safe area only because the footage is framed that tight is a note, not a failure', () => {
  const tight = face(960, 160, 0, 380); // hairline 0.4 % from the top of a 1080p source
  const people = [{ id: 1, side: 'centre', frames: [{ ...tight, t: 0, mouth: 0 }], smooth: [{ t: 0, ...tight }] }];
  const clips = { a: { src: SRC, steadyZoom: 1, faces: { people }, speakers: null } };
  const cut = { pieces: [{ kind: 'speech', clip: 'a', in: 0, at: 0, dur: 1 }], joins: [] };
  const crop = frameFace(tight, SRC, OUT);
  const r = checkSize('16:9', OUT, cut, [[{ t: 0, ...crop }, { t: 1, ...crop }]], clips, { captions: false });
  assert.equal(crop.y, 0);
  assert.ok(r.pass); assert.ok(r.notes.some((n) => n.what === 'tight in the footage'));
});

test('a camera change in the footage is a clean cut in the framing, and each shot\'s people are used only in that shot', () => {
  // Shot one (0 to 2 s): a face on the left. Shot two (2 to 4 s): a face on the right. One piece spans the change.
  const mk = (x, from, to, id) => {
    const smooth = Array.from({ length: 21 }, (_, i) => ({ t: from + i * ((to - from) / 20), ...face(x, 900) }));
    return { id, side: 'centre', shot: id - 1, shot_from: from, shot_to: to, start: from, end: to, frames: smooth.map((f) => ({ ...f, mouth: 0 })), smooth };
  };
  const people = [mk(1000, 0, 2, 1), mk(2800, 2, 4, 2)];
  // A room-tone piece first, so this is not the opening line (no push).
  const cut = { pieces: [{ kind: 'room', at: -1, dur: 1 }, { kind: 'speech', clip: 'a', in: 0, at: 0, dur: 4 }], joins: [] };
  const clips = { a: { src: SRC4K, steadyZoom: 1, faces: { people }, speakers: null, shots: { cuts: [2] } } };
  const keys = planCut(cut, clips, OUT)[1];
  assert.ok(keys.every((k, i) => i === 0 || k.t > keys[i - 1].t)); // in time order
  const before = keys.filter((k) => k.t < 2); const after = keys.filter((k) => k.t > 2);
  assert.ok(before.every((k) => k.x === before[0].x)); // held on the first face up to the change
  assert.ok(after.every((k) => k.x === after[0].x)); // straight onto the second face, no easing across
  assert.ok(after[0].x > before[0].x + 1000);
  assert.ok(checkSize('16:9', OUT, cut, [null, keys], clips, { captions: false }).pass);
});
