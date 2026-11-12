#!/usr/bin/env node
// Tells the engine which brands exist. Run it after adding a brand or editing anything in a brand folder.
//
//   sync.mjs            check every brand, copy its fonts and logos to the engine, rewrite the brand list
//
// Reads   studio.json, brands/<name>/brand.json and the font and logo files it names
// Writes  engine/public/brands/<name>/      that brand's fonts and logos, where a render can load them
//         engine/src/brands/index.ts        the list of brands the engine can use
//
// Folders that start with "_" (brands/_template) are skipped. A brand whose brand.json has a problem is left
// out and named, so one unfinished brand never blocks videos for the others.
// tools/film/scaffold.mjs runs this by itself before every scaffold and render.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRANDS, ENGINE, STUDIO, brandFiles, brandNames, checkBrand, defaultBrand, rel } from './lib.mjs';

const PUBLIC = path.join(ENGINE, 'public/brands');
const REGISTRY = path.join(ENGINE, 'src/brands/index.ts');

/** The registry file: one import per brand. Folder names become identifiers, so "my-brand" is imported as my_brand. */
function registryFile(names, fallback) {
  const id = (name) => (/^\d/.test(name) ? '_' : '') + name.replace(/-/g, '_');
  const toBrandJson = (name) => path.relative(path.dirname(REGISTRY), path.join(BRANDS, name, 'brand.json')).split(path.sep).join('/');
  return `// Written by tools/brand/sync.mjs: one entry per folder in brands/. Do not edit; run the sync again.
${names.map((name) => `import ${id(name)} from '${toBrandJson(name)}';`).join('\n')}

/** Every brand's brand.json, by folder name. */
export const brandFiles = { ${names.map((name) => (id(name) === name ? name : `'${name}': ${id(name)}`)).join(', ')} };

export const brandNames = [${names.map((name) => `'${name}'`).join(', ')}] as const;

/** studio.json, "default_brand". */
export const defaultBrand: (typeof brandNames)[number] = '${fallback}';
`;
}

function copyIfChanged(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (fs.existsSync(to) && fs.readFileSync(to).equals(fs.readFileSync(from))) return false;
  fs.copyFileSync(from, to);
  return true;
}

/** Removes files in a brand's public folder that the brand no longer names. */
function prune(folder, keep) {
  if (!fs.existsSync(folder)) return;
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) { prune(file, keep); if (!fs.readdirSync(file).length) fs.rmdirSync(file); }
    else if (!keep.has(file)) fs.rmSync(file);
  }
}

/**
 * Checks every brand, copies files, writes the registry.
 * Returns { ready: [names], left_out: { name: [problems] } }. Throws if the default brand cannot be used.
 */
export function syncBrands({ quiet = false } = {}) {
  const log = quiet ? () => {} : console.log;
  const fallback = defaultBrand();
  const ready = [];
  const leftOut = {};
  for (const name of brandNames()) {
    const { brand, problems } = checkBrand(name);
    if (problems.length) { leftOut[name] = problems; continue; }
    const files = brandFiles(name, brand);
    const keep = new Set();
    let copied = 0;
    for (const { from, to } of files) {
      const target = path.join(ENGINE, 'public', to);
      keep.add(target);
      if (copyIfChanged(from, target)) copied++;
    }
    prune(path.join(PUBLIC, name), keep);
    ready.push(name);
    log(`  ready     ${name.padEnd(14)} ${brand.name}  (${files.length} files${copied ? `, ${copied} copied` : ''})`);
  }
  for (const [name, problems] of Object.entries(leftOut)) {
    console.warn(`  LEFT OUT  ${name}: brands/${name}/brand.json needs attention`);
    for (const problem of problems) console.warn(`            - ${problem}`);
  }
  // Brands that were removed, or no longer pass, lose their copied files too.
  if (fs.existsSync(PUBLIC)) {
    for (const name of fs.readdirSync(PUBLIC)) if (!ready.includes(name)) fs.rmSync(path.join(PUBLIC, name), { recursive: true, force: true });
  }
  if (!ready.includes(fallback)) {
    throw new Error(`The default brand "${fallback}" (studio.json) cannot be used${leftOut[fallback] ? ': fix the problems listed above' : `: there is no brands/${fallback}/brand.json`}. The engine's brand list was not changed.`);
  }
  const content = registryFile(ready, fallback);
  fs.mkdirSync(path.dirname(REGISTRY), { recursive: true });
  const before = fs.existsSync(REGISTRY) ? fs.readFileSync(REGISTRY, 'utf8') : null;
  if (before !== content) fs.writeFileSync(REGISTRY, content);
  log(`  ${before === null ? 'made     ' : before === content ? 'unchanged' : 'updated  '} ${rel(REGISTRY)}`);
  return { ready, left_out: leftOut };
}

// Run from the command line (not when another tool imports it).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 12).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
    process.exit(0);
  }
  console.log(`Brands in ${rel(BRANDS) || path.basename(STUDIO)}`);
  try {
    const { ready, left_out } = syncBrands();
    const skipped = Object.keys(left_out).length;
    console.log(`\n${ready.length} brand${ready.length === 1 ? '' : 's'} ready: ${ready.join(', ')}. Default: ${defaultBrand()}.${skipped ? ` ${skipped} left out.` : ''}`);
    process.exit(skipped ? 1 : 0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
