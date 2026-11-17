// The timed beat sheet (LIBRARY-PLAN.md phase 2; knowledge/craft/16-structure-and-retention.md). Lays a script's
// lines against a framework's beats and names what does not fit: a hook that runs late, a beat that is too long or
// too short, a beat missing or out of order, a film over its cap, a line too long to say in one go, an energy map that
// breaks the rules of 01-direction.md, on-screen text with too little time to be read. Pure.
//
// A framework's beat: { id, name, job, size: [min, max] share of the film or null, seconds: [min, max] or null,
// required }. Sizes come from the playbooks ("Proof 50-60%"), seconds from them too ("Close 4-6 s").

const round = (v) => Math.round(v * 100) / 100;
export const SHORT_FORM = ['reels', 'tiktok', 'shorts'];

/** The seconds a beat should take in a film of `duration` seconds: [min, max]. */
export function allowed(beat, duration) {
  let lo = beat.size ? beat.size[0] * duration : 0; let hi = beat.size ? beat.size[1] * duration : duration;
  if (beat.seconds) { lo = Math.max(lo, beat.seconds[0]); hi = Math.min(hi, beat.seconds[1]); }
  if (lo > hi) lo = hi; // a short film cannot give every beat its minimum in seconds
  return [round(lo), round(hi)];
}

/** Where each beat would sit if every beat took the middle of what it is allowed: [{ id, start, end }]. */
export function expectedWindows(framework, duration) {
  const mids = framework.beats.map((b) => { const [lo, hi] = allowed(b, duration); return (lo + hi) / 2; });
  const total = mids.reduce((a, b) => a + b, 0) || 1;
  let t = 0;
  return framework.beats.map((b, i) => { const s = t; t += (mids[i] / total) * duration; return { id: b.id, start: round(s), end: round(t) }; });
}

/**
 * Each line's beat: the one given in the script, or the beat whose expected window holds the line's middle. A first
 * or last line with no beat opens or closes the film, so it goes to the first or last beat.
 */
export function assignBeats(lines, framework, duration) {
  const win = expectedWindows(framework, duration);
  return lines.map((l, i) => {
    if (l.beat) return { ...l, how: 'given' };
    if (i === 0) return { ...l, beat: framework.beats[0].id, how: 'by time' };
    if (i === lines.length - 1 && lines.length > 2) return { ...l, beat: framework.beats.at(-1).id, how: 'by time' };
    const mid = (l.start + l.end) / 2;
    const w = win.find((x) => mid >= x.start && mid < x.end) || win.at(-1);
    return { ...l, beat: w.id, how: 'by time' };
  });
}

/**
 * The energy map's rules (01-direction.md), on one energy per beat, in order. Returns problems. Values that are null
 * are skipped; fewer than three values are not judged.
 */
export function energyProblems(values) {
  const v = values.filter((x) => Number.isFinite(x));
  const out = []; if (v.length < 3) return out;
  if (v[0] === 3) out.push({ what: 'energy opens at 3', detail: 'open at 4 or 5, or at 1 and jump; never at 3' });
  else if (v[0] === 2) out.push({ what: 'energy opens at 2', detail: 'open at 4 or 5, or at 1 and jump' });
  else if (v[0] === 1 && v[1] < 4) out.push({ what: 'energy opens at 1 without the jump', detail: `opening at 1 works when the next beat jumps to 4 or 5; it goes to ${v[1]}` });
  for (let i = 0, run = 1; i < v.length; i++) {
    run = i && v[i] === v[i - 1] ? run + 1 : 1;
    if (run === 4) out.push({ what: 'energy flat', detail: `${v[i]} held for more than three beats in a row (from beat ${i - 2})` });
  }
  const peak = Math.max(...v); const peaks = v.map((x, i) => (x === peak ? i : -1)).filter((i) => i >= 0);
  if (peaks.length > 1) out.push({ what: 'more than one peak', detail: `the highest energy, ${peak}, comes ${peaks.length} times; it belongs once, at the signature moment or the offer` });
  const p = peaks[0];
  if (p > 0 && v[p - 1] > 2) out.push({ what: 'no rest before the peak', detail: `the beat before the peak is at ${v[p - 1]}; put a 1 or 2 directly before the biggest moment` });
  if (v.at(-1) !== peak - 1) out.push({ what: 'ending not one below the peak', detail: `the film ends at ${v.at(-1)}; the peak is ${peak}, so end at ${peak - 1} on the call to action (the logo may rest lower after it)` });
  return out;
}

/** One energy per beat: consecutive items of the same beat count once (their highest), as 01-direction.md maps beats. */
export function perBeat(items) {
  const out = [];
  for (const it of items) {
    if (!Number.isFinite(it.energy)) continue;
    const last = out.at(-1);
    if (last && it.beat && last.beat === it.beat) last.energy = Math.max(last.energy, it.energy);
    else out.push({ beat: it.beat, energy: it.energy });
  }
  return out.map((x) => x.energy);
}

