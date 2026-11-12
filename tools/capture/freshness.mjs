// Freshness by words and layout (CAPTURE-PLAN.md section 8): compares the words and the places of things saved
// with a mark against today's, for `capture.mjs check` and `capture.mjs compare`. Pure: no browser, no files.
//
// Words: marks/<mark>.txt holds the words on screen, one screen row per line, separate labels on a row joined by two
// spaces. Labels on one row can come out in a different order from run to run (they are sorted by their top edge,
// a pixel apart), so the words are compared as a set of labels, not as lines.
//
// Layout: marks/<mark>.layout.json holds the named things on screen (buttons, links, tabs, fields, headings: role,
// name and box in page pixels) and the tracked things. A thing is matched by its role and name (the first "Save"
// with the first "Save"); one that is gone and one that is new of the same role in about the same place is a rename.

const SPLIT = /\s{2,}/;

/** The labels of a words file, as a list (repeats kept). */
export const labelsOf = (text) =>
  String(text ?? '')
    .split('\n')
    .flatMap((line) => line.split(SPLIT))
    .map((s) => s.trim())
    .filter((s) => s && !/^\[masked( field)?\]$/.test(s));

const count = (list) => {
  const m = new Map();
  for (const s of list) m.set(s, (m.get(s) ?? 0) + 1);
  return m;
};

const words = (s) => s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/** How alike two labels are, 0 to 1: shared words, or shared letters for one-word labels. */
export const likeness = (a, b) => {
  const wa = words(a);
  const wb = words(b);
  if (!wa.length || !wb.length) return 0;
  const shared = wa.filter((w) => wb.includes(w)).length;
  const byWords = (2 * shared) / (wa.length + wb.length);
  // Letters: the longest common run of letters against the longer label, for "Invite" and "Invite people".
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  let best = 0;
  for (let i = 0; i < x.length; i++)
    for (let j = 0; j < y.length; j++) {
      let k = 0;
      while (x[i + k] && x[i + k] === y[j + k]) k++;
      if (k > best) best = k;
    }
  return Math.max(byWords, best / Math.max(x.length, y.length));
};

/**
 * Compares two words files. Labels gone and labels new are paired as renames when they look alike (half their
 * words shared), or when exactly one went and one came.
 */
export const compareWords = (beforeText, afterText) => {
  const a = count(labelsOf(beforeText));
  const b = count(labelsOf(afterText));
  const removed = [];
  const added = [];
  for (const [s, n] of a) for (let i = 0; i < n - (b.get(s) ?? 0); i++) removed.push(s);
  for (const [s, n] of b) for (let i = 0; i < n - (a.get(s) ?? 0); i++) added.push(s);
  const renamed = [];
  if (removed.length === 1 && added.length === 1) return { added: [], removed: [], renamed: [{ from: removed[0], to: added[0] }] };
  // The most alike pairs first.
  const pairs = [];
  removed.forEach((r, i) => added.forEach((s, j) => pairs.push({ i, j, l: likeness(r, s) })));
  pairs.sort((p, q) => q.l - p.l);
  const usedR = new Set();
  const usedA = new Set();
  for (const p of pairs) {
    if (p.l < 0.5) break;
    if (usedR.has(p.i) || usedA.has(p.j)) continue;
    usedR.add(p.i);
    usedA.add(p.j);
    renamed.push({ from: removed[p.i], to: added[p.j] });
  }
  return { added: added.filter((_, j) => !usedA.has(j)), removed: removed.filter((_, i) => !usedR.has(i)), renamed };
};

const quoteList = (list, most = 8) => {
  const shown = list.slice(0, most).map((s) => `"${s.length > 60 ? s.slice(0, 57) + '...' : s}"`);
  return shown.join(', ') + (list.length > most ? ` and ${list.length - most} more` : '');
};

/** Plain lines for a words comparison; empty when nothing changed. */
export const describeWords = ({ added, removed, renamed }) => [
  ...renamed.map((r) => `"${r.from}" became "${r.to}"`),
  ...(removed.length ? [`words gone: ${quoteList(removed)}`] : []),
  ...(added.length ? [`new words: ${quoteList(added)}`] : []),
];

/** True when a words comparison found anything. */
export const wordsChanged = (r) => r.added.length + r.removed.length + r.renamed.length > 0;

// ------------------------------------------------ layout

