// The brief (templates/brief.json) and what is still missing from it. Pure functions; tools/plan/brief.mjs prints them.
//
// questions(): only the decisions that change what gets made, most consequential first, at most three at a time.
// The order comes from the owner's own revision history (docs/product-plan-2026-11-18.md): the wrong size cost a whole
// storyboard; a reference copied for the wrong quality cost a whole film (V5); a promise the viewer could not see
// ("we don't understand what you're showing") cost a delivery.
// shotProblems(): shots that cannot yet show what they promise.
// preflight(): the eight things the studio must know before it makes anything (brand, product, audience, angle, look,
// hook, type with references, delivery). plan(): the plan in brief, with a timed scene outline, once all eight are known.

export const KINDS = ['product-demo', 'launch-reel', 'motion-graphics', 'footage-edit', 'ugc', 'animated-short', 'promo', 'tutorial'];
export const QUALITIES = ['camera', 'pacing', 'edit', 'delivery', 'performance', 'look', 'type', 'sound', 'structure', 'story', 'character'];
export const SOURCES = ['capture', 'footage', 'drawn', 'type', 'generated', 'mixed'];
// How much the viewer already knows (knowledge/craft/15-hooks.md): it picks the hook family and how much is explained.
export const AWARENESS = ['cold', 'problem-aware', 'solution-aware', 'product-aware'];
// The six looks in knowledge/craft/13-design-styles.md; "propose" means the studio brings it with the three concepts.
export const LOOKS = ['paper', 'night', 'glass', 'colour-field', 'editorial', 'blueprint', 'propose'];

// Kinds that do not need the brand's product discovery (they do not show a product's UI).
const NO_PRODUCT = new Set(['footage-edit', 'animated-short']);
// Which reference-library types (library/references/index.json "type") show each kind best.
const EXAMPLE_TYPES = { 'product-demo': ['tutorial', 'promo'], 'launch-reel': ['launch'], 'motion-graphics': ['launch'], promo: ['promo', 'ad'], ugc: ['ad', 'social'], 'footage-edit': ['social'], 'animated-short': ['social'], tutorial: ['tutorial'] };
// The playbook and the beat framework each kind starts from (knowledge/playbooks/, library/structure/frameworks.json).
export const PLAYBOOK = { 'product-demo': 'demo', tutorial: 'tutorial', 'footage-edit': 'edit', ugc: 'edit', 'animated-short': 'edit' };
export const FRAMEWORK = { 'product-demo': 'studio-demo', tutorial: 'studio-tutorial', 'footage-edit': 'studio-edit', 'animated-short': 'studio-edit', ugc: 'founder-explainer' };

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
export function assumptions(brief, ctx = {}) {
  const w = ` ${String(brief.in_their_words || '').toLowerCase()} `;
  const again = new Set(Array.isArray(brief.ask_again) ? brief.ask_again : []); // reopened: ask, do not assume
  const raw = [];
  const out = { push: (a) => { if (!again.has(a.id)) raw.push(a); } };
  if (empty(brief.brand)) {
    const named = Object.keys(ctx.brands || {}).find((b) => new RegExp(`\\b${b === 'demo' ? 'demo brand' : b.replace(/[-]/g, '[- ]?')}\\b`).test(w)); // the sample brand is named only as "demo brand"; "a demo of" asks for a product demo
    if (named) out.push({ id: 'brand', value: named, because: named });
    else if (ctx.jobBrand) out.push({ id: 'brand', value: ctx.jobBrand, because: 'job.json' });
    else if (ctx.defaultBrand) out.push({ id: 'brand', value: ctx.defaultBrand, because: 'the studio default' });
  }
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
  return raw;
}

export const VOICES = ['voice-over', 'presenter', 'dialogue', 'none'];
export const SIZES = ['9:16', '1:1', '4:5', '16:9'];
// The hook family ids in library/hooks/index.json, plus "propose" (the studio brings three).
export const HOOK_FAMILIES = ['question', 'contrarian', 'outcome', 'problem', 'curiosity-gap', 'proof', 'story', 'how-to', 'list', 'mistake-warning', 'callout', 'comparison', 'offer', 'demonstration', 'pattern-interrupt', 'propose'];

