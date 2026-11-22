// The brief's files, shared by the CLI (tools/plan/brief.mjs) and the connector: jobs/<job>/brief.json, the studio
// context (brands, references), plan.md and the recorded decisions. Every function that needs the studio takes its root.
import fs from 'node:fs';
import path from 'node:path';
import { assumptions, directorBriefOf, ENERGIES, FRAMEWORK, isEngineName, picksOf, plan, preflight, setField } from './brief.mjs';
import { loadFrameworks } from './frameworks.mjs';
import { engineNames, loadLibrary } from '../../styles/lib/library.mjs';

const today = () => new Date().toISOString().slice(0, 10);
const readJson = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
const writeJson = (f, data) => { fs.writeFileSync(`${f}.tmp`, JSON.stringify(data, null, 1) + '\n'); fs.renameSync(`${f}.tmp`, f); };

/** What the studio can look up instead of asking: the brands set up, whether each has an approved product discovery,
 *  the default brand, the reference library, the style library (styles: id to entry; styleNotes: what could not be read)
 *  and the engine's names (engineNames). */
export function studioContext(root) {
  const dir = path.join(root, 'brands');
  const brands = {};
  for (const name of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (name.startsWith('_') || name.startsWith('.') || !fs.statSync(path.join(dir, name)).isDirectory()) continue;
    const disc = path.join(dir, name, 'product', 'discovery.md');
    const approved = fs.existsSync(disc) && /Approved by:\s*(?!<)\S/.test(fs.readFileSync(disc, 'utf8'));
    brands[name] = { setUp: fs.existsSync(path.join(dir, name, 'brand.json')), discovery: approved };
  }
  const lib = loadLibrary(root);
  return { brands, defaultBrand: readJson(path.join(root, 'studio.json'))?.default_brand, references: readJson(path.join(root, 'library', 'references', 'index.json')) || [], styles: lib.byId, styleNotes: lib.notes, engineNames: engineNames(root) };
}

/** What checkDirectorBrief needs from the studio, the same for the CLI and the connector: the brief's energy (set, or
 *  assumed from their words), every engine name (so the words never use one), the engine names the picked styles list
 *  and the length cap (set, or from their words; null when not known). */
export function directorRules(brief, job, ctx) {
  const e = ctx.engineNames;
  // Only names that read as engine names (kebab-case, paths, prefixed ids, CamelCase). Plain words that are also names
  // in a library ("camera", "Button", "slam") are how a director describes a film, so they are not refused.
  const names = new Set([...(e?.moves || []), ...(e?.registry || []), ...(e?.backgrounds || []), ...(e?.sounds || [])].filter(isEngineName));
  const allowed = picksOf(brief, ctx.styles).filter((x) => !x.stale).flatMap((x) => ctx.styles.get(x.id).engine || []);
  const assumed = assumptions(brief, { jobBrand: job?.brand, ...ctx });
  const energy = brief.energy || assumed.find((x) => x.id === 'energy')?.value;
  const cap = Number(brief.length_cap_seconds) || assumed.find((x) => x.id === 'length_cap_seconds')?.value || null;
  return { energy, names, allowed, cap };
}

/** The set-up brands other than the demo brand. */
export const customerBrands = (ctx) => Object.entries(ctx.brands || {}).filter(([name, b]) => b.setUp && name !== 'demo').map(([name]) => name);

/** brief (null when missing) and job ({} when missing) of one job folder. */
export function loadBrief(jobDir) {
  try { return readJson(path.join(jobDir, 'brief.json')); } catch { throw new Error(`${path.basename(jobDir)}: brief.json cannot be read`); }
}

export function loadJob(jobDir) {
  const brief = loadBrief(jobDir);
  let job;
  try { job = readJson(path.join(jobDir, 'job.json')) || {}; } catch { throw new Error(`${path.basename(jobDir)}: job.json cannot be read`); }
  return { brief, job };
}

export const saveBrief = (jobDir, brief) => writeJson(path.join(jobDir, 'brief.json'), brief);

export function startBrief(root, jobDir, words) {
  if (fs.existsSync(path.join(jobDir, 'brief.json'))) throw new Error(`${path.basename(jobDir)}: brief.json exists already`);
  fs.mkdirSync(jobDir, { recursive: true });
  const t = readJson(path.join(root, 'templates', 'brief.json'));
  delete t._about;
  t.in_their_words = words;
  saveBrief(jobDir, t);
  return t;
}

const SKIP = new Set(['a', 'an', 'the', 'for', 'of', 'to', 'and', 'my', 'our']);
export function jobFolderName(words, date = today()) {
  const slug = String(words || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/).filter((w) => w && !SKIP.has(w)).slice(0, 5).join('-').slice(0, 40).replace(/-+$/, '');
  return `${date}-${slug || 'video'}`;
}

export function setDotted(obj, dotted, value) {
  const keys = dotted.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) { if (typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k]; }
  o[keys.at(-1)] = value;
}

function planFor(root, brief, job, ctx) {
  const kind = brief.kind || assumptions(brief, ctx).find((x) => x.id === 'kind')?.value;
  const fid = brief.framework || FRAMEWORK[kind] || 'studio-promo';
  const framework = loadFrameworks().frameworks.find((f) => f.id === fid) || null; // the studio's own frameworks file, not root's
  return plan(brief, { job, ctx, framework });
}

