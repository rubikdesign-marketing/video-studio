// Health check, same on every OS.
//   node setup/runtime/doctor.mjs          human output
//   node setup/runtime/doctor.mjs --json   also writes .damex/doctor.json (no keys, home folder shown as ~)
// Exit 1 only when a core check fails. Capabilities that are missing are reported, never fatal.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capture } from './run.mjs';
import {
  NODE_FLOOR, STUDIO, compositorPackage, currentOs, fixFor, nodeOk, npmInvocation, redact,
  resolveBinary, resolveChrome, resolveUv, runContext, venvPython, which,
} from './resolve.mjs';

const MASTER_FILTERS = ['drawtext', 'loudnorm', 'ebur128', 'signalstats', 'tblend', 'showspectrumpic', 'sidechaincompress'];

const check = (id, tier, status, found, fix = '') => ({ id, tier, status, found, fix });

function releaseOf(root) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(root, 'RELEASE.json'), 'utf8'));
    if (j.version) return String(j.version);
  } catch { /* not a release checkout */ }
  try { return fs.readFileSync(path.join(root, '.video-engine-release'), 'utf8').trim().split('\n')[0] || null; } catch { return null; }
}

function remotionBrowserDir(root) {
  const dir = path.join(root, 'engine', 'node_modules', '.remotion');
  try { return fs.readdirSync(dir).filter((n) => n.startsWith('chrome-headless-shell')).map((n) => path.join(dir, n)); } catch { return []; }
}

