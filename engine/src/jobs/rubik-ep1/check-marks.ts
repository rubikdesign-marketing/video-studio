// Is every highlight, pause and button morph inside the view while it is on screen? Exits 1 if any is cut off.
// run: node --experimental-strip-types engine/src/jobs/rubik-ep1/check-marks.ts
import fs from 'node:fs';
import { checkMarks } from './lib.ts';
import { CAP_LENGTH, SPEC, STILLS } from './spec.ts';
const read = (f: string) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url), 'utf8'));
const rows = checkMarks(SPEC, read('./timeline.json'), read('./marks.json'), CAP_LENGTH, (cap, from) => STILLS.includes(cap + from));
for (const r of rows) console.log(`S${r.shot} ${r.kind}${r.i ? ` ${r.i + 1}` : ''}`.padEnd(14), r.ok ? 'inside' : `CUT ${r.cut} px at ${r.t} s`);
// --outline <file>: the marked highlights as items for tools/checks/outline_clear.py (the gap RingMark leaves is
// 10 stage px, which is 10 / (1424 / 1920) page px).
const oi = process.argv.indexOf('--outline');
if (oi > 0) {
  const CAP = new URL('../../../../jobs/2026-11-17-rubik-ep1/capture/', import.meta.url).pathname;
  const items = [];
  for (const [n, sp] of Object.entries(SPEC) as [string, { type: string; cap?: string; rings?: { box: number[]; mark?: string }[] }][]) {
    if (sp.type !== 'site') continue;
    (sp.rings ?? []).forEach((r, i) => { if (!r.mark) return; const take = JSON.parse(fs.readFileSync(`${CAP}${sp.cap}/best.json`, 'utf8')).folder;
      items.push({ name: `S${n} ring${i ? ` ${i + 1}` : ''}`, png: `${CAP}${sp.cap}/${take}/marks/${r.mark}.png`, box: r.box, pad: 10 / (1424 / 1920), scale: 2 }); });
  }
  fs.writeFileSync(process.argv[oi + 1], JSON.stringify(items, null, 1));
}
const bad = rows.filter((r) => !r.ok).length;
console.log(`${rows.length} checked, ${bad} cut off`);
process.exit(bad ? 1 : 0);
