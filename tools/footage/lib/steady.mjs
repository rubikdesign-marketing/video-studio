// Steadying shaky clips (FOOTAGE-PLAN.md section 5.2): ffmpeg's vidstab, two passes, with a fixed 5% crop so the
// framing knows exactly how much enlargement is left (the sharpness limit counts it). The shaky working copy is kept
// as edit-unsteady.mp4; edit.mp4 becomes the steady one, so faces, plates and cuts all use it.
import fs from 'node:fs';
import path from 'node:path';
import { FFMPEG, run } from './common.mjs';

export const STEADY_ZOOM = 1.05; // the crop vidstab adds (zoom=5)

export function steady(dir) {
  const src = path.join(dir, 'edit.mp4'); const kept = path.join(dir, 'edit-unsteady.mp4');
  if (!fs.existsSync(kept)) fs.renameSync(src, kept);
  const trf = 'steady.trf'; // relative: the filter's option parser cannot take every path
  run(FFMPEG, ['-hide_banner', '-v', 'error', '-y', '-i', kept, '-vf', `vidstabdetect=shakiness=7:accuracy=15:result=${trf}`, '-f', 'null', '-'], { cwd: dir });
  run(FFMPEG, ['-hide_banner', '-v', 'error', '-y', '-i', kept, '-vf', `vidstabtransform=input=${trf}:smoothing=20:zoom=5:optzoom=0:interpol=bicubic,unsharp=5:5:0.4:3:3:0`,
    '-map', '0:v', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'fast', '-crf', '14', '-g', '10', '-bf', '0', '-c:a', 'copy', '-movflags', '+faststart', src], { cwd: dir });
  fs.rmSync(path.join(dir, trf), { force: true });
  return { zoom: STEADY_ZOOM };
}
