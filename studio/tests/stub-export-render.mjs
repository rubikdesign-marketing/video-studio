#!/usr/bin/env node
// A stand-in for tools/film/render.mjs in the export tests: `stub-export-render.mjs <job folder> <preview|master>`.
// Makes a small 16:9 film at out/preview.mp4 (or out/<job>.mp4). STUB_GATE: wait until that file exists. STUB_FAIL: exit 1.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const [jobDir, quality] = process.argv.slice(2);
if (process.env.STUB_LOG) fs.appendFileSync(process.env.STUB_LOG, `${path.basename(jobDir)} ${quality}\n`);
if (process.env.STUB_PIDFILE) fs.writeFileSync(process.env.STUB_PIDFILE, String(process.pid));
if (process.env.STUB_GATE) while (!fs.existsSync(process.env.STUB_GATE)) await new Promise((r) => setTimeout(r, 50));
if (process.env.STUB_FAIL) { console.error('Chrome could not start.'); process.exit(1); }
const out = path.join(jobDir, 'out', quality === 'master' ? `${path.basename(jobDir)}.mp4` : 'preview.mp4');
const tmp = path.join(path.dirname(out), `.stub.partial-${process.pid}.mp4`);
fs.mkdirSync(path.dirname(out), { recursive: true });
const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=10:duration=0.5', '-pix_fmt', 'yuv420p', tmp]);
if (r.status !== 0) process.exit(2);
fs.renameSync(tmp, out);
