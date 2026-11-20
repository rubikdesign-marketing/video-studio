// The brief (templates/brief.json) and what is still missing from it. Pure functions; tools/plan/brief.mjs prints them.
//
// questions(): only the decisions that change what gets made, most consequential first, at most three at a time.
// The order comes from the owner's own revision history (docs/product-plan-2026-11-18.md): the wrong size cost a whole
// storyboard; a reference copied for the wrong quality cost a whole film (V5); a promise the viewer could not see
// ("we don't understand what you're showing") cost a delivery.
// shotProblems(): shots that cannot yet show what they promise.

export const KINDS = ['product-demo', 'launch-reel', 'motion-graphics', 'footage-edit', 'ugc', 'animated-short', 'promo', 'tutorial'];
export const QUALITIES = ['camera', 'pacing', 'edit', 'delivery', 'performance', 'look', 'type', 'sound', 'structure', 'story', 'character'];
export const SOURCES = ['capture', 'footage', 'drawn', 'type', 'generated', 'mixed'];

// Each kind's default production path and what must be tested before spending on the whole sequence.
export const PATHS = {
  'product-demo': { sources: ['capture', 'type'], test: 'one held product shot at phone size: can a viewer read the action and its result?' },
  'launch-reel': { sources: ['type', 'capture', 'drawn'], test: 'the hook frame at 0 s and the first cut on the beat' },
  'motion-graphics': { sources: ['drawn', 'type'], test: 'one settled frame per size' },
  'footage-edit': { sources: ['footage'], test: 'one cut with sound: the line lands and the face is framed' },
  ugc: { sources: ['footage', 'generated'], test: 'a 3 to 5 s spoken take with sound before any other line: mouth timing, gesture, eye line, skin, background' },
  'animated-short': { sources: ['drawn', 'generated'], test: 'one representative performance, then the opening pose, main action and exit of two adjacent shots side by side' },
  promo: { sources: ['capture', 'type', 'drawn'], test: 'the proof shot held at phone size' },
  tutorial: { sources: ['capture'], test: 'one step from click to result, readable at phone size' },
};

// Physical or on-screen actions whose result must be seen; text that "types on" or "holds" is not one.
const ACTION = /\b(click|clicks|tap|taps|drag|drags|drop|drops|typing into|types into|pick|picks|grab|grabs|press|presses|swipe|swipes|scroll|scrolls|copy|copies|paste|pastes|opens|connect|connects|sends|pour|pours|lift|lifts|place|places|hands?)\b/i;
const empty = (v) => v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);

/**
 * What the creator's own words already settle, so it is not asked again: stated back as an assumption they can correct.
 * Only clear words count ("vertical", "square", "a demo of"); anything vaguer is asked.
 */
export function assumptions(brief) {
  const w = ` ${String(brief.in_their_words || '').toLowerCase()} `;
  const out = [];
  if (!(brief.deliver || []).some((d) => d.size)) {
    const size = /\b(vertical|portrait|9:16|reel|reels|tiktok|shorts|story|stories)\b/.test(w) ? '9:16' : /\b(square|1:1)\b/.test(w) ? '1:1' : /\b(landscape|horizontal|16:9|youtube)\b/.test(w) ? '16:9' : null;
    if (size) out.push({ id: 'size', value: size, because: w.match(/\b(vertical|portrait|9:16|reels?|tiktok|shorts|stor(y|ies)|square|1:1|landscape|horizontal|16:9|youtube)\b/)[0] });
  }
  if (!brief.kind) {
    // "the demo brand" names the sample brand, not a product demo.
    const kind = /\b(demo(?!\s+brand)|walkthrough|how it works)\b/.test(w) ? 'product-demo' : /\b(kinetic|type reel|launch|announc\w*)\b/.test(w) ? 'launch-reel' : /\b(my footage|our footage|clips? (i|we) shot|edit (my|our))\b/.test(w) ? 'footage-edit' : /\b(talking to (the )?camera|testimonial|ugc|presenter)\b/.test(w) ? 'ugc' : /\b(animated short|cartoon|character)\b/.test(w) ? 'animated-short' : null;
    if (kind) out.push({ id: 'kind', value: kind, because: w.match(/\b(demo(?!\s+brand)|walkthrough|how it works|kinetic|type reel|launch|announc\w*|my footage|our footage|talking to (the )?camera|testimonial|ugc|presenter|animated short|cartoon|character)\b/)[0] });
  }
  if (!brief.voice && /\b(no voice|no voice-?over|music only|just music|silent)\b/.test(w)) out.push({ id: 'voice', value: 'none', because: 'no voice' });
  return out;
}

