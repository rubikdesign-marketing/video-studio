#!/usr/bin/env node
// Checks the style library. Usage: node tools/styles/check.mjs [--tab <id>] [--skip-clips] [--corpus <path>] [--min <n>]
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TABS, loadLibrary, engineNames, checkLibrary } from './lib/library.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const tab = opt('--tab') ?? null;
if (tab && !TABS.includes(tab)) { console.error(`Unknown tab ${tab}. Tabs: ${TABS.join(', ')}`); process.exit(2); }
const min = opt('--min') !== undefined ? Number(opt('--min')) : 100;
const corpusPath = opt('--corpus') ?? join(root, '.damex', 'motion-study', 'corpus.json');
const corpus = existsSync(corpusPath) ? JSON.parse(readFileSync(corpusPath, 'utf8')) : null;
let banned = [];
try { banned = JSON.parse(readFileSync(join(root, 'release', 'manifest.json'), 'utf8')).banned || []; } catch { /* no manifest: no banned words */ }

const lib = loadLibrary(root);
const names = engineNames(root);
for (const n of names.notes) console.log(`Note: ${n}`);
const { problems } = checkLibrary(lib, { names, root, clips: !args.includes('--skip-clips'), corpus, banned, tab, min });
const all = [...lib.notes.filter((n) => !tab || n.includes(`The ${tab === 'product-ui' ? 'Product UI' : tab[0].toUpperCase() + tab.slice(1)} `)), ...problems];
if (all.length) { for (const p of all) console.log(p); process.exit(1); }
const count = (tab ? [tab] : TABS).reduce((n, t) => n + lib.tabs[t].length, 0);
console.log(`Style library: ${count} entries in ${tab ? 1 : 5} tabs, all checks pass`);
