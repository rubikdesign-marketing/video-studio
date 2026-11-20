import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  chromeCandidates, nodeOk, npmInvocation, redact, resolveBinary, resolveChrome, runContext, venvPython, which,
} from './resolve.mjs';
import { parseArgs } from './install.mjs';
import { renderArgs } from './sample.mjs';

const has = (...files) => (f) => files.includes(f);

test('node floor follows engines: 22.13+ or 24+, not 23', () => {
  assert.equal(nodeOk('22.12.0'), false);
  assert.equal(nodeOk('22.13.0'), true);
  assert.equal(nodeOk('v22.23.1'), true);
  assert.equal(nodeOk('23.5.0'), false);
  assert.equal(nodeOk('24.0.0'), true);
  assert.equal(nodeOk('20.19.0'), false);
});

test('venv interpreter path is per OS', () => {
  assert.equal(venvPython('C:\\studio\\tools\\footage\\.venv', 'win32'), 'C:\\studio\\tools\\footage\\.venv\\Scripts\\python.exe');
  assert.equal(venvPython('/s/tools/footage/.venv', 'linux'), '/s/tools/footage/.venv/bin/python');
  assert.equal(venvPython('/s/tools/footage/.venv', 'darwin'), '/s/tools/footage/.venv/bin/python');
});

