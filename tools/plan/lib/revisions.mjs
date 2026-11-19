// Revision notes as data, and the check that the next cut did what they asked and nothing else.
// Pure functions; tools/plan/revisions.mjs reads the files, renders the frames and prints.
//
// A round: { name, opened, from (the snapshot it revises), says (the creator's words), items: [item] }
// item: { id, says, action: keep | change | remove | add, aspect, scope: [scene ids], target, status, result }
//   aspect: pace | framing | copy | sound | look | order | ending | opening | content | other
//   target (optional, checked from the film's timing): slower | faster | hold>=<s> | length<=<s> | scene>=<s> | scene<=<s>
// Scene words the creator uses: "opening" (first scene), "ending" (last scene), "all", "rest" (every scene no other
// note names: what "keep everything I liked" means).

export const ACTIONS = ['keep', 'change', 'remove', 'add'];
// Aspects a change of timing alone can satisfy. Copy, look or framing need a change in the frames or the code.
const TIMING = ['pace', 'timing', 'order', 'length'];
// Measured 18 Nov 2026: two renders of the same frame, 59 dB to identical; the same picture moved later in the film
// (film grain and light drift with time) 46 to 48 dB; a real change (bigger logo, new line) 22 dB; different shots 14 dB.
// Under SAME_DB is a change. Between SAME_DB and LIKELY_SAME_DB is "the same picture, small drift", listed, not counted.
export const SAME_DB = 40;
export const LIKELY_SAME_DB = 50;

export function resolveScope(scope, sceneIds, { taken = [] } = {}) {
  const out = new Set();
  for (const raw of [].concat(scope)) {
    const s = String(raw).trim();
    if (s === 'all') sceneIds.forEach((x) => out.add(x));
    else if (s === 'opening') out.add(sceneIds[0]);
    else if (s === 'ending') out.add(sceneIds.at(-1));
    else if (s === 'rest') sceneIds.filter((x) => !taken.includes(x)).forEach((x) => out.add(x));
    else if (sceneIds.includes(s)) out.add(s);
    else throw new Error(`No scene "${s}". The scenes: ${sceneIds.join(', ')} (or opening, ending, all, rest).`);
  }
  return [...out];
}

const sceneLen = (film, id) => { const s = film.scenes.find((x) => x.id === id); return s ? +(s.end - s.start).toFixed(3) : null; };
const cueLens = (film, id) => { const s = film.scenes.find((x) => x.id === id); if (!s) return []; const len = s.end - s.start; return (s.texts?.length ? s.texts : [{ at: 0, out: len }]).map((c) => +(Math.min(len, c.out ?? len) - c.at).toFixed(3)); };

/**
 * What changed between two snapshots, scene by scene.
 * snap: { film, frames: { "<scene>#<n>": file }, code: { "<relative file>": sha } }
 * psnr(a, b): number (dB), or null when the frames cannot be compared (different size).
 */
export function diff(before, after, psnr) {
  const ids = after.film.scenes.map((s) => s.id);
  const codeChanged = Object.keys({ ...before.code, ...after.code }).filter((f) => before.code[f] !== after.code[f]);
  const sceneCode = (id) => codeChanged.some((f) => new RegExp(`(^|/)${id}\\.tsx?$`).test(f));
  const shared = codeChanged.filter((f) => !/(^|\/)S\d+\.tsx?$/.test(f));
  const scenes = {};
  for (const id of ids) {
    const keys = Object.keys(after.frames).filter((k) => k.startsWith(`${id}#`));
    const was = Object.keys(before.frames).filter((k) => k.startsWith(`${id}#`));
    const shots = keys.map((k) => {
      if (!before.frames[k]) return { key: k, db: null, changed: true, why: 'new shot' };
      const db = psnr(before.frames[k], after.frames[k]);
      // A frame that cannot be compared (a different size) is not evidence either way: a person looks.
      if (db === null) return { key: k, db: null, changed: false, uncertain: true };
      return { key: k, db, changed: db < SAME_DB, drift: db >= SAME_DB && db < LIKELY_SAME_DB };
    });
    const removed = was.filter((k) => !after.frames[k]);
    const lenBefore = before.film.scenes.some((s) => s.id === id) ? sceneLen(before.film, id) : null;
    const lenAfter = sceneLen(after.film, id);
    scenes[id] = {
      new_scene: lenBefore === null,
      length: { before: lenBefore, after: lenAfter },
      holds: { before: cueLens(before.film, id), after: cueLens(after.film, id) },
      code_changed: sceneCode(id),
      shots_changed: shots.filter((s) => s.changed).map((s) => s.key),
      shots_uncertain: shots.filter((s) => s.uncertain).map((s) => s.key),
      length_changed: lenBefore !== null && Math.abs(lenAfter - lenBefore) > 0.02,
      shots_drifted: shots.filter((s) => s.drift).map((s) => s.key),
      shots_removed: removed,
      shots,
      changed: lenBefore === null || removed.length > 0 || shots.some((s) => s.changed) || (lenBefore !== null && Math.abs(lenAfter - lenBefore) > 0.02),
    };
  }
  const gone = before.film.scenes.map((s) => s.id).filter((id) => !ids.includes(id));
  return { scenes, removed_scenes: gone, shared_code_changed: shared, film_length: { before: before.film.duration, after: after.film.duration } };
}

