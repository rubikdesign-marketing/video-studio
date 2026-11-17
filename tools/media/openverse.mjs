#!/usr/bin/env node
// Openverse (openverse.org, WordPress's search for openly licensed media): real recorded sounds and photographs for a
// video, with their licence and credit kept from the moment they are found.
//
//   node tools/media/openverse.mjs search audio "<words>" [--job jobs/<job>] [--category sound_effect|music]
//        [--length shortest|short|medium|long] [--n 12] [--allow by-sa]
//   node tools/media/openverse.mjs search image "<words>" [--job jobs/<job>] [--size large] [--aspect wide|tall|square]
//        [--category photograph|illustration] [--n 12] [--allow by-sa]
//   node tools/media/openverse.mjs get <id> --job jobs/<job> [--as <name>]
//   node tools/media/openverse.mjs credits jobs/<job>          the credit lines for the delivery pack
//
// Category: most Freesound sounds carry none, so --category sound_effect hides them; search by words and length.
// Lengths (Openverse's own): shortest under 30 s, short 30 s to 2 min, medium 2 to 10 min, long over 10 min.
// Only licences a company's film can use without asking anyone: CC0 and public domain (no credit needed), and CC BY
// (a credit is needed: the line is kept). Non-commercial (NC) and no-derivatives (ND) licences are never offered:
// a brand film is commercial and is edited. Share-alike (BY-SA) would put the whole film under BY-SA, so it is left
// out unless --allow by-sa. A person still checks that what is in a sound or picture is fine to show (a logo, a face,
// a recognisable place).
//
// get saves the file to jobs/<job>/media/openverse/<id>.<ext> with <id>.json beside it (title, creator, licence,
// the page it came from, the credit line, when it was taken) and adds it to jobs/<job>/media/CREDITS.md.
// Anonymous use: 20 searches a minute, 200 a day. No account, no key, nothing about the job is sent.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://api.openverse.org/v1';
const UA = 'video-studio/1.0 (open-source video tooling)';
const SAFE = ['cc0', 'pdm', 'by'];
const say = (s) => process.stdout.write(`${s}\n`);

function args(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) o[a.slice(2)] = argv[++i]; else o._.push(a); }
  return o;
}

/** curl, not Node's fetch: it uses the Mac's own certificates, so it also works inside Claude's command sandbox. */
function curl(url, { binary = false } = {}) {
  const out = execFileSync('curl', ['-sS', '-L', '-m', '60', '-A', UA, '-w', '\n%{http_code}', url], { maxBuffer: 1 << 28, encoding: binary ? 'buffer' : 'utf8' });
  const text = binary ? out : String(out);
  const cut = binary ? out.lastIndexOf(10) : text.lastIndexOf('\n');
  const status = Number(binary ? out.subarray(cut + 1).toString() : text.slice(cut + 1));
  return { status, body: binary ? out.subarray(0, cut) : text.slice(0, cut) };
}

async function call(url) {
  const r = curl(url);
  if (r.status === 429) throw new Error('Openverse says too many searches: anonymous use allows 20 a minute and 200 a day. Wait a minute, or tomorrow.');
  if (r.status !== 200) throw new Error(`Openverse answered ${r.status} for ${url}`);
  return JSON.parse(r.body);
}

/** The licences allowed for this search. Pure. */
export const allowed = (o = {}) => [...SAFE, ...(String(o.allow || '').split(',').includes('by-sa') ? ['by-sa'] : [])];

/** The search address. Pure. */
export function searchUrl(kind, q, o = {}) {
  const p = new URLSearchParams({ q, license: allowed(o).join(','), page_size: String(Math.min(Number(o.n) || 12, 20)), mature: 'false' });
  if (kind === 'audio') {
    if (o.category) p.set('category', o.category);
    if (o.length) p.set('length', o.length);
  } else {
    if (o.size) p.set('size', o.size);
    if (o.aspect) p.set('aspect_ratio', o.aspect);
    if (o.category) p.set('category', o.category);
  }
  return `${API}/${kind === 'audio' ? 'audio' : 'images'}/?${p}`;
}

/** One result as the studio records it. Pure. */
export function record(kind, r) {
  return {
    id: r.id, kind, title: r.title || '(untitled)', creator: r.creator || 'unknown', licence: r.license, licence_version: r.license_version,
    licence_url: r.license_url, source: r.source, provider: r.provider, page: r.foreign_landing_url, url: r.url,
    filetype: r.filetype || (r.url || '').split('.').pop().split('?')[0], seconds: r.duration ? Math.round(r.duration / 100) / 10 : undefined,
    width: r.width, height: r.height, credit: r.attribution, needs_credit: !['cc0', 'pdm'].includes(r.license),
  };
}

