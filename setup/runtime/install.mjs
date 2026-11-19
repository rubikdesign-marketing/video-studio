// Core install, same on every OS: check Node, install the engine's packages, fetch the render browser. No keys, no admin.
//   node setup/runtime/install.mjs
//   node setup/runtime/install.mjs --with <capability>   not implemented yet: says what it would fetch, exits 2
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NODE_FLOOR, STUDIO, fixFor, nodeOk, npmInvocation } from './resolve.mjs';
import { runLogged } from './run.mjs';

export const CAPABILITIES = {
  'mastering-checks': 'a pinned static FFmpeg build into .runtime/ffmpeg (checked against its SHA-256), with the filters mastering needs',
  'capture-web': 'nothing to download: it uses the Google Chrome already on this computer (set DAMEX_CHROME to point at it)',
  'footage-audio-python': 'uv, then a Python 3.12 environment in tools/footage/.venv with tools/footage/requirements.txt (about 1 GB)',
  voice: 'nothing to download: it needs your ElevenLabs key in .env',
  transcribe: 'whisper.cpp (whisper-cli) and the speech model (about 490 MB, plus 570 MB for footage)',
  demucs: 'Demucs 4.1.0 through uv (about 1-2 GB with PyTorch)',
  'deep-filter': 'DeepFilterNet 0.5.6, the build for this operating system (about 28 MB)',
  tesseract: 'Tesseract OCR from your package manager',
  'yt-dlp': 'yt-dlp from your package manager',
  'capture-terminal': 'nothing to download; macOS only for now',
  'capture-ios': 'nothing to download; needs full Xcode on a Mac',
  'capture-android': 'not available yet',
};

export function parseArgs(argv) {
  const withs = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--with') withs.push(argv[++i]);
    else if (argv[i].startsWith('--with=')) withs.push(argv[i].slice(7));
  }
  return { withs: withs.filter(Boolean) };
}

async function main() {
  const { withs } = parseArgs(process.argv.slice(2));
  if (withs.length) {
    for (const w of withs) {
      console.log(CAPABILITIES[w]
        ? `--with ${w}: would fetch ${CAPABILITIES[w]}.`
        : `--with ${w}: unknown capability. Known: ${Object.keys(CAPABILITIES).join(', ')}.`);
    }
    console.log('\nNot implemented yet: nothing was installed. The core install is separate: run this command without --with.');
    process.exit(2);
  }

  console.log(`Node ${process.versions.node}`);
  if (!nodeOk(process.versions.node)) {
    console.error(`Node ${process.versions.node} is too old or not supported. The studio needs Node ${NODE_FLOOR} or newer (not 23).\n  ${fixFor('node')}`);
    process.exit(1);
  }
  const engine = path.join(STUDIO, 'engine');
  if (!fs.existsSync(path.join(engine, 'package.json'))) {
    console.error('The engine folder is missing. Pull the latest studio from GitHub.');
    process.exit(1);
  }

  const npm = npmInvocation('npm');
  const npx = npmInvocation('npx');
  const lock = fs.existsSync(path.join(engine, 'package-lock.json'));
  console.log(`\n== 1 of 2  Engine packages (${lock ? 'npm ci' : 'npm install'})`);
  let r = await runLogged(npm.cmd, [...npm.prefix, lock ? 'ci' : 'install', '--no-audit', '--no-fund'], { cwd: engine, logName: 'install-npm' });
  if (r.code !== 0) { console.error(`\nPackage install failed (exit ${r.code}). Full log: ${r.logFile}`); process.exit(1); }

  console.log('\n== 2 of 2  Render browser (Remotion Chrome Headless Shell, one time)');
  r = await runLogged(npx.cmd, [...npx.prefix, 'remotion', 'browser', 'ensure'], { cwd: engine, logName: 'install-browser' });
  if (r.code !== 0) { console.error(`\nThe render browser did not download (exit ${r.code}). Full log: ${r.logFile}`); process.exit(1); }

  console.log('\nCore install done. Check it: node setup/runtime/doctor.mjs   Then: node setup/runtime/sample.mjs');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
