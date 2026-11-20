#!/usr/bin/env node
// Builds the white-label release of the Video Engine that Damex Digital sells: a clean copy of one committed
// version of this studio, with every company's brand, jobs, product screens and films taken out.
//
//   export.mjs [--ref HEAD] [--out <folder>] [--version 0.1.0] [--report-only]
//
// Reads   release/manifest.json   what to leave out, what to replace, which words must not appear
//         release/overrides/      files that replace the studio's own in the release (README, licence, setup)
//         the git commit --ref    never the working folder, so unfinished work never ships
// Writes  <out>/                  the release, with RELEASE.json naming the commit it came from
//
// The release folder keeps its own .git, so each export becomes one commit there and buyers update with a pull.
// Every replacement must find its text: if the studio changed and a "from" is no longer there, the export stops
// and names it, instead of shipping a file that still mentions a company. The scan at the end does the same for
// any banned word left anywhere. --report-only lists what the scan found without failing.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyJsonDrop } from './lib/json-drop.mjs';
import { stripMissingPreviews } from './lib/previews.mjs';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RELEASE_DIR = path.join(STUDIO, 'release');
const MARKER = '.video-engine-release';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const manifest = JSON.parse(fs.readFileSync(path.join(RELEASE_DIR, 'manifest.json'), 'utf8'));
const ref = opt('ref', 'HEAD');
const version = opt('version', manifest.version);
const out = path.resolve(opt('out', path.resolve(STUDIO, manifest.default_out)));
const reportOnly = flag('report-only');

const git = (...a) => execFileSync('git', a, { cwd: STUDIO, encoding: 'utf8', maxBuffer: 1 << 30 }).trim();
const commit = git('rev-parse', ref);

