#!/usr/bin/env node
/* global process, console */
/**
 * scope-css.mjs: turn the captured Tulvo app CSS into a stylesheet that only
 * applies inside an element with class "tulvo-app".
 *
 * Re-run any time the captures change:
 *   node src/products/tulvo/tools/scope-css.mjs                # default inputs/outputs
 *   node src/products/tulvo/tools/scope-css.mjs --in a.css b.css --out x.css --vw 1512 --vh 805
 *
 * What it does (in order):
 *  1. Parses every input file (Chrome-serialised cssText, one rule per line) into a
 *     small rule tree. No dependencies: a tiny tokenizer that respects strings,
 *     comments, escapes and nested blocks.
 *  2. Merges the files (they are the same app bundle plus lazily loaded chunks):
 *     ordered sequence merge, so rules that exist only in one capture are inserted
 *     next to their neighbours. Then dedupes identical rules keeping the LAST copy
 *     (cascade-safe: the surviving copy wins over everything the removed copy won over).
 *  3. Drops things that are not the app or cannot work offline:
 *     - rules injected by the Claude-in-Chrome extension (#claude-agent-*, claude-pulse)
 *     - @import (Google Fonts CSS; Inter is loaded by fonts.ts instead)
 *     - @font-face (KaTeX fonts served from the app origin; unused by the ad screens)
 *     - selectors that need a `.dark` ancestor (the ad is light mode only)
 *     - url(...) pointing at app-relative assets is replaced by an empty data URI
 *       (css-loader would otherwise try to resolve them at bundle time)
 *  4. Bakes width/height/hover/pointer/colour-scheme/motion media queries for the
 *     captured viewport (1512x805, desktop pointer, light, no reduced motion), so the
 *     rebuilt UI keeps its desktop layout even when rendered inside a 1080x1920 ad.
 *     Queries it cannot decide are kept as-is.
 *  5. Rewrites viewport units (vh/dvh/svh/lvh/vw/.../vmin/vmax) in declaration values
 *     to calc(N * var(--tulvo-vh)) etc. The app root sets --tulvo-vw/--tulvo-vh, so
 *     h-screen == 805px regardless of the composition size.
 *     Also maps `font-family: Inter, ...` to `"Tulvo Inter", Inter, ...` (see fonts.ts).
 *  6. Scopes selectors:
 *       :root / :host -> .tulvo-app.tulvo-app   (same specificity bump as everything else)
 *       html          -> div.tulvo-app
 *       body          -> :where(.tulvo-app) > div.tulvo-body
 *       #root         -> .tulvo-root
 *       *             -> .tulvo-app, .tulvo-app *   (root included, like html in the app)
 *       anything else -> .tulvo-app <selector>
 *     Every app selector therefore gains exactly (0,1,0) specificity, which keeps the
 *     app's internal cascade intact. Rules stay unlayered, so inside .tulvo-app they
 *     beat the studio's own Tailwind v4 layers; outside .tulvo-app nothing matches.
 *  7. Renames @keyframes to tulvo-<name> (keyframe names are global) and rewrites
 *     animation / animation-name references.
 *  8. Appends a motion kill-switch: no CSS animations or transitions inside .tulvo-app.
 *     Remotion renders frames out of order; every movement must come from props.
 *  9. Prepends a small compatibility block that neutralises the studio's own Tailwind v4
 *     utilities where they would stack on the app's v3 ones (individual rotate/scale/translate
 *     properties, space-x/y first-child margins, table-cell padding). See `compat` below.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_IN_DIR =
  "research/ui-live/dom/css";
const DEFAULT_OUT = path.resolve(__dirname, "..", "app.scoped.css");

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
const opt = { in: [], out: DEFAULT_OUT, vw: 1512, vh: 805, scope: "tulvo-app", keepDark: false };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--in") {
    while (argv[i + 1] && !argv[i + 1].startsWith("--")) opt.in.push(argv[++i]);
  } else if (a === "--out") opt.out = path.resolve(argv[++i]);
  else if (a === "--vw") opt.vw = Number(argv[++i]);
  else if (a === "--vh") opt.vh = Number(argv[++i]);
  else if (a === "--keep-dark") opt.keepDark = true;
  else if (a === "--help" || a === "-h") {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0]);
    process.exit(0);
  } else throw new Error(`Unknown argument ${a}`);
}
if (opt.in.length === 0) {
  opt.in = fs
    .readdirSync(DEFAULT_IN_DIR)
    .filter((f) => f.endsWith(".css"))
    .map((f) => path.join(DEFAULT_IN_DIR, f));
}
const S = `.${opt.scope}`;
const stats = { dropped: {}, keyframes: 0, urls: new Set(), mediaBaked: 0, mediaKept: new Set(), vunits: 0 };
const bump = (k, n = 1) => (stats.dropped[k] = (stats.dropped[k] || 0) + n);

// ---------------------------------------------------------------- parser
// Node shapes:
//   { type: "rule", prelude, body }                     style rule (body kept raw)
//   { type: "at", name, prelude, children }             grouping at-rule (@media, @supports, ...)
//   { type: "at", name, prelude, body }                 at-rule with raw block (@font-face, @keyframes, ...)
//   { type: "at", name, prelude, statement: true }      @import / @layer a, b; / @charset
const GROUPING = new Set(["media", "supports", "container", "layer", "document", "-moz-document", "scope", "starting-style"]);

function skipString(src, i) {
  const q = src[i];
  i++;
  while (i < src.length && src[i] !== q) {
    if (src[i] === "\\") i++;
    i++;
  }
  return i + 1;
}

/** Index of the "}" matching the "{" at `open`. */
function matchBrace(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "\\") { i++; continue; }
    if (c === '"' || c === "'") { i = skipString(src, i) - 1; continue; }
    if (c === "/" && src[i + 1] === "*") { i = src.indexOf("*/", i + 2) + 1; continue; }
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return i; }
  }
  throw new Error(`Unbalanced braces at ${open}`);
}

