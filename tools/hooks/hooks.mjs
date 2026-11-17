#!/usr/bin/env node
// The hook tool (LIBRARY-PLAN.md phase 1): formulas for a brief from library/hooks/, and what can be measured about a
// written hook. It never calls an outside service. Judging a hook is done from the rubric (knowledge/craft/15-hooks.md,
// "Scoring a hook") by a person or by Claude in the session; this tool says so.
//
//   node tools/hooks/hooks.mjs find [--type promo|demo|tutorial|edit|ad] [--platform reels|tiktok|shorts|youtube|linkedin|x]
//        [--awareness cold|problem-aware|solution-aware|product-aware] [--brand <brand>] [--n 5] [--family <id>] [--json]
//        formulas that suit the brief, one per family where possible, leaving out the formulas the brand used in its
//        last five films (brands/<brand>/ledger.json, "hook_formula")
//   node tools/hooks/hooks.mjs measure "<the spoken line>" [--on-screen "<the written line>"] [--json]
//        length, speaking time at 2.5 words a second, time to the first claim, openers to avoid
//   node tools/hooks/hooks.mjs rubric      the four questions every hook is scored on
//   node tools/hooks/hooks.mjs families    the families and how many formulas each has
//   node tools/hooks/hooks.mjs check       is the library itself sound
//
// Every formula is marked "untested": the library says what a formula is, never that it works. What worked for a brand
// is in that brand's ledger.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AWARENESS, PLATFORMS, TYPES, loadLibrary, validate } from './lib/library.mjs';
import { find, measure, usedByBrand } from './lib/pick.mjs';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const say = (s = '') => process.stdout.write(`${s}\n`);
const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name) => { const i = args.indexOf(`--${name}`); const v = i >= 0 ? args[i + 1] : undefined; return v === undefined || v.startsWith('--') ? undefined : v; };
const flag = (name) => args.includes(`--${name}`);
const fail = (msg) => { process.stderr.write(`${msg}\n`); process.exit(2); };
const oneOf = (name, allowed) => { const v = opt(name); if (v !== undefined && !allowed.includes(v)) fail(`--${name} must be one of: ${allowed.join(', ')}`); return v; };

if (cmd === 'find') {
  const lib = loadLibrary();
  const type = oneOf('type', TYPES); const platform = oneOf('platform', PLATFORMS); const awareness = oneOf('awareness', AWARENESS);
  const brand = opt('brand'); const n = Number(opt('n') || 5); const family = opt('family');
  if (!Number.isInteger(n) || n < 1) fail('--n must be a whole number, 1 or more');
  if (family && !lib.families.some((f) => f.id === family)) fail(`--family must be one of: ${lib.families.map((f) => f.id).join(', ')}`);
  const ledgerFile = brand ? path.join(STUDIO, 'brands', brand, 'ledger.json') : null;
  const used = ledgerFile && fs.existsSync(ledgerFile) ? usedByBrand(JSON.parse(fs.readFileSync(ledgerFile, 'utf8'))) : [];
  const pool = family ? { ...lib, formulas: lib.formulas.filter((f) => f.family === family) } : lib;
  const r = find(pool, { type, platform, awareness, exclude: used, n });
  if (flag('json')) { say(JSON.stringify({ ...r, left_out: used }, null, 2)); process.exit(0); }
  const brief = [type, platform, awareness].filter(Boolean).join(', ') || 'any brief';
  say(`${r.picks.length} of ${r.asked} asked for (${r.matched} formulas suit ${brief})${used.length ? `; left out, used in ${brand}'s last films: ${used.join(', ')}` : ''}.`);
  if (r.picks.length < r.asked) say('Fewer than asked for: loosen a filter (drop --awareness or --platform) for more.');
  for (const f of r.picks) {
    say(); say(`${f.id}  [${f.family}]  ${f.name}`);
    say(`  said:        ${f.spoken}`); say(`  for example: ${f.example}`); say(`  on screen:   ${f.on_screen}`);
    say(`  first frame: ${f.first_frame}`); say(`  the trap:    ${f.trap}`);
  }
  say(); say('Write each hook in the brand\'s own words, then: hooks.mjs measure "<line>" and score it with hooks.mjs rubric.');
} else if (cmd === 'measure') {
  const line = args[1]; if (!line || line.startsWith('--')) fail('Give the spoken line in quotes: hooks.mjs measure "<line>"');
  const m = measure(line, { onScreen: opt('on-screen') || '', avoid: loadLibrary().avoid });
  if (flag('json')) { say(JSON.stringify(m, null, 2)); process.exit(0); }
  say(`${m.words} words, ${m.seconds} s to say at 2.5 words a second; the first claim is out at ${m.first_claim_seconds} s.${m.on_screen_words ? ` On screen: ${m.on_screen_words} words.` : ''}`);
  say(m.notes.length ? m.notes.map((n) => `- ${n}`).join('\n') : 'Nothing measured against it.');
  say('This is only what can be counted. Whether it is clear, relevant and worth staying for is judged with: hooks.mjs rubric');
} else if (cmd === 'rubric') {
  const guide = path.join(STUDIO, 'knowledge', 'craft', '15-hooks.md');
  if (!fs.existsSync(guide)) fail('knowledge/craft/15-hooks.md is missing.');
  const text = fs.readFileSync(guide, 'utf8');
  const start = text.indexOf('## Scoring a hook'); if (start < 0) fail('15-hooks.md has no "Scoring a hook" section.');
  const next = text.indexOf('\n## ', start + 5);
  say(text.slice(start, next < 0 ? undefined : next).trim());
} else if (cmd === 'families') {
  const lib = loadLibrary();
  for (const fam of lib.families) say(`${fam.id.padEnd(18)} ${String(lib.formulas.filter((f) => f.family === fam.id).length).padStart(3)}  ${fam.what}`);
  say(`${lib.formulas.length} formulas from ${lib.sources.length} sources.`);
} else if (cmd === 'check') {
  const lib = loadLibrary(); const problems = validate(lib);
  if (problems.length) { say(problems.map((p) => `- ${p}`).join('\n')); say(`${problems.length} problem${problems.length > 1 ? 's' : ''} in the hook library.`); process.exit(1); }
  say(`The hook library is sound: ${lib.formulas.length} formulas in ${lib.families.length} families from ${lib.sources.length} sources, ${lib.avoid.length} openers to avoid.`);
} else {
  say('Usage: node tools/hooks/hooks.mjs find|measure|rubric|families|check (see the top of this file)'); process.exit(cmd ? 2 : 0);
}
