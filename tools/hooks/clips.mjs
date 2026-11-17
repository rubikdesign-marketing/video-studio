#!/usr/bin/env node
// A clip from viralhooks.org as a film's opening: only with the owner's decision, only for an organic post
// (LIBRARY-PLAN.md decision 1). Search the library in the session with the viralhooks connector (.mcp.json), for
// reference: to study what a strong first two seconds looks like. The studio's own hook openers and licensed footage
// are the default; this tool is for the rare clip the owner wants.
//
//   node tools/hooks/clips.mjs use <the clip's page on viralhooks.org> --job jobs/<job> --post organic
//        --approved-by "<name>" --words "<what the owner said about this clip>"
//        saves the clip to jobs/<job>/media/viralhooks/ with the decision beside it and a line in media/CREDITS.md.
//        Refuses a paid ad, a missing decision, and any address that is not a viralhooks.org clip.
//   node tools/hooks/clips.mjs check jobs/<job>     every clip in the job has its decision (run before delivery)
//
// Before asking the owner, look at the clip: no child, no recognisable private person, no one else's captions.
// Nothing about the job is sent to viralhooks.org: only the clip's own address is fetched.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkJob, creditLine, fileOf, mayUse, rightsRecord, slugOf } from './lib/clips.mjs';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); const v = i >= 0 ? args[i + 1] : undefined; return v === undefined || v.startsWith('--') ? undefined : v; };
const say = (s) => process.stdout.write(`${s}\n`);
const stop = (msg, code = 1) => { say(msg); process.exit(code); };

if (args[0] === 'use') {
  const slug = slugOf(args[1] || ''); const jobDir = opt('job');
  if (!slug) stop('Give the clip\'s page on viralhooks.org, for example https://viralhooks.org/hook/<name>/', 2);
  if (!jobDir || !fs.existsSync(jobDir)) stop('Give the job folder: --job jobs/<job>', 2);
  const jobFile = path.join(jobDir, 'job.json');
  if (!fs.existsSync(jobFile)) stop(`No job.json in ${jobDir}: a clip is only saved into a real job.`, 2);
  let job; try { job = JSON.parse(fs.readFileSync(jobFile, 'utf8')); } catch { stop('Not used. job.json cannot be read, so the job cannot be checked for paid use.'); }
  const gate = mayUse(job, { post: opt('post'), approvedBy: opt('approved-by'), words: opt('words') });
  if (!gate.ok) stop(`Not used. ${gate.why}`);
  // Nothing is written through a link to somewhere else, and nothing already decided is overwritten.
  const media = path.join(jobDir, 'media'); const folder = path.join(media, 'viralhooks');
  for (const d of [media, folder]) if (fs.existsSync(d) && fs.lstatSync(d).isSymbolicLink()) stop(`Not used. ${d} is a link to another place.`);
  const file = path.join(folder, `${slug}.mp4`);
  if (fs.existsSync(file)) stop(`Not used. ${file} is already there with its decision; remove both first to decide again.`);
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'clip-')), `${slug}.mp4`);
  const r = spawnSync('curl', ['-sS', '--fail', '-L', '--proto', '=https', '--proto-redir', '=https', '--max-redirs', '3', '-m', '120', '-A', 'video-studio/1.0 (open-source video tooling)', '-o', tmp, fileOf(slug)], { encoding: 'utf8' });
  if (r.status !== 0) stop(`The clip did not download: ${r.stderr.trim() || 'curl failed'}`, 2);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', tmp], { encoding: 'utf8' });
  if (probe.status !== 0 || !/video/.test(probe.stdout)) { fs.rmSync(tmp, { force: true }); stop('What came back is not a video, so nothing was saved.', 2); }
  fs.mkdirSync(folder, { recursive: true }); fs.copyFileSync(tmp, file); fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
  const rec = rightsRecord({ slug, approvedBy: opt('approved-by'), words: opt('words'), post: opt('post'), date: new Date().toISOString().slice(0, 10) });
  fs.writeFileSync(path.join(folder, `${slug}.rights.json`), `${JSON.stringify(rec, null, 2)}\n`);
  const credits = path.join(media, 'CREDITS.md');
  const before = fs.existsSync(credits) ? fs.readFileSync(credits, 'utf8') : '# Credits\n\n';
  if (!before.includes(rec.page)) fs.writeFileSync(credits, `${before.replace(/\n*$/, '\n')}${creditLine(rec)}\n`);
  say(`Saved ${file} with the decision beside it. A person still checks: ${rec.checks_for_a_person.join('; ')}.`);
} else if (args[0] === 'check') {
  const jobDir = args[1]; if (!jobDir || !fs.existsSync(jobDir)) stop('Give the job folder: clips.mjs check jobs/<job>', 2);
  const problems = checkJob(jobDir);
  if (problems.length) stop(problems.map((p) => `- ${p}`).join('\n'));
  say('Every Viral Hooks clip in this job has its decision recorded (or the job uses none).');
} else {
  say('Usage: node tools/hooks/clips.mjs use <page> --job jobs/<job> --post organic --approved-by "<name>" --words "<owner\'s words>" | check jobs/<job>'); process.exit(args[0] ? 2 : 0);
}
