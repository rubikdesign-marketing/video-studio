// Shared by the render and finishing tools (the Node twin of safe.sh): keep the last good file.
//
//   replaceKeeping(newFile, destination, keep = 3)
//       Moves the destination (if any) into versions/ beside it, stamped with the time, then moves the new file into
//       place. Only call it after the new file has been checked. Older versions beyond the limit are deleted.
//   videoFrames(file)           how many picture frames a file has (null if it cannot be read)
//   checkVideo(file, frames?)   null when the file has a picture and, if given, that many frames; otherwise the plain message
import fs from 'node:fs';
import path from 'node:path';
import { ffprobeBin, runBin } from '../../lib/ff.mjs';

const pad = (n) => String(n).padStart(2, '0');
const stamp = (d = new Date()) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

export function replaceKeeping(newFile, dest, keep = 3) {
  if (fs.existsSync(dest) && keep > 0) {
    const dir = path.join(path.dirname(dest), 'versions');
    const ext = path.extname(dest);                       // includes the dot
    const stem = path.basename(dest, ext);
    fs.mkdirSync(dir, { recursive: true });
    fs.renameSync(dest, path.join(dir, `${stem}.${stamp()}${ext}`));
    const mine = fs.readdirSync(dir).filter((f) => f.startsWith(`${stem}.2`) && f.endsWith(ext)).sort().reverse();
    for (const old of mine.slice(keep)) { try { fs.rmSync(path.join(dir, old), { force: true }); } catch {} }
  }
  fs.renameSync(newFile, dest);
}

export function videoFrames(file) {
  try {
    const r = runBin(ffprobeBin(), ['-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', path.resolve(file)]);
    const n = parseInt(String(r.stdout).trim(), 10);
    return r.status === 0 && Number.isFinite(n) ? n : null;
  } catch { return null; }
}

export function checkVideo(file, want) {
  let size = 0; try { size = fs.statSync(file).size; } catch {}
  if (!size) return `The render did not write ${file}.`;
  const got = videoFrames(file);
  if (!got || got <= 0) return `${file} has no readable picture.`;
  if (want != null && got !== Number(want)) return `${file} has ${got} frames, ${want} expected.`;
  return null;
}
