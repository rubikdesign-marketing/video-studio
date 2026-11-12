#!/usr/bin/env node
// Checks one brand before it is used for a video. Changes nothing; only reports.
//
//   check.mjs <name>      for example: check.mjs tulvo
//
// It checks that brands/<name>/brand.json has every required value, that every font and logo file it names
// exists, and it measures contrast on both pages: ink on the page must reach 4.5 to 1, and the accent on the
// page must reach 3 to 1. It also looks at the brand's other files (voices, pronunciation, heard-as).
// Exit code 0 = ready, 1 = something must be fixed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES, TEMPLATE, brandDir, brandNames, checkBrand, contrast, readJson } from './lib.mjs';

const INK_ON_PAGE = 4.5;
const ACCENT_ON_PAGE = 3;

const name = process.argv[2];
if (!name || name.startsWith('-')) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 9).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  console.log(`\nBrands here: ${brandNames().join(', ') || 'none'}`);
  process.exit(name ? 0 : 2);
}

let failed = 0;
let notes = 0;
const pass = (text) => console.log(`  ok    ${text}`);
const fail = (text) => { console.log(`  FIX   ${text}`); failed++; };
const note = (text) => { console.log(`  note  ${text}`); notes++; };

console.log(`Brand "${name}" (brands/${name}/)`);
if (name === TEMPLATE) note('This is the template. Copy it with: node tools/brand/new.mjs <name>');

console.log('brand.json');
const { brand, problems } = checkBrand(name);
for (const problem of problems) fail(problem);
if (!problems.length) pass(`every required value is there, and every font and logo file exists (${brand.name})`);

// Contrast, wherever the colours themselves are usable.
const solid = (value) => /^#[0-9a-f]{6}$/i.test(value ?? '');
console.log('Contrast');
for (const page of PAGES) {
  const roles = brand?.colours?.[page];
  if (!roles || !solid(roles.page)) { note(`${page} page: not measured until its colours are filled in`); continue; }
  for (const [role, floor] of [['ink', INK_ON_PAGE], ['accent', ACCENT_ON_PAGE]]) {
    if (!solid(roles[role])) continue;
    const ratio = contrast(roles[role], roles.page);
    const line = `${page} page: ${role} ${roles[role]} on page ${roles.page} is ${ratio.toFixed(1)} to 1 (needs ${floor} to 1)`;
    if (ratio >= floor) pass(line); else fail(line);
  }
  // For information only: quiet text is allowed to be quiet, but below 3 to 1 it is hard to read when small.
  if (solid(roles.second)) {
    const ratio = contrast(roles.second, roles.page);
    if (ratio < ACCENT_ON_PAGE) note(`${page} page: second ${roles.second} on the page is ${ratio.toFixed(1)} to 1. Fine for large text; keep small labels in ink.`);
  }
}

// The brand's other files. Only a broken file fails; an empty one is a note.
console.log('Other files');
const dir = brandDir(name);
const json = (file) => { try { return readJson(path.join(dir, file)); } catch { return undefined; } };
if (!fs.existsSync(path.join(dir, 'voices.json'))) note('voices.json is missing: voice.mjs cannot make a voice for this brand yet');
else {
  const book = json('voices.json');
  if (!book) fail('voices.json is not valid JSON');
  else if (!Array.isArray(book.voices) || !book.voices.length) note('voices.json has no voices yet: add one before making a voice');
  else if (!book.voices.some((v) => v.name === book.default)) note(`voices.json: the default voice "${book.default ?? ''}" is not one of its voices (${book.voices.map((v) => v.name).join(', ')})`);
  else pass(`voices.json: ${book.voices.length} voice${book.voices.length === 1 ? '' : 's'}, default ${book.default}`);
}
if (!fs.existsSync(path.join(dir, 'heard-as.json'))) note('heard-as.json is missing: the voice check will not know this brand\'s misheard words');
else if (!json('heard-as.json')) fail('heard-as.json is not valid JSON');
else pass('heard-as.json');
for (const file of ['pronunciation.md', 'brand.md', 'rules.md', 'ledger.json']) {
  if (!fs.existsSync(path.join(dir, file))) note(`${file} is missing`);
  else if (file.endsWith('.json') && json(file) === undefined) fail(`${file} is not valid JSON`);
  else pass(file);
}

console.log(`\n${failed ? `${failed} to fix` : 'Ready'}${notes ? `, ${notes} note${notes === 1 ? '' : 's'}` : ''}.${failed ? '' : ` Next: node tools/brand/sync.mjs, then render the brand sheet.`}`);
process.exit(failed ? 1 : 0);
