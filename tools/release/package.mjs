#!/usr/bin/env node
// Turns an exported release (tools/release/export.mjs) into the one zip buyers download: the same zip for Mac, Windows
// and Linux, because the packages and the render browser are fetched on the buyer's computer by setup/start (about 1.5
// minutes on a normal connection) rather than shipped per system (about 900 MB each).
//
//   package.mjs [--from <release folder>] [--out <folder>]
//
// Reads   the release folder's committed and new files (git ls-files, so .gitignore keeps out node_modules, .env,
//         renders and sign-ins). Without git, every file except a fixed list of local-only folders.
// Writes  <out>/damex-video-engine-<version>.zip, with one top folder "video-engine", and a .sha256 beside it.
//
// Hidden files and folders at the top (.claude, .mcp.json, .gitignore, .env.example) go into setup/dotfiles/ under
// visible names (claude, mcp.json, ...). A Drive folder upload, a copy by hand or a sync tool can drop dot-files; a
// visible folder survives all of them, and setup/start puts each one back as the hidden original.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const manifest = JSON.parse(fs.readFileSync(path.join(STUDIO, 'release', 'manifest.json'), 'utf8'));
const from = path.resolve(opt('from', path.resolve(STUDIO, manifest.default_out)));
const out = path.resolve(opt('out', path.join(path.dirname(from), `${path.basename(from)}-builds`)));
const TOP = 'video-engine';

if (!fs.existsSync(path.join(from, 'RELEASE.json'))) {
  console.error(`${from} has no RELEASE.json. Export the release first: node tools/release/export.mjs`);
  process.exit(1);
}
const release = JSON.parse(fs.readFileSync(path.join(from, 'RELEASE.json'), 'utf8'));

// Never in a zip, whatever .gitignore says: keys, sign-ins, installed packages, local state, version control.
const NEVER = [/(^|\/)\.git(\/|$)/, /(^|\/)node_modules\//, /^\.runtime\//, /^\.damex\//, /^\.capture\//, /(^|\/)\.env$/,
  /(^|\/)\.DS_Store$/, /^\.claude\/settings\.local\.json$/, /^\.claude\/worktrees\//, /^\.video-engine-release$/];

function listFiles(dir) {
  try {
    const outText = execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: dir, encoding: 'utf8', maxBuffer: 1 << 28 });
    return outText.split('\0').filter(Boolean);
  } catch {
    const list = [];
    (function walk(d) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) walk(full);
        else list.push(path.relative(dir, full).split(path.sep).join('/'));
      }
    })(dir);
    return list;
  }
}

const files = listFiles(from).filter((f) => !NEVER.some((re) => re.test(f)) && fs.existsSync(path.join(from, f)));
const links = files.filter((f) => fs.lstatSync(path.join(from, f)).isSymbolicLink());
if (links.length) {
  console.error(`Symbolic links do not survive a zip on Windows. Replace these with real files first:\n  ${links.join('\n  ')}`);
  process.exit(1);
}

// 1. Stage: <tmp>/video-engine/... with top-level dot entries moved to setup/dotfiles/<name without the dot>.
const stageRoot = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'video-engine-zip-'));
const stage = path.join(stageRoot, TOP);
const dotted = new Set();
for (const f of files) {
  const [first, ...rest] = f.split('/');
  let rel = f;
  if (first.startsWith('.')) {
    dotted.add(first);
    rel = ['setup', 'dotfiles', first.slice(1), ...rest].join('/');
  }
  const dest = path.join(stage, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(from, f), dest);
  fs.chmodSync(dest, fs.statSync(path.join(from, f)).mode);
}
if (!dotted.has('.claude') || !fs.existsSync(path.join(stage, 'setup', 'dotfiles', 'claude', 'skills', 'video-studio', 'SKILL.md'))) {
  console.error('The release has no .claude/skills/video-studio: the studio would not work. Export again.');
  process.exit(1);
}
fs.writeFileSync(path.join(stage, 'setup', 'dotfiles', 'README.md'),
  'The studio\'s hidden files, kept visible so no download, copy or sync can drop them.\n' +
  'The start step (setup/start.sh or setup\\start.ps1) puts each one back with a dot in front: claude becomes .claude.\n' +
  'Do not edit them here: edit the hidden copies in the studio folder.\n');

// 2. Zip. -X leaves out Mac-only extra attributes; file modes are kept, so the scripts stay runnable on a Mac or Linux.
fs.mkdirSync(out, { recursive: true });
const zipName = `damex-video-engine-${release.version}.zip`;
const zipPath = path.join(out, zipName);
fs.rmSync(zipPath, { force: true });
try {
  execFileSync('zip', ['-r', '-q', '-X', zipPath, TOP], { cwd: stageRoot, stdio: 'inherit' });
} catch {
  console.error('The zip command failed (is "zip" installed?). The staged folder is kept for a look: ' + stage);
  process.exit(1);
}
fs.rmSync(stageRoot, { recursive: true, force: true });

// 3. Checksum, and a record of what went in.
const sha = crypto.createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex');
fs.writeFileSync(`${zipPath}.sha256`, `${sha}  ${zipName}\n`);
const mb = (fs.statSync(zipPath).size / 1e6).toFixed(1);
console.log(`Damex Video Engine ${release.version} (source ${String(release.source_commit).slice(0, 7)})`);
console.log(`  ${files.length} files; hidden ones carried in setup/dotfiles: ${[...dotted].sort().join(', ')}`);
console.log(`  ${zipPath}  (${mb} MB)`);
console.log(`  SHA-256 ${sha}`);
console.log('\nUpload this one file (not the folder) to Google Drive, and share the link with the buyer.');
