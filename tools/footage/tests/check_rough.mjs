#!/usr/bin/env node
// Checks phase 2 end to end on a job holding the synthetic talking clip (FOOTAGE-PLAN.md phase 2 test).
//
//   node tools/footage/tests/make_clips.mjs <tmp>          (outside Claude's command sandbox: the Mac's voice)
//   mkdir -p <job>/footage && cp <tmp>/footage/talking.mp4 <job>/footage/
//   node tools/footage/footage.mjs ingest <job>
//   node tools/footage/tests/check_rough.mjs <job> [--render]   (--render: outside the sandbox, the render browser)
//
// It starts a fresh paper edit (the tool's proposals only), builds the rough cut and checks: the set-aside take and
// the fillers are gone, every kept word is heard and nothing struck is, no clicks, no join left unanswered, and with
// --render, the rendered picture within one frame of its sound and the render's sound free of clicks.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { FFMPEG, PYTHON, STUDIO, readJson, run } from '../lib/common.mjs';

const job = path.resolve(process.argv[2] || '');
const render = process.argv.includes('--render');
const tool = path.join(STUDIO, 'tools', 'footage', 'footage.mjs');
let bad = 0;
const check = (ok, what, detail = '') => { if (!ok) bad++; console.log(`${ok ? 'ok  ' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`); };

execFileSync('node', [tool, 'paper', job, '--fresh'], { stdio: 'ignore' });
let out = '';
try { out = execFileSync('node', [tool, 'rough', job, ...(render ? ['--render'] : [])], { encoding: 'utf8' }); } catch (e) { out = `${e.stdout || ''}${e.stderr || ''}`; }
const cut = readJson(path.join(job, 'edit', 'cutlist.json'));
const lb = readJson(path.join(job, 'edit', 'rough', 'listen-back.json'));
const heard = lb.heard.toLowerCase();
check((heard.match(/every project starts/g) || []).length === 1, 'the earlier take of "Every project starts…" is gone, the later one kept', lb.heard);
check(!/\b(um|uh)\b/.test(heard), 'no "um" or "uh" heard in the joined sound');
check(lb.missing.length === 0 && lb.extra.length === 0, 'every kept word heard, nothing struck heard', `${lb.matched} of ${lb.expected}${lb.missing.length ? `; missing ${lb.missing.join(' ')}` : ''}${lb.extra.length ? `; extra ${lb.extra.join(' ')}` : ''}`);
check(/No clicks in the joined sound/.test(out), 'no clicks in the joined sound');
check(cut.unanswered === 0, 'no flagged join left unanswered');
check(cut.duration > 10 && cut.duration < 13.5, 'about 12 s from the 19 s clip', `${cut.duration} s`);
if (render) {
  const film = path.join(job, 'out', 'rough-cut.mp4');
  const dur = Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', film]));
  check(Math.abs(dur - cut.duration) < 0.05, 'the render is as long as the cut list', `${dur.toFixed(3)} s`);
  // Picture against sound: each piece's rendered frame against the clip's frame at the matching moment.
  // Raw grey pixels, as bytes (not text), from above the captions.
  const grab = (src, t) => execFileSync(FFMPEG, ['-v', 'error', '-ss', t.toFixed(4), '-i', src, '-frames:v', '1', '-vf', 'scale=192:108,crop=192:70:0:0,format=gray', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 24 });
  const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
  let worst = 0;
  for (const p of cut.pieces.filter((x) => x.kind === 'speech')) {
    const src = path.join(job, 'edit', 'clips', p.clip, 'edit.mp4');
    const t = p.dur / 2;
    const r = grab(film, p.at + t);
    const best = [-2, -1, 0, 1, 2].map((d) => [diff(r, grab(src, p.in + t + d / 30)), d]).sort((a, b) => a[0] - b[0])[0];
    worst = Math.max(worst, Math.abs(best[1]));
  }
  check(worst <= 1, 'the rendered picture is within one frame of its sound in every piece', `worst ${worst} frame${worst === 1 ? '' : 's'}`);
  const snd = JSON.parse(run(PYTHON, ['-I', path.join(STUDIO, 'tools', 'footage', 'py', 'sound.py'), film, path.join(job, 'edit', 'rough', 'render-quality.json')]).trim().split('\n').pop());
  check(!snd.summary.clicks.length && !snd.summary.clipped_runs, 'the render\'s sound has no clicks or clipping');
}
console.log(bad ? `\n${bad} check${bad > 1 ? 's' : ''} failed.` : '\nAll checks passed.');
process.exit(bad ? 1 : 0);
