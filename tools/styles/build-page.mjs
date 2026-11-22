#!/usr/bin/env node
// Builds the brief page's publish set into studio/brief-desk/dist/ and writes dist/publish.json.
// Usage: node tools/styles/build-page.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TABS, loadLibrary, engineNames, checkLibrary, SKETCHES } from './lib/library.mjs';

export const MAX_BATCH = 250;
export const MAX_CLIPS = 500;
export const MAX_BYTES = 40 * 1024 * 1024;
const MB = 1024 * 1024;

const fail = (msg) => { const e = new Error(msg); e.plain = true; return e; };
const slash = (p) => p.split(sep).join('/');

export function buildPage(root, { out = join('studio', 'brief-desk', 'dist'), min = 100 } = {}) {
  const outDir = resolve(root, out);
  const pageFile = join(root, 'studio', 'brief-desk', 'index.html');
  const html = readFileSync(pageFile, 'utf8');
  const m = html.match(/<meta\s+name="brief-page-version"\s+content="([^"]*)"/);
  if (!m) throw fail('The page has no brief-page-version tag, so the build cannot tell which version it is.');
  const version = Number(m[1]);

  // The library must pass its own check, clips included.
  let banned = [];
  try { banned = JSON.parse(readFileSync(join(root, 'release', 'manifest.json'), 'utf8')).banned || []; } catch { /* no manifest */ }
  const corpusPath = join(root, '.damex', 'motion-study', 'corpus.json');
  const corpus = existsSync(corpusPath) ? JSON.parse(readFileSync(corpusPath, 'utf8')) : null;
  const lib = loadLibrary(root);
  const names = engineNames(root);
  const { problems } = checkLibrary(lib, { names, root, clips: true, corpus, banned, min });
  const all = [...lib.notes, ...problems];
  if (all.length) throw fail(`The style library does not pass its check, so nothing was built:\n${all.join('\n')}`);

  const previewsDir = join(root, 'library', 'styles', 'previews');
  const clips = existsSync(previewsDir) ? readdirSync(previewsDir).filter((f) => f.endsWith('.mp4')).sort() : [];
  if (clips.length > MAX_CLIPS) throw fail(`There are ${clips.length} preview clips and a publish holds at most ${MAX_CLIPS}. Nothing was built.`);

  // Everything is gathered as [published path, source file or content].
  const items = [];
  const addFile = (pub, src) => items.push({ pub, src });
  const addText = (pub, text) => items.push({ pub, text });
  addFile('index.html', pageFile);
  addFile('lib/brief.mjs', join(root, 'tools', 'plan', 'lib', 'brief.mjs'));
  addFile('lib/suggest.mjs', join(root, 'tools', 'styles', 'lib', 'suggest.mjs'));

  const counts = {};
  for (const tab of TABS) {
    const list = lib.tabs[tab].map((e) => {
      const { engine, ...rest } = e;
      return engine === undefined ? rest : { ...rest, engine_names: engine };
    });
    const fam = {};
    for (const e of list) fam[e.family ?? ''] = (fam[e.family ?? ''] || 0) + 1;
    counts[tab] = { total: list.length, families: fam };
    addText(`styles/${tab}.json`, JSON.stringify(list));
  }

  const sprite = join(previewsDir, 'sound-sprite.json');
  const spriteData = existsSync(sprite) ? JSON.parse(readFileSync(sprite, 'utf8')) : {};
  const sketches = existsSync(join(root, 'library', 'styles', 'sketches.json'))
    ? JSON.parse(readFileSync(join(root, 'library', 'styles', 'sketches.json'), 'utf8')) : SKETCHES;
  const soundSlices = {};
  for (const [id, v] of Object.entries(spriteData)) if (Array.isArray(v)) soundSlices[id] = v[1];
  addText('styles/meta.json', JSON.stringify({ counts, sketches, notes: lib.notes, sound_slices: soundSlices, built_at: new Date().toISOString() }));
  addFile('styles/director.md', join(root, 'library', 'styles', 'director.md'));
  for (const c of clips) addFile(`previews/${c}`, join(previewsDir, c));
  for (const f of ['sound-sprite.mp3', 'sound-sprite.json']) if (existsSync(join(previewsDir, f))) addFile(`previews/${f}`, join(previewsDir, f));

  const bytes = items.reduce((n, i) => n + (i.text !== undefined ? Buffer.byteLength(i.text) : statSync(i.src).size), 0);
  if (bytes > MAX_BYTES) throw fail(`The publish set is ${(bytes / MB).toFixed(1)} MB and the limit is ${MAX_BYTES / MB} MB. Nothing was built.`);

  rmSync(outDir, { recursive: true, force: true });
  for (const i of items) {
    const dest = join(outDir, ...i.pub.split('/'));
    mkdirSync(dirname(dest), { recursive: true });
    if (i.text !== undefined) writeFileSync(dest, i.text); else copyFileSync(i.src, dest);
  }

  const files = items.map((i) => i.pub);
  const isClip = (p) => p.startsWith('previews/') && p.endsWith('.mp4');
  const first = ['index.html', ...files.filter((p) => p !== 'index.html' && !isClip(p))];
  const rest = files.filter(isClip);
  const batches = [];
  for (let i = 0; i < first.length; i += MAX_BATCH) batches.push(first.slice(i, i + MAX_BATCH));
  for (let i = 0; i < rest.length; i += MAX_BATCH) batches.push(rest.slice(i, i + MAX_BATCH));
  writeFileSync(join(outDir, 'publish.json'), JSON.stringify({ version, batches }, null, 2) + '\n');
  return { out: outDir, files, batches, bytes, version };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  try {
    const r = buildPage(root);
    console.log(`Built ${r.files.length} files in ${r.batches.length} batches, ${(r.bytes / MB).toFixed(1)} MB, page version ${r.version}, in ${slash(r.out)}`);
  } catch (e) {
    if (!e.plain) throw e;
    console.error(e.message);
    process.exit(1);
  }
}
