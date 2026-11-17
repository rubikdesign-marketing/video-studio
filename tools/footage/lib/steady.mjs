// Steadying shaky clips (FOOTAGE-PLAN.md section 5.2): ffmpeg's vidstab, two passes, with a fixed 5% crop so the
// framing knows exactly how much enlargement is left (the sharpness limit counts it). The shaky working copy is kept
// as edit-unsteady.mp4; edit.mp4 becomes the steady one, so faces, plates and cuts all use it.
//
// The movement is found on a copy no more than 1080 on its short side and written as text; every position and
// movement in it is then scaled up to the full size, and the full-size picture is moved by it. On a 4K phone clip this
// is 26 times faster than finding the movement at full size and steadies as well (on a 10 s hand-held stretch: shake
// left 1.92% of the width against 1.99% from the full-size pass, 2.55% before). Above 1080p the picture is moved with
// bilinear sampling (three times faster than bicubic at 4K; on the 63 s phone clip 4 minutes instead of 27 with full-size
// finding and bicubic, shake left 0.32% against 0.28%, and a little softer at 4K, which the film's scaling down hides).
import fs from 'node:fs';
import path from 'node:path';
import { FFMPEG, FFPROBE, run } from './common.mjs';

export const STEADY_ZOOM = 1.05; // the crop vidstab adds (zoom=5)
const FIND_AT = 1080; // the short side the movement is found at

/** vidstab's text motion file with every local motion's vector, position and field size multiplied by k. Pure. */
export function scaleMotions(text, k) {
  if (k === 1) return text;
  return text.replace(/\(LM (-?\d+) (-?\d+) (-?\d+) (-?\d+) (\d+) /g, (_, ...v) => `(LM ${v.slice(0, 5).map((n) => Math.round(Number(n) * k)).join(' ')} `);
}

export function steady(dir) {
  const src = path.join(dir, 'edit.mp4'); const kept = path.join(dir, 'edit-unsteady.mp4');
  if (!fs.existsSync(kept)) fs.renameSync(src, kept);
  const [w, h] = run(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', kept]).trim().split(',').map(Number);
  const k = Math.max(1, Math.min(w, h) / FIND_AT);
  const small = k > 1 ? `scale=${w < h ? `${FIND_AT}:-2` : `-2:${FIND_AT}`},` : '';
  // Relative names: the filter's option parser cannot take every path.
  run(FFMPEG, ['-hide_banner', '-v', 'error', '-y', '-i', kept, '-vf', `${small}vidstabdetect=shakiness=7:accuracy=15:fileformat=1:result=found.trf`, '-f', 'null', '-'], { cwd: dir });
  // The small copy's width may round to an even number: scale by the exact ratio of the short sides.
  const ratio = k > 1 ? Math.min(w, h) / FIND_AT : 1;
  fs.writeFileSync(path.join(dir, 'steady.trf'), scaleMotions(fs.readFileSync(path.join(dir, 'found.trf'), 'utf8'), ratio));
  const interpol = w * h > 2.2e6 ? 'bilinear' : 'bicubic';
  run(FFMPEG, ['-hide_banner', '-v', 'error', '-y', '-i', kept, '-vf', `vidstabtransform=input=steady.trf:smoothing=20:zoom=5:optzoom=0:interpol=${interpol},unsharp=5:5:0.4:3:3:0`,
    '-map', '0:v', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'fast', '-crf', '14', '-g', '10', '-bf', '0', '-c:a', 'copy', '-movflags', '+faststart', src], { cwd: dir });
  for (const f of ['found.trf', 'steady.trf']) fs.rmSync(path.join(dir, f), { force: true });
  return { zoom: STEADY_ZOOM, found_at: k > 1 ? FIND_AT : Math.min(w, h), interpol };
}
