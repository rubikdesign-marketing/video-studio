#!/usr/bin/env node
// Motion-graphics recipes: from a one-line request to the right kind of film, its starter prompt and what to optimise.
//
//   recipe.mjs match "<their words>" [--json]   the closest recipes (at most three) and whether one clearly fits
//   recipe.mjs show <id> [--json]               one recipe in full: structure, starter prompt, questions, optimise,
//                                               avoid, engine moves and reference films
//   recipe.mjs list [--family <id>]             every recipe, one line each, grouped by family
//   recipe.mjs apply jobs/<job> <id>            records the recipe in brief.json, fills the brief's empty kind, length
//                                               and size from the recipe's defaults, and writes jobs/<job>/recipe.md
//                                               (the card with every placeholder the brief answers filled in)
//   recipe.mjs check                            validates library/recipes/index.json (exit 1 on problems)
//
// The catalogue is library/recipes/index.json; the craft behind it is knowledge/craft/17-motion-graphics.md and the
// method for short briefs is knowledge/craft/18-brief-expansion.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STUDIO, card, loadRecipes, matchRecipes, moveNames, validateCatalog, valuesFromBrief } from './lib/recipes.mjs';

const args = process.argv.slice(2);
const [cmd] = args;
const json = args.includes('--json');
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const plain = args.slice(1).filter((a, i, all) => !a.startsWith('--') && !all[i - 1]?.startsWith('--family'));
const say = (s = '') => process.stdout.write(`${s}\n`);
const usage = () => {
  const lines = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1);
  say(lines.slice(0, lines.findIndex((l) => !l.startsWith('//'))).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
};

let catalog;
try { catalog = loadRecipes(); } catch (e) { say(`Could not read library/recipes/index.json: ${e.message}`); process.exit(2); }
const byId = new Map(catalog.recipes.map((r) => [r.id, r]));
const banned = () => {
  try { return JSON.parse(fs.readFileSync(path.join(STUDIO, 'release/manifest.json'), 'utf8')).banned || []; } catch { return []; }
};

if (cmd === 'match') {
  const brief = plain.join(' ');
  if (!brief) { say('Usage: node tools/plan/recipe.mjs match "<their words>"'); process.exit(2); }
  const m = matchRecipes(brief, catalog);
  if (json) { say(JSON.stringify(m, null, 2)); process.exit(0); }
  if (m.verdict === 'none') {
    say('No recipe clearly fits. Ask what kind of film it is (one question, with a recommendation), then match again with their answer.');
    if (m.ranked.length) say(`Weak candidates: ${m.ranked.map((r) => r.id).join(', ')}.`);
    process.exit(0);
  }
  const [top, ...rest] = m.ranked;
  say(m.verdict === 'clear' ? `Recipe: ${top.name} (${top.id}).` : `Two recipes fit about equally: ${top.name} (${top.id}) and ${rest[0].name} (${rest[0].id}). Ask which, recommending ${top.id}, or decide from the brief and say why.`);
  for (const r of m.ranked) say(`- ${r.id} | ${r.family} | score ${r.score}${r.phrases.length ? ` | phrases: ${r.phrases.join(', ')}` : ''}${r.shared.length ? ` | words: ${r.shared.join(', ')}` : ''}`);
  say(`Next: node tools/plan/recipe.mjs show ${top.id}`);
} else if (cmd === 'show') {
  const r = byId.get(plain[0]);
  if (!r) { say(`No recipe "${plain[0] || ''}". See: node tools/plan/recipe.mjs list`); process.exit(2); }
  say(json ? JSON.stringify(r, null, 2) : card(r));
} else if (cmd === 'list') {
  const fam = opt('family');
  for (const f of catalog.families) {
    if (fam && f.id !== fam) continue;
    const rs = catalog.recipes.filter((r) => r.family === f.id);
    if (!rs.length) continue;
    say(`${f.name} (${f.id}): ${f.summary}`);
    for (const r of rs) say(`  ${r.id.padEnd(28)} ${r.summary}`);
  }
} else if (cmd === 'apply') {
  const [jobArg, id] = plain;
  const r = byId.get(id);
  if (!jobArg || !r) { say('Usage: node tools/plan/recipe.mjs apply jobs/<job> <recipe id>'); process.exit(2); }
  const jobDir = path.resolve(jobArg);
  const briefFile = path.join(jobDir, 'brief.json');
  if (!fs.existsSync(briefFile)) { say(`No brief yet. Start one: node tools/plan/brief.mjs new ${jobArg} "<their words>"`); process.exit(1); }
  const brief = JSON.parse(fs.readFileSync(briefFile, 'utf8'));
  const jobFile = path.join(jobDir, 'job.json');
  const job = fs.existsSync(jobFile) ? JSON.parse(fs.readFileSync(jobFile, 'utf8')) : {};
  const filled = [];
  brief.recipe = r.id;
  if (!brief.kind && r.brief_kind) { brief.kind = r.brief_kind; filled.push(`kind ${r.brief_kind}`); }
  if (!brief.length_cap_seconds && r.defaults?.length_s) { brief.length_cap_seconds = r.defaults.length_s; filled.push(`length ${r.defaults.length_s} s`); }
  const master = (brief.deliver || []).find((x) => x.master);
  if (master && !master.size && r.defaults?.aspects?.[0]) { master.size = r.defaults.aspects[0]; filled.push(`size ${master.size}`); }
  fs.writeFileSync(`${briefFile}.tmp`, JSON.stringify(brief, null, 1) + '\n');
  fs.renameSync(`${briefFile}.tmp`, briefFile);
  fs.writeFileSync(path.join(jobDir, 'recipe.md'), card(r, { values: valuesFromBrief(brief, job, r) }));
  say(`Recipe ${r.id} recorded in brief.json${filled.length ? `; from its defaults: ${filled.join(', ')} (say them back so they can be changed)` : ''}. The card is in ${path.relative(STUDIO, path.join(jobDir, 'recipe.md'))}.`);
} else if (cmd === 'check') {
  const errors = validateCatalog(catalog, { moves: moveNames(), banned: banned() });
  if (errors.length) { for (const e of errors) say(`- ${e}`); say(`${errors.length} problem(s) in library/recipes/index.json.`); process.exit(1); }
  say(`library/recipes/index.json is valid: ${catalog.families.length} families, ${catalog.recipes.length} recipes.`);
} else {
  usage();
  process.exit(cmd ? 2 : 0);
}
