// Finds the programs the studio needs, the same way on macOS, Linux and Windows.
// Everything here takes its inputs (platform, env, file test) as arguments so the tests can pretend to be another OS.
// No shell is ever used: callers spawn(cmd, argsArray).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RUNTIME_DIR = path.dirname(fileURLToPath(import.meta.url));
export const STUDIO = path.resolve(RUNTIME_DIR, '..', '..');

/** Node floor, from engine/package.json engines "^22.13.0 || >=24" (23 is not in that range). */
export const NODE_FLOOR = '22.13';
export function nodeOk(version) {
  const [major, minor] = String(version).replace(/^v/, '').split('.').map(Number);
  return (major === 22 && minor >= 13) || major >= 24;
}

/** True when this file is the one node was started with. Compares real paths: the studio can sit behind a symlink
 *  (macOS /var -> /private/var, a linked folder), and the loader reports the resolved path while argv keeps the typed one. */
export function isMain(metaUrl, argv1 = process.argv[1]) {
  if (!argv1) return false;
  const real = (f) => { try { return fs.realpathSync(f); } catch { return path.resolve(f); } };
  return real(argv1) === real(fileURLToPath(metaUrl));
}

const pathFor = (platform) => (platform === 'win32' ? path.win32 : path.posix);
const exe = (name, platform) => (platform === 'win32' ? `${name}.exe` : name);

/** The Python inside a virtual environment: Scripts\python.exe on Windows, bin/python elsewhere. */
export function venvPython(venvDir, platform = process.platform) {
  const p = pathFor(platform);
  return platform === 'win32' ? p.join(venvDir, 'Scripts', 'python.exe') : p.join(venvDir, 'bin', 'python');
}

/** glibc or musl, for Linux (Alpine and similar are musl). null elsewhere. Remotion ships a compositor for each. */
export function detectLibc(platform = process.platform) {
  if (platform !== 'linux') return null;
  try { return process.report?.getReport?.().header?.glibcVersionRuntime ? 'gnu' : 'musl'; } catch { return 'gnu'; }
}

/**
 * The Remotion compositor package that carries this platform's bundled ffmpeg and ffprobe, or null if unsupported.
 * darwin arm64 and x64, linux x64 and arm64 (glibc "gnu" or "musl"), win32 x64 (msvc). Windows on Arm has none: run the
 * x64 Node there, which Windows runs under emulation.
 */
export function compositorPackage(platform = process.platform, arch = process.arch, libc = 'gnu') {
  if (platform === 'darwin' && (arch === 'arm64' || arch === 'x64')) return `compositor-darwin-${arch}`;
  if (platform === 'linux' && (arch === 'arm64' || arch === 'x64')) return `compositor-linux-${arch}-${libc === 'musl' ? 'musl' : 'gnu'}`;
  if (platform === 'win32' && arch === 'x64') return 'compositor-win32-x64-msvc';
  return null;
}

/**
 * How to run a resolved binary. Remotion's copy loads its libraries from its own folder (dyld on macOS only looks in the
 * current folder; Linux needs LD_LIBRARY_PATH), so it must run from that folder.
 */
export function runContext(resolved, { env = process.env, platform = process.platform } = {}) {
  if (resolved?.source !== 'remotion') return { cwd: undefined, env };
  const p = pathFor(platform);
  const cwd = p.dirname(resolved.path);
  return { cwd, env: platform === 'linux' ? { ...env, LD_LIBRARY_PATH: [cwd, env.LD_LIBRARY_PATH].filter(Boolean).join(':') } : env };
}

/** Where a command is found on PATH. Honours PATHEXT on Windows. */
export function which(name, { env = process.env, platform = process.platform, exists = fs.existsSync } = {}) {
  const p = pathFor(platform);
  const sep = platform === 'win32' ? ';' : ':';
  const dirs = String(env.PATH ?? env.Path ?? '').split(sep).filter(Boolean);
  const exts = platform === 'win32' ? ['', ...String(env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';').filter(Boolean)] : [''];
  for (const dir of dirs) for (const ext of exts) {
    const candidate = p.join(dir, name + ext);
    if (exists(candidate)) return candidate;
  }
  return null;
}