function parseList(src) {
  const nodes = [];
  let i = 0;
  while (i < src.length) {
    // skip whitespace + comments
    if (/\s/.test(src[i])) { i++; continue; }
    if (src[i] === "/" && src[i + 1] === "*") { i = src.indexOf("*/", i + 2) + 2; continue; }
    // read prelude up to "{" or ";"
    let j = i, paren = 0, bracket = 0;
    for (; j < src.length; j++) {
      const c = src[j];
      if (c === "\\") { j++; continue; }
      if (c === '"' || c === "'") { j = skipString(src, j) - 1; continue; }
      if (c === "(") paren++;
      else if (c === ")") paren--;
      else if (c === "[") bracket++;
      else if (c === "]") bracket--;
      else if (paren === 0 && bracket === 0 && (c === "{" || c === ";")) break;
    }
    const prelude = src.slice(i, j).trim();
    if (j >= src.length) {
      if (prelude) console.warn("scope-css: trailing junk ignored:", prelude.slice(0, 80));
      break;
    }
    if (src[j] === ";") {
      if (prelude.startsWith("@")) {
        const name = prelude.slice(1).match(/^[\w-]+/)[0].toLowerCase();
        nodes.push({ type: "at", name, prelude: prelude.slice(1 + name.length).trim(), statement: true });
      } // a stray declaration at list level: ignore
      i = j + 1;
      continue;
    }
    const close = matchBrace(src, j);
    const body = src.slice(j + 1, close);
    if (prelude.startsWith("@")) {
      const name = prelude.slice(1).match(/^[\w-]+/)[0].toLowerCase();
      const p = prelude.slice(1 + name.length).trim();
      if (GROUPING.has(name)) nodes.push({ type: "at", name, prelude: p, children: parseList(body) });
      else nodes.push({ type: "at", name, prelude: p, body });
    } else {
      nodes.push({ type: "rule", prelude, body });
    }
    i = close + 1;
  }
  return nodes;
}

// ---------------------------------------------------------------- serialise / keys
const squash = (s) => s.replace(/\s+/g, " ").trim();
function keyOf(n) {
  if (n._key) return n._key;
  let k;
  if (n.type === "rule") k = `R ${squash(n.prelude)}{${squash(n.body)}}`;
  else if (n.statement) k = `S @${n.name} ${squash(n.prelude)};`;
  else if (n.children) k = `G @${n.name} ${squash(n.prelude)}{${n.children.map(keyOf).join("")}}`;
  else k = `B @${n.name} ${squash(n.prelude)}{${squash(n.body)}}`;
  n._key = k;
  return k;
}