/**
 * On-screen text that cannot be read in the time it has (04-type-and-captions.md: a line needs its word count ÷ 3 +
 * 0.4 s). Each shot gets an equal part of its scene; the same text over several shots in a row is one hold. Text the
 * voice says at the same time (most of its words are in the scene's spoken lines) is read along with the voice and is
 * not judged here. scenes: [{ id, seconds, shots: [{ text }], said: the scene's spoken words }].
 */
const textWords = (t) => String(t || '').toLowerCase().replace(/[*\n]/g, ' ').match(/[\p{L}\p{N}%$]+/gu) || [];
export function textHolds(scenes) {
  const out = [];
  for (const sc of scenes) {
    const shots = sc.shots || []; if (!shots.length || !(sc.seconds > 0)) continue;
    const each = sc.seconds / shots.length;
    const said = new Set(textWords(sc.said));
    const holds = [];
    shots.forEach((sh, i) => { const t = String(sh.text || '').trim(); const last = holds.at(-1); if (last && last.text === t) last.seconds += each; else holds.push({ text: t, seconds: each, shot: i + 1 }); });
    for (const h of holds) {
      const words = textWords(h.text); if (!words.length) continue;
      if (said.size && words.filter((w) => said.has(w)).length * 2 >= words.length) continue; // read along with the voice
      const need = words.length / 3 + 0.4;
      if (h.seconds < need - 0.01) out.push({ what: 'text too short on screen', scene: sc.id, detail: `${sc.id} shot ${h.shot}: "${h.text.replace(/\n/g, ' ')}" is up for about ${round(h.seconds)} s and is not said by the voice; ${words.length} words need ${round(need)} s` });
    }
  }
  return out;
}

/**
 * The beat sheet. lines: from timing.mjs (each { id, start, end, text, words, beat, energy }); framework; duration:
 * the film's length (the last line's end plus the close, or the job's); cap: the length cap or null; platform.
 */
export function beatSheet({ lines, framework, duration, cap = null, platform = null, lengths = null }) {
  const problems = []; const order = framework.beats.map((b) => b.id);
  // Beats written for another framework (most of the given ones are not this framework's): place every line by time.
  const given = lines.filter((l) => l.beat);
  const foreign = given.length && given.filter((l) => !order.includes(l.beat)).length * 2 > given.length;
  if (foreign) problems.push({ what: 'beats from another framework', detail: `the script's beats (${[...new Set(given.map((l) => l.beat))].join(', ')}) are not ${framework.id}'s, so every line was placed by time` });
  const placed = assignBeats(foreign ? lines.map((l) => ({ ...l, beat: null })) : lines, framework, duration);
  const guessed = placed.some((l) => l.how === 'by time');
  for (const l of placed) if (!order.includes(l.beat)) problems.push({ what: 'unknown beat', line: l.id, detail: `line ${l.id} is marked "${l.beat}", which is not a beat of ${framework.id} (${order.join(', ')})` });
  // Beats appear in the framework's order, each in one run of lines.
  const runs = []; for (const l of placed) if (!runs.length || runs.at(-1) !== l.beat) runs.push(l.beat);
  const seen = new Set();
  for (const b of runs) { if (seen.has(b)) problems.push({ what: 'beat split', beat: b, detail: `the ${b} beat comes back after other beats; keep each beat in one run, or name the second part as its own beat` }); seen.add(b); }
  const known = runs.filter((b) => order.includes(b));
  for (let i = 1; i < known.length; i++) if (order.indexOf(known[i]) < order.indexOf(known[i - 1])) problems.push({ what: 'out of order', beat: known[i], detail: `${known[i]} comes after ${known[i - 1]}; the framework has it before` });
  const beats = framework.beats.map((b, k) => {
    const mine = placed.filter((l) => l.beat === b.id);
    const next = framework.beats.slice(k + 1).map((n) => placed.find((l) => l.beat === n.id)).find(Boolean);
    const nextIsAdjacent = Boolean(next) && next.beat === framework.beats[k + 1]?.id;
    const start = mine.length ? mine[0].start : null;
    // A beat lasts from its first line to the next beat's first line (its pauses and holds included). When the beat
    // right after it in the framework is absent, the gap may be that beat's picture-only time, so this one is measured
    // on its own lines plus a second of hold.
    let end = null; let own = false;
    if (mine.length) {
      if (!next) end = Math.max(duration, mine.at(-1).end);
      else if (nextIsAdjacent) end = next.start;
      else { end = Math.min(next.start, mine.at(-1).end + 1); own = true; }
    }
    const seconds = mine.length ? round(end - start) : 0;
    // A beat may run over or under its range by a tenth of its longest allowed length, and at least half a second.
    const [lo, hi] = allowed(b, duration); const slack = Math.max(0.5, 0.1 * hi);
    let verdict = 'fits';
    if (!mine.length) { verdict = b.required ? 'missing' : 'left out'; if (b.required) problems.push({ what: 'beat missing', beat: b.id, detail: `no line is in the ${b.name.toLowerCase()} beat: ${b.job}` }); }
    else if (seconds > hi + slack) { verdict = 'long'; problems.push({ what: 'beat long', beat: b.id, detail: `${b.name} takes ${seconds} s; it is given ${lo} to ${hi} s in a ${round(duration)} s film` }); }
    else if (seconds < lo - slack) { verdict = 'short'; problems.push({ what: 'beat short', beat: b.id, detail: `${b.name} takes ${seconds} s; it is given ${lo} to ${hi} s in a ${round(duration)} s film` }); }
    return { id: b.id, name: b.name, lines: mine.map((l) => l.id), start: start === null ? null : round(start), end: end === null ? null : round(end), seconds, allowed: [lo, hi], verdict, ...(own ? { measured: 'on its own lines (the next beat is absent)' } : {}) };
  });
  // The hook: out by its seconds limit, and on short-form feeds by about 3 s. Only when the first beat is a hook.
  const hook = beats[0];
  const hookLike = Boolean(framework.beats[0].seconds) || /hook|cold|result|promise/i.test(framework.beats[0].id);
  if (hook?.lines.length && hookLike) {
    const first = placed.find((l) => l.beat === hook.id);
    const limit = Math.min(framework.beats[0].seconds?.[1] ?? 5, SHORT_FORM.includes(platform) ? 3 : Infinity);
    if (first.end > limit + 0.05) problems.push({ what: 'hook late', beat: hook.id, detail: `the first line of the hook is still being said at ${round(first.end)} s; ${SHORT_FORM.includes(platform) ? `on ${platform} its point must be out by about 3 s` : `the hook is said inside ${limit} s`}` });
  }
  for (const l of placed) if (l.end - l.start > 6.05) problems.push({ what: 'line long', line: l.id, detail: `line ${l.id} takes ${round(l.end - l.start)} s to say; split it (one thought a line, 6 s at most)` });
  if (cap && duration > cap + 0.05) problems.push({ what: 'over the cap', detail: `the film runs ${round(duration)} s; its cap is ${cap} s` });
  problems.push(...energyProblems(perBeat(placed)));
  const stretched = Boolean(lengths?.length) && (duration < Math.min(...lengths) * 0.8 || duration > Math.max(...lengths) * 1.25);
  return { framework: framework.id, duration: round(duration), guessed, stretched, beats, lines: placed.map(({ id, beat, how, start, end }) => ({ id, beat, how, start, end })), problems };
}

