// Beat frameworks (LIBRARY-PLAN.md phase 2): library/structure/frameworks.json. The studio's four playbook shapes are
// the defaults for their film types; the others are alternatives, credited in library/structure/CREDITS.md.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allowed } from './beats.mjs';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const STRUCTURE_DIR = path.join(STUDIO, 'library', 'structure');
const TYPES = ['promo', 'demo', 'tutorial', 'edit', 'ad'];
const LICENCES = ['MIT', 'Apache-2.0', 'own'];

export function loadFrameworks(dir = STRUCTURE_DIR) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, 'frameworks.json'), 'utf8'));
  return { frameworks: d.frameworks || [], sources: d.sources || [] };
}

/** The framework a film type starts from: the playbook's own shape. An ad uses the promo's. */
export const defaultFor = (type) => ({ promo: 'studio-promo', ad: 'studio-promo', demo: 'studio-demo', tutorial: 'studio-tutorial', edit: 'studio-edit' })[String(type || '').split(/[\s(]/)[0].toLowerCase()] || 'studio-promo';

export function validateFrameworks(lib) {
  const problems = []; const ids = new Set(); const sources = new Set(lib.sources.map((s) => s.id));
  if (!lib.frameworks.length) problems.push('there are no frameworks');
  for (const s of lib.sources) if (!LICENCES.includes(s.licence)) problems.push(`source ${s.id}: licence "${s.licence}" is not one that allows copying`);
  for (const f of lib.frameworks) {
    const at = `framework ${f.id || '(no id)'}`;
    if (!f.id || ids.has(f.id)) problems.push(`${at}: the id is missing or used twice`); ids.add(f.id);
    if (!sources.has(f.source)) problems.push(`${at}: source "${f.source}" is not in the list`);
    for (const k of ['name', 'what']) if (!f[k]) problems.push(`${at}: "${k}" is missing`);
    for (const t of f.suits?.types || []) if (!TYPES.includes(t)) problems.push(`${at}: suits.types has "${t}"`);
    if (!f.suits?.lengths?.length) problems.push(`${at}: suits.lengths is empty`);
    if (!f.beats?.length || f.beats.length < 2) { problems.push(`${at}: fewer than two beats`); continue; }
    const beatIds = new Set();
    for (const b of f.beats) {
      if (!b.id || beatIds.has(b.id)) problems.push(`${at}: beat id "${b.id}" missing or used twice`); beatIds.add(b.id);
      if (!b.name || !b.job) problems.push(`${at}, beat ${b.id}: name or job missing`);
      for (const k of ['size', 'seconds']) if (b[k] !== null && b[k] !== undefined && !(Array.isArray(b[k]) && b[k].length === 2 && b[k][0] <= b[k][1] && b[k][0] >= 0)) problems.push(`${at}, beat ${b.id}: ${k} must be [min, max] with min <= max`);
      if (b.size && b.size[1] > 1) problems.push(`${at}, beat ${b.id}: a size is a share of the film, at most 1`);
    }
    if (!f.beats.some((b) => b.required)) problems.push(`${at}: no beat is required`);
    // At each length it is written for, the beats can fill the film: their minimums fit, their maximums reach.
    for (const L of f.suits?.lengths || []) {
      const lo = f.beats.reduce((a, b) => a + (b.size || b.seconds ? allowed(b, L)[0] : 0), 0);
      const open = f.beats.some((b) => !b.size && !b.seconds);
      const hi = f.beats.reduce((a, b) => a + allowed(b, L)[1], 0);
      if (lo > L * 1.001) problems.push(`${at}: at ${L} s its beats' minimums add up to ${Math.round(lo * 10) / 10} s`);
      if (!open && hi < L * 0.999) problems.push(`${at}: at ${L} s its beats' maximums add up to only ${Math.round(hi * 10) / 10} s`);
    }
  }
  for (const t of ['studio-promo', 'studio-demo', 'studio-tutorial', 'studio-edit']) if (!ids.has(t)) problems.push(`the playbook framework ${t} is missing`);
  return problems;
}