test('paths with spaces and Unicode stay whole', () => {
  const root = '/Users/Zoë Ünal/My Studio ✨';
  const probe = path.posix.join(root, 'engine', 'node_modules', '@remotion', 'compositor-darwin-arm64', 'ffprobe');
  const r = resolveBinary('ffprobe', { root, platform: 'darwin', arch: 'arm64', env: {}, exists: has(probe) });
  assert.deepEqual(r, { path: probe, source: 'remotion' });
  const winRoot = 'C:\\Users\\Zoë Ünal\\My Studio';
  const winProbe = path.win32.join(winRoot, 'engine', 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffprobe.exe');
  assert.equal(resolveBinary('ffprobe', { root: winRoot, platform: 'win32', arch: 'x64', env: {}, exists: has(winProbe) }).path, winProbe);
});

test('ffmpeg resolution order: env, .runtime, package manager, PATH', () => {
  const root = '/studio';
  const env = { PATH: '/pathdir' };
  const all = ['/override/ffmpeg', '/studio/.runtime/ffmpeg/ffmpeg', '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg', '/pathdir/ffmpeg'];
  const base = { root, platform: 'darwin', arch: 'arm64' };
  assert.equal(resolveBinary('ffmpeg', { ...base, env: { ...env, DAMEX_FFMPEG: '/override/ffmpeg' }, exists: has(...all) }).source, 'DAMEX_FFMPEG');
  assert.equal(resolveBinary('ffmpeg', { ...base, env, exists: has(...all.slice(1)) }).source, '.runtime');
  assert.equal(resolveBinary('ffmpeg', { ...base, env, exists: has(...all.slice(2)) }).source, 'package manager');
  assert.equal(resolveBinary('ffmpeg', { ...base, env, exists: has(all[3]) }).source, 'PATH');
  assert.equal(resolveBinary('ffmpeg', { ...base, env, exists: has() }).path, null);
});

test('ffprobe prefers Remotion\'s copy over PATH', () => {
  const bundled = '/studio/engine/node_modules/@remotion/compositor-darwin-arm64/ffprobe';
  const r = resolveBinary('ffprobe', { root: '/studio', platform: 'darwin', arch: 'arm64', env: { PATH: '/p' }, exists: has(bundled, '/p/ffprobe') });
  assert.equal(r.source, 'remotion');
});

test('a broken override is an error, not a silent fallback', () => {
  const r = resolveBinary('ffmpeg', { root: '/s', platform: 'linux', env: { DAMEX_FFMPEG: '/nonexistent', PATH: '/usr/bin' }, exists: has('/usr/bin/ffmpeg') });
  assert.equal(r.path, null);
  assert.match(r.error, /DAMEX_FFMPEG points to a file that does not exist: \/nonexistent/);
});

test('which honours PATHEXT on Windows', () => {
  const exe = 'C:\\Tools\\git.EXE';
  assert.equal(which('git', { platform: 'win32', env: { PATH: 'C:\\Other;C:\\Tools', PATHEXT: '.EXE;.CMD' }, exists: has(exe) }), exe);
});

test('Chrome discovery per OS and DAMEX_CHROME first', () => {
  assert.equal(chromeCandidates({ platform: 'win32', env: { ProgramFiles: 'C:\\Program Files' } })[0], 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
  assert.ok(chromeCandidates({ platform: 'linux', env: {} }).includes('/usr/bin/google-chrome-stable'));
  assert.ok(chromeCandidates({ platform: 'linux', env: {} }).includes('/usr/bin/chromium'));
  assert.equal(chromeCandidates({ platform: 'darwin', env: { DAMEX_CHROME: '/x/chrome' } })[0], '/x/chrome');
  assert.equal(resolveChrome({ platform: 'linux', env: { DAMEX_CHROME: '/x/chrome' }, exists: has('/x/chrome') }).source, 'DAMEX_CHROME');
});

test('npm is started through node on Windows, without a .cmd shim', () => {
  const r = npmInvocation('npx', { execPath: 'C:\\Program Files\\nodejs\\node.exe', platform: 'win32', exists: has('C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npx-cli.js') });
  assert.equal(r.cmd, 'C:\\Program Files\\nodejs\\node.exe');
  assert.deepEqual(r.prefix, ['C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npx-cli.js']);
});

test('redaction replaces the home folder and keys', () => {
  const out = redact('/Users/zoe/Desktop/x C:\\Users\\zoe\\x ELEVENLABS_API_KEY=abc123 sk-abcdefghijklmnop1234', { home: '/Users/zoe' });
  assert.ok(!out.includes('zoe/Desktop'));
  assert.ok(out.startsWith('~/Desktop/x'));
  assert.ok(!out.includes('abc123'));
  assert.ok(!out.includes('sk-abcdefghijklmnop1234'));
  assert.equal(redact('C:\\Users\\Zoe\\x', { home: 'C:\\Users\\Zoe' }), '~\\x');
});

test('--with is parsed and sample render args are an array with the props file', () => {
  assert.deepEqual(parseArgs(['--with', 'demucs', '--with=tesseract']).withs, ['demucs', 'tesseract']);
  const a = renderArgs({ composition: 'sample', output: '/o ut/Zoë.mp4', full: false, propsFile: '/t/p.json' });
  assert.ok(a.includes('/o ut/Zoë.mp4'));
  assert.deepEqual(a.slice(a.indexOf('--props'), a.indexOf('--props') + 2), ['--props', '/t/p.json']);
});

test('Remotion\'s ffprobe runs from its own folder, with LD_LIBRARY_PATH on Linux', () => {
  const r = { path: '/s/engine/node_modules/@remotion/compositor-linux-x64-gnu/ffprobe', source: 'remotion' };
  const c = runContext(r, { env: { LD_LIBRARY_PATH: '/x' }, platform: 'linux' });
  assert.equal(c.cwd, '/s/engine/node_modules/@remotion/compositor-linux-x64-gnu');
  assert.equal(c.env.LD_LIBRARY_PATH, `${c.cwd}:/x`);
  assert.equal(runContext({ path: '/usr/bin/ffprobe', source: 'PATH' }).cwd, undefined);
});

test('isMain sees through a symlinked folder (macOS /var -> /private/var)', async () => {
  const { default: fs } = await import('node:fs');
  const { default: os } = await import('node:os');
  const { default: p } = await import('node:path');
  const { fileURLToPath, pathToFileURL } = await import('node:url');
  const { isMain } = await import('./resolve.mjs');
  const dir = fs.mkdtempSync(p.join(os.tmpdir(), 'Vidéo '));
  try {
    const real = p.join(dir, 'real'); fs.mkdirSync(real);
    fs.writeFileSync(p.join(real, 'a.mjs'), '');
    const link = p.join(dir, 'link');
    try { fs.symlinkSync(real, link, 'dir'); } catch { return; } // no symlink rights (Windows without developer mode): nothing to test
    assert.equal(isMain(pathToFileURL(p.join(real, 'a.mjs')).href, p.join(link, 'a.mjs')), true);
    assert.equal(isMain(pathToFileURL(p.join(real, 'a.mjs')).href, p.join(real, 'other.mjs')), false);
    assert.equal(isMain(pathToFileURL(p.join(real, 'a.mjs')).href, undefined), false);
    void fileURLToPath;
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
