// The brief's files, shared by the CLI (tools/plan/brief.mjs) and the connector: jobs/<job>/brief.json, the studio
// context (brands, references), plan.md and the recorded decisions. Every function that needs the studio takes its root.
import fs from 'node:fs';
import path from 'node:path';
import { assumptions, FRAMEWORK, plan, preflight } from './brief.mjs';
import { loadFrameworks } from './frameworks.mjs';

const today = () => new Date().toISOString().slice(0, 10);
const readJson = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
const writeJson = (f, data) => { fs.writeFileSync(`${f}.tmp`, JSON.stringify(data, null, 1) + '\n'); fs.renameSync(`${f}.tmp`, f); };

/** What the studio can look up instead of asking: the brands set up, whether each has an approved product discovery,
 *  the default brand, and the reference library. */
export function studioContext(root) {
  const dir = path.join(root, 'brands');
  const brands = {};
  for (const name of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (name.startsWith('_') || name.startsWith('.') || !fs.statSync(path.join(dir, name)).isDirectory()) continue;
    const disc = path.join(dir, name, 'product', 'discovery.md');
    const approved = fs.existsSync(disc) && /Approved by:\s*(?!<)\S/.test(fs.readFileSync(disc, 'utf8'));
    brands[name] = { setUp: fs.existsSync(path.join(dir, name, 'brand.json')), discovery: approved };
  }
  return { brands, defaultBrand: readJson(path.join(root, 'studio.json'))?.default_brand, references: readJson(path.join(root, 'library', 'references', 'index.json')) || [] };
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

/** Records "plan confirmed" (once) and makes job.json at the Idea stage when there is none. Safe to call again. */
export function confirmPlan(root, jobDir, { ctx = studioContext(root) } = {}) {
  const { brief, job } = loadJob(jobDir);
  const name = path.basename(jobDir);
  if (!brief) throw new Error(`${name}: there is no brief yet`);
  if (!fs.existsSync(path.join(jobDir, 'plan.md'))) throw new Error(`${name}: there is no plan yet; write the plan first`);
  if (!planFor(root, brief, job, ctx)) throw new Error(`${name}: the plan is not complete; the checklist still has open items`);
  const file = path.join(jobDir, 'job.json');
  const exists = fs.existsSync(file);
  let made = job;
  if (exists) {
    if (!(job.notes || []).some((n) => String(n).startsWith('Plan confirmed'))) made = { ...job, notes: [...(job.notes || []), `Plan confirmed ${today()}; job.json left as it was.`] };
  } else {
    const t = readJson(path.join(root, 'templates', 'job.json'));
    const kind = brief.kind || assumptions(brief, ctx).find((x) => x.id === 'kind')?.value;
    const brand = brief.brand || assumptions(brief, { jobBrand: job.brand, ...ctx }).find((x) => x.id === 'brand')?.value;
    const master = (brief.deliver || []).find((d) => d.master) || (brief.deliver || []).find((d) => d.size);
    made = { ...t, name, brand, type: TYPE_OF[kind] || 'promo', size: master?.size || t.size, length_cap_seconds: brief.length_cap_seconds ?? null, created: today(), stage_next: 'idea', approval_mode: 'guided' };
  }
  if (made !== job || !exists) writeJson(file, made);
  if (!(brief.decisions || []).some((d) => d.what === 'plan confirmed')) decide(jobDir, 'plan confirmed');
  return made;
}
