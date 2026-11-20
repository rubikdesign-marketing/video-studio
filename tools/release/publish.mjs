#!/usr/bin/env node
// Publishes one packaged release (tools/release/package.mjs) to the Cloudflare R2 bucket that damex.digital serves buyers from.
//
//   publish.mjs --version <v> [--from <release folder>] [--zip <path>] [--bucket damex-ve-releases]
//               [--local [--persist-to <dir>]] [--current <v>]
//
// Checks the zip against its .sha256, reads the three guides (ONBOARDING, README, LICENSE) from the release folder, then
// uploads the zip, releases/<v>/release.json and finally current.json, with `wrangler r2 object put`. The first failure
// stops everything, so current.json never points at a half-published version.
//   --local      writes to wrangler's local R2 (for a rehearsal) instead of the real bucket; --persist-to picks the folder.
//   --current v  only rewrites current.json (a rollback), after checking that releases/<v>/release.json is in the bucket.
// WRANGLER overrides the wrangler binary (default: website-v3's).
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReleaseJson, uploadPlan } from './lib/publish.mjs';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);
const die = (msg) => { console.error(msg); process.exit(1); };
const SAFE = /^[A-Za-z0-9._-]+$/;

const WRANGLER = process.env.WRANGLER || '/Users/wedevs/Desktop/Damex/website-v3/node_modules/.bin/wrangler';
const bucket = opt('bucket', 'damex-ve-releases');
const local = flag('local');
const persist = opt('persist-to');
const scratch = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 've-publish-'));
const cleanup = () => fs.rmSync(scratch, { recursive: true, force: true });

// Runs wrangler r2 object put/get. Without --local it goes to the real bucket, so --remote is explicit.
function wrangler(verb, key, file) {
  const a = ['r2', 'object', verb, `${bucket}/${key}`, '--file', file];
  if (local) a.push('--local', ...(persist ? ['--persist-to', path.resolve(persist)] : []));
  else a.push('--remote');
  return spawnSync(WRANGLER, a, { encoding: 'utf8' });
}
function put(key, file) {
  const r = wrangler('put', key, file);
  if (r.status !== 0) {
    cleanup();
    die(`Uploading ${key} failed${r.error ? ` (${r.error.message})` : ''}. current.json was not written, so buyers still see the previous version.\n${(r.stderr || '').trim()}`);
  }
  console.log(`  uploaded ${bucket}/${key}`);
}
const writeJson = (name, value) => {
  const f = path.join(scratch, name);
  fs.writeFileSync(f, JSON.stringify(value));
  return f;
};

const currentOnly = opt('current');
if (currentOnly !== undefined) {
  if (!currentOnly || !SAFE.test(currentOnly)) die(`"${currentOnly}" is not a version name (letters, digits, dots, dashes and underscores only).`);
  const probe = wrangler('get', `releases/${currentOnly}/release.json`, path.join(scratch, 'probe.json'));
  if (probe.status !== 0) { cleanup(); die(`Version ${currentOnly} is not in the bucket (releases/${currentOnly}/release.json was not found), so current.json was not changed.`); }
  put('current.json', writeJson('current.json', { version: currentOnly }));
  cleanup();
  console.log(`current.json now points at ${currentOnly}. Check /api/video-engine/me/ shows it.`);
  process.exit(0);
}

const version = opt('version');
if (!version || !SAFE.test(version)) die('Pass --version <v> (letters, digits, dots, dashes and underscores only), for example --version 0.1.0-rc6.');

const manifest = JSON.parse(fs.readFileSync(path.join(STUDIO, 'release', 'manifest.json'), 'utf8'));
const from = path.resolve(opt('from', path.resolve(STUDIO, manifest.default_out)));
const file = `damex-video-engine-${version}.zip`;
const zip = path.resolve(opt('zip', path.join(path.dirname(from), `${path.basename(from)}-builds`, file)));
if (!fs.existsSync(zip)) die(`${zip} does not exist. Build it first: node tools/release/package.mjs`);
if (!fs.existsSync(`${zip}.sha256`)) die(`${zip}.sha256 does not exist, so the zip cannot be checked and nothing was published.`);

// 1. The zip must be the one package.mjs wrote: "<sha256>  <name>".
const zipBytes = fs.readFileSync(zip);
const sha256 = crypto.createHash('sha256').update(zipBytes).digest('hex');
const recorded = fs.readFileSync(`${zip}.sha256`, 'utf8').trim().split(/\s+/)[0].toLowerCase();
if (recorded !== sha256) die(`${path.basename(zip)} does not match its .sha256, so nothing was published. Build the zip again.`);
if (path.basename(zip) !== file) die(`The zip is named ${path.basename(zip)}, but version ${version} should be ${file}, so nothing was published.`);

// 2. release.json from the three guides.
const read = (name) => {
  const p = path.join(from, name);
  if (!fs.existsSync(p)) die(`${p} does not exist, so nothing was published.`);
  return fs.readFileSync(p, 'utf8');
};
let release;
try {
  release = buildReleaseJson({
    version, file, bytes: zipBytes.length, sha256, released: new Date().toISOString().slice(0, 10),
    onboarding: read('ONBOARDING.md'), readme: read('README.md'), license: read('LICENSE.md'),
  });
} catch (e) { cleanup(); die(e.message); }

// 3. Upload in order; current.json last.
console.log(`Publishing ${version} to ${bucket}${local ? ' (local)' : ''}`);
for (const item of uploadPlan(version, file)) {
  const f = item.source === 'zip' ? zip
    : item.key === 'current.json' ? writeJson('current.json', { version })
    : writeJson('release.json', release);
  put(item.key, f);
}
cleanup();
console.log(`Published ${version}. Now check /api/video-engine/me/ shows it. Roll back with: node tools/release/publish.mjs --current <previous version>`);
