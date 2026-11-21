// What the studio's memory knows, as short summaries for the brief page (the studio_context tool), and the one guard
// every connector read goes through. Reads only: brands/, knowledge/, library/references/index.json, studio.json and
// jobs/<job>/brief.json, job.json, plan.md. Never .env, .capture/, jobs/*/out/, captures or footage.
import fs from 'node:fs';
import path from 'node:path';
import { customerBrands, loadJob, studioContext } from '../../plan/lib/brief-store.mjs';
import { questions } from '../../plan/lib/brief.mjs';

const JOB_FILES = new Set(['brief.json', 'job.json', 'plan.md']);
const SECRET = (seg) => seg === '.capture' || seg.toLowerCase().startsWith('.env');

function allowed(parts) {
  if (parts.some((p) => !p || p === '.' || p === '..' || SECRET(p))) return false;
  const [top] = parts;
  if (top === 'studio.json') return parts.length === 1;
  if (top === 'brands' || top === 'knowledge') return parts.length >= 2;
  if (top === 'library') return parts.length === 3 && parts[1] === 'references' && parts[2] === 'index.json';
  if (top === 'jobs') return parts.length === 3 && JOB_FILES.has(parts[2]);
  return false;
}

/** Absolute path of a studio file the connector may read. Throws Error("Not allowed: <rel>") for anything else,
 *  for a path that leaves the studio folder, and for a link that points outside it. */
export function safePath(root, rel) {
  const text = String(rel);
  const bad = () => new Error(`Not allowed: ${text}`);
  if (!text || text.includes('\0') || text.includes('\\') || text.startsWith('/') || /^[a-zA-Z]:/.test(text)) throw bad();
  const parts = text.split('/');
  if (!allowed(parts)) throw bad();
  const abs = path.join(root, ...parts);
  const inside = (base, p) => { const r = path.relative(base, p); return r !== '' && !r.startsWith('..') && !path.isAbsolute(r); };
  if (!inside(path.resolve(root), path.resolve(abs))) throw bad();
  // A link inside the studio must not lead outside it: the nearest part of the path that exists (the file, or the
  // jobs/<x> or brands/<x> folder above it) must really be inside the studio. A link that leads nowhere is refused.
  let realRoot;
  try { realRoot = fs.realpathSync(root); } catch { return abs; }
  const present = (p) => { try { fs.lstatSync(p); return true; } catch { return false; } };
  let probe = abs;
  while (!present(probe) && probe !== path.dirname(probe)) probe = path.dirname(probe);
  let real;
  try { real = fs.realpathSync(probe); } catch { throw bad(); }
  if (real !== realRoot && !inside(realRoot, real)) throw bad();
  return abs;
}

const readJson = (root, rel) => { try { return JSON.parse(fs.readFileSync(safePath(root, rel), 'utf8')); } catch { return null; } };
// Folder names only: the two folders that hold one entry per brand or job are listed directly, everything else through safePath.
const listDir = (root, rel) => { try { return fs.readdirSync(rel === 'brands' || rel === 'jobs' ? path.join(root, rel) : safePath(root, rel)); } catch { return []; } };
const visible = (name) => !name.startsWith('_') && !name.startsWith('.');
const dateOf = (v) => String(v ?? '');

function lessons(root, brand) {
  return listDir(root, `brands/${brand}/lessons`)
    .map((f) => ({ f, m: /^(\d{4}-\d{2}-\d{2})/.exec(f) }))
    .filter(({ f, m }) => m && f.endsWith('.md'))
    .map(({ f, m }) => {
      let text = '';
      try { text = fs.readFileSync(safePath(root, `brands/${brand}/lessons/${f}`), 'utf8'); } catch { /* unreadable: use the file name */ }
      const heading = /^#\s+(.+)$/m.exec(text);
      return { date: m[1], title: heading ? heading[1].trim() : f.slice(m[1].length).replace(/^-/, '').replace(/\.md$/, '') };
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
}

function films(root, brand) {
  const ledger = readJson(root, `brands/${brand}/ledger.json`);
  return (Array.isArray(ledger) ? ledger : [])
    .filter((f) => f && typeof f === 'object')
    .sort((a, b) => dateOf(b.date).localeCompare(dateOf(a.date)))
    .slice(0, 5)
    .map((f) => ({ name: f.name ?? null, type: f.type ?? null, date: f.date ?? null, hook: f.hook ?? null, look: f.look ?? null }));
}

// Saved styles of the customer's own brands. The demo brand's shipped presets are not "your saved" styles.
function styles(root, brands) {
  const out = [];
  for (const brand of brands) {
    for (const style of listDir(root, `brands/${brand}/styles`).filter(visible)) {
      const s = readJson(root, `brands/${brand}/styles/${style}/style.json`);
      if (s) out.push({ ref: `${brand}/${style}`, size: s.size ?? null, kind: s.kind ?? s.type ?? null, scenes: (s.structure || []).length, from_job: s.from_job ?? null });
    }
  }
  return out;
}

const confirmedDate = (brief) => (brief.decisions || []).filter((d) => d?.what === 'plan confirmed' && d.date).map((d) => String(d.date)).sort().at(-1) ?? null;

function briefs(root, ctx) {
  const out = [];
  for (const name of listDir(root, 'jobs').filter(visible)) {
    try {
      const files = ['brief.json', 'job.json'].map((f) => safePath(root, `jobs/${name}/${f}`));
      const { brief, job } = loadJob(path.dirname(files[0]));
      if (!brief) continue;
      const updated = Math.max(0, ...files.map((f) => { try { return fs.statSync(f).mtimeMs; } catch { return 0; } }));
      out.push({
        updated,
        item: { job: name, words: String(brief.in_their_words ?? '').slice(0, 120), brand: brief.brand ?? job.brand ?? null, stage: job.stage_next || 'brief', confirmed: confirmedDate(brief), open: questions(brief, { job, ctx }).length, parked: !!brief.parked },
      });
    } catch { /* a brief or job file that cannot be read leaves that job out */ }
  }
  return out
    .sort((a, b) => (b.item.confirmed || '').localeCompare(a.item.confirmed || '') || b.updated - a.updated)
    .slice(0, 10)
    .map((x) => x.item);
}

/** The studio_context reply: customer brands with their last films and lessons, their saved styles, and open briefs. */
export function studioMemory(root) {
  const ctx = studioContext(root);
  const names = customerBrands(ctx);
  return {
    parked: names.length === 0,
    brands: names.map((name) => ({ name, discovery: !!ctx.brands[name].discovery, last_films: films(root, name), lessons: lessons(root, name) })),
    styles: styles(root, names),
    briefs: briefs(root, ctx),
  };
}
