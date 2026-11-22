// The ten tools the brief page can call. Plain functions: an input object in, a small JSON-able object out, or a plain
// Error. The questions, checklist and validation all come from tools/plan/lib/brief.mjs; nothing is re-created here.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { applyAnswer, assumptions, checkAnswer, checkDirectorBrief, directorBriefOf, ENERGIES, picksOf, preflight, questions, reopen, setPick, understood } from '../../plan/lib/brief.mjs';
import { suggest } from '../../styles/lib/suggest.mjs';
import { confirmPlan, customerBrands, decide, directorRules, jobFolderName, loadJob, saveBrief, startBrief, studioContext, writePlan } from '../../plan/lib/brief-store.mjs';
import { loadLibrary, TABS } from '../../styles/lib/library.mjs';
import { safePath, studioMemory } from './memory.mjs';

const JOB = /^[a-z0-9][a-z0-9-]{0,80}$/;
const STYLE = /^[a-z0-9][a-z0-9-]{0,80}\/[a-z0-9][a-z0-9-]{0,80}$/;
const BRAND_FIRST = 'Set up your brand first: start a new chat in the studio folder and say "set up my brand".';
const CONFIRMED = 'This brief is confirmed and its video has started. To change it, say so in a chat in the studio folder.';
const CONTINUE = 'Start a new chat in the studio folder and say "continue the video".';
const cut = (v, n = 120) => (typeof v === 'string' && v.length > n ? `${v.slice(0, n - 1)}…` : v);
const given = (v) => (Array.isArray(v) ? v.some((x) => String(x).trim()) : v != null && String(v).trim() !== '');
const confirmed = (brief) => (brief?.decisions || []).some((d) => d?.what === 'plan confirmed');

/** The studio's context, with the demo brand and any unknown brand never used as the default. A studio with one
 *  customer brand and no usable default uses that brand (onlyBrand), so it is not asked every time. */
function contextOf(root) {
  const ctx = studioContext(root);
  const customers = customerBrands(ctx);
  if (ctx.defaultBrand === 'demo' || !customers.includes(ctx.defaultBrand)) delete ctx.defaultBrand;
  const onlyBrand = !ctx.defaultBrand && customers.length === 1;
  if (onlyBrand) ctx.defaultBrand = customers[0];
  return { ctx, customers, onlyBrand };
}

/* ---------- The page's wording: the same questions, without engine paths or file names ---------- */

// Questions whose chat wording does not fit the page: the brand list there names demo, and files are added in chat.
const PAGE_QUESTION = {
  brand: 'Which brand is this for? A new brand is set up in chat: say "set up my brand" in a chat in the studio folder.',
  reference: 'Is there a film you want this one to feel like? Paste a link, or pick one from our library; then say what you like about it.',
};
// Reasons behind an assumption that are not the customer's own words.
const BECAUSE = { 'job.json': 'already set for this job', 'the studio default': "your studio's default brand" };
const POINTER = /\b(in|from) brands\/([^/\s]+)\/product\/discovery\.md, section (\d+)/;

