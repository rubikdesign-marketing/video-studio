// Style suggestions, shared by the brief page, the chat command and the connector.
// This file imports nothing at all: the browser page loads it as is.

const STOP = new Set(('a an the and or but of for to in on at by with from into as is are was were be been it its this that these those ' +
  'i me my we our you your they them their he she his her not no so if then than too very can will just want need like make made ' +
  'video videos please some any one about over under up down out off do does did have has had would should could get got').split(' '));

const split = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
const contentWords = (text) => [...new Set(split(text).filter((w) => w.length > 1 && !STOP.has(w)))];
const list = (v) => (Array.isArray(v) ? v : v === undefined || v === null || v === '' ? [] : [v]);
const readable = (kind) => String(kind).replace(/-/g, ' ');
const joinWords = (ws) => (ws.length < 2 ? ws.join('') : `${ws.slice(0, -1).join(', ')} and ${ws[ws.length - 1]}`);

// Scores every entry. Returns [{ entry, score, parts }] sorted by score, then id.
// parts holds what matched: { memory, words, kind, energy, size }.
export function rank(entries, { text = '', understood = {}, memory = [], picked = [] } = {}) {
  const skip = new Set(picked);
  const remembered = new Map();
  for (const m of memory) if (m && m.id !== undefined && !remembered.has(m.id)) remembered.set(m.id, m.job);
  const wanted = contentWords(text);
  const energies = list(understood.energy);
  const kinds = list(understood.kind);
  const sizes = list(understood.size);
  const out = [];
  for (const entry of entries) {
    if (!entry || skip.has(entry.id)) continue;
    const f = entry.filters || {};
    const parts = {};
    let score = 0;
    if (remembered.has(entry.id)) { score += 4; parts.memory = remembered.get(entry.id); }
    const e = energies.find((x) => (f.energy || []).includes(x));
    if (e) { score += 3; parts.energy = e; }
    const k = kinds.find((x) => (f.kinds || []).includes(x));
    if (k) { score += 2; parts.kind = k; }
    const s = sizes.find((x) => (f.sizes || []).includes(x));
    if (s) { score += 1; parts.size = s; }
    if (wanted.length) {
      const have = new Set(split(`${entry.name} ${entry.line} ${entry.family}`));
      const hit = wanted.filter((w) => have.has(w));
      if (hit.length) { score += hit.length; parts.words = hit; }
    }
    out.push({ entry, score, parts });
  }
  out.sort((a, b) => b.score - a.score || (a.entry.id < b.entry.id ? -1 : a.entry.id > b.entry.id ? 1 : 0));
  return out;
}

function reasonFor(parts) {
  const bits = [];
  if (parts.memory !== undefined) bits.push(`you used this on ${parts.memory}`);
  const because = [];
  if (parts.words) because.push(`you said ${joinWords(parts.words)}`);
  if (parts.kind) because.push(`it suits a ${readable(parts.kind)}`);
  if (parts.energy) because.push(`it has a ${parts.energy} feel`);
  if (parts.size) because.push(`it works at ${parts.size}`);
  if (because.length) bits.push(`because ${because.join(' and ')}`);
  return bits.join(', ') || 'a ready style to start from';
}

export function suggest(entries, { text = '', understood = {}, memory = [], picked = [], n = 6 } = {}) {
  const hasSignal = contentWords(text).length > 0 || Object.values(understood || {}).some((v) => list(v).length) || (memory || []).length > 0;
  let pool = rank(entries, { text, understood, memory, picked });
  if (!hasSignal) {
    // No signal: only ready styles, taken one tab at a time so the first six are varied.
    const byTab = new Map();
    for (const r of pool) if (r.entry.filters?.ready === true) { if (!byTab.has(r.entry.tab)) byTab.set(r.entry.tab, []); byTab.get(r.entry.tab).push(r); }
    const lanes = [...byTab.keys()].sort().map((t) => byTab.get(t));
    pool = [];
    for (let i = 0; lanes.some((l) => i < l.length); i++) for (const l of lanes) if (i < l.length) pool.push(l[i]);
  }
  const used = new Map();
  const out = [];
  for (const r of pool) {
    if (out.length >= n) break;
    const c = used.get(r.entry.tab) || 0;
    if (c >= 2) continue;
    used.set(r.entry.tab, c + 1);
    out.push({ id: r.entry.id, tab: r.entry.tab, name: r.entry.name, reason: hasSignal ? reasonFor(r.parts) : 'a ready style to start from' });
  }
  return out;
}
