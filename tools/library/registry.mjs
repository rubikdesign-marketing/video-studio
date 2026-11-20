#!/usr/bin/env node
// The master registry: one generated, validated file that lists everything the studio can reach for (presets,
// workflows, motion, backgrounds, hooks, sounds, references, components), and a bounded way to browse it.
//
//   registry.mjs build [--manifest <path>] [--out <file>]   writes library/registry.json and prints the counts
//   registry.mjs check [--release <dir>] [--manifest <path>] [--strict]
//                                                            validates it; with --release also compares the
//                                                            customer items with a packaged folder
//   registry.mjs find <words> [--kind k] [--tag t] [--customer] [--limit n]
//                                                            at most 5 one-line results, however large --limit is
//   registry.mjs get <id>                                    one item, in full
//   registry.mjs kinds [--json]                              the count per kind, with 3 example ids each
//
// The release manifest (exclude globs, banned words, json_drop) belongs to the exporter and is only read:
// --manifest <path>, DAMEX_RELEASE_MANIFEST, or by default the versioned release/manifest.json. Without any of them only
// the folder rules apply and the privacy scan is "not run".
// Dependency-free ESM, node 22.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const REGISTRY = 'library/registry.json';
export const SCHEMA = 'damex.registry/1';
export const KINDS = ['background', 'component', 'hook', 'motion', 'preset', 'reference', 'sound', 'workflow'];
const TIERS = ['any', 'gpu', 'heavy'];
const FIND_MAX = 5;
const PUBLIC_BRANDS = new Set(['demo', '_template']);
const PRIVATE_FOLDERS = ['jobs', 'engine/src/jobs', 'engine/src/products', 'library/own-films'];