/**
 * Scenes of a shot list checked against the beat sheet: a scene's beat must be the beat of its lines, and its time
 * (first line to the next scene's start; before a silent scene, the end of the voice; a silent scene its own seconds)
 * is what textHolds measures. scenes: shots.json scenes; placed: lines with beats; duration.
 * Returns { scenes: [{ id, beat, seconds, shots, energy, said }], problems }.
 */
export function sceneBeats(scenes, placed, duration) {
  const at = new Map(placed.map((l) => [l.id, l]));
  const problems = []; const out = [];
  const starts = scenes.map((sc) => (sc.silent ? null : at.get(String((sc.lines || [])[0]))?.start ?? null));
  const voiceEnd = Math.max(0, ...placed.map((l) => l.end));
  scenes.forEach((sc, i) => {
    const mine = (sc.lines || []).map((id) => at.get(String(id))).filter(Boolean);
    const beats = [...new Set(mine.map((l) => l.beat))];
    // A scene ends where the next scene starts; before a silent scene (which follows the voice), where the voice ends.
    const after = scenes[i + 1];
    const end = !after ? duration : after.silent ? voiceEnd : (starts[i + 1] ?? duration);
    const seconds = sc.silent ? Number(sc.seconds) || 0 : starts[i] === null ? 0 : end - starts[i];
    if (sc.beat && beats.length && !beats.includes(sc.beat)) problems.push({ what: 'scene beat differs', scene: sc.id, detail: `${sc.id} is marked "${sc.beat}" but its lines are in ${beats.join(' and ')}` });
    // Only beats the script gives are judged here; beats placed by time are a guess.
    if (beats.length > 1 && mine.every((l) => l.how === 'given')) problems.push({ what: 'scene spans beats', scene: sc.id, detail: `${sc.id} holds lines from ${beats.join(' and ')}; a scene change usually falls on a beat change` });
    out.push({ id: sc.id, beat: sc.beat || beats[0] || null, seconds: round(seconds), shots: sc.shots || [], energy: sc.energy ?? null, said: mine.map((l) => l.text).join(' ') });
  });
  return { scenes: out, problems };
}
