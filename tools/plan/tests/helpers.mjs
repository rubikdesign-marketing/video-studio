// Shared by the plan and connector tests: a scratch studio folder and a complete brief.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** A temp studio: the brief and job templates, the frameworks, brands acme and demo (acme with an approved product
 *  discovery), and studio.json naming demo as the default. Returns its root. */
export function scratchStudio() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-'));
  const copy = (rel) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.copyFileSync(path.join(STUDIO, rel), path.join(root, rel)); };
  for (const rel of ['templates/brief.json', 'templates/job.json', 'library/structure/frameworks.json']) copy(rel);
  for (const b of ['acme', 'demo']) { fs.mkdirSync(path.join(root, 'brands', b), { recursive: true }); fs.writeFileSync(path.join(root, 'brands', b, 'brand.json'), JSON.stringify({ name: b })); }
  fs.mkdirSync(path.join(root, 'brands', 'acme', 'product'), { recursive: true });
  fs.writeFileSync(path.join(root, 'brands', 'acme', 'product', 'discovery.md'), '# Discovery\n\nApproved by: Owner\n');
  fs.writeFileSync(path.join(root, 'studio.json'), JSON.stringify({ default_brand: 'demo' }));
  return root;
}

/** A complete brief (every checklist item known) for brand acme. */
export const completeBrief = () => ({ brand: 'acme', product: 'Acme, exporting a board', kind: 'product-demo', for: 'agency owners', awareness: 'problem-aware', angle: 'one click replaces the weekly report', viewer_should: 'try it', look: 'paper', hook: { family: 'demonstration' }, voice: 'none', length_cap_seconds: 20, deliver: [{ size: '9:16', master: true }], references: [{ source: 'r', liked_for: ['pacing'] }], must_show: [{ what: 'export', evidence: 'the file lands in Downloads' }] });
