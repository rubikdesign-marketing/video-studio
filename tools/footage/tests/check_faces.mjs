#!/usr/bin/env node
// Checks phase 4 end to end on the face test job (FOOTAGE-PLAN.md phase 4 test): footage with known answers, made by
// make_face_clips.py from CC0 portrait photos (no recording of anyone).
//
//   python tools/footage/tests/make_face_clips.py <job> --presenter <photo> --second <photo> --speech <wav> ...
//   node tools/footage/footage.mjs ingest <job> && node tools/footage/footage.mjs paper <job> --fresh
//   node tools/footage/footage.mjs rough <job>
//   node tools/footage/tests/check_faces.mjs <job>
//
// It checks: the small face in the 4K wide shot is found, and its eyes where they really are; both people in the
// two-person clip are found on the right sides; every line is given to the person who said it; the shaky clip was
// steadied; every film size passes the framing check; the punch-ins are 1.22 times tighter; and in 9:16 the frame
// is on whoever is speaking.
import path from 'node:path';
import { PYTHON, STUDIO, readJson, run } from '../lib/common.mjs';
import { RULES, personAt } from '../lib/framing.mjs';

const job = path.resolve(process.argv[2] || '');
const clipDir = (c) => path.join(job, 'edit', 'clips', c);
const truth = readJson(path.join(job, 'truth.json'));
let bad = 0;
const check = (ok, what, detail = '') => { if (!ok) bad++; console.log(`${ok ? 'ok  ' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`); };
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

// 1. The presenter: a face a sixth of a 4K frame's height, eyes compared with where they were put, frame by frame.
const pf = readJson(path.join(clipDir('presenter'), 'faces.json'));
const pt = truth.presenter;
check(pf.found >= 0.95 * pf.sampled, 'the small face in the 4K wide shot is found', `${pf.found} of ${pf.sampled} frames`);
const err = pf.frames.filter((f) => f.box).map((f) => { const [x, y] = pt.eyes[Math.round(f.t * pt.fps)]; return Math.hypot(f.eyes[0] - x, f.eyes[1] - y); });
check(err.length && pct(err, 0.95) < 0.01 * pt.size[1], 'its eyes are where they really are', `median ${median(err).toFixed(1)} px, 95% within ${pct(err, 0.95).toFixed(1)} px of a ${pt.size[1]} px frame`);

// 2. Two people: found, on the right sides, eyes where they were put.
const df = readJson(path.join(clipDir('duo'), 'faces.json'));
const dt = truth.duo;
const sides = Object.fromEntries((df.people || []).map((p) => [p.side, p]));
check(df.people?.length === 2 && sides.left && sides.right, 'two people found in the two-person clip, left and right', (df.people || []).map((p) => `${p.side} seen ${p.seen}`).join(', '));
for (const side of ['left', 'right']) {
  const p = sides[side]; if (!p) continue;
  const [tx, ty] = dt[`eyes_${side}`];
  const e = p.frames.filter(Boolean).map((f) => Math.hypot(f.eyes[0] - tx, f.eyes[1] - ty));
  check(median(e) < 0.02 * dt.size[1], `the ${side} person's eyes are where they really are`, `median ${median(e).toFixed(1)} px`);
}

// 3. Who speaks: each line given to the person whose mouth said it.
const sp = readJson(path.join(clipDir('duo'), 'speakers.json'));
const sideOf = Object.fromEntries((df.people || []).map((p) => [p.id, p.side]));
let right = 0;
for (const ln of dt.lines) {
  const overlap = (s) => Math.max(0, Math.min(s.end, ln.end) - Math.max(s.start, ln.start));
  const s = [...sp.sentences].sort((a, b) => overlap(b) - overlap(a))[0];
  if (s && overlap(s) > 0 && sideOf[s.person] === ln.face) right++;
}
check(right === dt.lines.length, 'every line is given to the person who said it', `${right} of ${dt.lines.length}`);

// 4. The shaky clip: steadied, and its shake now under the "shaky" line.
const sc = readJson(path.join(clipDir('shaky'), 'clip.json'));
const sq = readJson(path.join(clipDir('shaky'), 'quality.json'));
const before = JSON.parse(run(PYTHON, ['-I', path.join(STUDIO, 'tools', 'footage', 'py', 'picture.py'), path.join(clipDir('shaky'), 'edit-unsteady.mp4'), path.join(job, 'edit', 'unsteady-quality.json')]).trim().split('\n').pop());
const shakeBefore = before.summary?.shake ?? readJson(path.join(job, 'edit', 'unsteady-quality.json')).picture?.summary?.shake;
const shakeAfter = sq.picture?.summary?.shake;
check(Boolean(sc.steady) && shakeAfter < 0.35 && shakeAfter < shakeBefore / 2, 'the shaky clip was steadied', `shake ${shakeBefore} → ${shakeAfter} (% of the width; "shaky" is over 0.35), ${Math.round((sc.steady?.zoom - 1) * 100)}% crop`);

// 5. The framing check, every size.
const fc = readJson(path.join(job, 'edit', 'rough', 'framing-check.json'));
for (const r of fc) check(r.pass, `${r.size}: faces in frame and inside the safe area, sharp, captions clear, eye line steady`, r.pass ? `most enlargement ${r.worst_enlargement}x` : r.problems.map((p) => `${p.what} ${Math.round(p.share * 100)}%`).join(', '));

// 6. Punch-ins: the cut inside one take goes 1.22 times tighter (or back out).
const fr = readJson(path.join(job, 'edit', 'rough', 'framing.json'));
const cut = readJson(path.join(job, 'edit', 'cutlist.json'));
const wide = fr.sizes['16:9'];
const punches = cut.joins.filter((j) => ['pause', 'filler', 'inside a sentence'].includes(j.kind) && cut.pieces[j.after]?.clip === cut.pieces[j.after + 1]?.clip && cut.pieces[j.after].kind === 'speech' && cut.pieces[j.after + 1].kind === 'speech')
  .map((j) => { const a = wide[j.after].at(-1).w; const b = wide[j.after + 1][0].w; return Math.max(a, b) / Math.min(a, b); });
check(punches.length > 0 && punches.every((r) => r > 1.05 && r < RULES.close + 0.03) && punches.some((r) => Math.abs(r - RULES.close) < 0.03), 'punch-ins on the cuts inside a take: 1.22 times tighter where the source is sharp enough, less where it is not', punches.map((r) => r.toFixed(2)).join(', ') || 'no cuts inside a take');

// 7. 9:16 follows the speaker: in every two-person piece, the speaker is in the frame and the other person is not.
const tall = fr.sizes['9:16'];
let follow = 0; let duoPieces = 0;
cut.pieces.forEach((p, k) => {
  if (p.clip !== 'duo' || p.kind !== 'speech') return;
  const mid = p.in + p.dur / 2;
  const ln = dt.lines.find((l) => mid >= l.start && mid <= l.end);
  if (!ln) return;
  duoPieces++;
  const keys = tall[k]; const c = keys[Math.floor(keys.length / 2)];
  const inFrame = (side) => { const f = sides[side] && personAt(sides[side], mid); return f && f.eyes[0] >= c.x && f.eyes[0] <= c.x + c.w; };
  if (inFrame(ln.face) && !inFrame(ln.face === 'left' ? 'right' : 'left')) follow++;
});
check(duoPieces > 0 && follow === duoPieces, '9:16 is on whoever is speaking', `${follow} of ${duoPieces} two-person pieces`);

console.log(bad ? `\n${bad} check${bad > 1 ? 's' : ''} failed.` : '\nAll checks passed.');
process.exit(bad ? 1 : 0);