const keyed = (things) => {
  const seen = new Map();
  return things.map((t) => {
    const base = `${t.role}\u0000${t.name}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { ...t, key: `${base}\u0000${n}` };
  });
};

const delta = (a, b) => ({ dx: Math.round(b[0] - a[0]), dy: Math.round(b[1] - a[1]), dw: Math.round(b[2] - a[2]), dh: Math.round(b[3] - a[3]) });

const moveOf = (name, a, b, tolerance, extra = {}) => {
  const d = delta(a, b);
  const moved = Math.abs(d.dx) > tolerance || Math.abs(d.dy) > tolerance;
  const resized = Math.abs(d.dw) > tolerance || Math.abs(d.dh) > tolerance;
  if (!moved && !resized) return null;
  return { kind: moved ? 'moved' : 'resized', name, ...d, before: a, after: b, ...extra };
};

/**
 * Compares two layouts ({things: [{role, name, box}], tracked: {name: box | null}}). Reports things that moved or
 * changed size by more than `tolerance` page pixels, were renamed in place, went or came.
 */
export const compareLayout = (before, after, { tolerance = 3 } = {}) => {
  const changes = [];
  // Tracked things, by name.
  const ta = before?.tracked ?? {};
  const tb = after?.tracked ?? {};
  for (const name of new Set([...Object.keys(ta), ...Object.keys(tb)])) {
    const a = ta[name];
    const b = tb[name];
    if (a && !b) changes.push({ kind: 'gone', name, tracked: true, before: a });
    else if (!a && b) changes.push({ kind: 'new', name, tracked: true, after: b });
    else if (a && b) {
      const c = moveOf(name, a, b, tolerance, { tracked: true });
      if (c) changes.push(c);
    }
  }
  // Named things, by role and name.
  const ka = keyed(before?.things ?? []);
  const kb = keyed(after?.things ?? []);
  const byKey = new Map(kb.map((t) => [t.key, t]));
  const goneList = [];
  const matched = new Set();
  for (const t of ka) {
    const u = byKey.get(t.key);
    if (!u) {
      goneList.push(t);
      continue;
    }
    matched.add(u.key);
    const c = moveOf(t.name, t.box, u.box, tolerance, { role: t.role });
    if (c) changes.push(c);
  }
  const newList = kb.filter((u) => !matched.has(u.key));
  // Renamed in place: same role, the box about where it was (its corner within the tolerance, or its middle within
  // a quarter of its size).
  const usedNew = new Set();
  for (const t of goneList) {
    const near = newList.find((u, j) => {
      if (usedNew.has(j) || u.role !== t.role) return false;
      const cx = (b) => b[0] + b[2] / 2;
      const cy = (b) => b[1] + b[3] / 2;
      return Math.abs(cx(u.box) - cx(t.box)) <= Math.max(tolerance, t.box[2] / 4) && Math.abs(cy(u.box) - cy(t.box)) <= Math.max(tolerance, t.box[3] / 4);
    });
    if (near) {
      usedNew.add(newList.indexOf(near));
      changes.push({ kind: 'renamed', name: t.name, from: t.name, to: near.name, role: t.role, before: t.box, after: near.box, ...delta(t.box, near.box) });
    } else changes.push({ kind: 'gone', name: t.name, role: t.role, before: t.box });
  }
  newList.forEach((u, j) => {
    if (!usedNew.has(j)) changes.push({ kind: 'new', name: u.name, role: u.role, after: u.box });
  });
  return { changes, tolerance };
};

const way = (dx, dy) => {
  const parts = [];
  if (dy) parts.push(`${Math.abs(dy)} px ${dy > 0 ? 'down' : 'up'}`);
  if (dx) parts.push(`${Math.abs(dx)} px ${dx > 0 ? 'right' : 'left'}`);
  return parts.join(' and ');
};

const sizeWords = (c) => {
  const parts = [];
  if (Math.abs(c.dw) > 0) parts.push(`${Math.abs(c.dw)} px ${c.dw > 0 ? 'wider' : 'narrower'}`);
  if (Math.abs(c.dh) > 0) parts.push(`${Math.abs(c.dh)} px ${c.dh > 0 ? 'taller' : 'shorter'}`);
  return parts.join(' and ');
};

const what = (c) => `${c.tracked ? 'the tracked thing' : c.role ? `the ${c.role}` : 'the thing'} "${c.name}"`;

/** Plain lines for a layout comparison; things that moved by the same amount are one line. */
export const describeLayout = ({ changes, tolerance }) => {
  const lines = [];
  const moves = changes.filter((c) => c.kind === 'moved' && Math.abs(c.dw) <= tolerance && Math.abs(c.dh) <= tolerance);
  const groups = new Map();
  for (const c of moves) {
    const k = `${c.dx},${c.dy}`;
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  const grouped = new Set();
  for (const [, list] of groups) {
    if (list.length < 3) continue;
    list.forEach((c) => grouped.add(c));
    lines.push(`${list.length} things moved together, ${way(list[0].dx, list[0].dy)}, among them ${quoteList(list.map((c) => c.name), 4)}`);
  }
  for (const c of changes) {
    if (grouped.has(c)) continue;
    if (c.kind === 'renamed') lines.push(`${what(c)} is now called "${c.to}"${Math.abs(c.dx) > tolerance || Math.abs(c.dy) > tolerance ? `, and moved ${way(c.dx, c.dy)}` : ''}`);
    else if (c.kind === 'moved') lines.push(`${what(c)} moved ${way(c.dx, c.dy)}${Math.abs(c.dw) > tolerance || Math.abs(c.dh) > tolerance ? `, and is ${sizeWords(c)}` : ''}`);
    else if (c.kind === 'resized') lines.push(`${what(c)} is ${sizeWords(c)}`);
    else if (c.kind === 'gone') lines.push(`${what(c)} is no longer on screen`);
    else if (c.kind === 'new') lines.push(`new on screen: ${what(c)}`);
  }
  return lines;
};