function checkTarget(target, scope, d) {
  if (!target) return null;
  const t = String(target).replace(/\s+/g, '');
  const m = t.match(/^(hold|length|scene)(>=|<=)([\d.]+)$/);
  const fails = [];
  if (t === 'slower' || t === 'faster') {
    for (const id of scope) {
      const { before, after } = d.scenes[id]?.length || {};
      if (before == null) continue;
      if (t === 'slower' ? !(after > before + 0.02) : !(after < before - 0.02)) fails.push(`${id} is ${after} s, was ${before} s`);
    }
  } else if (m) {
    const [, what, op, n] = m; const v = Number(n);
    const ok = (x) => (op === '>=' ? x >= v - 1e-6 : x <= v + 1e-6);
    if (what === 'length') { if (!ok(d.film_length.after)) fails.push(`the film is ${d.film_length.after} s`); }
    for (const id of what === 'length' ? [] : scope) {
      const xs = what === 'hold' ? d.scenes[id].holds.after : [d.scenes[id].length.after];
      xs.forEach((x, i) => { if (!ok(x)) fails.push(`${id}${what === 'hold' ? ` shot ${i + 1}` : ''} is ${x} s`); });
    }
  } else return { ok: null, detail: `target "${target}" is not one the studio can measure; a person checks it` };
  return { ok: !fails.length, detail: fails.length ? fails.join('; ') : `met (${target})` };
}

/**
 * Checks a round's notes against what changed. Returns { items, unasked, ok }:
 * a change/remove/add note passes when every scene it names changed (and its target is met); a keep note passes when
 * none of its scenes changed. "unasked" lists scenes that changed with no note naming them.
 */
export function verify(round, d) {
  const ids = Object.keys(d.scenes);
  const named = round.items.filter((x) => x.action !== 'keep').flatMap((x) => x.scope);
  const items = round.items.map((item) => {
    const scope = item.scope.includes('rest') ? resolveScope('rest', ids, { taken: named }) : item.scope;
    const problems = [];
    const asks = [];   // what the frames cannot settle: a person looks
    // A note about the whole film's length ("the 12 s cap still holds") is measured on the film, not scene by scene.
    const filmOnly = /^length(>=|<=)/.test(String(item.target || '').replace(/\s+/g, ''));
    if (filmOnly) { /* only the target below */ } else if (item.action === 'keep') {
      for (const id of scope) {
        const s = d.scenes[id];
        if (!s) { problems.push(`${id} is gone`); continue; }
        if (s.shots_changed.length || s.shots_removed.length) problems.push(`${id} changed (${[...s.shots_changed, ...s.shots_removed].join(', ')})`);
        else if (Math.abs((s.length.after ?? 0) - (s.length.before ?? 0)) > 0.02) problems.push(`${id} length ${s.length.before} s became ${s.length.after} s`);
      }
      for (const id of scope) {
        const s = d.scenes[id];
        if (s?.code_changed && !problems.length) asks.push(`${id}'s own code changed though its frames match: check the motion between frames`);
        if (s?.shots_uncertain?.length) asks.push(`${id}: ${s.shots_uncertain.join(', ')} could not be compared`);
      }
    } else if (item.action === 'remove') {
      for (const id of scope) if (d.scenes[id] && !d.scenes[id].changed) problems.push(`${id} is still there, unchanged`);
    } else {
      for (const id of scope) {
        const s = d.scenes[id];
        if (!s) { problems.push(`${id} is gone`); continue; }
        const seen = s.new_scene || s.shots_changed.length > 0 || s.shots_removed.length > 0 || s.code_changed;
        // Frames that changed only alongside shared code (a background, the kit) may not be the change asked for.
        if (seen && !s.code_changed && !s.new_scene && d.shared_code_changed.length && !TIMING.includes(item.aspect)) asks.push(`${id} changed, but so did shared code (${d.shared_code_changed.join(', ')}): check it is the ${item.aspect} change asked for`);
        if (seen) continue;
        if (s.length_changed && TIMING.includes(item.aspect)) continue;
        if (s.length_changed) problems.push(`${id}: only its timing moved; the ${item.aspect} change is not in its frames or code`);
        else if (s.shots_uncertain?.length) asks.push(`${id}: ${s.shots_uncertain.join(', ')} could not be compared`);
        else problems.push(`${id} did not change`);
      }
    }
    const target = checkTarget(item.target, scope, d);
    if (target?.ok === false) problems.push(`target not met: ${target.detail}`);
    if (target?.ok === null) asks.push(target.detail);
    const status = problems.length ? 'failed' : asks.length ? 'needs a person' : 'verified';
    return { ...item, resolved_scope: scope, status, result: problems.length ? problems.join('; ') : asks.length ? asks.join('; ') : target?.detail || (item.action === 'keep' ? 'unchanged' : 'changed') };
  });
  const covered = new Set(items.filter((x) => !/^length(>=|<=)/.test(String(x.target || '').replace(/\s+/g, ''))).flatMap((x) => x.resolved_scope));
  const unasked = ids.filter((id) => d.scenes[id].changed && !covered.has(id)).map((id) => ({ scene: id, shots: d.scenes[id].shots_changed, length: d.scenes[id].length }));
  // With no keep note, every scene no note names is treated as "keep": a change there is a surprise for the creator.
  return { items, unasked, ok: items.every((x) => x.status !== 'failed') && !unasked.length };
}