// Plain words for every answer choice, in sentence case.
export const LABELS = {
  '9:16': 'Vertical 9:16', '1:1': 'Square 1:1', '4:5': 'Portrait 4:5', '16:9': 'Landscape 16:9',
  'product-demo': 'Product demo', 'launch-reel': 'Launch reel', 'motion-graphics': 'Motion graphics', 'footage-edit': 'Edit of your footage', ugc: 'Person talking to camera', 'animated-short': 'Animated short', promo: 'Promo', tutorial: 'Tutorial',
  camera: 'Camera', pacing: 'Pacing', edit: 'Editing', delivery: "Presenter's delivery", performance: 'Performance', look: 'Look', type: 'Type', sound: 'Sound', structure: 'Structure', story: 'Story', character: 'Character',
  cold: 'Not aware of the problem', 'problem-aware': 'Aware of the problem', 'solution-aware': 'Comparing solutions', 'product-aware': 'Already knows the product',
  paper: 'Paper', night: 'Night', glass: 'Glass', 'colour-field': 'Colour field', editorial: 'Editorial', blueprint: 'Blueprint', propose: 'Let the studio propose',
  'voice-over': 'Voice-over', presenter: 'Person on camera', dialogue: 'Two people talking', none: 'Nobody, music and type',
  question: 'Question', contrarian: 'Contrarian take', outcome: 'Outcome first', problem: 'Problem', 'curiosity-gap': 'Curiosity gap', proof: 'Proof', 'how-to': 'How to', list: 'List', 'mistake-warning': 'Mistake warning', callout: 'Callout', comparison: 'Comparison', offer: 'Offer', demonstration: 'Demonstration', 'pattern-interrupt': 'Pattern interrupt',
};
export const SETTABLE = ['kind', 'for', 'viewer_should', 'voice', 'length_cap_seconds', 'size'];

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

