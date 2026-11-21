// The six tools the brief page can call. Plain functions: an input object in, a small JSON-able object out, or a plain
// Error. The questions, checklist and validation all come from tools/plan/lib/brief.mjs; nothing is re-created here.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { applyAnswer, assumptions, checkAnswer, preflight, questions } from '../../plan/lib/brief.mjs';
import { confirmPlan, customerBrands, decide, jobFolderName, loadJob, saveBrief, startBrief, studioContext, writePlan } from '../../plan/lib/brief-store.mjs';
import { safePath, studioMemory } from './memory.mjs';

const JOB = /^[a-z0-9][a-z0-9-]{0,80}$/;
const STYLE = /^[a-z0-9][a-z0-9-]{0,80}\/[a-z0-9][a-z0-9-]{0,80}$/;
const BRAND_FIRST = 'Set up your brand first: start a new chat in the studio folder and say "set up my brand".';
const CONTINUE = 'Start a new chat in the studio folder and say "continue the video".';
const cut = (v, n = 120) => (typeof v === 'string' && v.length > n ? `${v.slice(0, n - 1)}…` : v);
const given = (v) => (Array.isArray(v) ? v.some((x) => String(x).trim()) : v != null && String(v).trim() !== '');

/** The studio's context, with the demo brand and any unknown brand never used as the default. */
function contextOf(root) {
  const ctx = studioContext(root);
  const customers = customerBrands(ctx);
  if (ctx.defaultBrand === 'demo' || !customers.includes(ctx.defaultBrand)) delete ctx.defaultBrand;
  return { ctx, customers };
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
  const { ctx, customers } = contextOf(root);
  const { brief, job: jobJson } = loadJob(dir);
  if (!brief) throw new Error(`Not a brief: ${job}`);
  const opts = { job: jobJson, ctx };
  const assumed = assumptions(brief, { jobBrand: jobJson.brand, ...ctx });
  const checks = preflight(brief, opts);
  const all = questions(brief, opts).map((q) => ({
    id: q.id, question: q.question, why: q.why, recommended: q.recommended, field: q.field,
    choices: q.id === 'brand' ? customers.map((value) => ({ value, label: value, recommended: false })) : q.choices,
    many: q.many,
  }));
  const brand = brief.brand || assumed.find((a) => a.id === 'brand')?.value;
  const parked = customers.length === 0;
  let status = 'ready';
  if (parked) status = 'none';
  else if (brand && !ctx.brands[brand]?.setUp) status = 'needs-setup';
  else if (checks.find((c) => c.id === 'product')?.todo?.includes('no approved product discovery')) status = 'needs-discovery';
  return {
    job, brand_status: status,
    assumed: assumed.map((a) => ({ id: a.id, value: a.value, because: cut(String(a.because ?? '')) })),
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

    brief_plan({ job } = {}) {
      const dir = jobDirOf(root, job);
      const { ctx, customers } = contextOf(root);
      if (customers.length === 0) throw new Error(`Not yet: set up your brand first. ${BRAND_FIRST}`);
      const out = writePlan(root, dir, { ctx });
      if (!out) {
        const { brief, job: jobJson } = loadJob(dir);
        const open = preflight(brief, { job: jobJson, ctx }).filter((c) => !c.done).map((c) => `${c.label}: ${c.todo}`);
        throw new Error(`Not yet: ${open.join('; ')}`);
      }
      return { job, lines: out.lines, outline: out.outline.map((s) => ({ n: s.n, name: s.name, from: s.from, to: s.to, shows: s.shows })) };
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
  { name: 'brief_plan', description: 'Write the plan in brief once the checklist is complete.', inputSchema: { type: 'object', properties: { job: jobProp }, required: ['job'], additionalProperties: false }, annotations: rw },
  { name: 'brief_confirm', description: 'Confirm the plan and start the job at the Idea stage.', inputSchema: { type: 'object', properties: { job: jobProp }, required: ['job'], additionalProperties: false }, annotations: rw },
];
