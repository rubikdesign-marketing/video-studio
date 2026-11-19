#!/usr/bin/env node
// One bundle of the engine, made once and reused until the engine's code changes.
//
//   import { ensureBundle } from './lib/bundle.mjs'; const serveUrl = await ensureBundle();
//   node tools/film/lib/bundle.mjs            prints the bundle folder (making it if needed), for render.sh
//
// Every `npx remotion render` or `still` with the plain entry point bundles the whole engine again and copies its
// public folder (14 GB on the owner's Mac). Here the public folder is linked, not copied, and the bundle is kept in
// engine/out/bundles/<fingerprint>/. The fingerprint covers every file under engine/src (path, size, time changed),
// the Remotion config, package.json and the lock file, so any code or film.json change makes a fresh bundle. Files in
// engine/public are read live through the link, so new captures or sounds need no new bundle.
// Only the two newest bundles are kept.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const ENGINE = path.join(STUDIO, 'engine');
const BUNDLES = path.join(ENGINE, 'out', 'bundles');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.DS_Store') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

export function fingerprint() {
  const h = crypto.createHash('sha256');
  const files = [...walk(path.join(ENGINE, 'src')), ...['remotion.config.ts', 'package.json', 'package-lock.json', 'tsconfig.json'].map((f) => path.join(ENGINE, f))];
  for (const f of files.sort()) {
    let st; try { st = fs.statSync(f); } catch { continue; }
    h.update(`${path.relative(ENGINE, f)}\0${st.size}\0${Math.round(st.mtimeMs)}\n`);
  }
  return h.digest('hex').slice(0, 16);
}

/** Returns the folder of a bundle matching the engine as it is now. log gets one line when it has to bundle. */
export async function ensureBundle({ log = (m) => console.error(m) } = {}) {
  const fp = fingerprint();
  const dir = path.join(BUNDLES, fp);
  if (fs.existsSync(path.join(dir, 'index.html'))) { fs.utimesSync(dir, new Date(), new Date()); return dir; }
  const require = createRequire(path.join(ENGINE, 'package.json'));
  const { bundle } = await import(require.resolve('@remotion/bundler'));
  log(`Bundling the engine once (code changed since the last bundle)...`);
  const t = Date.now();
  const tmp = `${dir}.partial-${process.pid}`;
  fs.rmSync(tmp, { recursive: true, force: true });
  await bundle({
    entryPoint: path.join(ENGINE, 'src', 'index.ts'),
    outDir: tmp,
    publicDir: path.join(ENGINE, 'public'),
    symlinkPublicDir: true,
    // Rspack, as remotion.config.ts. Its own build cache is off: with it on, a bundle made through this API came back in
    // 0.3 s and never loaded ("Waiting for root component to load"). Without it a full bundle takes about a second.
    enableCaching: false,
    rspack: true,
  });
  fs.rmSync(dir, { recursive: true, force: true });
  fs.renameSync(tmp, dir);
  log(`Bundled in ${((Date.now() - t) / 1000).toFixed(1)} s.`);
  // keep the two newest
  const all = fs.readdirSync(BUNDLES).filter((d) => /^[0-9a-f]{16}$/.test(d)).map((d) => ({ d, t: fs.statSync(path.join(BUNDLES, d)).mtimeMs })).sort((a, b) => b.t - a.t);
  for (const { d } of all.slice(2)) fs.rmSync(path.join(BUNDLES, d), { recursive: true, force: true });
  return dir;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--fingerprint') console.log(fingerprint());
  else console.log(await ensureBundle());
}