export function questions(brief, { job = {}, ctx = {} } = {}) {
  const assumed = assumptions(brief, { jobBrand: job.brand, ...ctx });
  const settled = new Set(assumed.map((a) => a.id));
  const kind = brief.kind || assumed.find((a) => a.id === 'kind')?.value;
  const q = [];
  const ask = (id, question, why, recommended, rank, extra = {}) => q.push({ id, question, why, recommended, rank, ...extra });
  const brand = brief.brand || assumed.find((a) => a.id === 'brand')?.value;
  const known = brand && ctx.brands?.[brand];
  const saved = !empty(brief.style); // a saved style (tools/plan/style.mjs) settles look, hook and references
  if (!brand) ask('brand', `Which brand is this for${Object.keys(ctx.brands || {}).length ? ` (${Object.keys(ctx.brands).join(', ')}, or a new one)` : ''}?`, 'Colours, type, logo, voice and the last five films all come from the brand folder.', null, 0);
  const deliver = (brief.deliver || []).filter((d) => !empty(d.size));
  if (!deliver.length && settled.has('size')) { /* their words say it */ } else if (!deliver.length) {
    ask('size', 'Which size is the master, and where will it run?', 'The size decides every framing; changing it later redraws the whole storyboard.', job.size ? `${job.size} (from job.json)` : '9:16 for Reels, TikTok and Shorts; 1:1 if it is mainly a feed post', 1);
  } else if (!deliver.some((d) => d.master)) {
    ask('master', `Which of ${deliver.map((d) => d.size).join(', ')} is the master?`, 'The others are cut from it; the master is framed first.', deliver[0].size, 1);
  }
  if (empty(brief.kind) && !settled.has('kind')) ask('kind', 'Is this a product demo, a launch reel, an edit of your footage, a person talking to camera, or an animated short?', 'Each is made a different way: screen capture, type and motion, your footage, a presenter, or drawn characters.', null, 2, { examples: examples(ctx.references) });
  (brief.references || []).forEach((r, i) => {
    if (empty(r.liked_for)) ask(`ref-${i}`, `What do you like about ${r.source || `reference ${i + 1}`}: the camera, the pacing, the presenter's delivery, the look, the type, or the sound?`, 'We copy only the quality you like; copying the wrong one is how a remake misses its reference.', null, 3);
  });
  if (!(brief.references || []).length && !brief.no_reference && !saved) ask('reference', 'Is there a film you want this one to feel like? A link, a file, or one from our library; then say what you like about it.', 'A reference settles pacing, look and energy faster than any description; without one we choose, and say why.', 'one of the examples below, or "none, you choose"', 3, { examples: examples(ctx.references, kind, 3, brand) });
  const needsProduct = !NO_PRODUCT.has(kind);
  if (empty(brief.product) && needsProduct) ask('product', 'Which product, and which feature or moment of it, is this film about?', 'Every product shot is real UI captured from the real product; we capture only what the film is about.', null, 4);
  if (empty(brief.for) || !AWARENESS.includes(brief.awareness)) ask('audience', 'Who exactly is it for, and how much do they know already: not aware of the problem, aware of the problem, comparing solutions, or already know the product?', 'It picks the hook family and how much the film explains before it shows.', known?.discovery ? `the ideal customer in brands/${brand}/product/discovery.md, section 2, with an awareness level` : null, 5);
  if (empty(brief.viewer_should)) ask('viewer', 'What should a viewer do or believe after one watch?', 'It decides the last shot and what every shot must prove.', null, 6);
  if (empty(brief.angle)) ask('angle', 'What is the angle, in one sentence: the pain it ends, the result it gives, the old way it replaces, the proof it has, the news, or the offer?', 'One angle per film. Two angles make two half-films and neither lands.', known?.discovery ? `the first key message in brands/${brand}/product/discovery.md, section 3` : null, 6);
  if (needsProduct && !(brief.must_show || []).length) ask('proof', 'What must the viewer see the product do, so they believe the angle?', 'A claim the viewer cannot see is the most common reason a finished cut came back.', null, 7);
  if (empty(brief.voice) && !settled.has('voice')) ask('voice', 'Who speaks: a voice-over, a person on camera, two people talking, or nobody (music and type)?', 'It decides how the film is timed: to the voice, to the music, or to the action.', kind === 'launch-reel' || kind === 'motion-graphics' ? 'none: music and type' : 'voice-over', 8);
  (brief.must_show || []).forEach((m, i) => {
    if (empty(m.evidence)) ask(`show-${i}`, `When the film says "${m.what}", what exactly should the viewer see on screen?`, 'A claim the viewer cannot see is the most common reason a finished cut came back.', null, 7);
  });
  if (!Number(brief.length_cap_seconds)) ask('length', 'How long at most?', 'The cap sets how many beats fit and how long each product shot can hold.', job.length_cap_seconds ? `${job.length_cap_seconds} s (from job.json)` : null, 9);
  if (empty(brief.look) && !saved) ask('look', 'Which look: one of our six styles (paper, night, glass, colour field, editorial, blueprint), the look of your reference, or shall we propose it with the three concepts?', 'The look sets the palette, light and type treatment of every frame.', 'propose: we bring it with the concepts, different from the last five films', 10);
  if (empty(brief.hook?.family) && empty(brief.hook?.idea) && !saved) ask('hook', 'Do you have an opening in mind (the first thing the viewer sees and hears)? If not, we bring three, each from a different hook family.', 'The first three seconds decide whether anyone sees the rest; the family follows from the audience.', 'propose: three openings from three families', 11);
  return q.sort((a, b) => a.rank - b.rank).map((x) => {
    const s = specOf(brief, x.id);
    const text = typeof x.recommended === 'string' ? x.recommended : '';
    const pick = s.values?.find((v) => text.startsWith(v) && !/[a-z0-9-]/i.test(text[v.length] || ''));
    return { ...x, field: s.field, choices: s.values ? s.values.map((value) => ({ value, label: LABELS[value] || value, recommended: value === pick })) : null, many: !!s.many };
  });
}

// Where each question's answer goes, and which fixed choices it has (null: open-ended).
const CHOSEN = {
  size: { field: 'size', values: () => SIZES },
  master: { field: 'size', values: (b) => [...new Set((b.deliver || []).filter((d) => !empty(d.size)).map((d) => d.size))] },
  kind: { field: 'kind', values: () => KINDS },
  audience: { field: 'awareness', values: () => AWARENESS },
  voice: { field: 'voice', values: () => VOICES },
  look: { field: 'look', values: () => LOOKS },
  hook: { field: 'hook.family', values: () => HOOK_FAMILIES },
};
const OPEN = { brand: 'brand', reference: 'references', product: 'product', viewer: 'viewer_should', angle: 'angle', proof: 'must_show', length: 'length_cap_seconds' };

