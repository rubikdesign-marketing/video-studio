#!/usr/bin/env node
// Browse the style library from chat.
// Usage: node tools/styles/styles.mjs list [--tab t] [--family f] [--energy e] [--kind k] [--ready] [--root dir]
//        node tools/styles/styles.mjs find <words> | show <id> | suggest "<words>" [--energy e] [--kind k] [--size s]
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TABS, loadLibrary, promptText } from './lib/library.mjs';
import { rank, suggest } from './lib/suggest.mjs';

const STUDIO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const VALUE_FLAGS = new Set(['--root', '--tab', '--family', '--energy', '--kind', '--size']);
const argv = process.argv.slice(2);
const flags = {};
const rest = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (VALUE_FLAGS.has(a)) flags[a] = argv[++i];
  else if (a === '--ready') flags[a] = true;
  else rest.push(a);
}
const [command, ...words] = rest;
const lib = loadLibrary(flags['--root'] ? resolve(flags['--root']) : STUDIO);
for (const n of lib.notes) console.error(n);
const all = TABS.flatMap((t) => lib.tabs[t]);
const status = (e) => (e.filters?.ready === true ? 'ready now' : 'made on request');
const line = (e) => `${e.id}  ${e.name}  ${e.line}  ${status(e)}`;

if (command === 'list') {
  if (flags['--tab'] && !TABS.includes(flags['--tab'])) { console.log(`No tab called ${flags['--tab']}. Tabs: ${TABS.join(', ')}`); process.exit(1); }
  const keep = all.filter((e) => (!flags['--tab'] || e.tab === flags['--tab'])
    && (!flags['--family'] || e.family === flags['--family'])
    && (!flags['--energy'] || (e.filters?.energy || []).includes(flags['--energy']))
    && (!flags['--kind'] || (e.filters?.kinds || []).includes(flags['--kind']))
    && (!flags['--ready'] || e.filters?.ready === true));
  if (!keep.length) console.log('No styles match.');
  for (const e of keep) console.log(line(e));
} else if (command === 'find') {
  const hits = rank(all, { text: words.join(' ') }).filter((r) => r.score > 0).slice(0, 10);
  if (!hits.length) console.log('No styles match those words.');
  for (const r of hits) console.log(line(r.entry));
} else if (command === 'show') {
  const e = lib.byId.get(words[0]);
  if (!e) { console.log(`No style with the id ${words[0] ?? ''}`.trim()); process.exit(1); }
  console.log(e.name);
  console.log(e.line);
  console.log('');
  console.log(promptText(e));
  if (e.filters?.ready !== true) {
    const near = lib.byId.get(e.nearest);
    console.log('');
    console.log(`made on request: closest ready style ${near ? near.name : 'none named'}`);
  }
} else if (command === 'suggest') {
  const understood = {};
  for (const k of ['energy', 'kind', 'size']) if (flags[`--${k}`]) understood[k] = flags[`--${k}`];
  const out = suggest(all, { text: words.join(' '), understood });
  for (const s of out) console.log(`${s.id}  ${s.name}  ${s.reason}`);
} else {
  console.log('Usage: styles.mjs list|find|show|suggest (see the top of this file)');
  process.exit(command ? 1 : 0);
}