function serialize(nodes, indent = "") {
  const out = [];
  for (const n of nodes) {
    if (n.type === "rule") out.push(`${indent}${n.prelude} { ${squash(n.body)} }`);
    else if (n.statement) out.push(`${indent}@${n.name}${n.prelude ? " " + n.prelude : ""};`);
    else if (n.children) {
      out.push(`${indent}@${n.name}${n.prelude ? " " + n.prelude : ""} {`);
      out.push(serialize(n.children, indent + "  "));
      out.push(`${indent}}`);
    } else {
      const inner = n.body.trim().split("\n").map((l) => indent + "  " + l.trim()).join("\n");
      out.push(`${indent}@${n.name}${n.prelude ? " " + n.prelude : ""} {\n${inner}\n${indent}}`);
    }
  }
  return out.join("\n");
}

// ---------------------------------------------------------------- merge + dedupe
function mergeLists(A, B) {
  const res = A.slice();
  let cursor = -1;
  for (const n of B) {
    const k = keyOf(n);
    let idx = -1;
    for (let t = cursor + 1; t < res.length; t++) if (keyOf(res[t]) === k) { idx = t; break; }
    if (idx === -1) for (let t = 0; t <= cursor; t++) if (keyOf(res[t]) === k) { idx = -2; break; }
    if (idx >= 0) { cursor = idx; continue; }
    if (idx === -2) continue; // present earlier: already covered
    if (n.children) {
      // same grouping at-rule right after the cursor: merge its children instead of duplicating it
      for (let t = cursor + 1; t < Math.min(res.length, cursor + 4); t++) {
        const m = res[t];
        if (m.children && m.name === n.name && squash(m.prelude) === squash(n.prelude)) {
          res[t] = { ...m, _key: undefined, children: mergeLists(m.children, n.children) };
          idx = t;
          break;
        }
      }
      if (idx >= 0) { cursor = idx; continue; }
    }
    res.splice(cursor + 1, 0, n);
    cursor++;
  }
  return res;
}

function dedupe(nodes) {
  const seen = new Set();
  const out = [];
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i].children ? { ...nodes[i], _key: undefined, children: dedupe(nodes[i].children) } : nodes[i];
    const k = keyOf(n);
    if (seen.has(k)) { bump("duplicate rules"); continue; }
    seen.add(k);
    out.push(n);
  }
  return out.reverse();
}

// ---------------------------------------------------------------- selector utils
/** Split on top-level commas (outside (), [] and strings). */
function splitTop(sel, sep = ",") {
  const parts = [];
  let depth = 0, last = 0;
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (c === "\\") { i++; continue; }
    if (c === '"' || c === "'") { i = skipString(sel, i) - 1; continue; }
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (c === sep && depth === 0) { parts.push(sel.slice(last, i)); last = i + 1; }
  }
  parts.push(sel.slice(last));
  return parts.map((s) => s.trim()).filter(Boolean);
}

/** First compound selector of a complex selector + the remainder (starting at the combinator). */
function firstCompound(sel) {
  let depth = 0;
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (c === "\\") { i++; continue; }
    if (c === '"' || c === "'") { i = skipString(sel, i) - 1; continue; }
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (depth === 0 && (/\s/.test(c) || c === ">" || c === "+" || c === "~")) return [sel.slice(0, i), sel.slice(i)];
  }
  return [sel, ""];
}