/** Build the whole report. `root` and `env` are arguments so tests can aim it at a scratch folder. */
export async function buildReport({ root = STUDIO, env = process.env, platform = process.platform, arch = process.arch, nodeVersion = process.versions.node } = {}) {
  const opts = { root, env, platform, arch };
  const checks = [];

  // ---- core
  checks.push(nodeOk(nodeVersion)
    ? check('node', 'core', 'pass', `Node ${nodeVersion}`)
    : check('node', 'core', 'fail', `Node ${nodeVersion} (needs ${NODE_FLOOR} or newer, not 23)`, fixFor('node', platform)));

  const npm = npmInvocation('npm', { platform });
  const npmv = await capture(npm.cmd, [...npm.prefix, '--version'], { env });
  checks.push(npmv.code === 0
    ? check('npm', 'core', 'pass', `npm ${npmv.out.trim()}`)
    : check('npm', 'core', 'fail', 'npm did not start', 'npm comes with Node: reinstall Node. ' + fixFor('node', platform)));

  const bad = ['DAMEX_FFMPEG', 'DAMEX_FFPROBE', 'DAMEX_CHROME'].filter((k) => env[k] && !fs.existsSync(env[k]));
  checks.push(bad.length
    ? check('env-overrides', 'core', 'fail', bad.map((k) => `${k} points to a file that does not exist: ${env[k]}`).join('; '),
      `unset ${bad.join(' ')} or point ${bad.length > 1 ? 'them' : 'it'} at a real file`)
    : check('env-overrides', 'core', 'pass', 'no broken DAMEX_* overrides'));

  const remotionPkg = path.join(root, 'engine', 'node_modules', 'remotion', 'package.json');
  let remotionVersion = null;
  try { remotionVersion = JSON.parse(fs.readFileSync(remotionPkg, 'utf8')).version; } catch { /* not installed */ }
  checks.push(remotionVersion
    ? check('engine-packages', 'core', 'pass', `Remotion ${remotionVersion}`)
    : check('engine-packages', 'core', 'fail', 'engine packages are not installed', 'node setup/runtime/install.mjs'));

  const shells = remotionBrowserDir(root);
  checks.push(shells.length
    ? check('render-browser', 'core', 'pass', 'Remotion Chrome Headless Shell present')
    : check('render-browser', 'core', 'fail', 'the render browser is not downloaded', 'node setup/runtime/install.mjs   (or: cd engine && npx remotion browser ensure)'));

  const probe = resolveBinary('ffprobe', opts);
  const probeRun = probe.path ? await capture(probe.path, ['-version'], runContext(probe, { env, platform })) : null;
  checks.push(probe.path && probeRun.code !== 0
    ? check('ffprobe', 'core', 'fail', `${probe.path} (${probe.source}) did not run: ${probeRun.err.trim().split('\n')[0]}`, 'node setup/runtime/install.mjs   (or set DAMEX_FFPROBE to a working ffprobe)')
    : probe.path
    ? check('ffprobe', 'core', 'pass', `${probe.path} (${probe.source})`)
    : check('ffprobe', 'core', 'fail', probe.error ?? 'ffprobe not found',
      probe.error ? `unset DAMEX_FFPROBE or point it at ffprobe` : 'node setup/runtime/install.mjs   (the packages bring a copy inside Remotion)'));

  const sampleFiles = ['jobs/_sample/job.json', 'jobs/_sample/audio/voice.wav', 'jobs/_sample/audio/captions.json', 'engine/src/jobs/sample/Film.tsx'];
  const missing = sampleFiles.filter((f) => !fs.existsSync(path.join(root, f)));
  checks.push(missing.length
    ? check('sample-job', 'core', 'fail', `missing: ${missing.join(', ')}`, 'pull the latest studio from GitHub')
    : check('sample-job', 'core', 'pass', 'the _sample film is complete'));

  // ---- capabilities
  const capabilities = {};
  const cap = (id, state, found, fix = '') => {
    capabilities[id] = state;
    checks.push(check(id, 'capability', state === 'ready' ? 'pass' : 'skip', found, fix));
  };

  const ff = resolveBinary('ffmpeg', opts);
  if (ff.path) {
    const filters = await capture(ff.path, ['-hide_banner', '-filters'], { env });
    const lacks = MASTER_FILTERS.filter((f) => !new RegExp(`\\s${f}\\s`).test(filters.out));
    if (filters.code === 0 && !lacks.length) cap('mastering-checks', 'ready', `${ff.path} (${ff.source})`);
    else cap('mastering-checks', 'missing', `ffmpeg at ${ff.path} lacks: ${lacks.join(', ') || 'it did not run'}`, fixFor('ffmpeg', platform));
  } else {
    cap('mastering-checks', 'missing', ff.error ?? 'no full ffmpeg found (Remotion\'s bundled copy is not enough for mastering)',
      ff.error ? 'unset DAMEX_FFMPEG or point it at a real ffmpeg' : fixFor('ffmpeg', platform));
  }

  const chrome = resolveChrome(opts);
  chrome.path ? cap('capture-web', 'ready', `${chrome.path} (${chrome.source})`)
    : cap('capture-web', 'missing', chrome.error ?? 'Google Chrome not found', chrome.error ? 'unset DAMEX_CHROME or point it at chrome' : fixFor('chrome', platform));

  const uv = resolveUv({ env, platform });
  const venv = venvPython(path.join(root, 'tools', 'footage', '.venv'), platform);
  if (uv.path && fs.existsSync(venv)) cap('footage-audio-python', 'ready', `uv + ${venv}`);
  else cap('footage-audio-python', 'missing', uv.path ? 'the footage Python 3.12 environment is not set up' : 'uv is not installed',
    uv.path ? 'node setup/runtime/install.mjs --with footage-audio-python' : fixFor('uv', platform));

  const key = (() => { try { return /^ELEVENLABS_API_KEY=.+/m.test(fs.readFileSync(path.join(root, '.env'), 'utf8')); } catch { return false; } })();
  cap('voice', key ? 'ready' : 'missing', key ? 'ElevenLabs key is set' : 'no ElevenLabs key (only needed for generated voice-over)', 'add ELEVENLABS_API_KEY= to .env (optional)');

  const tool = (id, bin, fixKey) => {
    const hit = which(platform === 'win32' ? bin : bin, { env, platform });
    cap(id, hit ? 'ready' : 'missing', hit ?? `${bin} not found`, fixFor(fixKey, platform));
  };
  tool('transcribe', 'whisper-cli', 'whisper');
  tool('tesseract', 'tesseract', 'tesseract');
  tool('yt-dlp', 'yt-dlp', 'yt-dlp');

  const df = path.join(root, 'tools', 'footage', 'bin', platform === 'win32' ? 'deep-filter.exe' : 'deep-filter');
  cap('deep-filter', fs.existsSync(df) ? 'ready' : 'missing', fs.existsSync(df) ? df : 'not downloaded', 'node setup/runtime/install.mjs --with deep-filter');
  const demucs = which('demucs', { env, platform }) || [path.join(os.homedir(), '.local', 'bin', 'demucs')].find((p) => fs.existsSync(p));
  cap('demucs', demucs ? 'ready' : 'missing', demucs || 'not installed (optional)', 'node setup/runtime/install.mjs --with demucs');

  platform === 'darwin' && fs.existsSync('/usr/bin/script')
    ? cap('capture-terminal', 'ready', '/usr/bin/script')
    : cap('capture-terminal', 'unsupported', `not claimed on ${platform} until tested`, 'macOS only for now');
  if (platform === 'darwin') {
    const xc = await capture('xcrun', ['--find', 'simctl'], { env });
    cap('capture-ios', xc.code === 0 ? 'ready' : 'missing', xc.code === 0 ? 'Xcode simulator tools found' : 'full Xcode is not installed', 'install Xcode from the Mac App Store (optional)');
  } else cap('capture-ios', 'unsupported', 'macOS with Xcode only', 'use a screen recording import instead');
  cap('capture-android', 'unsupported', 'not claimed until tested', '');

  return {
    schema: 1,
    release: releaseOf(root),
    ...currentOsFor(platform, arch),
    node: nodeVersion,
    checks,
    capabilities,
  };
}

function currentOsFor(platform, arch) { return { os: platform, arch }; }

export function printHuman(report) {
  const mark = { pass: 'ok  ', fail: 'NEED', skip: 'opt ' };
  for (const tier of ['core', 'capability']) {
    console.log(tier === 'core' ? '\nCore (needed to open the studio and export the sample)' : '\nOptional capabilities (each is fetched only when you ask)');
    for (const c of report.checks.filter((x) => x.tier === tier)) {
      console.log(`  ${mark[c.status]}  ${c.id}: ${c.found}`);
      if (c.status !== 'pass' && c.fix) console.log(`        -> ${c.fix}`);
    }
  }
  const bad = report.checks.filter((c) => c.tier === 'core' && c.status === 'fail').length;
  console.log(bad ? `\n${bad} core check${bad > 1 ? 's' : ''} need attention.` : '\nCore is ready. In the studio, say: make a video.');
}

async function main() {
  const json = process.argv.includes('--json');
  const report = await buildReport();
  const text = redact(JSON.stringify(report, null, 2) + '\n');
  const redacted = JSON.parse(text);
  if (json) {
    const dir = path.join(STUDIO, '.damex');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'doctor.json'), text);
    printHuman(redacted);
    console.log(`\nWrote ${path.join('.damex', 'doctor.json')}`);
  } else printHuman(redacted);
  process.exit(report.checks.some((c) => c.tier === 'core' && c.status === 'fail') ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
