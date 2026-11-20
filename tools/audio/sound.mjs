#!/usr/bin/env node
// Music and sound effects for a Tulvo video, generated on the team's ElevenLabs plan.
//
//   sound.mjs plan <job_dir>     turn audio/music-brief.json into audio/music-plan.json (no cost; check it first)
//   sound.mjs music <job_dir>    compose audio/music.mp3 from the plan
//   sound.mjs sfx <job_dir>      generate every effect in audio/sfx.json that does not exist yet
//
// audio/music-brief.json (written at the animation stage, after the voice is locked):
//   { "style": ["warm electronic", "110 bpm", "instrumental"], "avoid": ["vocals", "long intro"],
//     "sections": [ { "name": "Hook", "start": 0, "end": 4.2, "energy": 5, "feel": ["starts on a hit"] }, ... ] }
//   Section times are film seconds, so the music changes where the picture changes.
// audio/sfx.json:
//   [ { "id": "whoosh-1", "prompt": "soft airy whoosh, short", "seconds": 0.8, "at": 3.25, "gain": 0.5 }, ... ]
//   "at" and "gain" are used by mix.py; "prompt" and "seconds" are used here.
//
// Limits learned the hard way: a music section is at least 3 s; an effect is 0.5 to 30 s; a few requests at a time.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Inside Claude's command sandbox the network goes through a proxy, which Node only uses when told to.
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const again = spawnSync(process.execPath, ['--no-warnings', ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' } });
  process.exit(again.status ?? 1);
}
const [cmd, jobDir] = process.argv.slice(2);
const die = (m) => { console.error(m); process.exit(1); };
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 1));
const audio = () => path.join(path.resolve(jobDir || die('Give the job folder.')), 'audio');

// What each energy level sounds like when the brief gives no "feel" for a section.
const FEEL = {
  1: ['very sparse', 'almost silent', 'a single held note', 'no drums'],
  2: ['light and open', 'drums pulled back', 'leaves space for a voice'],
  3: ['steady groove', 'moderate energy', 'leaves space for a voice'],
  4: ['driving', 'full rhythm', 'building'],
  5: ['full energy', 'big downbeat', 'widest arrangement'],
};