/** The first filled-in line of one numbered section of a brand's product discovery, as plain text, or null. */
function discoveryLine(root, brand, n) {
  let text;
  try { text = fs.readFileSync(safePath(root, `brands/${brand}/product/discovery.md`), 'utf8'); } catch { return null; }
  const lines = text.split(/\r?\n/);
  const at = lines.findIndex((l) => new RegExp(`^##\\s+${n}[.)\\s]`).test(l));
  if (at < 0) return null;
  for (const raw of lines.slice(at + 1)) {
    if (/^##\s/.test(raw)) break; // the next section
    let t = raw.trim();
    if (!t || t.startsWith('#') || /^[|\s:-]+$/.test(t) || /^[-*]\s+\*\*[^*]+\*\*\s*$/.test(t)) continue; // headings, table rules, empty template items
    if (t.startsWith('|')) {
      const cells = t.split('|').map((c) => c.trim()).filter(Boolean);
      if (cells.length < 2) continue; // a table row not filled in
      t = `${cells[0]}: ${cells.slice(1).join(', ')}`;
    }
    t = t.replace(/^[-*>]\s+/, '').replace(/\*\*|`/g, '').replace(/\s+/g, ' ').trim();
    if (t) return cut(t, 120);
  }
  return null;
}

/** A recommended answer that points into a brand's discovery file becomes that section's first line. */
function plainRecommended(root, text) {
  if (typeof text !== 'string') return text;
  const m = POINTER.exec(text);
  if (!m) return text;
  return discoveryLine(root, m[2], m[3]) ?? text.replace(POINTER, `${m[1]} your product discovery`);
}

/** A library film as text only: its title (a plain one made from the file name when it has none) and its type. */
function filmText(e) {
  const rel = String(e.file || '').replace(/^library\/references\//, '');
  const title = e.title && e.title !== rel ? String(e.title) : rel.split('/').pop().replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim();
  const type = String(e.type || '').replace(/[-_]+/g, ' ').trim();
  return { title: cut(title, 120), type: type ? type[0].toUpperCase() + type.slice(1) : null };
}

/** The job folder for a name from the page. The name is checked before any path is built. */
function jobDirOf(root, job) {
  if (typeof job !== 'string' || !JOB.test(job)) throw new Error(`Not a brief: ${job}`);
  const brief = safePath(root, `jobs/${job}/brief.json`);
  const dir = path.dirname(brief);
  if (!fs.existsSync(brief)) throw new Error(`Not a brief: ${job}`);
  return dir;
}

function checkReply(root, job, dir) {
  const { ctx, customers, onlyBrand } = contextOf(root);
  const { brief, job: jobJson } = loadJob(dir);
  if (!brief) throw new Error(`Not a brief: ${job}`);
  const opts = { job: jobJson, ctx };
  const assumed = assumptions(brief, { jobBrand: jobJson.brand, ...ctx });
  const checks = preflight(brief, opts);
  const all = questions(brief, opts).map((q) => ({
    id: q.id, question: PAGE_QUESTION[q.id] ?? q.question, why: q.why, recommended: plainRecommended(root, q.recommended), field: q.field,
    choices: q.id === 'brand' ? customers.map((value) => ({ value, label: value, recommended: false })) : q.choices,
    many: q.many,
    ...(Array.isArray(q.examples) && { examples: q.examples.map(filmText) }),
  }));
  const because = (a) => {
    if (a.id === 'brand' && a.because === 'the studio default' && onlyBrand) return { because: 'your only brand', said: false };
    if (Object.hasOwn(BECAUSE, a.because)) return { because: BECAUSE[a.because], said: false };
    return { because: cut(String(a.because ?? '')), said: true };
  };
  const brand = brief.brand || assumed.find((a) => a.id === 'brand')?.value;
  const parked = customers.length === 0;
  let status = 'ready';
  if (parked) status = 'none';
  else if (brand && !ctx.brands[brand]?.setUp) status = 'needs-setup';
  else if (checks.find((c) => c.id === 'product')?.todo?.includes('no approved product discovery')) status = 'needs-discovery';
  const parts = directorBriefOf(brief)?.parts ?? null;
  // The energy and length the brief has now (answered, or taken from their words): the page checks the director's
  // brief against these, as brief_direct does.
  const rules = directorRules(brief, jobJson, ctx);
  return {
    job, brand_status: status,
    picks: picksOf(brief, ctx.styles),
    director_brief: parts && typeof parts === 'object' ? { ...parts, logline: cut(parts.logline) } : null,
    understood: understood(brief.in_their_words, { brands: ctx.brands }),
    energy: rules.energy || null,
    length: rules.cap || null,
    library_notes: ctx.styleNotes || [],
    assumed: assumed.map((a) => ({ id: a.id, value: a.value, ...because(a) })),
    preflight: checks.map((c) => ({ id: c.id, label: c.label, done: c.done, known: cut(c.known), todo: c.todo })),
    questions: all.slice(0, 3), more: Math.max(0, all.length - 3),
    ready_for_plan: !parked && status === 'ready' && checks.every((c) => c.done),
    parked,
  };
}

function uniqueName(root, words) {
  const base = jobFolderName(words);
  let name = base;
  for (let n = 2; fs.existsSync(path.join(root, 'jobs', name)); n++) name = `${base}-${n}`;
  return name;
}

const NOT_IN_LIBRARY = 'That style is no longer in the library';

/** The style picks other jobs recorded, as { id, job }. Read through safePath only; a job that cannot be read is left out. */
function pastPicks(root, except) {
  const out = [];
  let names = [];
  try { names = fs.readdirSync(path.join(root, 'jobs')); } catch { return out; }
  for (const name of names) {
    if (name === except || !JOB.test(name)) continue;
    try {
      const b = JSON.parse(fs.readFileSync(safePath(root, `jobs/${name}/brief.json`), 'utf8'));
      for (const p of Array.isArray(b?.style_picks) ? b.style_picks : []) if (p && typeof p.id === 'string') out.push({ id: p.id, job: name });
    } catch { /* an unreadable brief leaves that job out */ }
  }
  return out;
}

export function makeHandlers(root) {
  return {
    studio_context: () => studioMemory(root),

    brief_check({ job } = {}) {
      return checkReply(root, job, jobDirOf(root, job));
    },

    brief_start({ words, style } = {}) {
      if (typeof words !== 'string' || !words.trim()) throw new Error('Say what the video is about: words are needed to start a brief.');
      if (style != null && (typeof style !== 'string' || !STYLE.test(style))) throw new Error('The style must look like <brand>/<style>.');
      const name = uniqueName(root, words);
      const dir = path.join(root, 'jobs', name);
      if (style) {
        const r = spawnSync(process.execPath, ['tools/plan/style.mjs', 'new', `jobs/${name}`, '--style', style, words], { cwd: root, encoding: 'utf8' });
        if (r.status !== 0) throw new Error(cut(String(r.stderr || r.stdout || r.error?.message || 'The style could not be used.').trim(), 300));
      } else startBrief(root, dir, words);
      const { brief } = loadJob(dir);
      if (!brief) throw new Error(`Not a brief: ${name}`);
      if (contextOf(root).customers.length === 0) saveBrief(dir, { ...brief, parked: 'no brand yet' });
      return checkReply(root, name, dir);
    },

    brief_answer({ job, question, value, words } = {}) {
      const dir = jobDirOf(root, job);
      const hasValue = given(value);
      const hasWords = typeof words === 'string' && words.trim() !== '';
      if (!hasValue && !hasWords) throw new Error('Give a value or words for the answer.');
      const { brief } = loadJob(dir);
      if (confirmed(brief)) throw new Error(CONFIRMED);
      const { customers } = contextOf(root);
      let recorded = false;
      let reason = null;
      const fail = (r) => { reason = r; };
      try {
        if (hasValue) {
          const r = checkAnswer(brief, question, value);
          if (!r.ok) fail(r.reason);
          else if (question === 'brand' && !customers.includes(r.value)) fail(customers.length ? `Pick one of: ${customers.join(', ')}` : 'No brand is set up yet.');
          else { saveBrief(dir, applyAnswer(brief, question, { value, words })); recorded = true; }
        } else {
          const probe = checkAnswer(brief, question, undefined);
          const fixed = question === 'brand' || /^Pick /.test(probe.reason || '');
          if (fixed && probe.field !== '') fail('Pick one of the cards');
          else { saveBrief(dir, applyAnswer(brief, question, { words })); recorded = true; }
        }
      } catch (e) { recorded = false; reason = e.message; }
      if (hasWords) decide(dir, `${question}: "${words}"`, { by: 'owner' });
      return { ...checkReply(root, job, dir), recorded, reason: recorded ? null : reason };
    },

    brief_reopen({ job, item } = {}) {
      const dir = jobDirOf(root, job);
      const { brief } = loadJob(dir);
      if (!brief) throw new Error(`Not a brief: ${job}`);
      // A confirmed brief already has its job.json at the Idea stage, which confirming again leaves as it is.
      if (confirmed(brief)) throw new Error(CONFIRMED);
      saveBrief(dir, reopen(brief, item));
      decide(dir, `reopened ${item}`, { by: 'owner' });
      return checkReply(root, job, dir);
    },

    brief_plan({ job } = {}) {
      const dir = jobDirOf(root, job);
      const { ctx, customers } = contextOf(root);
      if (customers.length === 0) throw new Error(`Not yet: set up your brand first. ${BRAND_FIRST}`);
      // A confirmed brief's plan is shown as it is now, and plan.md (the plan that was confirmed) stays as it was.
      const out = writePlan(root, dir, { ctx, dryRun: confirmed(loadJob(dir).brief) });
      if (!out) {
        const { brief, job: jobJson } = loadJob(dir);
        const open = preflight(brief, { job: jobJson, ctx }).filter((c) => !c.done).map((c) => `${c.label}: ${c.todo}`);
        throw new Error(`Not yet: ${open.join('; ')}`);
      }
      // engine: the picks' engine names grouped as ui, motion and sound, plus the stage skills ("What the engine will use").
      const engine = out.engine || { ui: [], motion: [], sound: [], skills: [] };
      return { job, lines: out.lines, outline: out.outline.map((s) => ({ n: s.n, name: s.name, from: s.from, to: s.to, shows: s.shows })), engine };
    },

    brief_pick({ job, tab, id, on } = {}) {
      const dir = jobDirOf(root, job);
      const { brief } = loadJob(dir);
      if (!brief) throw new Error(`Not a brief: ${job}`);
      if (confirmed(brief)) throw new Error(CONFIRMED);
      const { ctx } = contextOf(root);
      const want = on !== false;
      let reason = null;
      let next = null;
      try {
        const entry = ctx.styles.get(id);
        if (want && (!entry || entry.tab !== tab)) throw new Error(NOT_IN_LIBRARY);
        next = setPick(brief, entry && entry.tab === tab ? entry : { tab, id }, want, ctx.styles);
      } catch (e) { reason = e.message; }
      if (next) saveBrief(dir, next);
      const now = loadJob(dir).brief;
      return { ...checkReply(root, job, dir), picked: (now.style_picks || []).some((p) => p.tab === tab && p.id === id), reason };
    },

    brief_direct({ job, parts, engine, energy: given } = {}) {
      if (given != null && !ENERGIES.includes(given)) throw new Error(`energy must be one of ${ENERGIES.join(', ')}`);
      const dir = jobDirOf(root, job);
      const { brief, job: jobJson } = loadJob(dir);
      if (!brief) throw new Error(`Not a brief: ${job}`);
      if (confirmed(brief)) throw new Error(CONFIRMED);
      if (!parts || typeof parts !== 'object' || Array.isArray(parts)) throw new Error("Give the director's brief as its parts.");
      if (Object.keys(parts).length === 0) {
        const { director_brief: _gone, ...rest } = brief;
        saveBrief(dir, rest);
        decide(dir, "director's brief cleared", { by: 'owner' });
        return { ...checkReply(root, job, dir), kept: false, reason: null, part: null };
      }
      const { ctx } = contextOf(root);
      const rules = directorRules(brief, jobJson, ctx);
      const { names, allowed, cap } = rules;
      // The brief's own energy (answered, or from their words) first, then the one the page checked against; without
      // either the beats cannot be checked, so it is refused as the CLI refuses it.
      const energy = rules.energy || given || null;
      if (!energy) return { ...checkReply(root, job, dir), kept: false, reason: 'The director did not say which energy the film runs at.', part: null };
      const { engine: inParts, ...words } = parts;
      const r = checkDirectorBrief(parts, { energy, names, allowed, cap });
      if (!r.ok) return { ...checkReply(root, job, dir), kept: false, reason: r.reason, part: r.part };
      const ok = new Set(allowed);
      const kept = [...(Array.isArray(engine) ? engine : []), ...(Array.isArray(inParts) ? inParts : [])].filter((n, i, a) => typeof n === 'string' && ok.has(n) && a.indexOf(n) === i);
      saveBrief(dir, { ...brief, director_brief: { parts: words, engine: kept, energy, at: new Date().toISOString() } });
      decide(dir, "director's brief kept", { by: 'owner' });
      return { ...checkReply(root, job, dir), kept: true, reason: null, part: null };
    },

    styles_suggest({ job, text, understood: heard } = {}) {
      let brief = null;
      if (job !== undefined) brief = loadJob(jobDirOf(root, job)).brief;
      const words = typeof text === 'string' ? text : '';
      const lib = loadLibrary(root);
      const said = heard && typeof heard === 'object' && !Array.isArray(heard) ? heard : understood(words || brief?.in_their_words);
      const picked = (brief?.style_picks || []).map((p) => p.id);
      const entries = TABS.flatMap((t) => lib.tabs[t] || []);
      // Saved styles (brands/<brand>/styles/<style>/style.json) record no style ids, so only other jobs' picks count.
      return { suggestions: suggest(entries, { text: words, understood: said, memory: pastPicks(root, job), picked }), notes: lib.notes };
    },

    brief_confirm({ job } = {}) {
      const dir = jobDirOf(root, job);
      const { ctx, customers } = contextOf(root);
      if (customers.length === 0) return { job, stage: null, next: BRAND_FIRST };
      const made = confirmPlan(root, dir, { ctx });
      return { job, stage: made.stage_next || 'idea', next: CONTINUE };
    },
  };
}

const jobProp = { type: 'string', description: 'The job folder name returned by brief_start.' };
const ro = { readOnlyHint: true };
const rw = { readOnlyHint: false };

export const TOOLS = [
  { name: 'studio_context', description: 'What the studio remembers: brands with their last films and lessons, saved styles and open briefs.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: ro },
  { name: 'brief_check', description: 'The brief\'s checklist, what is assumed, and the next three questions.', inputSchema: { type: 'object', properties: { job: jobProp }, required: ['job'], additionalProperties: false }, annotations: ro },
  { name: 'brief_start', description: 'Start a brief from the creator\'s own words, optionally from a saved style.', inputSchema: { type: 'object', properties: { words: { type: 'string', description: 'The creator\'s words, kept as written.' }, style: { type: 'string', description: 'A saved style, as <brand>/<style>.' } }, required: ['words'], additionalProperties: false }, annotations: rw },
  { name: 'brief_answer', description: 'Record the answer to one question: a choice as value, or the creator\'s own words.', inputSchema: { type: 'object', properties: { job: jobProp, question: { type: 'string', description: 'The question id from brief_check.' }, value: { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }], description: 'The chosen card or cards.' }, words: { type: 'string', description: 'The creator\'s own words.' } }, required: ['job', 'question'], additionalProperties: false }, annotations: rw },
  { name: 'brief_reopen', description: 'Open one checklist item again so its questions are asked again: brand, product, audience, angle, look, hook, type or delivery.', inputSchema: { type: 'object', properties: { job: jobProp, item: { type: 'string', enum: ['brand', 'product', 'audience', 'angle', 'look', 'hook', 'type', 'delivery'], description: 'The checklist item id from brief_check.' } }, required: ['job', 'item'], additionalProperties: false }, annotations: rw },
  { name: 'brief_plan', description: 'Write the plan in brief once the checklist is complete.', inputSchema: { type: 'object', properties: { job: jobProp }, required: ['job'], additionalProperties: false }, annotations: rw },
  { name: 'brief_confirm', description: 'Confirm the plan and start the job at the Idea stage.', inputSchema: { type: 'object', properties: { job: jobProp }, required: ['job'], additionalProperties: false }, annotations: rw },
  { name: 'brief_pick', description: 'Pick (on) or remove (off) one style from the style library for this brief. A pick that clashes with another is refused with the reason.', inputSchema: { type: 'object', properties: { job: jobProp, tab: { type: 'string', enum: TABS, description: 'The library tab.' }, id: { type: 'string', description: 'The style id.' }, on: { type: 'boolean', description: 'true to pick, false to remove.' } }, required: ['job', 'tab', 'id', 'on'], additionalProperties: false }, annotations: rw },
  { name: 'brief_direct', description: 'Keep the director\'s brief: the eight parts in plain words, and the engine names the picked styles list. Empty parts clears it.', inputSchema: { type: 'object', properties: { job: jobProp, parts: { type: 'object', description: 'logline, first_three_seconds, beats [{ at_s, what }], camera, motion, type, sound, ending. {} clears.' }, engine: { type: 'array', items: { type: 'string' }, description: 'Engine names, only from the picked styles.' }, energy: { type: 'string', enum: ['calm', 'confident', 'hype'], description: 'The energy the beats were checked against, used when the brief has none of its own.' } }, required: ['job', 'parts'], additionalProperties: false }, annotations: rw },
  { name: 'styles_suggest', description: 'Style suggestions from the library for the creator\'s words, with the reason for each. Changes nothing.', inputSchema: { type: 'object', properties: { job: { type: 'string', description: 'The job folder name, to leave out its own picks and use its words.' }, text: { type: 'string', description: 'The creator\'s words.' }, understood: { type: 'object', description: 'What the words say, as returned in a brief_check reply.' } }, required: ['text'], additionalProperties: false }, annotations: ro },
];
