#!/usr/bin/env node
// Runs any earshot command with the studio's settings: its models in tools/audio/.earshot/, offline, telemetry off,
// caches where Claude's command sandbox can write. Use it wherever the earshot skill says "earshot ...":
//
//   node tools/audio/earshot.mjs match candidate.wav "a soft paper whoosh"
//   node tools/audio/earshot.mjs rank candidates/ "a soft paper whoosh"
//   node tools/audio/earshot.mjs ab before.wav after.wav
//   node tools/audio/earshot.mjs realness stems/
//
// For a whole film or mix, tools/audio/listen.mjs runs measure, timeline, sheet and critique in one go with the
// job's cues. Never run `earshot llm` (it uploads audio to Gemini) without the owner's yes.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { which } from '../../setup/runtime/resolve.mjs';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOME = path.join(STUDIO, 'tools', 'audio', '.earshot');

/** Where the earshot program is, or null. PATH first, then where `uv tool install` / pipx put it. */
export function earshotBin() {
  const onPath = which('earshot');
  if (onPath) return onPath;
  const exe = process.platform === 'win32' ? 'earshot.exe' : 'earshot';
  const home = os.homedir();
  const spots = [path.join(home, '.local', 'bin', exe)];
  if (process.platform === 'win32' && process.env.APPDATA) spots.push(path.join(process.env.APPDATA, 'Python', 'Scripts', exe));
  return spots.find((s) => fs.existsSync(s)) ?? null;
}

export const earshotEnv = (base = process.env) => ({
  ...base, EARSHOT_HOME: HOME, EARSHOT_OFFLINE: '1', HF_HUB_OFFLINE: '1', HF_HUB_DISABLE_TELEMETRY: '1',
  TOKENIZERS_PARALLELISM: 'false', NUMBA_CACHE_DIR: path.join(HOME, 'numba'), MPLCONFIGDIR: path.join(HOME, 'matplotlib'),
});

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const bin = earshotBin();
  if (!bin) { console.log('earshot is not installed. Run: node setup/runtime/install.mjs --with earshot'); process.exit(2); }
  if (args[0] === 'llm') { console.log('earshot llm uploads audio to Gemini: ask the owner first, then run it by hand.'); process.exit(2); }
  // A .cmd shim cannot be started without a shell on Windows; earshot installs as an .exe there.
  const child = spawn(bin, args, { stdio: 'inherit', env: earshotEnv(), windowsHide: true });
  child.on('error', (e) => { console.log(`Could not start earshot: ${e.message}`); process.exit(127); });
  child.on('close', (code) => process.exit(code ?? 1));
}
