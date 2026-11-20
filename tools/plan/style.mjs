#!/usr/bin/env node
// "Make the next one in this style": an approved film's style saved once, and a new job started from it.
//
//   style.mjs save <job_dir> --name <style>          saves the film's style into brands/<brand>/styles/<style>/
//   style.mjs new <new_job_dir> --style <brand>/<style> "<the creator's words for this episode>"
//                                                    starts the new job with everything the style settles
//   style.mjs list [<brand>]                         the saved styles
//
// A style keeps what the creator approved and what is the same from episode to episode: the size and the cuts, the
// kind, the voice choice, the energy, the stage, the scene structure (beats, lengths, shot sizes, moves, sounds), the
// scene code (the motion itself), the sound recipe, the references and what they are liked for, the brief's standing
// decisions, and the revision notes that were verified (what this creator corrected once and should not have to again).
// It leaves out what is new each time: the words on screen, each shot's point and eye, what the viewer should do,
// what must be shown. So `tools/plan/brief.mjs check` on the new job asks only about those.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ENGINE_JOBS = path.join(STUDIO, 'engine', 'src', 'jobs');
const argv = process.argv.slice(2);
const [cmd, target] = argv;
const flag = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const words = argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !all[i - 1]?.startsWith('--')).join(' ');
const die = (m) => { console.error(m); process.exit(1); };
const read = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
const write = (f, d) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(d, null, 1) + '\n'); };
const slugOf = (jobDir) => spawnSync(process.execPath, [path.join(STUDIO, 'tools/film/scaffold.mjs'), '--slug', jobDir], { encoding: 'utf8' }).stdout.trim();
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain && !cmd) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 16).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(0); }

/** What a style needs before `new` can start an episode from it, as plain phrases. Empty when it is complete.
 *  The list fields that `save` always writes may be missing (they are read as empty), but not of the wrong kind. */
export function missingFields(style, dir) {
  const out = [];
  for (const k of ['size', 'type', 'stage', 'energy_preset']) if (typeof style?.[k] !== 'string' || !style[k]) out.push(`no ${k}`);
  if (!Array.isArray(style?.structure) || !style.structure.length) out.push('no scenes in its structure');
  else {
    const bad = style.structure.filter((s) => !s || typeof s.id !== 'string' || !Array.isArray(s.shots) || !s.shots.length).map((s, i) => s?.id || `scene ${i + 1}`);
    if (bad.length) out.push(`no shots for ${bad.join(', ')}`);
  }
  for (const k of ['references', 'decisions', 'must_not', 'learned', 'scene_files', 'sound']) {
    if (style?.[k] === undefined) { if (style) style[k] = []; continue; }
    if (!Array.isArray(style[k])) out.push(`a ${k} that is not a list`);
  }
  if (dir && Array.isArray(style?.scene_files)) { const gone = style.scene_files.filter((f) => !fs.existsSync(path.join(dir, 'scenes', f))); if (gone.length) out.push(`scene files that are missing (${gone.join(', ')})`); }
  if (dir && Array.isArray(style?.sound)) { const gone = style.sound.filter((f) => !fs.existsSync(path.join(dir, 'sound', f))); if (gone.length) out.push(`sound files that are missing (${gone.join(', ')})`); }
  return out;
}

