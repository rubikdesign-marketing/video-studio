// Motion-graphics recipes (library/recipes/index.json): the kinds of film the studio can make from a one-line request,
// each with its triggers, defaults, structure, starter prompt, the questions worth asking, what to optimise, what to
// avoid, the engine moves it leans on and the reference films it learned from.
// Dependency-free ESM, node 22. Used by tools/plan/recipe.mjs and tools/plan/brief.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const CATALOG = 'library/recipes/index.json';
export const BRIEF_KINDS = ['product-demo', 'launch-reel', 'motion-graphics', 'footage-edit', 'ugc', 'animated-short', 'promo', 'tutorial'];
const REQUIRED = ['id', 'name', 'family', 'summary', 'triggers', 'defaults', 'structure', 'starter_prompt', 'optimise', 'avoid', 'motion'];

export function loadRecipes(root = STUDIO) {
  return JSON.parse(fs.readFileSync(path.join(root, CATALOG), 'utf8'));
}

// ---------- words ----------
const STOP = new Set('a an the and or of for to in on at by with our my your their its this that these those me us we i you it is are be make made making need needs want wants like some something video videos film clip please can could would should just really very about from into out up get do show shows'.split(' '));
const stem = (w) => (w.length > 4 && w.endsWith('ies') ? `${w.slice(0, -3)}y` : w.length > 5 && w.endsWith('ing') ? w.slice(0, -3) : w.length > 4 && w.endsWith('ed') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
export const words = (s) => String(s ?? '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean).map(stem);
const content = (ws) => ws.filter((w) => !STOP.has(w));

function containsSeq(hay, needle) {
  if (!needle.length || needle.length > hay.length) return false;
  outer: for (let i = 0; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

// ---------- matching ----------
/** Ranks every recipe against a brief. A trigger phrase found whole in the brief weighs most (longer phrases more);
 *  single content words shared with the recipe's name, triggers and summary add a little. Returns the ranked list and a
 *  verdict: "clear" (one recipe stands out), "close" (the top two are near: ask which), or "none" (ask what kind of film). */
export function matchRecipes(brief, catalog, { limit = 3 } = {}) {
  const bw = words(brief);
  const bc = content(bw);
  const bset = new Set(bc);
  const scored = catalog.recipes.map((r) => {
    let score = 0;
    const phrases = [];
    for (const t of r.triggers || []) {
      const tw = words(t);
      const tc = content(tw);
      if (!tw.length || !tc.length) continue;
      // Whole phrase as written, or its content words in order with the small words left out on both sides
      // ("recap video of our conference" still finds "recap of our conference").
      if (containsSeq(bw, tw)) { score += 3 + 2 * (tw.length - 1); phrases.push(t); }
      else if (tc.length >= 2 && containsSeq(bc, tc)) { score += 3 + 2 * (tc.length - 1); phrases.push(t); }
    }
    if (containsSeq(bw, words(r.name)) || bw.join(' ').includes(r.id.replace(/-/g, ' '))) { score += 6; phrases.push(r.name); }
    const vocab = new Set(content([...words(r.name), ...(r.triggers || []).flatMap(words), ...words(r.summary)]));
    const shared = [...bset].filter((w) => vocab.has(w));
    score += shared.length;
    return { id: r.id, name: r.name, family: r.family, score, phrases, shared };
  });
  scored.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  const [top, second] = scored;
  let verdict = 'none';
  if (top && top.score >= 3 && (top.phrases.length || top.shared.length >= 2)) {
    verdict = second && second.score > 0 && second.score >= top.score * 0.8 ? 'close' : 'clear';
  }
  return { verdict, ranked: scored.slice(0, limit).filter((s) => s.score > 0) };
}

// ---------- checks ----------
/** Problems in a catalogue: missing fields, unknown families, engine moves that do not exist, duplicate ids,
 *  references that point nowhere, banned words. `moves` is the set of move names in library/motion/index.json. */
export function validateCatalog(catalog, { moves = null, banned = [] } = {}) {
  const errors = [];
  const families = new Set((catalog.families || []).map((f) => f.id));
  const ids = new Set();
  for (const r of catalog.recipes || []) {
    const where = `recipe ${r.id || '?'}`;
    for (const k of REQUIRED) if (r[k] === undefined || r[k] === null || r[k] === '' || (Array.isArray(r[k]) && !r[k].length)) errors.push(`${where}: no ${k}`);
    if (ids.has(r.id)) errors.push(`${where}: duplicate id`);
    ids.add(r.id);
    if (r.family && !families.has(r.family)) errors.push(`${where}: family "${r.family}" is not listed in families`);
    if (r.brief_kind && !BRIEF_KINDS.includes(r.brief_kind)) errors.push(`${where}: brief_kind "${r.brief_kind}" is not a brief kind`);
    if (moves) for (const m of r.motion?.engine_moves || []) if (!moves.has(m)) errors.push(`${where}: engine move "${m}" is not in library/motion/index.json`);
    if (!/\{[a-z_]+\}/.test(r.starter_prompt || '')) errors.push(`${where}: the starter prompt has no {placeholders}`);
    const text = JSON.stringify(r).toLowerCase();
    for (const b of banned) if (new RegExp(b, 'i').test(text)) errors.push(`${where}: banned word /${b}/`);
  }
  return errors;
}

export function moveNames(root = STUDIO) {
  const idx = JSON.parse(fs.readFileSync(path.join(root, 'library/motion/index.json'), 'utf8'));
  return new Set(idx.moves.map((m) => m.name));
}

// ---------- the card ----------
/** Fills {placeholders} the brief already answers; the rest stay for the person or the stage to fill. */
export function fillPrompt(prompt, values = {}) {
  return String(prompt).replace(/\{([a-z_]+)\}/g, (m, k) => (values[k] !== undefined && values[k] !== null && values[k] !== '' ? String(values[k]) : m));
}

export function card(r, { values = {} } = {}) {
  const d = r.defaults || {};
  const L = [];
  L.push(`# ${r.name} (${r.id})`, '', r.summary, '');
  L.push(`Defaults: ${d.length_s ?? '?'} s, ${(d.aspects || []).join(' / ') || '?'}, ${d.energy || '?'} energy, ${d.design_style || '?'} style, ${d.sound || '?'}, ${d.fps || 30} fps.`);
  if (r.brief_kind) L.push(`Brief kind: ${r.brief_kind}.`);
  L.push('', '## Structure', '');
  for (const b of r.structure || []) L.push(`- **${b.beat}** (${b.share}): ${b.what}`);
  if (r.questions?.length) { L.push('', '## Ask only if the brief does not say', ''); for (const q of r.questions) L.push(`- ${q}`); }
  L.push('', '## Starter prompt', '', fillPrompt(r.starter_prompt, values));
  L.push('', '## Optimise', ''); for (const o of r.optimise || []) L.push(`- ${o}`);
  L.push('', '## Avoid', ''); for (const a of r.avoid || []) L.push(`- ${a}`);
  const m = r.motion || {};
  L.push('', '## Motion', '');
  if (m.signature_techniques?.length) L.push(`- Signature techniques: ${m.signature_techniques.join('; ')}`);
  if (m.transitions?.length) L.push(`- Transitions: ${m.transitions.join('; ')}`);
  if (m.engine_moves?.length) L.push(`- Engine moves: ${m.engine_moves.join(', ')} (node tools/library/registry.mjs get motion:<name>)`);
  if (m.timing) L.push(`- Timing: ${m.timing}`);
  if (r.engine_gaps?.length) L.push(`- Not in the engine yet (build or approximate): ${r.engine_gaps.join('; ')}`);
  if (r.references?.length) {
    L.push('', '## Reference films (study only; nothing from them goes in our film)', '');
    for (const x of r.references) L.push(`- ${x.title}${x.likes ? ` (${x.likes} likes)` : ''}: ${x.why}${x.url ? ` ${x.url}` : ''}`);
  }
  if (r.not_for?.length) { L.push('', '## Not for', ''); for (const n of r.not_for) L.push(`- ${n}`); }
  return L.join('\n') + '\n';
}

/** Values a brief already gives a recipe's placeholders. */
export function valuesFromBrief(brief = {}, job = {}, recipe = {}) {
  const master = (brief.deliver || []).find((x) => x.master) || {};
  return {
    brand: job.brand || undefined,
    product: job.product || undefined,
    audience: brief.for || undefined,
    message: brief.viewer_should || undefined,
    length: (() => { const n = brief.length_cap_seconds || job.length_cap_seconds || recipe.defaults?.length_s; return n ? `${n} s` : undefined; })(),
    aspect: master.size || job.size || recipe.defaults?.aspects?.[0],
    energy: ['calm', 'confident', 'hype'].includes(job.energy_preset) ? job.energy_preset : recipe.defaults?.energy,
    fps: recipe.defaults?.fps,
  };
}