async function search(kind, q, o) {
  if (!['audio', 'image'].includes(kind) || !q) throw new Error('Usage: openverse.mjs search audio|image "<words>"');
  const d = await call(searchUrl(kind, q, o));
  const list = (d.results || []).map((r) => record(kind, r)).filter((r) => allowed(o).includes(r.licence));
  say(`${d.result_count} found for "${q}"; ${list.length} shown (licences: ${allowed(o).join(', ')}).`);
  for (const r of list) {
    const size = kind === 'audio' ? `${r.seconds ?? '?'} s ${r.filetype}` : `${r.width ?? '?'}×${r.height ?? '?'} ${r.filetype}`;
    say(`  ${r.id}  ${r.licence.toUpperCase()}${r.needs_credit ? ' (credit)' : ''}  ${size}  "${r.title}" by ${r.creator} (${r.source})`);
  }
  if (o.job) {
    const dir = path.join(o.job, 'media', 'openverse');
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, `search-${kind}-${q.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.json`);
    fs.writeFileSync(f, `${JSON.stringify({ kind, q, searched: new Date().toISOString(), results: list }, null, 1)}\n`);
    say(`Saved the list: ${f}`);
  }
}

function creditLine(m) {
  return m.needs_credit ? m.credit : `"${m.title}" by ${m.creator} (${m.licence.toUpperCase()}, no credit needed) ${m.page || ''}`.trim();
}

function writeCredits(job) {
  const dir = path.join(job, 'media', 'openverse');
  const items = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^[0-9a-f-]{36}\.json$/.test(f)).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) : [];
  const lines = ['# Credits for media from Openverse', '', 'Written by tools/media/openverse.mjs. Every line marked "credit needed" must appear in the video\'s description or end card.', ''];
  for (const m of items.sort((a, b) => a.taken.localeCompare(b.taken))) lines.push(`- ${m.needs_credit ? '**credit needed**: ' : ''}${creditLine(m)} (file: media/openverse/${m.file})`);
  fs.writeFileSync(path.join(job, 'media', 'CREDITS.md'), `${lines.join('\n')}\n`);
  return items;
}

async function get(id, o) {
  if (!id || !o.job) throw new Error('Usage: openverse.mjs get <id> --job jobs/<job>');
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error(`"${id}" is not an Openverse id.`);
  let r; let kind = 'audio';
  try { r = await call(`${API}/audio/${id}/`); } catch { kind = 'image'; r = await call(`${API}/images/${id}/`); }
  const m = record(kind, r);
  if (!allowed(o).includes(m.licence)) throw new Error(`Not taken: its licence is ${m.licence.toUpperCase()}, which a brand film cannot use${m.licence === 'by-sa' ? ' (add --allow by-sa if the owner agrees the whole film may be BY-SA)' : ''}.`);
  const dir = path.join(o.job, 'media', 'openverse');
  fs.mkdirSync(dir, { recursive: true });
  const ext = (m.filetype || 'bin').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
  const res = curl(m.url, { binary: true });
  if (res.status !== 200) throw new Error(`The file could not be downloaded (${res.status}) from ${m.url}`);
  const file = `${id}.${ext}`;
  fs.writeFileSync(path.join(dir, file), res.body);
  const meta = { ...m, file, as: o.as || null, taken: new Date().toISOString() };
  fs.writeFileSync(path.join(dir, `${id}.json`), `${JSON.stringify(meta, null, 1)}\n`);
  writeCredits(o.job);
  say(`Saved ${path.join(dir, file)} (${m.licence.toUpperCase()}${m.needs_credit ? ', credit needed: added to media/CREDITS.md' : ', no credit needed'}).`);
  if (kind === 'audio' && m.source === 'freesound') say('Note: Freesound gives a preview copy (MP3, about 128 kb/s). Good for sound effects; for a hero sound, a person can download the original from its page.');
}

async function main() {
  const o = args(process.argv.slice(2));
  const [cmd, a, b] = o._;
  if (cmd === 'search') return search(a, b, o);
  if (cmd === 'get') return get(a, o);
  if (cmd === 'credits') { if (!a) throw new Error('Usage: openverse.mjs credits jobs/<job>'); const items = writeCredits(a); say(`${items.length} item(s); ${items.filter((m) => m.needs_credit).length} need a credit. Written: ${path.join(a, 'media', 'CREDITS.md')}`); return; }
  say(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 22).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { say(e.message); process.exit(1); });