function key() {
  const f = path.join(STUDIO, '.env');
  const m = fs.existsSync(f) && fs.readFileSync(f, 'utf8').match(/^ELEVENLABS_API_KEY=(.+)$/m);
  if (!m || !m[1].trim()) die('No ElevenLabs key. Run: node setup/runtime/install.mjs, then paste the key into .env');
  return m[1].trim();
}
async function post(url, body) {
  const r = await fetch('https://api.elevenlabs.io' + url, {
    method: 'POST', headers: { 'xi-api-key': key(), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) die(`ElevenLabs refused: ${r.status} ${(await r.text()).slice(0, 400)}`);
  return Buffer.from(await r.arrayBuffer());
}
function seconds(file) {
  return parseFloat(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout);
}

function plan() {
  const A = audio();
  const brief = readJson(path.join(A, 'music-brief.json'));
  if (!brief.sections?.length) die('music-brief.json has no sections.');
  // Sections must touch and run in order; a section under 3 s joins its neighbour.
  const secs = brief.sections.map((s) => ({ ...s, ms: Math.round((s.end - s.start) * 1000) }));
  secs.forEach((s, i) => {
    if (s.ms <= 0) die(`Section "${s.name}" ends before it starts.`);
    if (i && Math.abs(s.start - secs[i - 1].end) > 0.01) die(`Section "${s.name}" does not start where "${secs[i - 1].name}" ends.`);
  });
  const merged = [];
  for (const s of secs) {
    const last = merged[merged.length - 1];
    if (s.ms < 3000 && last) {
      // Too short to be its own section: it becomes the ending of the one before, described in words.
      last.feel = [...(last.feel?.length ? last.feel : FEEL[last.energy] || FEEL[3]),
        `final ${(s.ms / 1000).toFixed(1)} seconds: ${s.feel?.[0] || (FEEL[s.energy] || FEEL[3])[0]}`];
      last.ms += s.ms; last.name += ' + ' + s.name;
    }
    else merged.push({ ...s });
  }
  if (merged[0].ms < 3000 && merged[1]) {
    merged[1].feel = [`first ${(merged[0].ms / 1000).toFixed(1)} seconds: ${merged[0].feel?.[0] || (FEEL[merged[0].energy] || FEEL[3])[0]}`,
      ...(merged[1].feel?.length ? merged[1].feel : FEEL[merged[1].energy] || FEEL[3])];
    merged[1].ms += merged[0].ms; merged[1].name = merged[0].name + ' + ' + merged[1].name; merged.shift();
  }
  const total = merged.reduce((n, s) => n + s.ms, 0);
  const out = {
    model_id: 'music_v1',
    composition_plan: {
      positive_global_styles: brief.style || ['instrumental'],
      negative_global_styles: brief.avoid || ['vocals', 'singing', 'lyrics'],
      sections: merged.map((s) => ({
        section_name: s.name,
        positive_local_styles: s.feel?.length ? s.feel : FEEL[s.energy] || FEEL[3],
        negative_local_styles: s.energy <= 2 ? ['full drums', 'drop'] : s.energy >= 5 ? ['quiet', 'breakdown'] : [],
        duration_ms: s.ms,
        lines: [],
      })),
    },
  };
  writeJson(path.join(A, 'music-plan.json'), out);
  console.log(`music-plan.json: ${merged.length} sections, ${(total / 1000).toFixed(1)} s`);
  for (const s of merged) console.log(`  ${(s.ms / 1000).toFixed(1).padStart(5)} s  energy ${s.energy}  ${s.name}`);
  const film = brief.sections[brief.sections.length - 1].end - brief.sections[0].start;
  if (Math.abs(total / 1000 - film) > 0.05) die('The plan length does not match the brief. Not written correctly.');
}

async function music() {
  const A = audio(); const planFile = path.join(A, 'music-plan.json');
  if (!fs.existsSync(planFile)) die('Run "sound.mjs plan" first and read the plan.');
  const body = readJson(planFile);
  const want = body.composition_plan.sections.reduce((n, s) => n + s.duration_ms, 0) / 1000;
  const out = path.join(A, 'music.mp3');
  if (fs.existsSync(out)) fs.renameSync(out, path.join(A, `music-previous-${Date.now()}.mp3`));   // keep the earlier take
  fs.writeFileSync(out, await post('/v1/music?output_format=mp3_44100_192', body));
  const got = seconds(out);
  console.log(`music.mp3 ${got.toFixed(1)} s (asked for ${want.toFixed(1)} s)`);
  if (got < want - 0.5) die('The music came back shorter than the film. Compose again.');
}

async function sfx() {
  const A = audio(); const dir = path.join(A, 'sfx'); fs.mkdirSync(dir, { recursive: true });
  const cues = readJson(path.join(A, 'sfx.json'));
  const todo = [];
  const seen = new Set();
  for (const c of cues) {
    if (seen.has(c.id)) continue; seen.add(c.id);                      // one file per id, reused at several times
    if (!c.prompt) die(`Effect "${c.id}" has no prompt.`);
    const secs = Math.min(30, Math.max(0.5, c.seconds ?? 1));
    if (!fs.existsSync(path.join(dir, c.id + '.mp3'))) todo.push({ ...c, secs });
  }
  console.log(`${seen.size} effects, ${todo.length} to make`);
  for (let i = 0; i < todo.length; i += 4) {                           // four at a time
    await Promise.all(todo.slice(i, i + 4).map(async (c) => {
      const buf = await post('/v1/sound-generation?output_format=mp3_44100_192', { text: c.prompt, duration_seconds: c.secs, prompt_influence: c.influence ?? 0.5 });
      fs.writeFileSync(path.join(dir, c.id + '.mp3'), buf);
      console.log('made', c.id);
    }));
  }
}

if (cmd === 'plan') plan();
else if (cmd === 'music') await music();
else if (cmd === 'sfx') await sfx();
else { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 16).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(cmd ? 2 : 0); }
