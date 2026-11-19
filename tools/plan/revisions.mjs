#!/usr/bin/env node
// Revision notes that the next cut is checked against: what the creator asked for, shot by shot, and proof it landed.
//
//   revisions.mjs snapshot <job_dir> --as <name> [--no-frames]
//       Saves the cut as it is now: film.json, shots.json, a fingerprint of every engine file of the film, and one frame
//       per shot (rendered with tools/film/storyboard.mjs; must run outside the command sandbox) into
//       jobs/<job>/revisions/<name>/. Take one of every cut the creator reviews.
//   revisions.mjs note <job_dir> --round <name> --from <snapshot> --action keep|change|remove|add --scope <scenes>
//       --aspect <pace|framing|copy|sound|look|order|ending|opening|content|other> --says "<their words>" [--target <t>]
//       One note. --scope takes scene ids (S03,S04) or opening, ending, all, rest ("everything else": keep everything
//       I liked). --target is measured when it can be: slower, faster, hold>=2, scene>=4, length<=30.
//   revisions.mjs verify <job_dir> --round <name> [--after <snapshot>]
//       Snapshots the new cut (or uses --after), compares it with the round's --from snapshot, and writes
//       jobs/<job>/revisions/<round>/report.md: every note passed or failed with the reason, and every scene that changed
//       without a note asking for it.
//   revisions.mjs show <job_dir>     the rounds and their notes
//
// "Keep everything I liked, slow down the demo, and change the ending" is three notes:
//   --action change --scope S04,S05 --aspect pace --target slower --says "slow down the demo"
//   --action change --scope ending --aspect ending --says "change the ending"
//   --action keep --scope rest --aspect content --says "keep everything I liked"
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ACTIONS, diff, resolveScope, verify } from './lib/revisions.mjs';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ENGINE = path.join(STUDIO, 'engine');
const [cmd, jobArg, ...rest] = process.argv.slice(2);
const flag = (name) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : undefined; };
if (!cmd || !jobArg) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 25).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(cmd ? 2 : 0); }
const die = (m) => { console.error(m); process.exit(1); };
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const jobDir = path.resolve(jobArg);
const job = path.basename(jobDir);
const revDir = path.join(jobDir, 'revisions');
const ledgerFile = path.join(jobDir, 'revisions.json');
const ledger = () => (fs.existsSync(ledgerFile) ? readJson(ledgerFile) : { rounds: [] });
const save = (d) => { fs.writeFileSync(`${ledgerFile}.tmp`, JSON.stringify(d, null, 1) + '\n'); fs.renameSync(`${ledgerFile}.tmp`, ledgerFile); };

function filmDir() {
  const films = path.join(ENGINE, 'src', 'jobs');
  const slug = fs.readdirSync(films).find((s) => fs.existsSync(path.join(films, s, 'film.json')) && readJson(path.join(films, s, 'film.json')).job === job);
  if (!slug) die(`No film found for ${job}. Run: node tools/film/scaffold.mjs ${jobArg}`);
  return path.join(films, slug);
}

function walk(dir, out = []) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p, out); else out.push(p); } return out; }

function snapshot(name, { frames = true } = {}) {
  const dir = path.join(revDir, name);
  const fd = filmDir();
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(path.join(jobDir, 'shots.json'))) fs.copyFileSync(path.join(jobDir, 'shots.json'), path.join(dir, 'shots.json'));
  const code = Object.fromEntries(walk(fd).filter((f) => !f.endsWith('film.json')).map((f) => [path.relative(fd, f), crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16)]));
  fs.writeFileSync(path.join(dir, 'code.json'), JSON.stringify(code, null, 1));
  if (frames) {
    // The frames must show the shot list as it is now, so the film is refreshed from it first.
    const sc = spawnSync(process.execPath, [path.join(STUDIO, 'tools/film/scaffold.mjs'), jobDir], { encoding: 'utf8' });
    if (sc.status !== 0) die(`The film could not be refreshed from the shot list:\n${(sc.stderr || sc.stdout).slice(-600)}`);
    const r = spawnSync(process.execPath, [path.join(STUDIO, 'tools/film/storyboard.mjs'), jobDir, '--out', path.join(dir, 'frames')], { stdio: 'inherit' });
    if (r.status !== 0) die('The frames could not be rendered (rendering must run outside the command sandbox). The snapshot has no frames.');
  }
  fs.copyFileSync(path.join(fd, 'film.json'), path.join(dir, 'film.json'));
  console.log(`Snapshot ${name} saved in ${path.relative(STUDIO, dir)}.`);
  return dir;
}

function loadSnap(name) {
  const dir = path.join(revDir, name);
  if (!fs.existsSync(path.join(dir, 'film.json'))) die(`No snapshot ${name}. Take one: node tools/plan/revisions.mjs snapshot ${jobArg} --as ${name}`);
  const frames = {};
  const fj = path.join(dir, 'frames', 'frames.json');
  if (fs.existsSync(fj)) {
    const count = {};
    for (const f of readJson(fj).frames) { count[f.scene] = (count[f.scene] || 0) + 1; frames[`${f.scene}#${count[f.scene]}`] = path.join(dir, 'frames', path.basename(f.file)); }
  }
  return { film: readJson(path.join(dir, 'film.json')), code: readJson(path.join(dir, 'code.json')), frames, dir };
}

function psnr(a, b) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', a, '-i', b, '-lavfi', 'psnr', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = (r.stderr || '').match(/average:(inf|[\d.]+)/);
  return m ? (m[1] === 'inf' ? Infinity : Number(m[1])) : null;
}