export function renderPlan(out) {
  return [
    '# The plan, in brief', '',
    ...out.lines, '',
    `## Scene outline${out.framework ? ` (${out.framework.name}, ${out.framework.id})` : ''}`, '',
    'Rough seconds; tools/plan/beats.mjs times it against the script at stage 2. The storyboard\'s shot list starts from these scenes.', '',
    ...out.outline.map((s) => `${s.n}. **${s.name}** ${s.from}–${s.to} s${s.optional ? ' (optional)' : ''}: ${s.job}${s.shows.length ? `. Shows: ${s.shows.join('; ')}` : ''}`), '',
    '## Will use', '',
    ...out.uses.map((u) => `- ${u}`), '',
  ].join('\n');
}

/** The plan in brief, written to plan.md (not with { dryRun: true }); null when the checklist is not complete. */
export function writePlan(root, jobDir, { dryRun = false, ctx = studioContext(root) } = {}) {
  const { brief, job } = loadJob(jobDir);
  const out = planFor(root, brief || {}, job, ctx);
  if (!out) return null;
  const md = renderPlan(out);
  if (!dryRun) fs.writeFileSync(path.join(jobDir, 'plan.md'), md);
  return { ...out, md };
}

export function decide(jobDir, what, { by = 'owner', applies = 'all' } = {}) {
  const { brief } = loadJob(jobDir);
  brief.decisions = [...(brief.decisions || []), { what, by, date: today(), applies_to: applies }];
  saveBrief(jobDir, brief);
  return brief;
}

const TYPE_OF = { 'product-demo': 'demo', tutorial: 'tutorial', 'footage-edit': 'edit', ugc: 'edit', 'animated-short': 'edit' };
// What the customer confirms along with the plan when it was only taken as given: written into the brief as decided.
const SETTLED_ON_CONFIRM = ['brand', 'size', 'kind', 'voice', 'length_cap_seconds', 'look', 'energy'];
const SAID = { length_cap_seconds: 'length', look: 'look' };

/** The brief with what was taken as given (their words, a pick, the studio default) written in as decided, and the
 *  energy of a kept director's brief when the brief has none. Returns { brief, settled } (settled: plain words). */
function settleAssumed(brief, job, ctx) {
  const assumed = assumptions(brief, { jobBrand: job.brand, ...ctx }).filter((a) => SETTLED_ON_CONFIRM.includes(a.id));
  let b = { ...brief };
  const settled = [];
  for (const a of assumed) {
    if (['size', 'kind', 'voice', 'length_cap_seconds', 'energy'].includes(a.id)) b = setField(b, a.id, a.value);
    else b[a.id] = a.value;
    settled.push(`${SAID[a.id] || a.id} ${a.value}`);
  }
  const directed = directorBriefOf(b)?.energy;
  if (!b.energy && ENERGIES.includes(directed)) { b.energy = directed; settled.push(`energy ${directed} (from the director's brief)`); }
  return { brief: b, settled };
}

/** Records "plan confirmed" (once), writes what was taken as given into the brief as decided, and makes job.json at the
 *  Idea stage from it when there is none. Refuses when plan.md is not the plan of the brief as it is now. Safe to call
 *  again. */
export function confirmPlan(root, jobDir, { ctx = studioContext(root) } = {}) {
  const { brief, job } = loadJob(jobDir);
  const name = path.basename(jobDir);
  if (!brief) throw new Error(`${name}: there is no brief yet`);
  if (!fs.existsSync(path.join(jobDir, 'plan.md'))) throw new Error(`${name}: there is no plan yet; write the plan first`);
  const out = planFor(root, brief, job, ctx);
  if (!out) throw new Error(`${name}: the plan is not complete; the checklist still has open items`);
  // The customer confirms the plan they were shown: a brief changed since then needs the plan shown again. A confirmed
  // plan gains a "plan confirmed" line, so confirming it again skips this check.
  const confirmed = (brief.decisions || []).some((d) => d?.what === 'plan confirmed');
  if (!confirmed && fs.readFileSync(path.join(jobDir, 'plan.md'), 'utf8') !== renderPlan(out)) throw new Error('The plan changed since it was shown; show it again.');
  // What was only taken as given becomes decided, so `show` and every later stage read it from the brief itself.
  const { brief: settledBrief, settled } = settleAssumed(brief, job, ctx);
  if (settled.length) {
    saveBrief(jobDir, settledBrief);
    decide(jobDir, `taken as given when the plan was confirmed: ${settled.join(', ')}`);
  }
  const b = settledBrief;
  const file = path.join(jobDir, 'job.json');
  const exists = fs.existsSync(file);
  let made = job;
  if (exists) {
    if (!(job.notes || []).some((n) => String(n).startsWith('Plan confirmed'))) made = { ...job, notes: [...(job.notes || []), `Plan confirmed ${today()}; job.json left as it was.`] };
  } else {
    const t = readJson(path.join(root, 'templates', 'job.json'));
    const master = (b.deliver || []).find((d) => d.master && d.size) || (b.deliver || []).find((d) => d.size);
    // voice: a film with no voice says "none" (tools/film/scaffold.mjs); otherwise the voice's name stays the template's.
    // energy_preset: the brief's energy when known (tools/film/scaffold.mjs refuses the template's placeholder).
    made = {
      ...t, name, brand: b.brand || job.brand, type: TYPE_OF[b.kind] || 'promo', size: master?.size || t.size,
      length_cap_seconds: Number(b.length_cap_seconds) || null,
      ...(b.voice === 'none' && { voice: 'none' }),
      ...(ENERGIES.includes(b.energy) && { energy_preset: b.energy }),
      created: today(), stage_next: 'idea', approval_mode: 'guided',
    };
  }
  if (made !== job || !exists) writeJson(file, made);
  if (!(loadJob(jobDir).brief.decisions || []).some((d) => d.what === 'plan confirmed')) decide(jobDir, 'plan confirmed');
  return made;
}
