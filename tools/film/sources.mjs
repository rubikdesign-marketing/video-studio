#!/usr/bin/env node
// Proof of source (CAPTURE-PLAN.md section 8; the delivery stage): lists every product shot in the film with the
// capture and take it came from, when it was captured, the product's address and the browser that recorded it.
// A product shot with no source fails delivery.
//
//   node tools/film/sources.mjs jobs/<job> [--scenes <engine scenes folder>] [--no-write]
//
// Product shots are found in two places: shots.json (a shot's "capture": a capture "capture/<id>" means its best
// take, "capture/<id>/take-2" that take, "capture/<id>/take-2/marks/x.png" a still from it) and the film's scene code
// (engine/src/jobs/<slug>/scenes/*.tsx naming a capture the engine plays, "jobs/<slug>/capture/<id>/..."). Each is
// traced to the take's capture.json. When the engine's copy of a capture is there (engine/public/jobs/<slug>/capture/
// <id>/recording.mp4), it must be the best take's own recording.
//
// Writes jobs/<job>/deliver/sources.json and sources.txt (the delivery pack's proof of source). Exit code 0 when
// every product shot has a source, 1 when one has none, 2 when it could not run.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { rel, sourceOfShot, STUDIO } from '../checks/lib/film.mjs';

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const localStamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** The first megabyte and the size of a file, enough to tell two recordings apart. */
const fingerprint = (f) => {
  const fd = fs.openSync(f, 'r');
  const buf = Buffer.alloc(Math.min(1 << 20, fs.fstatSync(fd).size));
  fs.readSync(fd, buf, 0, buf.length, 0);
  fs.closeSync(fd);
  return `${fs.statSync(f).size}:${crypto.createHash('sha1').update(buf).digest('hex')}`;
};

const describe = (job, scene, shot, value, from) => {
  const src = sourceOfShot(job, value);
  const row = { scene, shot, capture: value, from };
  if (src.kind === 'none') return { ...row, ok: false, why: src.why };
  const c = readJson(src.captureJson);
  return {
    ...row,
    ok: true,
    from: from ?? (src.kind === 'take' && !fs.statSync(path.resolve(job, value)).isDirectory() ? 'a still or clip taken from the take' : src.kind === 'best' ? 'the best take' : 'that take'),
    take: c.take ?? Number(path.basename(src.takeDir).replace(/\D/g, '')),
    takeDir: rel(src.takeDir),
    captured: c.captured ?? null,
    address: c.address ?? null,
    page: c.mark_details ? Object.values(c.mark_details)[0]?.url ?? null : null,
    browser: [c.browser, c.chrome].filter(Boolean).join(', ') || null,
    brand: c.brand ?? null,
    source: c.source?.kind ?? c.source ?? null,
  };
};

/** Every product shot in the job's film, traced to its take. Returns { pass, shots }. */
export function sourcesOf(jobDir, { scenesDir } = {}) {
  const job = path.resolve(jobDir);
  const slug = path.basename(job).replace(/^_/, '');
  const shots = [];
  const shotsFile = path.join(job, 'shots.json');
  if (fs.existsSync(shotsFile))
    for (const scene of readJson(shotsFile).scenes ?? [])
      (scene.shots ?? []).forEach((s, i) => {
        if (s.capture) shots.push(describe(job, scene.id, i + 1, s.capture));
      });
  const dir = scenesDir ?? path.join(STUDIO, 'engine', 'src', 'jobs', slug, 'scenes');
  if (fs.existsSync(dir))
    for (const file of fs.readdirSync(dir).filter((f) => /\.(tsx?|jsx?|json)$/.test(f)).sort()) {
      const code = fs.readFileSync(path.join(dir, file), 'utf8');
      const scene = path.basename(file).replace(/\.[^.]+$/, '');
      const ids = new Set([...code.matchAll(/jobs\/([\w.-]+)\/capture\/([\w.-]+)/g)].filter((m) => m[1] === slug).map((m) => m[2]));
      for (const id of ids) {
        if (shots.some((s) => s.scene === scene && s.capture === `capture/${id}`)) continue;
        const row = describe(job, scene, null, `capture/${id}`, 'played by the scene code');
        // The engine's copy must be the best take's own recording.
        const pub = path.join(STUDIO, 'engine', 'public', 'jobs', slug, 'capture', id, 'recording.mp4');
        if (row.ok && fs.existsSync(pub)) {
          const own = path.join(STUDIO, row.takeDir, 'recording.mp4');
          const same = fs.existsSync(own) && fingerprint(own) === fingerprint(pub);
          row.engine_copy = same ? 'the same recording as the take' : 'DIFFERENT from the take';
          if (!same) Object.assign(row, { ok: false, why: `the engine plays ${rel(pub)}, which is not take ${row.take}'s recording: run node tools/capture/capture.mjs relist, then render again` });
        }
        shots.push(row);
      }
    }
  return { pass: shots.every((s) => s.ok), shots };
}

function main() {
  const args = process.argv.slice(2);
  const jobDir = args[0] && !args[0].startsWith('--') ? args[0] : null;
  const flag = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  if (!jobDir || !fs.existsSync(path.join(jobDir, 'job.json'))) {
    console.log('Usage: node tools/film/sources.mjs jobs/<job> [--scenes <engine scenes folder>] [--no-write]');
    process.exit(2);
  }
  const r = sourcesOf(jobDir, { scenesDir: flag('--scenes') });
  const lines = [`Proof of source: ${rel(path.resolve(jobDir))}, checked ${localStamp()}`];
  if (!r.shots.length) lines.push('  This film shows no product shots (no shot names a capture, and no scene plays one).');
  for (const s of r.shots) {
    const where = `${s.scene}${s.shot ? ` shot ${s.shot}` : ''}`;
    if (s.ok) lines.push(`  ${where}: ${s.capture} (${s.from}), take ${s.take}, captured ${s.captured ?? 'date not recorded'}, ${s.address ?? 'no address recorded'}, ${s.browser ?? 'browser not recorded'}${s.engine_copy ? `; the engine's copy is ${s.engine_copy}` : ''}`);
    else lines.push(`  ${where}: NO SOURCE for ${s.capture}: ${s.why}`);
  }
  const missing = r.shots.filter((s) => !s.ok).length;
  lines.push(r.pass && !r.shots.length ? 'Pass: no product shots to trace.' : r.pass ? `Pass: all ${r.shots.length} product shot${r.shots.length === 1 ? '' : 's'} traced to a take.` : `Fail: ${missing} product shot${missing === 1 ? '' : 's'} with no source. Record it with tools/capture/capture.mjs and name the capture in shots.json, or take the shot out. Delivery stops here.`);
  console.log(lines.join('\n'));
  if (!args.includes('--no-write')) {
    const out = path.join(jobDir, 'deliver');
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'sources.json'), JSON.stringify({ checked: localStamp(), ...r }, null, 1) + '\n');
    fs.writeFileSync(path.join(out, 'sources.txt'), lines.join('\n') + '\n');
    console.log(`Written: ${rel(path.join(out, 'sources.txt'))} and sources.json`);
  }
  process.exit(r.pass ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
