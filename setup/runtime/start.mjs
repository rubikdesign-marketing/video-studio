// From an unzipped download to a ready studio, the same on every OS. setup/start.sh and setup/start.ps1 find or fetch
// Node first, put it on PATH, then run this. Safe to run again: each step skips itself when it is already done.
//
//   node setup/runtime/start.mjs                          restore hidden files, install the core, quick check
//   node setup/runtime/start.mjs --import-from <folder>   also bring brands, videos, keys and sign-ins from an older copy
//
// 1. Hidden files. A zip keeps .claude, .mcp.json and friends, but a Drive folder upload, a copy by hand or a cloud
//    sync tool can drop anything whose name starts with a dot. So the release zip carries them visibly in
//    setup/dotfiles/ (claude -> .claude, mcp.json -> .mcp.json, ...) and this step puts back whatever is missing.
// 2. Core install (engine packages, render browser, capture tool), only when it is not there yet. No tests, no sample
//    render, nothing optional: transcription, sound and footage tools are added when a step first needs them.
// 3. Quick check: the core rows of the health check, a few seconds.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { registerConnector } from './connector.mjs';
import { isMain, STUDIO, nodeOk } from './resolve.mjs';

export const DOTFILES_DIR = path.join('setup', 'dotfiles');

/** setup/dotfiles/<name> -> <studio>/.<name>. Copies what is missing; never overwrites a file that is there. */
export function restoreDotfiles(root = STUDIO) {
  const src = path.join(root, DOTFILES_DIR);
  const restored = [];
  if (!fs.existsSync(src)) return restored;
  const merge = (from, to, label) => {
    if (fs.statSync(from).isDirectory()) {
      fs.mkdirSync(to, { recursive: true });
      for (const entry of fs.readdirSync(from)) merge(path.join(from, entry), path.join(to, entry), label);
    } else if (!fs.existsSync(to)) {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
      fs.chmodSync(to, fs.statSync(from).mode);
      restored.push(label);
    }
  };
  for (const name of fs.readdirSync(src)) {
    if (name.startsWith('.') || name === 'README.md') continue;
    merge(path.join(src, name), path.join(root, `.${name}`), `.${name}`);
  }
  return [...new Set(restored)];
}

/** True when the core install is already in place: engine packages, the render browser, the capture tool. */
export function coreInstalled(root = STUDIO) {
  const has = (...p) => fs.existsSync(path.join(root, ...p));
  const browser = (() => {
    try { return fs.readdirSync(path.join(root, 'engine', 'node_modules', '.remotion')).some((n) => n.startsWith('chrome-headless-shell')); }
    catch { return false; }
  })();
  const capture = !has('tools', 'capture', 'package.json') || has('tools', 'capture', 'node_modules', 'playwright-core');
  return has('engine', 'node_modules', 'remotion', 'package.json') && browser && capture;
}

/** What an older copy holds that belongs to the buyer, not to the release. Demo brand and sample video stay new. */
export const IMPORT_ITEMS = [
  { from: 'brands', skip: ['demo', '_template'] },
  { from: 'jobs', skip: ['_sample'] },
  { from: 'library/own-films' },
  { from: '.env' },
  { from: '.capture' },
  { from: 'studio.json', replace: true },
];

/** Copies the buyer's own work from an older studio folder. Never overwrites anything in this copy, except studio.json. */
export function importFrom(oldRoot, root = STUDIO) {
  const copied = [], kept = [];
  if (!fs.existsSync(path.join(oldRoot, 'brands'))) throw new Error(`${oldRoot} does not look like a studio folder (no brands/ in it).`);
  if (path.resolve(oldRoot) === path.resolve(root)) throw new Error('That is this folder. Point --import-from at the older copy.');
  for (const item of IMPORT_ITEMS) {
    const from = path.join(oldRoot, item.from);
    if (!fs.existsSync(from)) continue;
    const isDir = fs.statSync(from).isDirectory();
    const entries = isDir ? fs.readdirSync(from).filter((n) => !(item.skip ?? []).includes(n) && n !== '.DS_Store') : [null];
    for (const name of entries) {
      const rel = name ? path.join(item.from, name) : item.from;
      const to = path.join(root, rel);
      if (fs.existsSync(to) && !item.replace) { kept.push(rel); continue; }
      fs.cpSync(path.join(oldRoot, rel), to, { recursive: true, force: true });
      copied.push(rel);
    }
  }
  return { copied, kept };
}

