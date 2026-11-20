// Core install, same on every OS: check Node, install the engine's packages, fetch the render browser. No keys, no admin.
//   node setup/runtime/install.mjs
//   node setup/runtime/install.mjs --with <capability>   prints the exact commands for this OS (winget / apt / brew). It installs
//                                                        nothing and never asks for admin: you run the commands yourself.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isMain, NODE_FLOOR, STUDIO, fixFor, nodeOk, npmInvocation, venvPython } from './resolve.mjs';
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
  ffmpeg: 'a full ffmpeg from your package manager (the same as mastering-checks)',
  uv: 'uv, the Python tool installer',
  earshot: 'earshot (the sound-listening tool) through uv, then its models (about 1 GB)',
};

export function parseArgs(argv) {
  const withs = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--with') withs.push(argv[++i]);
    else if (argv[i].startsWith('--with=')) withs.push(argv[i].slice(7));
  }
  return { withs: withs.filter(Boolean) };
}

const WHISPER_BASE = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';

/**
 * What to run, for this OS, to add a capability. Pure: nothing is executed or downloaded here. Each entry is
 * { commands: [exact lines to paste], notes: [plain sentences] }.
 */
export function capabilityPlan(id, { platform = process.platform, arch = process.arch } = {}) {
  const win = platform === 'win32';
  const models = win ? '$HOME\\.cache\\hyperframes\\whisper\\models' : '$HOME/.cache/hyperframes/whisper/models';
  const mk = win ? `New-Item -ItemType Directory -Force "${models}"` : `mkdir -p "${models}"`;
  const dl = (file) => `${win ? 'curl.exe' : 'curl'} -L --fail -o "${models}${win ? '\\' : '/'}${file}" ${WHISPER_BASE}/${file}`;
  const venv = venvPython('tools/footage/.venv', platform);
  const uvStep = () => ({ commands: [fixFor('uv', platform)], notes: ['uv is installed for you only (no admin). On Linux the official installer is a script: read it first if you like, then run the line.'] });
  switch (id) {
    case 'ffmpeg':
    case 'mastering-checks':
      return { commands: [fixFor('ffmpeg', platform)], notes: ['Needed for mastering, splicing one scene and contact sheets. Or set DAMEX_FFMPEG to a full ffmpeg you already have. A plain render needs only ffprobe, which comes with the studio.'] };
    case 'uv': return uvStep();
    case 'footage-audio-python':
      return { commands: [fixFor('uv', platform), 'uv venv --python 3.12 tools/footage/.venv', `uv pip install --python ${venv} -r tools/footage/requirements.txt`], notes: ['About 1 GB. Run the commands from the studio folder.'] };
    case 'transcribe':
      return { commands: [fixFor('whisper', platform), mk, dl('ggml-small.en.bin'), dl('ggml-large-v3-turbo-q5_0.bin')], notes: ['The first model is about 490 MB (voice checks), the second about 570 MB (cutting raw footage).'] };
    case 'demucs':
      return { commands: [fixFor('uv', platform), 'uv tool install --python 3.12 "demucs==4.1.0" --with numpy --with soundfile'], notes: ['About 1-2 GB with PyTorch.'] };
    case 'earshot':
      return { commands: [fixFor('uv', platform), 'uv tool install --python 3.12 "earshot @ git+https://github.com/Leonxlnx/earshot@4ac3d2a"', 'node tools/audio/earshot.mjs doctor --fetch'], notes: ['About 1 GB with its models.'] };
    case 'tesseract': return { commands: [fixFor('tesseract', platform)], notes: [] };
    case 'yt-dlp': return { commands: [fixFor('yt-dlp', platform)], notes: [] };
    case 'deep-filter': {
      // Release assets listed for DeepFilterNet v0.5.6 on GitHub (checked 2026-11-19). Linux x64 uses the static musl
      // build (runs on any distribution); Windows on Arm runs the x64 build under emulation.
      const asset = {
        'darwin-arm64': 'aarch64-apple-darwin', 'darwin-x64': 'x86_64-apple-darwin',
        'linux-x64': 'x86_64-unknown-linux-musl', 'linux-arm64': 'aarch64-unknown-linux-gnu',
        'win32-x64': 'x86_64-pc-windows-msvc.exe', 'win32-arm64': 'x86_64-pc-windows-msvc.exe',
      }[`${platform}-${arch}`];
      if (!asset) return { commands: [], notes: ['Noise removal has no DeepFilterNet build for this system.'] };
      const url = `https://github.com/Rikorose/DeepFilterNet/releases/download/v0.5.6/deep-filter-0.5.6-${asset}`;
      return platform === 'win32'
        ? { commands: ['New-Item -ItemType Directory -Force tools\\footage\\bin | Out-Null', `Invoke-WebRequest -Uri ${url} -OutFile tools\\footage\\bin\\deep-filter.exe`], notes: ['Run in PowerShell from the studio folder. About 28 MB.'] }
        : { commands: ['mkdir -p tools/footage/bin', `curl -L --fail -o tools/footage/bin/deep-filter ${url}`, 'chmod +x tools/footage/bin/deep-filter'], notes: ['About 28 MB.'] };
    }
    case 'capture-web': return { commands: [fixFor('chrome', platform)], notes: ['Uses the Google Chrome already installed. Set DAMEX_CHROME to point at a different one.'] };
    case 'voice': return { commands: [], notes: ['Add ELEVENLABS_API_KEY=... to .env (optional, only for generated voice-over).'] };
    case 'capture-terminal':
      return { commands: platform === 'linux' ? ['sudo apt install bsdutils'] : [], notes: [platform === 'win32' ? 'Terminal capture needs macOS or Linux. On Windows, record the terminal yourself and import the recording.' : 'Uses the system `script` program.'] };
    case 'capture-ios': return { commands: [], notes: [platform === 'darwin' ? 'Needs full Xcode from the Mac App Store.' : 'The iOS Simulator exists only on a Mac. Record the app yourself and import the recording.'] };
    case 'capture-android': return { commands: [], notes: ['Needs Android Studio and a virtual device (adb is found in ANDROID_HOME, or the default SDK folder for this OS). Not claimed as tested yet.'] };
    default: return null;
  }
}