// ---------- small helpers ----------
const abs = (rel, base = ROOT) => path.join(base, rel);
const exists = (rel, base = ROOT) => fs.existsSync(abs(rel, base));
const readText = (rel, base = ROOT) => fs.readFileSync(abs(rel, base), 'utf8');
const sha256 = (rel) => crypto.createHash('sha256').update(fs.readFileSync(abs(rel))).digest('hex');
const slug = (s) => String(s).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2').toLowerCase();
const flat = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
export const cut = (s, n) => { const t = flat(s); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };
const firstSentence = (s) => flat(s).split(/(?<=[.!?])\s/)[0];
const uniqSorted = (a) => [...new Set(a.map((x) => flat(x).toLowerCase()).filter(Boolean))].sort();
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const flag = (args, name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const has = (args, name) => args.includes(`--${name}`);

function walk(rel, out = []) {
  for (const e of fs.readdirSync(abs(rel), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const r = `${rel}/${e.name}`;
    if (e.isDirectory()) walk(r, out);
    else if (/\.(tsx?|jsx?|mjs)$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(r);
  }
  return out;
}

// ---------- exports: what each source file really exports ----------
const DECL = /^[ \t]*export\s+(?:declare\s+)?(default\s+)?(?:abstract\s+)?(?:async\s+)?(function\*?|const|let|var|class|enum|type|interface)\s+([A-Za-z_$][\w$]*)/gm;
const PASCAL = /^[A-Z][A-Za-z0-9]*[a-z0-9][A-Za-z0-9]*$/;

/** Every exported name in a source text, and the ones that are React components (a .tsx file's PascalCase functions,
 *  classes and component-shaped consts). Re-exports ("export { X } from") count as exports, never as components. */
export function parseExports(text, isTsx) {
  const all = new Set();
  const components = [];
  let m;
  DECL.lastIndex = 0;
  while ((m = DECL.exec(text))) {
    const [whole, , kind, name] = m;
    all.add(name);
    if (!isTsx || !PASCAL.test(name) || kind === 'type' || kind === 'interface' || kind === 'enum') continue;
    let comp = kind === 'function*' || kind === 'function' || kind === 'class';
    if (!comp && (kind === 'const' || kind === 'let' || kind === 'var')) {
      const rest = text.slice(m.index + whole.length, m.index + whole.length + 260);
      const rhs = rest.slice(rest.indexOf('=') + 1).trimStart();
      comp =
        /^\s*:\s*(?:React\.)?(?:FC|FunctionComponent|ComponentType|ForwardRefExoticComponent|MemoExoticComponent)\b/.test(rest) ||
        /^(?:React\.)?(?:memo|forwardRef)\(/.test(rhs) ||
        (rest.includes('=') && !/^[{["'`\d]/.test(rhs) && /^[^;\n]{0,140}?=>/.test(rhs));
    }
    if (comp) components.push({ name, index: m.index });
  }
  const re = /export\s*(?:type\s*)?\{([^}]*)\}/g;
  while ((m = re.exec(text))) {
    for (const part of m[1].split(',')) {
      const n = part.trim().split(/\s+as\s+/).pop().trim();
      if (/^[A-Za-z_$][\w$]*$/.test(n)) all.add(n);
    }
  }
  return { all, components };
}

/** The comment written just above an export: a /** block or a run of // lines. */
function docAbove(text, index) {
  const before = text.slice(0, index).trimEnd();
  if (before.endsWith('*/')) {
    const start = before.lastIndexOf('/*');
    return flat(before.slice(start).replace(/^\/\*+|\*\/$/g, '').replace(/^\s*\* ?/gm, ''));
  }
  const lines = [];
  for (const l of before.split('\n').reverse()) {
    const t = l.trim();
    if (t.startsWith('//')) lines.unshift(t.replace(/^\/\/+\s?/, ''));
    else break;
  }
  return flat(lines.join(' '));
}

/** The keys of `type NameProps = { ... }` (or interface), as key -> short type. */
function propsOf(text, name) {
  const m = new RegExp(`(?:type\\s+${name}Props\\s*=|interface\\s+${name}Props(?:\\s+extends\\s+[^{]+)?)\\s*\\{`).exec(text);
  if (!m) return null;
  let i = m.index + m[0].length;
  let depth = 1;
  const start = i;
  for (; i < text.length && depth > 0; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') depth--;
  }
  const body = text.slice(start, i - 1).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
  const out = {};
  let seg = '';
  let d = 0;
  const flush = () => {
    const k = /^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)(\??)\s*:\s*([\s\S]+)$/.exec(seg);
    if (k && Object.keys(out).length < 30) out[k[1] + k[2]] = cut(k[3].replace(/[;,]\s*$/, ''), 80);
    seg = '';
  };
  for (const ch of body) {
    if ('{(<['.includes(ch)) d++;
    else if ('})>]'.includes(ch)) d--;
    if (d === 0 && (ch === ';' || ch === ',' || ch === '\n') && !/[:|&=]\s*$/.test(seg)) flush();
    else seg += ch;
  }
  flush();
  return Object.keys(out).length ? out : null;
}

export function scanComponentSources(base = ROOT) {
  const files = [...walkIn('engine/src/kit', base), ...walkIn('engine/src/library', base)];
  const index = new Map();
  for (const f of files) {
    const text = readText(f, base);
    index.set(f, { text, ...parseExports(text, f.endsWith('x')) });
  }
  return index;
}
function walkIn(rel, base) {
  if (base === ROOT) return walk(rel);
  const out = [];
  const go = (r) => {
    if (!fs.existsSync(abs(r, base))) return;
    for (const e of fs.readdirSync(abs(r, base), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = `${r}/${e.name}`;
      if (e.isDirectory()) go(p);
      else if (/\.(tsx?|jsx?|mjs)$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p);
    }
  };
  go(rel);
  return out;
}

// ---------- the release manifest: exclude globs, banned words, json_drop ----------
function globToRegex(p) {
  p = p.replace(/\/+$/, '');
  let r = '';
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === '*') {
      if (p[i + 1] === '*') {
        i++;
        if (p[i + 1] === '/') { i++; r += '(?:.*/)?'; } else r += '.*';
      } else r += '[^/]*';
    } else if (c === '?') r += '[^/]';
    else r += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${r}(?:/.*)?$`);
}

export function loadManifest(p) {
  if (!p) return null;
  const m = JSON.parse(fs.readFileSync(p, 'utf8'));
  return {
    file: p,
    exclude: (m.exclude || []).map((g) => ({ glob: g, re: globToRegex(g) })),
    keep: (m.keep_inside_excluded || []).map((g) => g.replace(/\/+$/, '')),
    banned: (m.banned || []).map((b) => ({ word: b, re: new RegExp(b, 'i') })),
    jsonDrop: m.json_drop || {},
  };
}

const privateFolderRes = PRIVATE_FOLDERS.map((g) => ({ glob: g, re: globToRegex(g) }));
export function isPrivatePath(rel) {
  const m = /^brands\/([^/]+)(?:\/|$)/.exec(rel);
  if (m && !PUBLIC_BRANDS.has(m[1])) return `brands/${m[1]}`;
  const hit = privateFolderRes.find((x) => x.re.test(rel));
  return hit ? hit.glob : null;
}

/** The exclude glob that keeps this path out of the customer release, or null. */
export function excludedBy(rel, manifest) {
  const priv = isPrivatePath(rel);
  if (priv) return priv;
  if (!manifest) return null;
  if (manifest.keep.some((k) => rel === k || rel.startsWith(`${k}/`))) return null;
  const hit = manifest.exclude.find((x) => x.re.test(rel));
  return hit ? hit.glob : null;
}

function bannedIn(text, manifest) {
  if (!manifest) return null;
  for (const b of manifest.banned) if (b.re.test(text)) return b.word;
  return null;
}

function jsonDropped(catalogFile, entry, manifest) {
  const rule = manifest?.jsonDrop?.[catalogFile];
  if (!rule) return false;
  // One match object, or an array of them (the exporter's json_drop accepts both): any match drops the entry.
  return (Array.isArray(rule) ? rule : [rule]).some((where) => Object.entries(where).every(([k, v]) => String(entry?.[k] ?? '').toLowerCase() === String(v).toLowerCase()));
}

// ---------- the build ----------
export function buildRegistry({ manifest = null } = {}) {
  const errors = [];
  const warnings = [];
  const used = new Set();
  const omitted = { path: 0, json_drop: 0, banned: 0 };
  const items = [];
  const readJson = (rel) => { used.add(rel); return JSON.parse(readText(rel)); };
  const readSrc = (rel) => { used.add(rel); return readText(rel); };
  const comps = scanComponentSources();
  for (const f of comps.keys()) if (comps.get(f).components.length || true) used.add(f);

  const add = (it) => items.push(it);
  const base = (kind, slugText, name, summary, tags, locator, extra = {}) => ({
    id: `${kind}:${slugText}`,
    kind,
    name: cut(name, 120),
    summary: cut(summary, 140),
    tags: uniqSorted(tags),
    locator,
    ...extra,
  });

  // Resolve a catalog's component to a real export: the declared file, then its module, then the one other file that exports it.
  function resolveComponent(entryName, declaredFile, module, componentField) {
    if (!componentField) return { file: declaredFile, export: undefined, also: [] };
    const names = String(componentField).split(',').map((s) => s.trim()).filter(Boolean);
    const exportsIn = (f, n) => comps.get(f)?.all.has(n);
    for (const f of [declaredFile, module]) {
      const n = names.find((x) => f && exportsIn(f, x));
      if (n) return { file: f, export: n, also: names.filter((x) => x !== n) };
    }
    for (const n of names) {
      const where = [...comps.keys()].filter((f) => exportsIn(f, n));
      if (where.length === 1) {
        warnings.push(`${entryName}: catalog says ${declaredFile}, but ${n} is exported from ${where[0]}`);
        return { file: where[0], export: n, also: names.filter((x) => x !== n) };
      }
      if (where.length > 1) {
        const near = where.find((f) => path.dirname(f) === path.dirname(declaredFile || ''));
        if (near) return { file: near, export: n, also: names.filter((x) => x !== n) };
      }
    }
    errors.push(`${entryName}: component "${componentField}" is not exported from ${declaredFile || 'any file in engine/src/kit or engine/src/library'}`);
    return null;
  }

  // ----- motion -----
  const motionFile = 'library/motion/index.json';
  const motion = readJson(motionFile);
  const moveByFileExport = new Map();
  for (const mv of motion.moves) {
    const r = resolveComponent(`motion:${mv.name}`, mv.file, mv.module, mv.component);
    if (!r) continue;
    if (mv.module && !exists(mv.module)) errors.push(`motion:${mv.name}: module ${mv.module} does not exist`);
    if (r.export && !moveByFileExport.has(`${r.file}#${r.export}`)) moveByFileExport.set(`${r.file}#${r.export}`, mv);
    const gpu = mv.family === 'shader' || /webgl|--gl=angle/i.test(mv.does || '');
    const loc = { file: r.file };
    if (r.export) loc.export = r.export;
    loc.catalog = `${motionFile}#moves/${mv.name}`;
    if (mv.preview) loc.preview = mv.preview;
    const it = base('motion', slug(mv.name), mv.name, mv.does, [mv.family, ...(mv.energies || []), ...(mv.video_types || []), ...(mv.sizes || []), ...r.also], loc, {
      ...(mv.props && Object.keys(mv.props).length ? { props: mv.props } : {}),
    });
    it._src = { catalogFile: motionFile, entry: mv };
    it._tier = gpu ? 'gpu' : 'any';
    add(it);
  }

  // ----- backgrounds -----
  const bgFile = 'library/backgrounds/index.json';
  const bgs = readJson(bgFile);
  const bgDir = (/engine\/src\/[\w/-]+/.exec(bgs._about || '') || ['engine/src/kit/backgrounds'])[0];
  for (const b of bgs.backgrounds) {
    const file = `${bgDir}/${b.component}.tsx`;
    if (!comps.get(file)?.all.has(b.component)) {
      errors.push(`background:${b.name}: component ${b.component} is not exported from ${file}`);
      continue;
    }
    const prev = b.previews?.[b.best_page] || Object.values(b.previews || {})[0];
    const loc = { file, export: b.component, catalog: `${bgFile}#backgrounds/${b.name}` };
    if (prev) loc.preview = prev;
    const it = base('background', slug(b.name), b.label || b.name, b.looks, [b.name, b.kind, ...(b.families || []), ...(b.videos || []), ...(b.pages || []), b.best_page, b.content_on].filter(Boolean), loc, {
      ...(b.props ? { props: b.props } : {}),
    });
    it._src = { catalogFile: bgFile, entry: b };
    it._tier = 'any';
    add(it);
  }

  // ----- hooks -----
  const hookFile = 'library/hooks/index.json';
  const hooks = readJson(hookFile);
  const hookLicence = new Map(hooks.sources.map((s) => [s.id, `${s.licence} (${s.name.replace(/\s*\(.*$/, '')})`]));
  hookLicence.set('studio', 'own');
  for (const h of hooks.formulas) {
    const lic = hookLicence.get(h.source);
    if (!lic) { errors.push(`hook:${h.id}: source "${h.source}" is not listed in ${hookFile}`); continue; }
    const it = base('hook', slug(h.id), h.name, h.spoken, [h.family, h.source, h.status, ...(h.suits?.types || []), ...(h.suits?.platforms || []), ...(h.suits?.awareness || [])], {
      file: hookFile,
      catalog: `${hookFile}#formulas/${h.id}`,
    }, {});
    it.license = lic;
    it._src = { catalogFile: hookFile, entry: h };
    add(it);
  }

  // ----- sounds -----
  const credits = readSrc('library/sounds/CREDITS.md');
  if (!/CC0/.test(credits)) errors.push('library/sounds/CREDITS.md does not mention CC0');
  const soundById = new Map();
  for (const g of fs.readdirSync(abs('library/sounds'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
    const indexes = fs.readdirSync(abs(`library/sounds/${g}`)).filter((n) => n.endsWith('.json') && !n.endsWith('.beats.json')).sort();
    for (const n of indexes) {
      const idx = `library/sounds/${g}/${n}`;
      const doc = readJson(idx);
      if (!Array.isArray(doc.sounds)) continue;
      for (const s of doc.sounds) {
        if (!s.licence) { errors.push(`sound:${s.id}: no licence in ${idx}`); continue; }
        const lic = s.author ? `${s.licence} (${s.author})` : s.licence;
        const it = base('sound', slug(s.id), s.name, s.use_for || s.about || s.name, [doc.group || g, ...(s.feel || []), s.source].filter(Boolean), {
          file: `library/sounds/${s.file}`,
          catalog: `${idx}#sounds/${s.id}`,
        });
        it.license = lic;
        it._src = { catalogFile: idx, entry: s };
        soundById.set(s.id, it);
        add(it);
      }
    }
  }
  const kitFile = 'library/sounds/kit.json';
  const kit = readJson(kitFile);
  for (const [slot, def] of Object.entries(kit.slots)) {
    const target = soundById.get(def.library);
    if (!target) { errors.push(`sound:slot-${slot}: kit slot points at ${def.library}, which is not in the sound library`); continue; }
    const it = base('sound', `slot-${slug(slot)}`, `Kit slot: ${slot}`, def.about, ['kit-slot', def.layer, ...target.tags], { file: kitFile, catalog: `${kitFile}#slots/${slot}` }, { props: { library: def.library, layer: def.layer } });
    it.license = target.license;
    it._src = { catalogFile: kitFile, entry: def };
    add(it);
  }

  // ----- references -----
  const refFile = 'library/references/index.json';
  const refs = readJson(refFile);
  for (const r of refs) {
    const stem = path.basename(r.file).replace(/\.[^.]+$/, '');
    const file = r.study_card && exists(`library/references/${r.study_card}`) ? `library/references/${r.study_card}` : r.profile ? `library/references/${r.profile}` : null;
    if (!file) { errors.push(`reference:${stem}: neither a study card nor a profile is listed`); continue; }
    const it = base('reference', slug(stem), r.title, `${r.brand} ${r.type} film, ${Math.round(r.seconds)} s, ${r.shape}${r.motion_studied ? ', motion studied' : ''}`, [r.brand, r.type, r.shape, r.motion_studied ? 'motion-studied' : 'not-motion-studied'], {
      file,
      catalog: `${refFile}#${r.file}`,
    });
    it.license = 'reference only: third-party film, not included in this repository';
    it._src = { catalogFile: refFile, entry: r };
    add(it);
  }

  // ----- workflows: video types, stages, beat frameworks -----
  for (const f of fs.readdirSync(abs('knowledge/playbooks')).filter((n) => n.endsWith('.md')).sort()) {
    const rel = `knowledge/playbooks/${f}`;
    const text = readSrc(rel);
    const title = /^#\s*Playbook:\s*(.+)$/m.exec(text);
    const para = text.split('\n').slice(1).join('\n').trim().split(/\n\s*\n/)[0];
    const rows = {};
    for (const l of text.split('\n')) {
      const m = /^\|\s*(Length|Energy preset|Stage)\s*\|\s*(.+?)\s*\|\s*$/.exec(l);
      if (m && !rows[slug(m[1]).replace(/-/g, '_')]) rows[slug(m[1]).replace(/-/g, '_')] = flat(m[2]);
    }
    const type = f.replace(/\.md$/, '');
    const it = base('workflow', type, title ? title[1] : type, para, ['video-type', 'playbook', type], { file: rel, catalog: `${rel}#playbook` }, { props: rows });
    it._src = { catalogFile: rel, entry: {} };
    add(it);
  }
  const skillFile = '.claude/skills/video-studio/SKILL.md';
  for (const l of readSrc(skillFile).split('\n')) {
    const m = /^\|\s*([0-9A-Za-z–-]+)\s*\|\s*(.+?)\s*\|\s*`(stages\/[^`]+)`\s*\|\s*(.+?)\s*\|\s*$/.exec(l);
    if (!m || m[1] === '#') continue;
    const file = `.claude/skills/video-studio/${m[3]}`;
    const stem = path.basename(m[3]).replace(/\.md$/, '');
    const it = base('workflow', `stage-${stem}`, `Stage ${m[1]}: ${m[2]}`, `Stage ${m[1]} of the production line: ${m[2]}. Approval: ${m[4]}.`, ['stage', 'production-line', `stage-${m[1].toLowerCase()}`], { file, catalog: `${skillFile}#stages` }, { props: { stage: m[1], approval: m[4] } });
    it._src = { catalogFile: skillFile, entry: {} };
    add(it);
  }
  const fwFile = 'library/structure/frameworks.json';
  const fw = readJson(fwFile);
  const fwLicence = new Map(fw.sources.map((s) => [s.id, s.licence === 'own' ? 'own' : `${s.licence} (${s.name.replace(/\s*\(.*$/, '')})`]));
  for (const f of fw.frameworks) {
    const lic = fwLicence.get(f.source);
    if (!lic) { errors.push(`workflow:framework-${f.id}: source "${f.source}" is not listed in ${fwFile}`); continue; }
    const it = base('workflow', `framework-${slug(f.id)}`, f.name, f.what, ['framework', 'beats', f.source, ...(f.suits?.types || [])], { file: fwFile, catalog: `${fwFile}#frameworks/${f.id}` }, {
      props: { beats: (f.beats || []).map((b) => b.id), lengths: f.suits?.lengths || [] },
    });
    it.license = lic;
    it._src = { catalogFile: fwFile, entry: f };
    add(it);
  }

  // ----- presets: design styles, capture looks, saved styles -----
  const stylesFile = 'knowledge/craft/13-design-styles.md';
  const styles = readSrc(stylesFile);
  const sections = styles.split(/^## /m).slice(1);
  for (const sec of sections) {
    const head = /^(\d+)\.\s*(.+)$/m.exec(sec.split('\n')[0]);
    if (!head) continue;
    const lines = sec.split('\n').slice(1);
    const para = lines.find((l) => l.trim() && !l.startsWith('|'));
    const rows = {};
    for (const l of lines) {
      const m = /^\|\s*([^|]+?)\s*\|\s*(.+?)\s*\|\s*$/.exec(l);
      if (m && !/^-+$/.test(m[1])) rows[slug(m[1]).replace(/-/g, '_')] = flat(m[2]);
    }
    const it = base('preset', `design-${slug(head[2])}`, `${head[2]} (design style)`, firstSentence(para || head[2]), ['design-style', slug(head[2]), ...String(rows.suits || '').split(/,| and /)], {
      file: stylesFile,
      catalog: `${stylesFile}#${slug(head[2])}`,
    }, { props: rows });
    it._src = { catalogFile: stylesFile, entry: {} };
    it._tier = 'any';
    add(it);
  }

  const looksFile = 'engine/src/kit/capture/looks.ts';
  const looksText = readSrc(looksFile);
  const block = (text, from) => {
    const open = text.indexOf('{', from);
    let d = 0;
    for (let i = open; i < text.length; i++) {
      if (text[i] === '{') d++;
      else if (text[i] === '}' && --d === 0) return text.slice(open + 1, i);
    }
    return '';
  };
  const lookFields = (b) => {
    const o = {};
    for (const m of b.matchAll(/\b(cursor|cursorSize|click|staging|pace|marks|trail|keyCaps)\s*:\s*('[^']*'|[\d.]+|true|false)/g)) o[m[1]] = m[2].replace(/'/g, '');
    const t = /transitions\s*:\s*\[([^\]]*)\]/.exec(b);
    if (t) o.transitions = t[1].split(',').map((x) => x.replace(/['\s]/g, '')).filter(Boolean).join(', ');
    return o;
  };
  const baseIdx = looksText.indexOf('const base: Look');
  const baseFields = baseIdx >= 0 ? lookFields(block(looksText, baseIdx)) : {};
  const lookNamesDecl = /lookNames\s*=\s*\[([^\]]*)\]/.exec(looksText);
  const declared = lookNamesDecl ? lookNamesDecl[1].split(',').map((x) => x.replace(/['\s]/g, '')).filter(Boolean) : [];
  const recStart = looksText.indexOf('export const looks');
  const rec = looksText.slice(recStart);
  const found = [];
  const entries = new Map();
  for (const m of rec.matchAll(/(?:\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*)?(?:'([a-z-]+)'|\b([a-z]+))\s*:\s*\{/g)) {
    const name = m[2] || m[3];
    if (!declared.includes(name) || entries.has(name)) continue;
    entries.set(name, { doc: m[1], fields: { ...baseFields, ...lookFields(block(rec, m.index + m[0].length - 1)) } });
  }
  for (const m of rec.matchAll(/(?:\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*)?'([a-z-]+)'\s*:\s*base\s*,/g)) {
    if (declared.includes(m[2]) && !entries.has(m[2])) entries.set(m[2], { doc: m[1], fields: { ...baseFields } });
  }
  for (const name of declared) {
    const e = entries.get(name);
    if (!e) continue;
    found.push(name);
    const fields = e.fields;
    const doc = flat((e.doc || '').replace(/^\s*\* ?/gm, ''));
    const it = base('preset', `look-${slug(name)}`, `${name} (capture look)`, firstSentence(doc).length > 25 ? firstSentence(doc) : `Capture look: ${fields.cursor} pointer, ${fields.click} click, ${fields.staging} staging, ${fields.pace} pace`, ['capture-look', name, fields.staging, fields.pace, fields.cursor], {
      file: looksFile,
      export: 'looks',
      catalog: `${looksFile}#looks['${name}']`,
    }, { props: fields });
    it._src = { catalogFile: looksFile, entry: {} };
    it._tier = 'any';
    add(it);
  }
  if (!comps.get(looksFile)?.all.has('looks')) errors.push(`${looksFile} does not export looks`);
  if (declared.join() !== found.join()) errors.push(`${looksFile}: lookNames (${declared.join(', ')}) and the looks table (${found.join(', ')}) disagree`);

  // Saved styles (tools/plan/style.mjs save): brands/<brand>/styles/<style>/style.json. Only the public brands are listed.
  if (exists('brands')) {
    for (const b of fs.readdirSync(abs('brands'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
      const dir = `brands/${b}/styles`;
      if (!exists(dir)) continue;
      for (const s of fs.readdirSync(abs(dir), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
        const sf = `${dir}/${s}/style.json`;
        if (!exists(sf)) continue;
        if (!PUBLIC_BRANDS.has(b)) { omitted.path++; continue; }
        const st = readJson(sf);
        const it = base('preset', `style-${slug(b)}-${slug(s)}`, `${b}/${s} (saved style)`, `Saved style: ${st.kind || st.type || 'film'}, ${(st.structure || []).length} scenes${st.from_job ? `, from job ${st.from_job}` : ''}`, ['saved-style', b, st.kind, st.type], { file: sf, catalog: `${sf}#style` });
        it._src = { catalogFile: sf, entry: st };
        it._tier = 'any';
        add(it);
      }
    }
  }

  // ----- components: every real React component export in engine/src/kit/** and engine/src/library/** -----
  const compItems = [];
  for (const [file, info] of comps) {
    for (const c of info.components) {
      const mv = moveByFileExport.get(`${file}#${c.name}`);
      const doc = mv ? mv.does : docAbove(info.text, c.index);
      const dir = path.dirname(file).split('/').pop();
      const props = propsOf(info.text, c.name) || (mv?.props && Object.keys(mv.props).length ? mv.props : null);
      const gpu = /paper-design|@react-three|from 'three'|webgl/i.test(info.text);
      compItems.push({ file, name: c.name, dir, doc: doc || `React component ${c.name}, exported from ${file}`, props, gpu, family: mv?.family });
    }
  }
  const nameCount = new Map();
  for (const c of compItems) nameCount.set(kebab(c.name), (nameCount.get(kebab(c.name)) || 0) + 1);
  for (const c of compItems) {
    const k = kebab(c.name);
    const id = nameCount.get(k) > 1 ? `${slug(c.dir)}-${k}` : k;
    const it = base('component', id, c.name, c.doc, ['component', c.dir, c.family, kebab(c.name)], { file: c.file, export: c.name }, c.props ? { props: c.props } : {});
    it._src = { catalogFile: c.file, entry: {} };
    it._tier = c.gpu ? 'gpu' : 'any';
    add(it);
  }

  // ----- privacy, availability, order -----
  const final = [];
  for (const it of items) {
    const files = [it.locator.file, it.locator.preview, it.locator.catalog?.split('#')[0]].filter(Boolean);
    if (files.some((f) => isPrivatePath(f))) { omitted.path++; continue; }
    if (it._src && jsonDropped(it._src.catalogFile, it._src.entry, manifest)) { omitted.json_drop++; continue; }
    const text = JSON.stringify({ ...it, _src: undefined, _tier: undefined });
    if (bannedIn(text, manifest)) { omitted.banned++; continue; }
    const source = exists(it.locator.file);
    const exc = excludedBy(it.locator.file, manifest) || (it.locator.catalog && excludedBy(it.locator.catalog.split('#')[0], manifest));
    const customer = source && !exc;
    const previewExists = !!it.locator.preview && exists(it.locator.preview);
    const pexc = it.locator.preview ? excludedBy(it.locator.preview, manifest) : null;
    const preview_customer = previewExists && !pexc && customer;
    const availability = { source, customer, preview_customer };
    const reason = !source ? 'the locator file is missing in the source tree' : exc ? `excluded from the customer release: ${exc}` : it.locator.preview && !previewExists ? 'preview file is missing' : pexc ? `preview excluded from the customer release: ${pexc}` : null;
    if (reason) availability.reason = reason;
    const out = { id: it.id, kind: it.kind, name: it.name, summary: it.summary, tags: it.tags, locator: it.locator };
    if (it.props) out.props = it.props;
    out.availability = availability;
    if (it.license) out.license = it.license;
    if (it._tier) out.device_tier = it._tier;
    final.push(out);
  }
  final.sort(byId);
  const seen = new Set();
  for (const it of final) {
    if (seen.has(it.id)) errors.push(`duplicate id ${it.id}`);
    seen.add(it.id);
  }
  const counts = {};
  for (const k of KINDS) counts[k] = final.filter((i) => i.kind === k).length;
  const sources = [...used].filter((f) => !isPrivatePath(f)).sort().map((file) => ({ file, sha256: sha256(file) }));
  const omitted_private = omitted.path + omitted.json_drop + omitted.banned;
  const registry = { schema: SCHEMA, sources, counts, omitted_private, items: final };
  const text = JSON.stringify(registry, null, 1) + '\n';
  const leak = bannedIn(text, manifest);
  if (leak) errors.push(`banned word /${leak}/ appears in the output`);
  return { registry, text, errors, warnings, omitted };
}

function writeAtomic(rel, text) {
  const file = path.isAbsolute(rel) ? rel : abs(rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

// ---------- check ----------
export function checkRegistry({ manifest = null, release = null } = {}) {
  const lines = [];
  const errors = [];
  if (!exists(REGISTRY)) return { lines, errors: [`${REGISTRY} does not exist: run build`], mismatches: [] };
  const text = readText(REGISTRY);
  let reg;
  try { reg = JSON.parse(text); } catch (e) { return { lines, errors: [`${REGISTRY} is not valid JSON: ${e.message}`], mismatches: [] }; }
  if (reg.schema !== SCHEMA) errors.push(`schema is ${reg.schema}, expected ${SCHEMA}`);
  for (const k of ['sources', 'counts', 'omitted_private', 'items']) if (!(k in reg)) errors.push(`missing top-level key ${k}`);
  if (errors.length) return { lines, errors, mismatches: [] };
  for (const s of reg.sources) {
    if (!exists(s.file)) errors.push(`source ${s.file} no longer exists: rebuild`);
    else if (sha256(s.file) !== s.sha256) errors.push(`source ${s.file} changed since the build: rebuild`);
  }
  const comps = scanComponentSources();
  const ids = new Set();
  let prev = '';
  const counts = {};
  for (const it of reg.items) {
    const where = it.id || '(no id)';
    if (!/^[a-z]+:[a-z0-9][a-z0-9-]*$/.test(it.id || '')) errors.push(`${where}: id is not <kind>:<slug>`);
    if (ids.has(it.id)) errors.push(`${where}: duplicate id`);
    ids.add(it.id);
    if (it.id < prev) errors.push(`${where}: not sorted by id`);
    prev = it.id;
    if (!KINDS.includes(it.kind) || it.id.split(':')[0] !== it.kind) errors.push(`${where}: kind "${it.kind}" does not match the id`);
    counts[it.kind] = (counts[it.kind] || 0) + 1;
    if (!it.name) errors.push(`${where}: no name`);
    if (typeof it.summary !== 'string' || !it.summary || it.summary.length > 140) errors.push(`${where}: summary must be 1 to 140 characters`);
    if (!Array.isArray(it.tags)) errors.push(`${where}: tags is not an array`);
    if (!it.locator?.file) errors.push(`${where}: no locator.file`);
    else {
      if (!exists(it.locator.file)) errors.push(`${where}: locator file ${it.locator.file} does not exist`);
      if (it.locator.preview && it.availability?.preview_customer && !exists(it.locator.preview)) errors.push(`${where}: preview ${it.locator.preview} does not exist`);
      const cf = it.locator.catalog?.split('#')[0];
      if (cf && !exists(cf)) errors.push(`${where}: catalog ${cf} does not exist`);
      if (it.locator.export) {
        const info = comps.get(it.locator.file);
        const ok = info ? info.all.has(it.locator.export) : parseExports(exists(it.locator.file) ? readText(it.locator.file) : '', it.locator.file.endsWith('x')).all.has(it.locator.export);
        if (!ok) errors.push(`${where}: ${it.locator.file} does not export ${it.locator.export}`);
      }
    }
    const a = it.availability;
    if (!a || ['source', 'customer', 'preview_customer'].some((k) => typeof a[k] !== 'boolean')) errors.push(`${where}: availability needs boolean source, customer and preview_customer`);
    if (['sound', 'reference'].includes(it.kind) && !it.license) errors.push(`${where}: no license`);
    if (it.kind === 'workflow' && it.id.startsWith('workflow:framework-') && !it.license) errors.push(`${where}: framework without a license`);
    if (it.device_tier && !TIERS.includes(it.device_tier)) errors.push(`${where}: device_tier ${it.device_tier} is not any, gpu or heavy`);
  }
  for (const k of KINDS) if ((reg.counts[k] || 0) !== (counts[k] || 0)) errors.push(`counts.${k} is ${reg.counts[k]}, but there are ${counts[k] || 0} items`);
  lines.push(`schema ${reg.schema}: ${reg.items.length} items, ${reg.sources.length} sources, omitted_private ${reg.omitted_private}`);
  lines.push(`counts: ${KINDS.map((k) => `${k} ${reg.counts[k] ?? 0}`).join(', ')}`);

  if (manifest) {
    const hit = bannedIn(text, manifest);
    if (hit) errors.push(`privacy scan: banned word /${hit}/ appears in ${REGISTRY}`);
    else lines.push(`privacy scan: passed (${manifest.banned.length} banned words, ${path.basename(manifest.file)})`);
  } else lines.push('privacy scan: not run (no manifest: pass --manifest or set DAMEX_RELEASE_MANIFEST)');

  const mismatches = [];
  if (release) {
    const dir = path.resolve(release);
    if (!fs.existsSync(dir)) errors.push(`release folder ${dir} does not exist`);
    else {
      const rcomps = new Map();
      const rinfo = (f) => {
        if (!rcomps.has(f)) rcomps.set(f, exists(f, dir) ? parseExports(readText(f, dir), f.endsWith('x')) : null);
        return rcomps.get(f);
      };
      let n = 0;
      for (const it of reg.items) {
        if (!it.availability?.customer) continue;
        n++;
        if (!exists(it.locator.file, dir)) { mismatches.push({ id: it.id, file: it.locator.file, reason: 'file not in the packaged folder' }); continue; }
        if (it.locator.export && !rinfo(it.locator.file)?.all.has(it.locator.export)) mismatches.push({ id: it.id, file: it.locator.file, reason: `packaged file does not export ${it.locator.export}` });
        const cf = it.locator.catalog?.split('#')[0];
        if (cf && !exists(cf, dir)) mismatches.push({ id: it.id, file: cf, reason: 'catalog file not in the packaged folder' });
      }
      lines.push(`release ${dir}: ${n} customer items checked, ${mismatches.length} mismatches`);
      const byReason = {};
      for (const m of mismatches) byReason[m.reason] = (byReason[m.reason] || 0) + 1;
      for (const [r, c] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) lines.push(`  ${c} x ${r}`);
      const byKind = {};
      for (const m of mismatches) byKind[m.id.split(':')[0]] = (byKind[m.id.split(':')[0]] || 0) + 1;
      if (mismatches.length) lines.push(`  by kind: ${Object.entries(byKind).sort().map(([k, c]) => `${k} ${c}`).join(', ')}`);
      for (const m of mismatches) lines.push(`MISMATCH ${m.id} ${m.file} (${m.reason})`);
    }
  }
  return { lines, errors, mismatches };
}

// ---------- find / get / kinds ----------
function loadRegistry() {
  if (!exists(REGISTRY)) { console.error(`${REGISTRY} not found. Run: node tools/library/registry.mjs build`); process.exit(1); }
  return JSON.parse(readText(REGISTRY));
}
const yn = (b) => (b ? 'y' : 'n');
export function oneLine(it) {
  const a = it.availability;
  return `${it.id} | ${cut(it.name, 40)} | ${cut(it.summary, 80)} | src=${yn(a.source)} cust=${yn(a.customer)} prev=${yn(a.preview_customer)}`;
}
export function findItems(items, words, { kind, tag, customer, limit } = {}) {
  let pool = items;
  if (kind) pool = pool.filter((i) => i.kind === kind);
  if (tag) pool = pool.filter((i) => i.tags.includes(String(tag).toLowerCase()));
  if (customer) pool = pool.filter((i) => i.availability.customer);
  const ws = words.map((w) => w.toLowerCase()).filter(Boolean);
  let n = Number.parseInt(limit, 10);
  if (!Number.isFinite(n) || n < 1) n = FIND_MAX;
  n = Math.min(n, FIND_MAX);
  const scored = pool.map((it) => {
    let score = 0;
    let hits = 0;
    for (const w of ws) {
      let h = 0;
      if (it.name.toLowerCase().includes(w)) h += 5;
      if (it.id.includes(w)) h += 4;
      if (it.tags.some((t) => t.includes(w))) h += 3;
      if (it.summary.toLowerCase().includes(w)) h += 1;
      if (h) { hits++; score += h; }
    }
    return { it, score, hits };
  });
  let ranked = ws.length ? scored.filter((s) => s.hits === ws.length) : scored;
  if (ws.length && !ranked.length) ranked = scored.filter((s) => s.hits > 0);
  ranked.sort((a, b) => b.hits - a.hits || b.score - a.score || byId(a.it, b.it));
  return { total: ranked.length, shown: ranked.slice(0, n).map((s) => s.it) };
}

// ---------- command line ----------
function main(argv) {
  const [cmd, ...args] = argv;
  // The release recipe is versioned with the source (release/manifest.json); a flag or the variable overrides it.
  const inTree = path.join(ROOT, 'release', 'manifest.json');
  const manifestPath = flag(args, 'manifest') || process.env.DAMEX_RELEASE_MANIFEST || (fs.existsSync(inTree) ? inTree : null);
  if (cmd === 'build') {
    let manifest = null;
    try { manifest = loadManifest(manifestPath); } catch (e) { console.error(`cannot read the manifest ${manifestPath}: ${e.message}`); process.exit(1); }
    const { registry, text, errors, warnings, omitted } = buildRegistry({ manifest });
    for (const w of warnings) console.error(`warning: ${w}`);
    if (errors.length) {
      for (const e of errors) console.error(`error: ${e}`);
      console.error(`build failed with ${errors.length} error(s); nothing written`);
      process.exit(1);
    }
    writeAtomic(flag(args, 'out') || REGISTRY, text);
    console.log(`${flag(args, 'out') || REGISTRY}: ${registry.items.length} items, ${registry.sources.length} sources`);
    console.log(`counts: ${KINDS.map((k) => `${k} ${registry.counts[k]}`).join(', ')}`);
    console.log(`omitted_private: ${registry.omitted_private} (folders ${omitted.path}, json_drop ${omitted.json_drop}, banned words ${omitted.banned})`);
    console.log(manifest ? `privacy scan: passed (${manifest.banned.length} banned words, ${path.basename(manifest.file)})` : 'privacy scan: not run (no manifest)');
    if (warnings.length) console.log(`warnings: ${warnings.length} (catalog file paths that are stale; the real export was used)`);
    return;
  }
  if (cmd === 'check') {
    let manifest = null;
    try { manifest = loadManifest(manifestPath); } catch (e) { console.error(`cannot read the manifest ${manifestPath}: ${e.message}`); process.exit(1); }
    const { lines, errors, mismatches } = checkRegistry({ manifest, release: flag(args, 'release') || null });
    for (const l of lines) console.log(l);
    for (const e of errors.slice(0, 50)) console.log(`ERROR ${e}`);
    if (errors.length > 50) console.log(`... and ${errors.length - 50} more errors`);
    console.log(errors.length ? `check failed: ${errors.length} error(s)` : 'check passed');
    process.exit(errors.length || (has(args, 'strict') && mismatches.length) ? 1 : 0);
  }
  if (cmd === 'find') {
    const valueFlags = new Set(['kind', 'tag', 'limit', 'manifest']);
    const words = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i].startsWith('--')) { if (valueFlags.has(args[i].slice(2))) i++; } else words.push(args[i]);
    }
    const reg = loadRegistry();
    const { total, shown } = findItems(reg.items, words.flatMap((w) => w.split(/\s+/)), { kind: flag(args, 'kind'), tag: flag(args, 'tag'), customer: has(args, 'customer'), limit: flag(args, 'limit') });
    for (const it of shown) console.log(oneLine(it));
    if (!shown.length) console.error('no match');
    else if (total > shown.length) console.error(`(${total - shown.length} more: narrow with --kind, --tag or more words)`);
    return;
  }
  if (cmd === 'get') {
    const id = args[0];
    if (!id) { console.error('usage: registry.mjs get <id>'); process.exit(2); }
    const reg = loadRegistry();
    const it = reg.items.find((i) => i.id === id);
    if (!it) {
      const near = findItems(reg.items, id.split(/[:\-\s]+/).slice(-2), { limit: 3 }).shown.map((i) => i.id);
      console.error(`no item ${id}${near.length ? `; did you mean ${near.join(', ')}?` : ''}`);
      process.exit(1);
    }
    console.log(JSON.stringify(it, null, 1));
    return;
  }
  if (cmd === 'kinds') {
    const reg = loadRegistry();
    const out = KINDS.map((k) => ({ kind: k, count: reg.counts[k] ?? 0, examples: reg.items.filter((i) => i.kind === k).slice(0, 3).map((i) => i.id) }));
    if (has(args, 'json')) console.log(JSON.stringify(out, null, 1));
    else for (const o of out) console.log(`${o.kind.padEnd(10)} ${String(o.count).padStart(4)}  ${o.examples.join(', ')}`);
    return;
  }
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 16).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(cmd ? 2 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
