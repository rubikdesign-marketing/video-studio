#!/usr/bin/env node
// Starts a new brand folder.
//
//   new.mjs <name>                    copy brands/_template to brands/<name>
//   new.mjs <name> --from <brand>     start from another brand's look instead (its colours, fonts, logo and voices)
//
// <name> is the folder name: lower-case letters, digits and hyphens, like "acme" or "north-star".
// With --from, only the look and the voices are copied. The pronunciation list, misheard words, rules, product
// notes, lessons and the list of finished videos start empty, because those belong to the other brand.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRANDS, TEMPLATE, brandDir, brandNames, isBrandName } from './lib.mjs';

const args = process.argv.slice(2);
const die = (msg) => { console.error(msg); process.exit(1); };
const fromAt = args.indexOf('--from');
const from = fromAt >= 0 ? args.splice(fromAt, 2)[1] ?? die('--from needs the name of a brand to copy.') : TEMPLATE;
const name = args[0];

if (!name || name.startsWith('-')) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 9).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  console.log(`\nBrands here: ${brandNames().join(', ') || 'none'}`);
  process.exit(name ? 0 : 2);
}
if (!isBrandName(name)) die(`"${name}" cannot be a folder name. Use lower-case letters, digits and hyphens, like "acme" or "north-star".`);
const target = brandDir(name);
if (fs.existsSync(target)) die(`brands/${name}/ already exists. Pick another name, or edit that folder.`);
const template = path.join(BRANDS, TEMPLATE);
if (!fs.existsSync(path.join(template, 'brand.json'))) die('brands/_template/ is missing. Pull the latest studio.');
if (from !== TEMPLATE && !fs.existsSync(path.join(brandDir(from), 'brand.json'))) die(`There is no brand "${from}" to copy. Brands here: ${brandNames().join(', ')}.`);

// Everything starts as the template. The template's README explains the template itself, so it stays behind.
fs.cpSync(template, target, { recursive: true });
fs.rmSync(path.join(target, 'README.md'), { force: true });
if (from !== TEMPLATE) {
  // The other brand's look and voices replace the placeholders.
  for (const item of ['brand.json', 'brand.md', 'voices.json', 'logo', 'fonts']) {
    const source = path.join(brandDir(from), item);
    if (!fs.existsSync(source)) continue;
    fs.rmSync(path.join(target, item), { recursive: true, force: true });
    fs.cpSync(source, path.join(target, item), { recursive: true });
  }
}

// The display name: the folder name with capitals, until a person writes the real one.
const display = name.split('-').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');
const brandJson = path.join(target, 'brand.json');
const text = fs.readFileSync(brandJson, 'utf8');
const renamed = text.replace(/^(\s*"name"\s*:\s*)"(?:[^"\\]|\\.)*"/m, `$1${JSON.stringify(display)}`);
fs.writeFileSync(brandJson, renamed);

console.log(`Made brands/${name}/${from === TEMPLATE ? ' from the template' : `, with the look and voices of "${from}"`}.

Next steps
  1. Open brands/${name}/brand.json. Every value has a note beside it saying what it is.
     ${from === TEMPLATE ? 'The values are neutral placeholders that already work, so change one group at a time.' : `The values are ${from}'s. Change what differs.`}
     Check the name first: it is set to "${display}".
  2. Put the logo files in brands/${name}/logo/ and the font files in brands/${name}/fonts/,
     and name them in brand.json under "logo" and "fonts".
  3. Tell the engine about the brand, and check it:
       node tools/brand/sync.mjs
       node tools/brand/check.mjs ${name}
  4. Render the brand sheet and get it approved:
       cd engine && npx remotion still BrandSheet out/brand-sheet-${name}.png --props='{"brand":"${name}"}'
  5. Fill in brands/${name}/brand.md (how to use the look), voices.json (the voices this brand may use)
     and pronunciation.md (how product words are written for the voice).
  6. To make a video with it, write "brand": "${name}" in the job's job.json.
     To make it the brand used when a job names none, change default_brand in studio.json.

Run step 3 again after every edit to the brand folder. The full guide is brands/_template/README.md.`);