async function main() {
  const { withs } = parseArgs(process.argv.slice(2));
  if (withs.length) {
    let unknown = false;
    for (const w of withs) {
      const plan = capabilityPlan(w);
      if (!plan) { console.log(`--with ${w}: unknown capability. Known: ${Object.keys(CAPABILITIES).join(', ')}.`); unknown = true; continue; }
      console.log(`\n--with ${w}: ${CAPABILITIES[w]}.`);
      if (plan.commands.length) { console.log('Run, in this order:'); plan.commands.forEach((c) => console.log(`  ${c}`)); }
      plan.notes.forEach((n) => console.log(n));
    }
    console.log('\nNothing was installed or downloaded: these are the commands to run yourself (none needs admin rights except where sudo or winget is shown, and those ask you). Then check with: node setup/runtime/doctor.mjs');
    process.exit(unknown ? 2 : 0);
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
  console.log(`\n== 1 of 3  Engine packages (${lock ? 'npm ci' : 'npm install'})`);
  let r = await runLogged(npm.cmd, [...npm.prefix, lock ? 'ci' : 'install', '--no-audit', '--no-fund'], { cwd: engine, logName: 'install-npm' });
  if (r.code !== 0) { console.error(`\nPackage install failed (exit ${r.code}). Full log: ${r.logFile}`); process.exit(1); }

  console.log('\n== 2 of 3  Render browser (Remotion Chrome Headless Shell, one time)');
  r = await runLogged(npx.cmd, [...npx.prefix, 'remotion', 'browser', 'ensure'], { cwd: engine, logName: 'install-browser' });
  if (r.code !== 0) { console.error(`\nThe render browser did not download (exit ${r.code}). Full log: ${r.logFile}`); process.exit(1); }

  // The capture tool (playwright-core, no browser download: it drives the Google Chrome already installed). Small, and
  // capture.mjs tells people to run this file when it is missing, so it belongs to the core install.
  const capture = path.join(STUDIO, 'tools', 'capture');
  console.log('\n== 3 of 3  Capture tool packages');
  if (fs.existsSync(path.join(capture, 'package.json'))) {
    const capLock = fs.existsSync(path.join(capture, 'package-lock.json'));
    r = await runLogged(npm.cmd, [...npm.prefix, capLock ? 'ci' : 'install', '--no-audit', '--no-fund'], { cwd: capture, logName: 'install-capture' });
    if (r.code !== 0) console.error(`The capture tool did not install (exit ${r.code}); videos still render. Full log: ${r.logFile}`);
  } else console.log('No capture tool in this copy; skipped.');

  console.log('\nCore install done. Check it: node setup/runtime/doctor.mjs   Then: node setup/runtime/sample.mjs');
}

if (isMain(import.meta.url)) await main();