function specOf(brief, id) {
  const m = /^(ref|show)-(\d+)$/.exec(id);
  if (m) return m[1] === 'ref' ? { field: `references.${m[2]}.liked_for`, values: QUALITIES, many: true, n: Number(m[2]) } : { field: `must_show.${m[2]}.evidence`, values: null, many: false, n: Number(m[2]) };
  if (Object.hasOwn(CHOSEN, id)) return { field: CHOSEN[id].field, values: CHOSEN[id].values(brief), many: false };
  if (Object.hasOwn(OPEN, id)) return { field: OPEN[id], values: null, many: false };
  return null;
}

// "Problem aware", " Colour field " -> "problem-aware", "colour-field".
const norm = (v) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, '-');

/** Is this a valid answer to the question? Plain words are matched to the choice they mean. Never throws. */
export function checkAnswer(brief, questionId, value) {
  const s = specOf(brief || {}, questionId);
  if (!s) return { ok: false, field: '', value: null, reason: `No question ${questionId}` };
  const bad = (reason) => ({ ok: false, field: s.field, value: null, reason });
  if (s.values) {
    const list = s.values.join(', ');
    if (Array.isArray(value) && !s.many) return bad(`Pick one of: ${list}`);
    const items = [].concat(value ?? []).map(norm).filter(Boolean);
    if (!items.length) return bad(`${s.many ? 'Pick at least one of' : 'Pick one of'}: ${list}`);
    if (items.some((i) => !s.values.includes(i))) return bad(`${s.many ? 'Pick any of' : 'Pick one of'}: ${list}`);
    return { ok: true, field: s.field, value: s.many ? [...new Set(items)] : items[0], reason: null };
  }
  const text = Array.isArray(value) ? '' : String(value ?? '').trim();
  if (!text) return bad('Say it in a few words.');
  if (questionId === 'length' && !(Number(text.replace(/\s*(s|sec|secs|seconds)$/i, '')) > 0)) return bad('Give the length as a number of seconds, for example 30.');
  return { ok: true, field: s.field, value: text, reason: null };
}

/**
 * Put one answer into the brief, so the question is not asked again. Returns a new brief; throws a plain Error when the
 * answer is not valid. For a choice, `value` is the choice (or several for ref-N); for an open question `words` (or value)
 * is the text. `words` also goes to `for` (audience) and `hook.idea` (hook). Uses setField where the chat's `set` does.
 */
export function applyAnswer(brief, questionId, answer = {}) {
  const b = { ...applyOne(brief, questionId, answer) };
  const cleared = ANSWER_CLEARS[questionId];
  if (cleared && Array.isArray(b.ask_again)) {
    const rest = b.ask_again.filter((id) => id !== cleared);
    if (rest.length) b.ask_again = rest; else delete b.ask_again;
  }
  return b;
}

// The assumption an answer settles, so a reopened item stops being asked again once it is answered.
const ANSWER_CLEARS = { size: 'size', master: 'size', kind: 'kind', voice: 'voice', brand: 'brand' };

function applyOne(brief, questionId, { value, words } = {}) {
  const s = specOf(brief, questionId);
  if (!s) throw new Error(`No question ${questionId}`);
  const w = String(words ?? '').trim();
  const given = s.values ? value : (w || value);
  const r = checkAnswer(brief, questionId, given);
  if (!r.ok) throw new Error(s.values && [].concat(given ?? []).some((g) => String(g).trim()) ? `${s.field.split('.').at(-1)} must be one of ${s.values.join(', ')}` : r.reason);
  const v = r.value;
  const b = { ...brief };
  if (questionId.startsWith('ref-')) {
    if (!(brief.references || [])[s.n]) throw new Error(`No reference ${s.n}`);
    b.references = brief.references.map((x, i) => (i === s.n ? { ...x, liked_for: v } : x));
    return b;
  }
  if (questionId.startsWith('show-')) {
    if (!(brief.must_show || [])[s.n]) throw new Error(`No must-show ${s.n}`);
    b.must_show = brief.must_show.map((x, i) => (i === s.n ? { ...x, evidence: v } : x));
    return b;
  }
  switch (questionId) {
    case 'size': case 'kind': case 'voice': return setField(brief, s.field, v);
    case 'length': return setField(brief, 'length_cap_seconds', v);
    case 'viewer': return setField(brief, 'viewer_should', v);
    case 'master': {
      // Mark the delivery that already has this size, rather than adding a second one.
      const deliver = (brief.deliver || []).map((d) => ({ ...d }));
      deliver.find((d) => d.size === v).master = true;
      b.deliver = deliver; return b;
    }
    case 'audience':
      // A card alone leaves "who" open, and the question would come straight back: ask for the words instead.
      if (!w && empty(brief.for)) throw new Error('Say who it is for in a few words.');
      b.awareness = v; return w ? setField(b, 'for', w) : b;
    case 'hook': b.hook = { ...brief.hook, family: v, ...(w && { idea: w }) }; return b;
    case 'proof': b.must_show = [...(brief.must_show || []), { what: v, evidence: '' }]; return b;
    case 'reference':
      if (/^none(,\s*you choose)?$/i.test(v)) b.no_reference = true;
      else b.references = [...(brief.references || []), { source: v, liked_for: [], use: 'study-only' }];
      return b;
    default: b[s.field] = v; return b; // brand, product, angle, look
  }
}