/** Package-manager locations, per OS. */
export function packageManagerDirs({ platform = process.platform, arch = process.arch, env = process.env } = {}) {
  if (platform === 'darwin') {
    return ['/opt/homebrew/opt/ffmpeg-full/bin', '/usr/local/opt/ffmpeg-full/bin', '/opt/homebrew/bin', '/usr/local/bin', '/opt/local/bin'];
  }
  if (platform === 'linux') return ['/usr/bin', '/usr/local/bin', '/snap/bin'];
  const p = path.win32;
  const dirs = [];
  if (env.LOCALAPPDATA) dirs.push(p.join(env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Links'));
  if (env.ProgramData) dirs.push(p.join(env.ProgramData, 'chocolatey', 'bin'));
  if (env.USERPROFILE) dirs.push(p.join(env.USERPROFILE, 'scoop', 'shims'));
  return dirs;
}

/**
 * Where a program lives. Order (contract): env override, then Remotion's own copy (ffprobe only), then
 * .runtime/<tool>, then package-manager paths, then PATH.
 * Returns { path, source } or { path: null, error } when an override points nowhere.
 */
export function resolveBinary(tool, opts = {}) {
  const { env = process.env, platform = process.platform, arch = process.arch, root = STUDIO, exists = fs.existsSync } = opts;
  const p = pathFor(platform);
  const name = exe(tool, platform);
  const override = { ffmpeg: 'DAMEX_FFMPEG', ffprobe: 'DAMEX_FFPROBE' }[tool];
  if (override && env[override]) {
    return exists(env[override])
      ? { path: env[override], source: override }
      : { path: null, source: override, error: `${override} points to a file that does not exist: ${env[override]}` };
  }
  if (tool === 'ffprobe' || tool === 'ffmpeg-bundled') {
    const pkg = compositorPackage(platform, arch, opts.libc ?? detectLibc(platform) ?? 'gnu');
    const bundled = pkg && p.join(root, 'engine', 'node_modules', '@remotion', pkg, exe(tool === 'ffprobe' ? 'ffprobe' : 'ffmpeg', platform));
    if (bundled && exists(bundled)) return { path: bundled, source: 'remotion' };
    if (tool === 'ffmpeg-bundled') return { path: null, source: 'remotion' };
  }
  const local = p.join(root, '.runtime', tool, name);
  const localBin = p.join(root, '.runtime', tool, 'bin', name);
  for (const c of [local, localBin]) if (exists(c)) return { path: c, source: '.runtime' };
  for (const dir of packageManagerDirs({ platform, arch, env })) {
    const c = p.join(dir, name);
    if (exists(c)) return { path: c, source: 'package manager' };
  }
  const found = which(name, { env, platform, exists });
  return found ? { path: found, source: 'PATH' } : { path: null, source: null };
}

/** Where Chrome might be, in order. DAMEX_CHROME first. */
export function chromeCandidates({ platform = process.platform, env = process.env } = {}) {
  const list = [];
  if (env.DAMEX_CHROME) list.push(env.DAMEX_CHROME);
  if (platform === 'darwin') {
    list.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    if (env.HOME) list.push(path.posix.join(env.HOME, 'Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'));
  } else if (platform === 'linux') {
    list.push('/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium');
  } else if (platform === 'win32') {
    const p = path.win32;
    for (const base of [env.ProgramFiles, env['ProgramFiles(x86)'], env.LOCALAPPDATA]) {
      if (base) list.push(p.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'));
    }
  }
  return list;
}

export function resolveChrome(opts = {}) {
  const { env = process.env, platform = process.platform, exists = fs.existsSync } = opts;
  if (env.DAMEX_CHROME) {
    return exists(env.DAMEX_CHROME)
      ? { path: env.DAMEX_CHROME, source: 'DAMEX_CHROME' }
      : { path: null, source: 'DAMEX_CHROME', error: `DAMEX_CHROME points to a file that does not exist: ${env.DAMEX_CHROME}` };
  }
  const hit = chromeCandidates({ platform, env }).find((c) => exists(c));
  if (hit) return { path: hit, source: 'known location' };
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium']) {
    const found = which(platform === 'win32' ? 'chrome' : name, { env, platform, exists });
    if (found) return { path: found, source: 'PATH' };
  }
  return { path: null, source: null };
}

/** Python 3: the footage venv first, then python3 / python / py on PATH. */
export function resolvePython({ env = process.env, platform = process.platform, root = STUDIO, exists = fs.existsSync } = {}) {
  const venv = venvPython(pathFor(platform).join(root, 'tools', 'footage', '.venv'), platform);
  if (exists(venv)) return { path: venv, source: 'footage venv' };
  for (const name of platform === 'win32' ? ['python', 'py'] : ['python3', 'python']) {
    const found = which(name, { env, platform, exists });
    if (found) return { path: found, source: 'PATH' };
  }
  return { path: null, source: null };
}

export function resolveUv({ env = process.env, platform = process.platform, exists = fs.existsSync } = {}) {
  const found = which('uv', { env, platform, exists });
  if (found) return { path: found, source: 'PATH' };
  const home = env.HOME || env.USERPROFILE;
  if (home) {
    const p = pathFor(platform);
    const c = p.join(home, '.local', 'bin', exe('uv', platform));
    if (exists(c)) return { path: c, source: '~/.local/bin' };
  }
  return { path: null, source: null };
}

/**
 * How to start npm or npx without a shell. Prefers `node <npm>/bin/<tool>-cli.js`, which needs no .cmd shim
 * (Windows cannot spawn .cmd files without a shell). Falls back to the bare command name.
 */
export function npmInvocation(tool, { execPath = process.execPath, platform = process.platform, exists = fs.existsSync } = {}) {
  const p = pathFor(platform);
  const nodeDir = p.dirname(execPath);
  const cli = `${tool}-cli.js`;
  const candidates = platform === 'win32'
    ? [p.join(nodeDir, 'node_modules', 'npm', 'bin', cli)]
    : [p.join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', cli)];
  for (const c of candidates) if (exists(c)) return { cmd: execPath, prefix: [c] };
  return { cmd: platform === 'win32' ? `${tool}.cmd` : tool, prefix: [] };
}

/** Replace the studio folder with . and the home folder with ~, and blank anything that looks like a key.
 *  For anything written to disk or pasted. Also matches JSON-escaped Windows paths (C:\\Users\\...). */
export function redact(text, { home = os.homedir(), root = STUDIO } = {}) {
  let out = String(text);
  const swap = (p, to) => {
    if (!p || p.length <= 1) return;
    const fwd = p.replace(/\\/g, '/'), back = p.replace(/\//g, '\\');
    const variants = new Set([p, fwd, back, back.replace(/\\/g, '\\\\')]);
    for (const h of [...variants].sort((a, b) => b.length - a.length)) {
      const esc = h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      out = out.replace(new RegExp(esc, 'gi'), to);
    }
  };
  swap(root, '.'); // the studio folder first: it usually sits inside home
  swap(home, '~');
  out = out.replace(/\b(sk|pk|xi|key)[-_][A-Za-z0-9_-]{16,}\b/g, '[redacted]');
  out = out.replace(/\b([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD))=\S+/g, '$1=[redacted]');
  return out;
}

export function currentOs() {
  return { os: process.platform, arch: process.arch };
}

/** The fix text for a missing program, copy-pasteable for this OS. */
export function fixFor(what, platform = process.platform) {
  const table = {
    node: {
      darwin: 'brew install node   (or download Node 22 LTS from https://nodejs.org)',
      linux: 'install Node 22 LTS from https://nodejs.org (a portable .tar.xz works, no admin needed)',
      win32: 'winget install OpenJS.NodeJS.LTS   (or unzip the portable Node 22 zip from https://nodejs.org)',
    },
    ffmpeg: {
      darwin: 'brew install ffmpeg-full',
      linux: 'sudo apt install ffmpeg   (or set DAMEX_FFMPEG to a full ffmpeg)',
      win32: 'winget install Gyan.FFmpeg   (or set DAMEX_FFMPEG to ffmpeg.exe)',
    },
    chrome: {
      darwin: 'install Google Chrome from https://google.com/chrome   (or set DAMEX_CHROME)',
      linux: 'sudo apt install chromium   (or install google-chrome-stable, or set DAMEX_CHROME)',
      win32: 'winget install Google.Chrome   (or set DAMEX_CHROME to chrome.exe)',
    },
    uv: {
      darwin: 'brew install uv',
      linux: 'curl -LsSf https://astral.sh/uv/install.sh | sh',
      win32: 'winget install astral-sh.uv',
    },
    whisper: {
      darwin: 'brew install whisper-cpp',
      linux: 'build whisper.cpp from https://github.com/ggerganov/whisper.cpp and put whisper-cli on PATH',
      win32: 'download whisper-cli from https://github.com/ggerganov/whisper.cpp/releases and put it on PATH',
    },
    tesseract: {
      darwin: 'brew install tesseract',
      linux: 'sudo apt install tesseract-ocr',
      win32: 'winget install UB-Mannheim.TesseractOCR',
    },
    'yt-dlp': {
      darwin: 'brew install yt-dlp',
      linux: 'sudo apt install yt-dlp   (or: pipx install yt-dlp)',
      win32: 'winget install yt-dlp.yt-dlp',
    },
  };
  return table[what]?.[platform] ?? table[what]?.linux ?? '';
}
