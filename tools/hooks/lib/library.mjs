// The hook library (LIBRARY-PLAN.md phase 1): library/hooks/index.json (formulas, families, sources) and avoid.json
// (openers to avoid). loadLibrary reads them; validate lists what is wrong with them (empty when nothing is). Pure
// apart from reading the files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const HOOKS_DIR = path.join(STUDIO, 'library', 'hooks');

export const TYPES = ['promo', 'demo', 'tutorial', 'edit', 'ad'];
export const PLATFORMS = ['reels', 'tiktok', 'shorts', 'youtube', 'linkedin', 'x'];
export const AWARENESS = ['cold', 'problem-aware', 'solution-aware', 'product-aware'];
const LICENCES = ['MIT', 'Apache-2.0', 'own']; // "own": written for this studio
const FIELDS = ['id', 'family', 'name', 'spoken', 'example', 'on_screen', 'first_frame', 'trap', 'source', 'status'];
// Words a formula's example may not use: a claim about results is the brand's ledger's to make, never the library's.
const CLAIMS = /\d\s?%|\b(proven|guaranteed|viral)\b/i;

export const wordCount = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;
/** A spoken template with case, punctuation and slot names taken out, to spot two formulas that are the same. */
export const normalise = (spoken) => {
  const clean = (t) => t.replace(/[^a-z0-9{} ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const lower = String(spoken).toLowerCase();
  const bare = clean(lower.replace(/\{[^}]*\}/g, '{}'));
  // A template that is nothing but slots (a picture-first hook: "{what just broke}") is told apart by its slots' words.
  return /[a-z]/.test(bare) ? bare : clean(lower);
};

export function loadLibrary(dir = HOOKS_DIR) {
  const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
  const avoidFile = path.join(dir, 'avoid.json');
  return { families: index.families || [], sources: index.sources || [], formulas: index.formulas || [], avoid: fs.existsSync(avoidFile) ? JSON.parse(fs.readFileSync(avoidFile, 'utf8')) : [] };
}

/** Everything wrong with a library, one line each. */
export function validate(lib, { minPerFamily = 3 } = {}) {
  const problems = [];
  if (!lib.formulas.length) problems.push('the library has no formulas');
  if (!lib.families.length) problems.push('the library has no families');
  const families = new Set(lib.families.map((f) => f.id));
  const sources = new Set(lib.sources.map((s) => s.id));
  for (const s of lib.sources) if (!LICENCES.includes(s.licence)) problems.push(`source ${s.id}: licence "${s.licence}" is not one that allows copying (${LICENCES.join(', ')})`);
  const ids = new Set(); const seen = new Map(); const perFamily = {};
  for (const f of lib.formulas) {
    const at = `formula ${f.id || '(no id)'}`;
    for (const k of FIELDS) if (typeof f[k] !== 'string' || !f[k].trim()) problems.push(`${at}: "${k}" is missing`);
    if (f.id && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.id)) problems.push(`${at}: the id is not lower-case words joined by hyphens`);
    if (ids.has(f.id)) problems.push(`${at}: the id is used twice`); ids.add(f.id);
    if (!families.has(f.family)) problems.push(`${at}: family "${f.family}" is not in the list`);
    if (!sources.has(f.source)) problems.push(`${at}: source "${f.source}" is not in the list`);
    if (f.status !== 'untested') problems.push(`${at}: status must be "untested" (only a brand's ledger says what worked)`);
    if (wordCount(f.on_screen || '') > 7) problems.push(`${at}: the on-screen line has ${wordCount(f.on_screen)} words (7 at most)`);
    if (CLAIMS.test(f.example || '')) problems.push(`${at}: the example makes a claim (a percentage, "proven", "guaranteed" or "viral")`);
    const key = normalise(f.spoken || '');
    if (seen.has(key)) problems.push(`${at}: the same spoken line as ${seen.get(key)}`); else seen.set(key, f.id);
    for (const [k, allowed] of [['types', TYPES], ['platforms', PLATFORMS], ['awareness', AWARENESS]]) {
      const v = f.suits?.[k];
      if (!Array.isArray(v) || !v.length) problems.push(`${at}: suits.${k} is empty`);
      else for (const x of v) if (!allowed.includes(x)) problems.push(`${at}: suits.${k} has "${x}", which is not one of ${allowed.join(', ')}`);
    }
    perFamily[f.family] = (perFamily[f.family] || 0) + 1;
  }
  for (const fam of lib.families) if ((perFamily[fam.id] || 0) < minPerFamily) problems.push(`family ${fam.id}: ${perFamily[fam.id] || 0} formulas (at least ${minPerFamily})`);
  for (const a of lib.avoid) {
    if (typeof a.pattern !== 'string' || !a.pattern.trim()) { problems.push('avoid list: an entry has no pattern (it would match every hook)'); continue; }
    try { new RegExp(a.pattern, 'i'); } catch { problems.push(`avoid list: "${a.pattern}" is not a valid pattern`); }
    if (!a.why) problems.push(`avoid list: "${a.pattern}" has no reason`);
  }
  return problems;
}