// For each checklist item: the brief fields reopening it clears, and the assumptions the customer's words could fill
// again (those are asked instead, through brief.ask_again).
const REOPEN = {
  brand: { fields: ['brand'], again: ['brand'] },
  product: { fields: ['product'] },
  audience: { fields: ['for', 'awareness'] },
  angle: { fields: ['angle', 'viewer_should', 'must_show'] },
  look: { fields: ['look'] },
  hook: { fields: ['hook'] },
  type: { fields: ['kind', 'references', 'no_reference'], again: ['kind'] },
  delivery: { fields: ['length_cap_seconds', 'voice'], sizes: true, again: ['size', 'voice'] },
};

// A saved style settles these; they are changed in chat, where the style can be looked at.
const STYLE_ITEMS = new Set(['look', 'hook', 'type']);

/**
 * Open one checklist item again (an id from preflight), so its questions are asked again. Returns a new brief; the
 * customer's words stay. Throws a plain Error for an unknown item, and for look, hook or type on a brief made from a
 * saved style.
 */
export function reopen(brief, itemId) {
  const r = Object.hasOwn(REOPEN, itemId) ? REOPEN[itemId] : null;
  if (!r) throw new Error(`No checklist item ${itemId}`);
  if (!empty(brief.style) && STYLE_ITEMS.has(itemId)) throw new Error(`That comes from your saved style ${brief.style}. To change it, say so in a chat in the studio folder.`);
  const b = { ...brief };
  for (const f of r.fields) delete b[f];
  if (r.sizes && Array.isArray(b.deliver)) {
    // Keep where it runs; only the sizes are asked again.
    b.deliver = b.deliver.map(({ size, ...rest }) => rest).filter((d) => !empty(d.platform) || d.master);
  }
  if (r.again) b.ask_again = [...new Set([...(Array.isArray(brief.ask_again) ? brief.ask_again : []), ...r.again])];
  return b;
}

/**
 * Films from the reference library a person can look at to say "like this": the ones with a study card first.
 * With a kind, those of that kind; without one, one per library type, so the "what kind of film" question has examples.
 */
export function examples(index = [], kind = null, n = 3, brand = null) {
  const own = (r) => Number(!!brand && String(r.brand || '').toLowerCase() === String(brand).toLowerCase());
  const list = (index || []).filter((r) => r.file).sort((a, b) => own(b) - own(a) || Number(!!b.study_card) - Number(!!a.study_card));
  const show = (r) => ({ type: r.type, title: r.title || r.file, brand: r.brand || null, seconds: r.seconds ? Math.round(r.seconds) : null, file: `library/references/${r.file}`, study_card: r.study_card ? `library/references/${r.study_card}` : null });
  if (kind) return list.filter((r) => (EXAMPLE_TYPES[kind] || []).includes(r.type)).slice(0, n).map(show);
  const seen = new Set();
  return list.filter((r) => !seen.has(r.type) && seen.add(r.type)).map(show);
}

/**
 * The pre-flight checklist: the eight things the studio must know before it captures, generates or proposes anything.
 * Each item is known (with what is known) or open (with what to do: a question to ask, or a stage to run first).
 * ctx.brands: { <brand>: { setUp, discovery } } from the brand folders; ctx.defaultBrand from studio.json.
 */