const VOICES = ['voice-over', 'presenter', 'dialogue', 'none'];
const SETTABLE = ['kind', 'for', 'viewer_should', 'voice', 'length_cap_seconds', 'size'];

/**
 * Fill one field of the brief from an answer, so `check` stops asking that question. Returns a new brief.
 * size sets the master's size (adding a master when there is none). Free-form answers go to `decisions` instead.
 */
export function setField(brief, field, value) {
  const v = String(value ?? '').trim();
  if (!SETTABLE.includes(field)) throw new Error(`Can set: ${SETTABLE.join(', ')}. Record anything else with decide.`);
  if (!v) throw new Error(`${field} needs a value`);
  const b = { ...brief };
  if (field === 'kind' && !KINDS.includes(v)) throw new Error(`kind must be one of ${KINDS.join(', ')}`);
  if (field === 'voice' && !VOICES.includes(v)) throw new Error(`voice must be one of ${VOICES.join(', ')}`);
  if (field === 'length_cap_seconds') {
    const n = Number(v.replace(/\s*(s|sec|secs|seconds)$/i, ''));
    if (!(n > 0)) throw new Error('length_cap_seconds must be a number of seconds, e.g. 30');
    b.length_cap_seconds = n; return b;
  }
  if (field === 'size') {
    const deliver = (b.deliver || []).filter((d) => !empty(d.size) || d.master).map((d) => ({ ...d }));
    const master = deliver.find((d) => d.master);
    if (master) master.size = v; else deliver.unshift({ platform: '', size: v, master: true });
    b.deliver = deliver; return b;
  }
  b[field] = v; return b;
}

export function questions(brief, { job = {} } = {}) {
  const assumed = assumptions(brief);
  const settled = new Set(assumed.map((a) => a.id));
  const kind = brief.kind || assumed.find((a) => a.id === 'kind')?.value;
  const q = [];
  const ask = (id, question, why, recommended, rank) => q.push({ id, question, why, recommended, rank });
  const deliver = (brief.deliver || []).filter((d) => !empty(d.size));
  if (!deliver.length && settled.has('size')) { /* their words say it */ } else if (!deliver.length) {
    ask('size', 'Which size is the master, and where will it run?', 'The size decides every framing; changing it later redraws the whole storyboard.', job.size ? `${job.size} (from job.json)` : '9:16 for Reels, TikTok and Shorts; 1:1 if it is mainly a feed post', 1);
  } else if (!deliver.some((d) => d.master)) {
    ask('master', `Which of ${deliver.map((d) => d.size).join(', ')} is the master?`, 'The others are cut from it; the master is framed first.', deliver[0].size, 1);
  }
  if (empty(brief.kind) && !settled.has('kind')) ask('kind', 'Is this a product demo, a launch reel, an edit of your footage, a person talking to camera, or an animated short?', 'Each is made a different way: screen capture, type and motion, your footage, a presenter, or drawn characters.', null, 2);
  (brief.references || []).forEach((r, i) => {
    if (empty(r.liked_for)) ask(`ref-${i}`, `What do you like about ${r.source || `reference ${i + 1}`}: the camera, the pacing, the presenter's delivery, the look, the type, or the sound?`, 'We copy only the quality you like; copying the wrong one is how a remake misses its reference.', null, 3);
  });
  if (empty(brief.viewer_should)) ask('viewer', 'What should a viewer do or believe after one watch?', 'It decides the last shot and what every shot must prove.', null, 4);
  if (empty(brief.voice) && !settled.has('voice')) ask('voice', 'Who speaks: a voice-over, a person on camera, two people talking, or nobody (music and type)?', 'It decides how the film is timed: to the voice, to the music, or to the action.', kind === 'launch-reel' || kind === 'motion-graphics' ? 'none: music and type' : 'voice-over', 5);
  (brief.must_show || []).forEach((m, i) => {
    if (empty(m.evidence)) ask(`show-${i}`, `When the film says "${m.what}", what exactly should the viewer see on screen?`, 'A claim the viewer cannot see is the most common reason a finished cut came back.', null, 6);
  });
  if (!Number(brief.length_cap_seconds)) ask('length', 'How long at most?', 'The cap sets how many beats fit and how long each product shot can hold.', job.length_cap_seconds ? `${job.length_cap_seconds} s (from job.json)` : null, 7);
  return q.sort((a, b) => a.rank - b.rank);
}