if (!isMain) { /* imported for missingFields */ } else if (cmd === 'save') {
  const jobDir = path.resolve(target || die('Which job?'));
  const name = flag('name') || die('Name the style: --name <style>');
  const job = read(path.join(jobDir, 'job.json')) || die('No job.json.');
  const brief = read(path.join(jobDir, 'brief.json')) || {};
  const shots = read(path.join(jobDir, 'shots.json')) || die('No shots.json.');
  const revisions = read(path.join(jobDir, 'revisions.json'));
  const brand = job.brand || read(path.join(STUDIO, 'studio.json')).default_brand;
  const dir = path.join(STUDIO, 'brands', brand, 'styles', name);
  const slug = slugOf(jobDir);
  const scenesDir = path.join(ENGINE_JOBS, slug, 'scenes');
  fs.mkdirSync(path.join(dir, 'scenes'), { recursive: true });
  const sceneFiles = fs.existsSync(scenesDir) ? fs.readdirSync(scenesDir).filter((f) => /\.tsx?$/.test(f)) : [];
  for (const f of sceneFiles) fs.copyFileSync(path.join(scenesDir, f), path.join(dir, 'scenes', f));
  for (const f of ['mix.sh', 'mix-plan.json', 'music-plan.json']) if (fs.existsSync(path.join(jobDir, 'audio', f))) { fs.mkdirSync(path.join(dir, 'sound'), { recursive: true }); fs.copyFileSync(path.join(jobDir, 'audio', f), path.join(dir, 'sound', f)); }
  const learned = (revisions?.rounds || []).flatMap((r) => r.items.filter((x) => x.status === 'verified' && x.action !== 'keep').map((x) => ({ said: x.says, aspect: x.aspect, scenes: x.scope, target: x.target, round: r.name })));
  const style = {
    name, brand, saved: new Date().toISOString().slice(0, 10), from_job: path.basename(jobDir),
    approved: job.approvals?.full_animation || job.approvals?.delivery || null,
    size: job.size, energy_preset: job.energy_preset, voice: job.voice, length_cap_seconds: job.length_cap_seconds, type: job.type,
    stage: shots.stage, kind: brief.kind || null, deliver: brief.deliver || null,
    structure: shots.scenes.map((s) => ({ id: s.id, title: s.title, beat: s.beat, energy: s.energy, ...(s.seconds ? { seconds: s.seconds } : {}), ...(s.silent ? { silent: true } : {}), transition_in: s.transition_in, hand_off: s.hand_off,
      shots: s.shots.map((sh) => ({ size: sh.size, move: sh.move, sound: sh.sound, focal_point: sh.focal_point, ...(sh.borrow ? { borrow: sh.borrow } : {}), example_text: sh.text, ...(sh.label !== undefined ? { example_label: sh.label } : {}) })) })),
    references: brief.references || [], decisions: (brief.decisions || []).filter((d) => !d.applies_to || d.applies_to === 'all'), must_not: brief.must_not || [],
    learned, scene_files: sceneFiles, sound: fs.existsSync(path.join(dir, 'sound')) ? fs.readdirSync(path.join(dir, 'sound')) : [],
  };
  write(path.join(dir, 'style.json'), style);
  console.log(`Saved style "${name}" for ${brand} from ${path.basename(jobDir)}: ${style.structure.length} scenes, ${sceneFiles.length} scene files, ${learned.length} verified corrections, ${style.decisions.length} standing decisions.`);
  console.log(`Next episode: node tools/plan/style.mjs new jobs/<date>-<name> --style ${brand}/${name} "<what this one is about>"`);
} else if (cmd === 'new') {
  const jobDir = path.resolve(target || die('Which new job folder?'));
  const ref = flag('style') || die('Which style? --style <brand>/<style>');
  const [brand, name] = ref.split('/');
  const dir = path.join(STUDIO, 'brands', brand, 'styles', name);
  const style = read(path.join(dir, 'style.json')) || die(`No style ${ref}. See: node tools/plan/style.mjs list ${brand}`);
  // Everything is checked before anything is written, so a style that cannot start an episode leaves no half-made job.
  const missing = missingFields(style, dir);
  if (missing.length) die(`The style ${ref} cannot start an episode because it has ${missing.join(', ')}, so nothing was written. Save it again from an approved film: node tools/plan/style.mjs save jobs/<job> --name ${name}`);
  const existing = ['job.json', 'brief.json', 'shots.json'].filter((f) => fs.existsSync(path.join(jobDir, f)));
  if (existing.length) die(`${path.relative(STUDIO, jobDir)} already has ${existing.join(', ')}; nothing was changed. Start the episode in a new folder.`);
  fs.mkdirSync(path.join(jobDir, 'audio'), { recursive: true });
  const template = read(path.join(STUDIO, 'templates', 'job.json'));
  const today = new Date().toISOString().slice(0, 10);
  write(path.join(jobDir, 'job.json'), { ...template, name: path.basename(jobDir), brand, type: style.type, created: today, maker: '', size: style.size, length_cap_seconds: style.length_cap_seconds, energy_preset: style.energy_preset, voice: style.voice, stage_next: 'storyboard', approval_mode: 'guided', style: ref,
    notes: [`Started from the style ${ref}${style.from_job ? ` (approved film ${style.from_job})` : ''}. Idea, moodboard and look are settled by the style; approve the words and the storyboard.`] });
  const bt = read(path.join(STUDIO, 'templates', 'brief.json')); delete bt._about;
  write(path.join(jobDir, 'brief.json'), { ...bt, in_their_words: words, kind: style.kind || '', deliver: style.deliver || bt.deliver, length_cap_seconds: style.length_cap_seconds, voice: style.voice || '', references: style.references, decisions: style.decisions, must_not: style.must_not, style: ref });
  write(path.join(jobDir, 'shots.json'), { stage: style.stage, planned_instant_changes: [], planned_holds: [],
    scenes: style.structure.map((s) => ({ ...s, shots: s.shots.map(({ example_text, example_label, focal_point, ...sh }) => ({ text: '', ...(example_label !== undefined ? { label: '' } : {}), ...sh, capture: null, point: '', eye: '', _last_time: example_label !== undefined ? `${example_text} / ${example_label}` : example_text, ...(focal_point ? { _last_focal_point: focal_point } : {}) })) })) });
  // The approved motion: the scene files go where the scaffold looks, so it keeps them instead of making placeholders.
  const slug = slugOf(jobDir);
  const scenes = path.join(ENGINE_JOBS, slug, 'scenes');
  fs.mkdirSync(scenes, { recursive: true });
  for (const f of style.scene_files) if (!fs.existsSync(path.join(scenes, f))) fs.copyFileSync(path.join(dir, 'scenes', f), path.join(scenes, f));
  for (const f of style.sound) fs.copyFileSync(path.join(dir, 'sound', f), path.join(jobDir, 'audio', f));
  console.log(`Started ${path.relative(STUDIO, jobDir)} in the style ${ref}.`);
  console.log(`  settled by the style: ${style.size} master${style.deliver?.length > 1 ? ` and ${style.deliver.filter((d) => !d.master).map((d) => d.size).join(', ')} cuts` : ''}, ${style.kind || style.type}, voice ${style.voice}, ${style.energy_preset}, ${style.stage} stage, ${style.structure.length} scenes, the motion (${style.scene_files.length} scene files), the sound recipe, ${style.decisions.length} standing decisions`);
  if (style.learned.length) console.log(`  corrections carried over: ${style.learned.map((l) => `"${l.said}"${l.target ? ` (${l.target})` : ''}`).join('; ')}`);
  console.log(`  new this time: the words on screen, each shot's point and eye, what the viewer should do, what must be shown.`);
  console.log(`Next: fill the shots' "text", "point" and "eye" in shots.json (each shot's "_last_time" shows the last episode's words), then node tools/plan/brief.mjs check ${path.relative(STUDIO, jobDir)}`);
} else if (cmd === 'list') {
  const brands = target ? [target] : fs.readdirSync(path.join(STUDIO, 'brands')).filter((b) => !b.startsWith('_'));
  let n = 0;
  for (const b of brands) {
    const d = path.join(STUDIO, 'brands', b, 'styles');
    if (!fs.existsSync(d)) continue;
    for (const s of fs.readdirSync(d)) { const st = read(path.join(d, s, 'style.json')); if (st) { n++; console.log(`${b}/${s}: ${st.size || '?'} ${st.kind || st.type || 'film'}, ${(st.structure || []).length} scenes${st.from_job ? `, from ${st.from_job}` : ''}${st.saved ? ` (saved ${st.saved})` : ''}`); } }
  }
  if (!n) console.log('No saved styles yet. Save one from an approved film: node tools/plan/style.mjs save jobs/<job> --name <style>');
} else die(`Unknown command ${cmd}.`);