export function preflight(brief, { job = {}, ctx = {} } = {}) {
  const assumed = assumptions(brief, { jobBrand: job.brand, ...ctx });
  const got = (id) => assumed.find((a) => a.id === id)?.value;
  const kind = brief.kind || got('kind');
  const brand = brief.brand || got('brand');
  const b = brand ? ctx.brands?.[brand] : null;
  const saved = !empty(brief.style);
  const needsProduct = !NO_PRODUCT.has(kind);
  const deliver = (brief.deliver || []).filter((d) => !empty(d.size));
  const size = deliver.find((d) => d.master)?.size || deliver[0]?.size || got('size');
  const voice = brief.voice || got('voice');
  const refsOk = saved || brief.no_reference || ((brief.references || []).length && brief.references.every((r) => !empty(r.liked_for)));
  const proofOk = (brief.must_show || []).every((m) => !empty(m.evidence)) && (!needsProduct || (brief.must_show || []).length);
  const item = (id, label, done, known, todo) => ({ id, label, done: !!done, known: done ? known : null, todo: done ? null : todo });
  return [
    item('brand', 'Brand', brand && (!ctx.brands || b?.setUp), brand,
      !brand ? 'ask which brand' : `${brand} is not set up: run stage 0 (brand setup) first`),
    item('product', 'Product', !needsProduct || (!empty(brief.product) && (!ctx.brands || b?.discovery)), needsProduct ? brief.product : 'none shown (this kind shows no product UI)',
      empty(brief.product) ? 'ask which product and which feature or moment' : `${brand} has no approved product discovery: run stage 0B first`),
    item('audience', 'Audience', !empty(brief.for) && AWARENESS.includes(brief.awareness), `${brief.for} (${brief.awareness})`,
      'ask who it is for and how aware they are (cold, problem-aware, solution-aware, product-aware)'),
    item('angle', 'Message angle', !empty(brief.angle) && !empty(brief.viewer_should) && proofOk, `${brief.angle}; after one watch they ${brief.viewer_should}; proved by ${(brief.must_show || []).map((m) => m.evidence).join('; ') || 'the story itself'}`,
      `ask ${[empty(brief.angle) && 'the one angle', empty(brief.viewer_should) && 'what the viewer should do or believe', !proofOk && 'what on screen proves it'].filter(Boolean).join(', ')}`),
    item('look', 'Style and look', saved || !empty(brief.look), saved ? `the saved style ${brief.style}` : brief.look === 'propose' ? 'we propose it with the concepts' : brief.look,
      'ask for one of the six looks, the look of a reference, or "propose"'),
    item('hook', 'Hook', saved || !empty(brief.hook?.family) || !empty(brief.hook?.idea), saved ? `the saved style's opening` : brief.hook?.family === 'propose' ? 'we bring three, from three families' : [brief.hook?.family, brief.hook?.idea].filter(Boolean).join(': '),
      'ask for an opening they have in mind, or "propose"'),
    item('type', 'Video type and references', kind && refsOk, `${kind}; ${brief.no_reference ? 'no reference (we choose, and say why)' : saved ? 'references from the saved style' : (brief.references || []).map((r) => `${r.source} for its ${r.liked_for.join(' and ')}`).join('; ')}`,
      !kind ? 'ask what kind of film, with examples from the library' : 'ask for a reference and what they like about it, or "none, you choose"'),
    item('delivery', 'Size, length and voice', size && Number(brief.length_cap_seconds) && voice, `${size} master, at most ${brief.length_cap_seconds} s, voice: ${voice}`,
      `ask ${[!size && 'the master size', !Number(brief.length_cap_seconds) && 'the length cap', !voice && 'who speaks'].filter(Boolean).join(', ')}${size ? ` (size ${size} known)` : ''}`),
  ];
}

/**
 * The plan in brief, once the checklist is complete: one screen the creator confirms before concepts and shots.
 * framework: the beat framework from library/structure/frameworks.json (the CLI picks it); refs: library examples to study.
 * Returns null when the checklist is not complete.
 */