/** Every shot, flattened with its scene id and position, from shots.json. */
export const allShots = (shots) => (shots?.scenes || []).flatMap((s) => (s.shots || []).map((sh, i) => ({ ...sh, scene: s.id, n: i + 1 })));

export function shotProblems(brief, shots) {
  const out = [];
  const list = allShots(shots);
  for (const s of list) {
    const where = `${s.scene} shot ${s.n}`;
    if (empty(s.point || s.purpose)) out.push({ where, what: 'no point', fix: 'one sentence: what this shot proves' });
    if (empty(s.eye || s.focal_point)) out.push({ where, what: 'no eye', fix: 'the one thing the viewer looks at' });
    if (ACTION.test(s.move || '') && s.proof?.at === undefined && !(s.keyframes || []).length) out.push({ where, what: 'an action with no proof moment', fix: 'add proof: { what, at } (the moment of contact or the result), so the storyboard draws that frame' });
    if (s.source === 'generated' && !s.test?.approved) out.push({ where, what: 'generated, not yet tested', fix: `make a short motion test first (${PATHS[brief.kind]?.test || 'a few seconds with sound'}) and record test.approved` });
  }
  (brief.must_show || []).forEach((m, i) => {
    if (!list.some((s) => [].concat(s.proves ?? []).includes(i) || [].concat(s.proves ?? []).includes(m.what))) out.push({ where: 'brief', what: `nothing shows "${m.what}"`, fix: `give the shot that shows it "proves": ${i}` });
  });
  (brief.references || []).forEach((r, i) => {
    for (const quality of r.liked_for || []) {
      if (!list.some((s) => (s.borrow || []).some((b) => b.ref === i && b.for === quality))) out.push({ where: 'brief', what: `${r.source || `reference ${i + 1}`} is liked for its ${quality}, and no shot borrows it`, fix: `add "borrow": [{ "ref": ${i}, "for": "${quality}" }] to the shots that should` });
    }
  });
  return out;
}

/** The short version a stage session reads: what was asked, what was decided, what is still open. */
export function summary(brief, { revisions = null } = {}) {
  const lines = [];
  if (brief.in_their_words) lines.push(`In their words: "${brief.in_their_words}"`);
  lines.push(`Kind: ${brief.kind || '?'}. For: ${brief.for || '?'}. After one watch they should: ${brief.viewer_should || '?'}.`);
  const d = (brief.deliver || []).filter((x) => x.size);
  lines.push(`Deliver: ${d.length ? d.map((x) => `${x.size}${x.platform ? ` ${x.platform}` : ''}${x.master ? ' (master)' : ''}`).join(', ') : '?'}. Cap: ${brief.length_cap_seconds ? `${brief.length_cap_seconds} s` : '?'}. Voice: ${brief.voice || '?'}.`);
  if ((brief.must_show || []).length) lines.push(`Must show: ${brief.must_show.map((m) => `${m.what}${m.evidence ? ` (seen as: ${m.evidence})` : ''}`).join('; ')}.`);
  if ((brief.must_not || []).length) lines.push(`Never: ${brief.must_not.join('; ')}.`);
  for (const [i, r] of (brief.references || []).entries()) lines.push(`Reference ${i}: ${r.source}${r.liked_for?.length ? `, liked for its ${r.liked_for.join(' and ')}` : ''}${r.in_their_words ? ` ("${r.in_their_words}")` : ''}${r.not_this ? `; not: ${r.not_this}` : ''}.`);
  for (const x of brief.decisions || []) lines.push(`Decided${x.date ? ` ${x.date}` : ''}: ${x.what}${x.applies_to && x.applies_to !== 'all' ? ` (${[].concat(x.applies_to).join(', ')})` : ''}.`);
  if (revisions?.rounds?.length) {
    const r = revisions.rounds.at(-1);
    const open = (r.items || []).filter((x) => x.status !== 'verified');
    lines.push(`Revision ${r.name}: ${(r.items || []).length} notes, ${open.length} not yet verified${open.length ? `: ${open.map((x) => `${x.action} ${x.aspect} in ${x.scope.join(',')}`).join('; ')}` : ''}.`);
  }
  return lines;
}
