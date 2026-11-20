// Exports the _sample film with no keys and no system FFmpeg.
//   node setup/runtime/sample.mjs [--full] [--no-captions]
// Preview look by default (half size, small file); --full renders the full-quality settings.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMain, STUDIO, npmInvocation, resolveBinary, runContext } from './resolve.mjs';
import { capture, runLogged } from './run.mjs';

export function renderArgs({ composition, output, full, propsFile }) {
  return [
    'remotion', 'render', composition, output,
    ...(propsFile ? ['--props', propsFile] : []),
    ...(full ? ['--crf', '16', '--jpeg-quality', '95'] : ['--scale', '0.5', '--crf', '28', '--jpeg-quality', '70']),
  ];
}

async function main() {
  const args = process.argv.slice(2);
  const full = args.includes('--full');
  const noCaptions = args.includes('--no-captions');
  const engine = path.join(STUDIO, 'engine');
  const jobDir = path.join(STUDIO, 'jobs', '_sample');
  const fail = (msg) => { console.error(msg); process.exit(1); };

  if (!fs.existsSync(path.join(engine, 'node_modules', 'remotion'))) fail('The engine packages are not installed. Run: node setup/runtime/install.mjs');
  const probe = resolveBinary('ffprobe');
  if (!probe.path) fail(probe.error ?? 'ffprobe was not found. Run: node setup/runtime/install.mjs   (Remotion brings its own copy)');

  // The film imports its sound and captions from engine/public/jobs/sample/ (made again on each machine, never kept in git).
  const pub = path.join(engine, 'public', 'jobs', 'sample');
  fs.mkdirSync(pub, { recursive: true });
  fs.copyFileSync(path.join(jobDir, 'audio', 'voice.wav'), path.join(pub, 'audio.wav'));
  fs.copyFileSync(path.join(jobDir, 'audio', 'captions.json'), path.join(pub, 'captions.json'));

  const outDir = path.join(jobDir, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const final = path.join(outDir, full ? 'sample.mp4' : 'sample-preview.mp4');
  const partial = path.join(outDir, `.sample.partial-${process.pid}.mp4`);
  let propsFile = null;
  if (noCaptions) {
    propsFile = path.join(os.tmpdir(), `damex-sample-props-${process.pid}.json`);
    fs.writeFileSync(propsFile, JSON.stringify({ captions: false }));
  }
  const cleanup = () => { fs.rmSync(partial, { force: true }); if (propsFile) fs.rmSync(propsFile, { force: true }); };
  process.on('SIGINT', () => { cleanup(); process.exit(130); }); // runLogged also stops the child on SIGINT

  const npx = npmInvocation('npx');
  console.log(`Rendering the sample film (${full ? 'full quality' : 'preview look'})...`);
  const r = await runLogged(npx.cmd, [...npx.prefix, ...renderArgs({ composition: 'sample', output: partial, full, propsFile })], { cwd: engine, logName: 'sample-render' });
  if (r.code !== 0 || !fs.existsSync(partial)) { cleanup(); fail(`The render did not finish (exit ${r.code ?? r.signal}). Full log: ${r.logFile}`); }

  const ctx = runContext(probe);
  const p = await capture(probe.path, ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type', '-of', 'json', partial], ctx);
  let info;
  try { info = JSON.parse(p.out); } catch { cleanup(); fail(`ffprobe could not read the result (${probe.path}): ${p.err.trim().split('\n')[0]}`); }
  const duration = parseFloat(info.format?.duration);
  const size = parseInt(info.format?.size, 10);
  const film = JSON.parse(fs.readFileSync(path.join(engine, 'src', 'jobs', 'sample', 'film.json'), 'utf8'));
  const hasVideo = (info.streams ?? []).some((s) => s.codec_type === 'video');
  if (!hasVideo || !(Math.abs(duration - film.duration) < 0.5)) { cleanup(); fail(`The file is not what the film says (duration ${duration}s, expected about ${film.duration}s).`); }
  fs.renameSync(partial, final);
  if (propsFile) fs.rmSync(propsFile, { force: true });
  console.log(`\nwrote ${final}\n  duration ${duration.toFixed(2)} s, size ${(size / 1048576).toFixed(2)} MB (probed with ${probe.source})`);
}

if (isMain(import.meta.url)) await main();