export function plan(brief, { job = {}, ctx = {}, framework = null } = {}) {
  const checks = preflight(brief, { job, ctx });
  if (checks.some((c) => !c.done)) return null;
  const by = Object.fromEntries(checks.map((c) => [c.id, c.known]));
  const assumed = assumptions(brief, { jobBrand: job.brand, ...ctx });
  const kind = brief.kind || assumed.find((a) => a.id === 'kind')?.value;
  const brand = brief.brand || assumed.find((a) => a.id === 'brand')?.value;
  const cap = Number(brief.length_cap_seconds);
  const lines = [];
  const others = (brief.deliver || []).filter((d) => d.size && !d.master).map((d) => d.size);
  lines.push(`Film: a ${cap} s ${kind} for ${brand}${brief.product ? `, about ${brief.product}` : ''}. ${by.delivery}${others.length ? `; cut to ${others.join(', ')}` : ''}.`);
  lines.push(`For: ${by.audience}.`);
  lines.push(`Angle: ${by.angle}.`);
  lines.push(`Look: ${by.look}. Hook: ${by.hook}.`);
  lines.push(`Type and references: ${by.type}. Nothing from a reference is placed in the film.`);
  if ((brief.must_not || []).length) lines.push(`Never: ${brief.must_not.join('; ')}.`);
  for (const d of (brief.decisions || []).filter((x) => !x.applies_to || x.applies_to === 'all')) lines.push(`Decided: ${d.what}.`);
  const outline = framework ? sceneOutline(framework, cap, brief.must_show || []) : [];
  const playbook = PLAYBOOK[kind] || 'promo';
  const study = examples(ctx.references, kind, 3, brand).map((r) => r.study_card || `${r.file} (no study card yet: run tools/study/profile.py first)`);
  const uses = [
    `playbook knowledge/playbooks/${playbook}.md`,
    `hooks: knowledge/craft/15-hooks.md and tools/hooks/hooks.mjs find --awareness ${brief.awareness}${brand ? ` --brand ${brand}` : ''}`,
    `structure: knowledge/craft/16-structure-and-retention.md and tools/plan/beats.mjs`,
    `look: knowledge/craft/13-design-styles.md${LOOKS.includes(brief.look) && brief.look !== 'propose' ? ` (${brief.look})` : ''}`,
    `brand: brands/${brand}/ (brand.json, rules.md, the last five films in ledger.json)`,
    needsProductUse(kind) ? `product: brands/${brand}/product/ (discovery.md, saved flows, capture.json)` : null,
    study.length ? `references to study (the brand's own first): ${study.join(', ')}` : null,
    'library: library/backgrounds, library/motion, library/ui-effects, library/sounds (one new move goes back into library/)',
    `skills (per skill-map.md): video-studio leads; zero-slop on every line; impeccable for frames; remotion-best-practices for scene code${kind === 'ugc' ? '; ugc-ad-scripts for the script' : ''}`,
  ].filter(Boolean);
  return { lines, outline, framework: framework ? { id: framework.id, name: framework.name } : null, uses };
}

const needsProductUse = (kind) => !NO_PRODUCT.has(kind);
const mid = (r) => (r[0] + r[1]) / 2;
const half = (x) => Math.round(x * 2) / 2;
// Beats whose job is to show the product working: the must-shows go there.
const PROOF_BEATS = ['proof', 'steps', 'body', 'walk-through', 'chapters', 'reveal', 'demo', 'story', 'body-first', 'insight'];

/** The framework's beats laid across the length cap, rough seconds each, with the must-shows on the proof beat. */
export function sceneOutline(framework, cap, mustShow = []) {
  const beats = (framework.beats || []).filter((b) => b.required || cap >= 20);
  const fixed = beats.filter((b) => b.seconds);
  const left = Math.max(0, cap - fixed.reduce((a, b) => a + mid(b.seconds), 0));
  const flex = beats.filter((b) => !b.seconds);
  const weights = flex.map((b) => (b.size ? mid(b.size) : 1 / Math.max(1, flex.length)));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const proofAt = beats.findIndex((b) => PROOF_BEATS.includes(b.id));
  let t = 0;
  return beats.map((b, i) => {
    const len = b.seconds ? mid(b.seconds) : (left * weights[flex.indexOf(b)]) / total;
    const from = half(t); t += len;
    return { n: i + 1, beat: b.id, name: b.name, from, to: i === beats.length - 1 ? cap : half(t), job: b.job, optional: !b.required, shows: i === (proofAt >= 0 ? proofAt : Math.floor(beats.length / 2)) ? mustShow.map((m) => m.evidence || m.what) : [] };
  });
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