function parseArgs(argv) {
  const i = argv.indexOf('--import-from');
  return { importFrom: i >= 0 ? argv[i + 1] : null, unknown: argv.filter((a, j) => a.startsWith('--') && a !== '--import-from' && j !== i + 1) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const started = Date.now();
  if (!nodeOk(process.versions.node)) {
    console.error(`Node ${process.versions.node} is too old. Run setup/start.sh (Mac, Linux) or setup\\start.ps1 (Windows): it fetches a suitable Node into this folder.`);
    process.exit(1);
  }

  console.log('== 1 of 3  Hidden files');
  const restored = restoreDotfiles();
  console.log(restored.length ? `Put back: ${restored.join(', ')}` : 'All present.');
  if (!fs.existsSync(path.join(STUDIO, '.claude', 'skills', 'video-studio', 'SKILL.md'))) {
    console.error('The studio skill (.claude/skills/video-studio) is missing and could not be put back. Download the studio again.');
    process.exit(1);
  }

  try {
    const state = registerConnector(STUDIO); // the studio's own Node, else node on PATH: see connectorNode
    console.log(`Brief page connector: ${state === 'unchanged' ? 'already set' : state}`);
  } catch {
    console.log('The brief page connector could not be set up. Running the start step again will retry. Carrying on.');
  }

  if (args.importFrom) {
    console.log(`\n== Bringing your work from ${args.importFrom}`);
    try {
      const { copied, kept } = importFrom(path.resolve(args.importFrom));
      console.log(copied.length ? `Copied: ${copied.join(', ')}` : 'Nothing to copy.');
      if (kept.length) console.log(`Already here, left as they are: ${kept.join(', ')}`);
    } catch (e) { console.error(e.message); process.exit(1); }
  }

  console.log('\n== 2 of 3  Core install');
  if (coreInstalled()) console.log('Already installed.');
  else {
    const r = spawnSync(process.execPath, [path.join(STUDIO, 'setup', 'runtime', 'install.mjs')], { cwd: STUDIO, stdio: 'inherit' });
    if (r.status !== 0) { console.error('\nThe core install did not finish. The lines above say why; run the same start command again once it is fixed.'); process.exit(1); }
  }

  console.log('\n== 3 of 3  Quick check');
  const { buildReport } = await import('./doctor.mjs');
  const report = await buildReport();
  const core = report.checks.filter((c) => c.tier === 'core');
  const failed = core.filter((c) => c.status === 'fail');
  for (const c of failed) console.log(`NEED  ${c.id}: ${c.found}${c.fix ? `\n      Fix: ${c.fix}` : ''}`);
  const secs = Math.round((Date.now() - started) / 1000);
  if (failed.length) { console.log(`\nNot ready yet (${secs} s). Fix the lines above, then run the start command again.`); process.exit(1); }
  console.log(`${core.length} core checks passed.`);

  fs.mkdirSync(path.join(STUDIO, '.damex'), { recursive: true });
  fs.writeFileSync(path.join(STUDIO, '.damex', 'ready.json'), JSON.stringify({ node: process.versions.node, platform: process.platform, arch: process.arch, at: new Date().toISOString(), seconds: secs }, null, 2) + '\n');
  const portable = path.relative(STUDIO, process.execPath).startsWith('.runtime');
  console.log(`\nThe studio is ready (${secs} s).${portable ? ' It uses its own copy of Node, in .runtime/node.' : ''}`);
  console.log('Open this folder in the Claude desktop app (Code tab), trust it when asked, and type /video-menu (or say: set up my brand).');
  console.log('Extra tools (transcription, noise removal, mastering) are added when a video first needs them.');
}

if (isMain(import.meta.url)) await main();
