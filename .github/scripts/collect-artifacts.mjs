// CI only: copy the smoke receipts, doctor reports, sample film and logs out of the "Vidéo studio" copy
// so actions/upload-artifact can find them. Runs in each runner's default shell (pwsh on Windows):
// Git Bash on Windows exited 127 in this step when STUDIO_DIR held a non-ASCII path.
import fs from 'node:fs';
import path from 'node:path';

const src = process.env.STUDIO_DIR;
const out = path.join(process.cwd(), 'ci-artifacts');
fs.mkdirSync(out, { recursive: true });
if (!src) { console.log('STUDIO_DIR is not set; nothing to collect'); process.exit(0); }

const files = ['.damex/smoke.json', '.damex/doctor.json', '.damex/doctor-no-ffmpeg.json', 'jobs/_sample/out/sample-preview.mp4'];
for (const f of files) {
  try { fs.copyFileSync(path.join(src, ...f.split('/')), path.join(out, path.basename(f))); console.log('collected ' + f); }
  catch { console.log('missing: ' + f); }
}
// Plain per-file copy, not fs.cpSync: on the Windows runner cpSync on the accented path ended the
// process from inside this try/catch (see probe-cpsync.mjs).
try {
  const logs = path.join(src, '.damex', 'logs');
  fs.mkdirSync(path.join(out, 'logs'), { recursive: true });
  for (const name of fs.readdirSync(logs)) {
    if (fs.statSync(path.join(logs, name)).isFile()) fs.copyFileSync(path.join(logs, name), path.join(out, 'logs', name));
  }
  console.log('collected logs');
} catch { console.log('missing: .damex/logs'); }