/** A glob from the manifest as a regular expression: ** crosses folders, * stays inside one. */
function globToRegex(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      re += '.*';
      i++;
      if (glob[i + 1] === '/') i++;
    } else if (c === '*') re += '[^/]*';
    else re += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}(/.*)?$`);
}
const matchesAny = (globs) => {
  const res = globs.map(globToRegex);
  return (p) => res.some((r) => r.test(p));
};

function walk(dir, base = dir, list = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.git') continue;
      walk(full, base, list);
    } else list.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return list;
}

// 1. A fresh staging folder with the committed files only.
const stage = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'video-engine-release-'));
execFileSync('sh', ['-c', `git archive --format=tar "${commit}" | tar -x -C "${stage}"`], { cwd: STUDIO, maxBuffer: 1 << 30 });

// 2. Leave out what is not ours to sell or names a company.
const excluded = matchesAny(manifest.exclude);
const keep = matchesAny(manifest.keep_inside_excluded ?? []);
let removed = 0;
for (const file of walk(stage)) {
  if (excluded(file) && !keep(file)) {
    fs.rmSync(path.join(stage, file));
    removed++;
  }
}
// Drop folders left empty.
(function prune(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) prune(path.join(dir, entry.name));
  }
  if (dir !== stage && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
})(stage);

// 3. The release's own files (README, licence, setup, defaults).
const overridesDir = path.join(RELEASE_DIR, 'overrides');
const overrides = fs.existsSync(overridesDir) ? walk(overridesDir) : [];
for (const file of overrides) {
  const dest = path.join(stage, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(overridesDir, file), dest);
}

// 4. Exact replacements. A "from" that is missing stops the export.
const problems = [];
for (const [file, pairs] of Object.entries(manifest.replace ?? {})) {
  const full = path.join(stage, file);
  if (!fs.existsSync(full)) {
    problems.push(`replace: ${file} is not in the release`);
    continue;
  }
  let text = fs.readFileSync(full, 'utf8');
  for (const [from, to] of pairs) {
    if (!text.includes(from)) {
      problems.push(`replace: "${from.slice(0, 70)}" not found in ${file}`);
      continue;
    }
    text = text.split(from).join(to);
  }
  fs.writeFileSync(full, text);
}
// Pattern replacements, for files where one wording repeats many times. Each pattern must match at least once.
for (const [file, rules] of Object.entries(manifest.replace_regex ?? {})) {
  const full = path.join(stage, file);
  if (!fs.existsSync(full)) {
    problems.push(`replace_regex: ${file} is not in the release`);
    continue;
  }
  let text = fs.readFileSync(full, 'utf8');
  for (const [pattern, to] of rules) {
    const re = new RegExp(pattern, 'g');
    if (!re.test(text)) {
      problems.push(`replace_regex: /${pattern}/ matched nothing in ${file}`);
      continue;
    }
    text = text.replace(new RegExp(pattern, 'g'), to);
  }
  fs.writeFileSync(full, text);
}
// Entries dropped from JSON lists (a reference film by a company that must not appear): see lib/json-drop.mjs.
problems.push(...applyJsonDrop(stage, manifest.json_drop));
// Preview links to files the release leaves out (motion and background mp4s) are removed: see lib/previews.mjs.
for (const { file, dropped } of stripMissingPreviews(stage, manifest.strip_missing_previews ?? [])) console.log(`Preview links removed: ${file} ${dropped}`);

// 4b. Build the review editor (studio/app), after the replacements so the built files carry them, and before the
// scan so the scan reads them too. Buyers get a working /editor without a build of their own. Needs npm and the
// package registry on the machine that exports.
const app = path.join(stage, 'studio', 'app');
if (fs.existsSync(path.join(app, 'package.json'))) {
  try {
    for (const step of [['ci', '--no-audit', '--no-fund'], ['run', 'build']]) execFileSync('npm', step, { cwd: app, stdio: 'pipe', maxBuffer: 1 << 26 });
  } catch (e) {
    problems.push(`editor build: ${String(e.stderr || e.stdout || e.message).trim().split('\n').slice(-3).join(' / ').slice(0, 300)}`);
  }
  fs.rmSync(path.join(app, 'node_modules'), { recursive: true, force: true });
  if (!fs.existsSync(path.join(app, 'dist', 'index.html'))) problems.push('editor build: studio/app/dist/index.html was not made');
}

// 5. Scan every text file for words that must not ship.
const banned = new RegExp(manifest.banned.join('|'), 'i');
const allow = (manifest.allow ?? []).map((a) => ({ file: globToRegex(a.file), line: new RegExp(a.line, 'i') }));
const hits = [];
for (const file of walk(stage)) {
  const full = path.join(stage, file);
  if (fs.statSync(full).size > 20_000_000) continue;
  const buf = fs.readFileSync(full);
  if (buf.subarray(0, 8000).includes(0)) continue; // binary: images, fonts, audio, video
  const lines = buf.toString('utf8').split('\n');
  lines.forEach((line, i) => {
    if (!banned.test(line)) return;
    if (allow.some((a) => a.file.test(file) && a.line.test(line))) return;
    hits.push({ file, line: i + 1, text: line.trim().slice(0, 140) });
  });
}
// File and folder names count too.
for (const file of walk(stage)) if (banned.test(file)) hits.push({ file, line: 0, text: '(the file name)' });

// 6. Report.
const byFile = new Map();
for (const h of hits) byFile.set(h.file, (byFile.get(h.file) ?? 0) + 1);
console.log(`Release ${version} from ${ref} (${commit.slice(0, 7)})`);
console.log(`  ${removed} files left out, ${overrides.length} replaced by release files`);
if (problems.length) {
  console.log(`\n${problems.length} replacement problem(s):`);
  for (const p of problems) console.log(`  - ${p}`);
}
if (hits.length) {
  console.log(`\n${hits.length} banned word(s) in ${byFile.size} file(s):`);
  for (const [file, n] of [...byFile].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${file}`);
  fs.writeFileSync(path.join(stage, '..', `release-scan-${commit.slice(0, 7)}.json`), JSON.stringify(hits, null, 2));
  console.log(`  Every line: ${path.join(path.dirname(stage), `release-scan-${commit.slice(0, 7)}.json`)}`);
}
const failed = problems.length > 0 || hits.length > 0;
if (failed && !reportOnly) {
  console.log('\nNot released: fix the above, then export again.');
  fs.rmSync(stage, { recursive: true, force: true });
  process.exit(1);
}
if (reportOnly) {
  console.log(`\nReport only. Staging folder kept for a look: ${stage}`);
  process.exit(0);
}

// 7. Replace the release folder's files (keeping its .git), then record where it came from.
if (fs.existsSync(out)) {
  if (!fs.existsSync(path.join(out, MARKER))) {
    console.error(`${out} exists and is not a release folder (no ${MARKER}). Refusing to overwrite it.`);
    process.exit(1);
  }
  for (const entry of fs.readdirSync(out)) if (entry !== '.git') fs.rmSync(path.join(out, entry), { recursive: true, force: true });
} else fs.mkdirSync(out, { recursive: true });
fs.cpSync(stage, out, { recursive: true });
fs.rmSync(stage, { recursive: true, force: true });
fs.writeFileSync(path.join(out, MARKER), 'This folder is written by tools/release/export.mjs. Do not edit it by hand.\n');
fs.writeFileSync(
  path.join(out, 'RELEASE.json'),
  JSON.stringify({ product: manifest.product, version, source_commit: commit, built: new Date().toISOString().slice(0, 10) }, null, 2) + '\n',
);
console.log(`\nWritten to ${out}`);