if (cmd === 'snapshot') {
  const name = flag('as'); if (!name) die('Name it: --as r1');
  snapshot(name, { frames: !rest.includes('--no-frames') });
} else if (cmd === 'note') {
  const round = flag('round'); const action = flag('action'); const scopeArg = flag('scope'); const says = flag('says');
  if (!round || !action || !scopeArg || !says) die('A note needs --round, --action, --scope and --says (and --from when the round is new).');
  if (!ACTIONS.includes(action)) die(`--action is one of ${ACTIONS.join(', ')}.`);
  const d = ledger();
  let r = d.rounds.find((x) => x.name === round);
  if (!r) {
    const from = flag('from'); if (!from) die(`Round ${round} is new: say which cut it revises with --from <snapshot>.`);
    loadSnap(from);
    r = { name: round, opened: new Date().toISOString().slice(0, 10), from, items: [] }; d.rounds.push(r);
  }
  const ids = loadSnap(r.from).film.scenes.map((s) => s.id);
  const parts = scopeArg.split(',').map((s) => s.trim());
  const scope = parts.includes('rest') ? ['rest'] : resolveScope(parts, ids);
  const item = { id: `${round}-${r.items.length + 1}`, says, action, aspect: flag('aspect') || 'other', scope, target: flag('target') || null, status: 'open' };
  r.items.push(item); save(d);
  console.log(`${item.id}: ${action} ${item.aspect} in ${scope.join(', ')}${item.target ? ` (target ${item.target})` : ''}.`);
} else if (cmd === 'verify') {
  const round = flag('round'); if (!round) die('Which round? --round r2');
  const d = ledger(); const r = d.rounds.find((x) => x.name === round); if (!r) die(`No round ${round}.`);
  const afterName = flag('after') || `${round}-cut`;
  if (!flag('after')) snapshot(afterName);
  const before = loadSnap(r.from); const after = loadSnap(afterName);
  if (!Object.keys(before.frames).length || !Object.keys(after.frames).length) die('Both snapshots need frames to compare.');
  const dd = diff(before, after, psnr);
  const v = verify(r, dd);
  r.items = v.items.map(({ resolved_scope, ...x }) => x); r.after = afterName; r.verified_at = new Date().toISOString(); save(d);
  const lines = [`# Revision ${round}: did the cut do what was asked?`, '', `Compared ${r.from} with ${afterName}. Film ${dd.film_length.before} s → ${dd.film_length.after} s.`, ''];
  lines.push('| Note | Their words | Scenes | Result |', '|---|---|---|---|');
  for (const x of v.items) lines.push(`| ${x.action} ${x.aspect} | "${x.says}" | ${x.resolved_scope.join(', ')} | ${x.status === 'verified' ? 'Done' : x.status === 'failed' ? '**Not done**' : 'A person checks'}: ${x.result} |`);
  lines.push('', v.unasked.length ? `**Changed without a note asking for it:** ${v.unasked.map((u) => `${u.scene} (${u.shots.join(', ') || `length ${u.length.before} → ${u.length.after} s`})`).join('; ')}.` : 'No scene changed without a note asking for it.');
  if (dd.shared_code_changed.length) lines.push('', `Shared code changed (${dd.shared_code_changed.join(', ')}): every scene was compared frame by frame for that reason.`);
  lines.push('', '## Scene by scene', '', '| Scene | Length before → after | Holds after (s) | Shots changed |', '|---|---|---|---|');
  for (const [id, s] of Object.entries(dd.scenes)) lines.push(`| ${id}${s.new_scene ? ' (new)' : ''} | ${s.length.before ?? '-'} → ${s.length.after} | ${s.holds.after.join(', ')} | ${s.shots_changed.length ? s.shots_changed.map((k) => { const sh = s.shots.find((x) => x.key === k); return `${k}${sh?.db != null && Number.isFinite(sh.db) ? ` (${sh.db.toFixed(0)} dB)` : ''}`; }).join(', ') : 'none'} |`);
  const drift = Object.values(dd.scenes).flatMap((s) => s.shots_drifted || []);
  if (drift.length) lines.push('', `Same picture with small drift (grain or light moving with time, ${'40 to 50'} dB): ${drift.join(', ')}. Not counted as a change.`);
  lines.push('', 'Frames are compared one per shot, at the moment the shot rests; a change between those moments is not seen here. Whether the change is what the creator meant is for the creator to judge.');
  const out = path.join(revDir, round); fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'report.md'), lines.join('\n') + '\n');
  console.log(lines.slice(0, 6 + v.items.length + 2).join('\n'));
  console.log(`\nReport: ${path.relative(STUDIO, path.join(out, 'report.md'))}`);
  process.exit(v.ok ? 0 : 1);
} else if (cmd === 'show') {
  const d = ledger();
  if (!d.rounds.length) { console.log('No revision rounds yet.'); process.exit(0); }
  for (const r of d.rounds) { console.log(`${r.name} (revises ${r.from}${r.after ? `, checked against ${r.after}` : ''}):`); for (const x of r.items) console.log(`  ${x.id} ${x.status.padEnd(14)} ${x.action} ${x.aspect} in ${x.scope.join(',')}${x.target ? ` [${x.target}]` : ''}: "${x.says}"${x.result ? ` → ${x.result}` : ''}`); }
} else die(`Unknown command ${cmd}.`);