/** Remove :not(...) arguments (so `:not(.dark)` does not count as needing .dark). */
function stripNot(sel) {
  let out = "";
  for (let i = 0; i < sel.length; i++) {
    if (sel[i] === "\\") { out += sel[i] + (sel[i + 1] || ""); i++; continue; }
    if (sel.startsWith(":not(", i)) {
      let depth = 0, j = i + 4;
      for (; j < sel.length; j++) {
        if (sel[j] === "\\") { j++; continue; }
        if (sel[j] === "(") depth++;
        else if (sel[j] === ")") { depth--; if (depth === 0) break; }
      }
      out += ":not()";
      i = j;
      continue;
    }
    out += sel[i];
  }
  return out;
}
const NEEDS_DARK = /(^|[\s>+~(,])\.dark(?![\w-])/;
const EXTENSION = /claude-agent|claude-pulse/;

function scopeComplex(sel) {
  const [first, rest] = firstCompound(sel);
  const m = first.match(/^(:root|:host|html|body)(?![\w-])(.*)$/i);
  if (m) {
    const kind = m[1].toLowerCase();
    let tail = m[2];
    let restSel = rest;
    if (kind === "html" || kind === ":root" || kind === ":host") {
      // `html body` / `html > body` -> body element
      const r = restSel.match(/^\s*>?\s*body(?![\w-])(.*)$/i);
      if (r) {
        const [bfirst, brest] = firstCompound("body" + r[1]);
        return `:where(${S}) > div.tulvo-body${bfirst.slice(4)}${brest}`;
      }
      const base = kind === "html" ? `div${S}` : `${S}${S}`;
      return `${base}${tail}${restSel}`;
    }
    return `:where(${S}) > div.tulvo-body${tail}${restSel}`;
  }
  if (first === "*") return rest ? `${S} *${rest}` : `${S}, ${S} *`;
  return `${S} ${sel.replace(/#root(?![\w-])/g, ".tulvo-root")}`;
}

function scopeSelectorList(prelude) {
  const out = [];
  for (const raw of splitTop(prelude)) {
    if (EXTENSION.test(raw)) { bump("extension selectors"); continue; }
    if (!opt.keepDark && NEEDS_DARK.test(stripNot(raw))) { bump("dark-only selectors"); continue; }
    out.push(scopeComplex(raw));
  }
  return out.length ? out.join(", ") : null;
}

// ---------------------------------------------------------------- media query baking
const env = {
  width: opt.vw, height: opt.vh, hover: "hover", "any-hover": "hover", pointer: "fine", "any-pointer": "fine",
  "prefers-color-scheme": "light", "prefers-reduced-motion": "no-preference", "prefers-contrast": "no-preference",
  orientation: opt.vw >= opt.vh ? "landscape" : "portrait", "display-mode": "browser",
};
const toPx = (v) => {
  const m = String(v).trim().match(/^(-?[\d.]+)(px|em|rem)?$/);
  if (!m) return null;
  return Number(m[1]) * (m[2] === "em" || m[2] === "rem" ? 16 : 1);
};
function evalFeature(f) {
  f = f.trim();
  // range syntax: (width >= 768px), (400px <= width < 900px)
  const range = f.match(/^([\w.-]+)\s*(<=|>=|<|>|=)\s*([\w.-]+)(?:\s*(<=|>=|<|>|=)\s*([\w.-]+))?$/);
  if (range && !f.includes(":")) {
    const cmp = (a, op, b) => (op === "<=" ? a <= b : op === ">=" ? a >= b : op === "<" ? a < b : op === ">" ? a > b : a === b);
    const val = (t) => (t === "width" || t === "height" ? env[t] : toPx(t));
    const [, a, op1, b, op2, c] = range;
    const va = val(a), vb = val(b);
    if (va == null || vb == null) return null;
    let r = cmp(va, op1, vb);
    if (op2) { const vc = val(c); if (vc == null) return null; r = r && cmp(vb, op2, vc); }
    return r;
  }
  const [nameRaw, valueRaw] = f.split(":").map((s) => s && s.trim());
  const name = nameRaw.toLowerCase();
  const value = valueRaw === undefined ? undefined : valueRaw.toLowerCase();
  const mm = name.match(/^(min-|max-)?(width|height)$/);
  if (mm) {
    if (value === undefined) return env[mm[2]] > 0;
    const px = toPx(value);
    if (px == null) return null;
    const cur = env[mm[2]];
    return mm[1] === "min-" ? cur >= px : mm[1] === "max-" ? cur <= px : cur === px;
  }
  if (name in env && typeof env[name] === "string") return value === undefined ? env[name] !== "none" : env[name] === value;
  return null; // resolution, aspect-ratio, -webkit-*, ... : leave to the browser
}
function evalQuery(q) {
  q = q.trim().toLowerCase();
  let negate = false;
  if (q.startsWith("not ")) { negate = true; q = q.slice(4).trim(); }
  if (q.startsWith("only ")) q = q.slice(5).trim();
  const parts = q.split(/\s+and\s+/);
  let result = true;
  for (const p of parts) {
    let r;
    if (/^\(.*\)$/.test(p)) r = evalFeature(p.slice(1, -1));
    else if (p === "all" || p === "screen") r = true;
    else if (p === "print" || p === "speech") r = false;
    else r = null;
    if (r === null) return null;
    result = result && r;
  }
  return negate ? !result : result;
}
function evalMediaList(prelude) {
  let any = false;
  for (const q of splitTop(prelude)) {
    const r = evalQuery(q);
    if (r === null) return null;
    any = any || r;
  }
  return any;
}

// ---------------------------------------------------------------- value rewrites
const KF = new Map(); // old name -> new name
const VUNIT = /(^|[^\w.#-])(-?\d*\.?\d+)(dvh|svh|lvh|vh|dvw|svw|lvw|vw|vmin|vmax)(?![\w-])/g;
function rewriteValueText(text, fn) {
  // apply fn only outside quoted strings and url(...)
  let out = "", i = 0, start = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'") {
      out += fn(text.slice(start, i));
      const end = skipString(text, i);
      out += text.slice(i, end);
      i = start = end;
      continue;
    }
    if (text.startsWith("url(", i)) {
      out += fn(text.slice(start, i));
      let depth = 0, j = i + 3;
      for (; j < text.length; j++) {
        if (text[j] === '"' || text[j] === "'") { j = skipString(text, j) - 1; continue; }
        if (text[j] === "(") depth++;
        else if (text[j] === ")") { depth--; if (depth === 0) break; }
      }
      out += rewriteUrl(text.slice(i, j + 1));
      i = start = j + 1;
      continue;
    }
    i++;
  }
  out += fn(text.slice(start));
  return out;
}
function rewriteUrl(u) {
  const inner = u.slice(4, -1).trim().replace(/^["']|["']$/g, "");
  if (/^(data:|#)/i.test(inner)) return u;
  stats.urls.add(inner);
  return `url("data:,")`;
}
function rewriteBody(body) {
  // declarations (and possibly nested rules); rewrite viewport units + keyframe refs + urls
  let b = rewriteValueText(body, (seg) =>
    seg.replace(VUNIT, (_, pre, num, unit) => {
      stats.vunits++;
      const u = unit.toLowerCase();
      const v = u.endsWith("vh") ? "var(--tulvo-vh, 1vh)" : u.endsWith("vw") ? "var(--tulvo-vw, 1vw)"
        : u === "vmin" ? "min(var(--tulvo-vw, 1vw), var(--tulvo-vh, 1vh))" : "max(var(--tulvo-vw, 1vw), var(--tulvo-vh, 1vh))";
      return `${pre}calc(${num} * ${v})`;
    })
  );
  // The app's UI font -> the dedicated "Tulvo Inter" family registered by fonts.ts (the exact
  // opsz+wght variable files the app loads). A bare "Inter" is ambiguous in the studio: other
  // modules register static Inter faces (no opsz axis) under that name.
  b = b.replace(/(font-family\s*:\s*)Inter(\s*,)/g, (_, pre, comma) => {
    stats.fontFamilies = (stats.fontFamilies || 0) + 1;
    return `${pre}"Tulvo Inter", Inter${comma}`;
  });
  if (KF.size) {
    b = b.replace(/((?:-webkit-)?animation(?:-name)?\s*:)([^;}]*)/g, (all, prop, val) => {
      const nv = val.replace(/[A-Za-z_][\w-]*/g, (w) => (KF.has(w) ? KF.get(w) : w));
      return prop + nv;
    });
  }
  return b;
}

// ---------------------------------------------------------------- transform pass
function transform(nodes) {
  const out = [];
  for (const n of nodes) {
    if (n.type === "rule") {
      const sel = scopeSelectorList(n.prelude);
      if (!sel) continue;
      out.push({ type: "rule", prelude: sel, body: rewriteBody(n.body) });
      continue;
    }
    if (n.statement) {
      if (n.name === "import") { bump("@import"); continue; }
      if (n.name === "charset") continue;
      out.push(n);
      continue;
    }
    if (n.name === "font-face") { bump("@font-face"); continue; }
    if (n.name === "keyframes" || n.name === "-webkit-keyframes") {
      if (EXTENSION.test(n.prelude)) { bump("extension keyframes"); continue; }
      out.push({ ...n, prelude: KF.get(n.prelude.trim()) || n.prelude });
      continue;
    }
    if (n.children) {
      if (n.name === "media") {
        const r = evalMediaList(n.prelude);
        if (r === true) { stats.mediaBaked++; out.push(...transform(n.children)); continue; }
        if (r === false) { stats.mediaBaked++; continue; }
        stats.mediaKept.add(squash(n.prelude));
      }
      const kids = transform(n.children);
      if (kids.length) out.push({ ...n, _key: undefined, children: kids });
      continue;
    }
    out.push(n); // @property, @page, @counter-style ... (global, harmless)
  }
  return out;
}

function collectKeyframes(nodes) {
  for (const n of nodes) {
    if (n.type === "at" && (n.name === "keyframes" || n.name === "-webkit-keyframes")) {
      const name = n.prelude.trim();
      if (!KF.has(name) && !EXTENSION.test(name)) KF.set(name, `tulvo-${name.replace(/^["']|["']$/g, "")}`);
    }
    if (n.children) collectKeyframes(n.children);
  }
}

// ---------------------------------------------------------------- main
const inputs = opt.in
  .map((f) => ({ f, src: fs.readFileSync(f, "utf8") }))
  .sort((a, b) => b.src.length - a.src.length); // largest (most complete) first
let merged = [];
for (const { f, src } of inputs) {
  const nodes = parseList(src);
  merged = merged.length ? mergeLists(merged, nodes) : nodes;
  console.log(`scope-css: ${path.basename(f)}: ${nodes.length} top-level rules -> merged ${merged.length}`);
}
merged = dedupe(merged);
collectKeyframes(merged);
stats.keyframes = KF.size;
let scoped = dedupe(transform(merged));

const header = `/*
 * GENERATED FILE: do not edit by hand. Regenerate with:
 *   node src/products/tulvo/tools/scope-css.mjs
 * Source: live Tulvo app CSS captured 2026-10-20 (light mode, 1512x805), files:
${inputs.map(({ f }) => ` *   ${path.basename(f)}`).join("\n")}
 * Every rule applies only inside an element with class "${opt.scope}" (see tools/scope-css.mjs).
 * Media queries baked for a ${opt.vw}x${opt.vh} desktop viewport; viewport units use --tulvo-vw / --tulvo-vh.
 */`;

// The project this kit came from (remotion-studio) also compiled Tailwind v4 (src/index.css) and scanned src/**
// for class names; the video studio's engine has no Tailwind, so this block changes nothing there and is kept
// only so a Tailwind v4 build can never stack on the app's v3 rules. With Tailwind v4, the build emits its OWN
// (layered) copies of utilities used in our TSX. Same-property conflicts are
// won by this unlayered file, but a few v4 utilities use properties the app's Tailwind v3
// never sets and would stack on top of the v3 result:
//   rotate-* / scale-* / translate-*  -> `rotate` / `scale` / `translate` (v3 uses `transform`)
//   space-x-* / space-y-*             -> margin-inline-end / margin-block-end on the FIRST child
// and v4's preflight zeroes the UA 1px padding of table cells. Neutralise those here, with
// :where() so that every real app rule (all >= this specificity, and later) still wins.
const compat = `
/* ---- Tailwind v4 compatibility (added by scope-css.mjs, see tools/scope-css.mjs) ---- */
${S} :where(*), ${S} :where(*)::before, ${S} :where(*)::after { translate: none; rotate: none; scale: none; }
${S} :where(*) { margin-block-end: 0; margin-inline-end: 0; }
${S} :where(td, th) { padding: 1px; }
`;

const tail = `
/* ---- added by scope-css.mjs ---- */
/* viewport units of the captured app window (TulvoApp overrides them inline from its width/height props) */
${S} { --tulvo-vw: ${opt.vw / 100}px; --tulvo-vh: ${opt.vh / 100}px; }
/* frame-accurate rendering: no CSS-driven motion inside the app. Animate via props. */
${S}, ${S} *, ${S} ::before, ${S} ::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
`;

let css = `${header}\n${compat}\n${serialize(scoped)}\n${tail}`;
// A Tailwind v4 loader would process any CSS containing these at-rules; we must never trigger it.
const twTrigger = /@(import|reference|theme|variant|config|plugin|apply|tailwind)\b/;
if (twTrigger.test(css)) {
  const m = css.match(twTrigger);
  throw new Error(`scope-css: output contains "${m[0]}" which would make @tailwindcss/webpack compile this file`);
}
fs.mkdirSync(path.dirname(opt.out), { recursive: true });
fs.writeFileSync(opt.out, css);

const count = (ns) => ns.reduce((a, n) => a + (n.children ? count(n.children) : 1), 0);
console.log(`scope-css: wrote ${path.relative(process.cwd(), opt.out)} (${(css.length / 1024).toFixed(0)} KB, ${count(scoped)} rules)`);
console.log(`scope-css: dropped ${JSON.stringify(stats.dropped)}`);
console.log(`scope-css: keyframes renamed ${stats.keyframes}, media blocks baked ${stats.mediaBaked}, viewport units rewritten ${stats.vunits}`);
if (stats.mediaKept.size) console.log(`scope-css: media queries left to the browser: ${[...stats.mediaKept].join(" | ")}`);
if (stats.urls.size) console.log(`scope-css: ${stats.urls.size} app-relative url()s blanked (e.g. ${[...stats.urls].slice(0, 3).join(", ")})`);
