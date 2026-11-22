// Checks on the brief page (studio/brief-desk/index.html): it calls only the connector's tools and declares them all,
// carries the brand tokens, takes no uploads, has no banned words and keeps no briefs in browser storage. Then its
// script runs against a small stand-in for the document, to check how it answers cards, words its hand-off, and more.
//   node --test studio/tests/brief-desk.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { TOOLS } from '../../tools/connector/lib/tools.mjs';

const PAGE = fileURLToPath(new URL('../brief-desk/index.html', import.meta.url));
const CAPS = fileURLToPath(new URL('../brief-desk/capabilities.json', import.meta.url));
const MANIFEST = fileURLToPath(new URL('../../release/manifest.json', import.meta.url));

test('brief page: calls only the connector tools that exist, and declares them all', () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  const caps = JSON.parse(fs.readFileSync(CAPS, 'utf8'));
  const called = [...html.matchAll(/callTool\(\s*HOST\s*,\s*'([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(called)].sort(), TOOLS.map((t) => t.name).sort());
  assert.deepEqual(caps.mcp.servers[0].tools.sort(), TOOLS.map((t) => t.name).sort());
  assert.match(html, /const HOST = 'host:damex-engine'/);
});

test('brief page: brand tokens, no uploads, no banned words, no browser storage for briefs', () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  for (const t of ['#010B24', '#BBFC9E', '#FFA724', 'Chakra Petch']) assert.ok(html.includes(t), t);
  assert.doesNotMatch(html, /type="file"|localStorage\.setItem\([^)]*brief/i);
  const banned = new RegExp(JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).banned.join('|'), 'i');
  assert.doesNotMatch(html, banned);
});

/* ---------- The page's script, run against a small stand-in for the document ---------- */

class El {
  constructor(tag) { this.tag = tag; this.nodeType = 1; this.children = []; this.attrs = {}; this.listeners = {}; this.textContent = ''; this.dataset = {}; this.hidden = false; this.value = ''; }
  set className(v) { this.attrs.class = v; }
  get id() { return this.attrs.id; }
  append(...kids) { this.children.push(...kids); }
  replaceChildren(...kids) { this.children = kids; }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  focus() {} select() {} setSelectionRange() {}
}
const textOf = (n) => (typeof n === 'string' ? n : `${n.textContent}${n.children.map(textOf).join('')}`);
const find = (n, id) => { if (typeof n === 'string') return null; if (n.attrs.id === id) return n; for (const c of n.children) { const f = find(c, id); if (f) return f; } return null; };

/** Runs the page's script with no Claude app (so it starts in the no-studio view) and returns a way to run more code
 *  in the same scope, the view element and the document's own click listeners. */
function loadPage() {
  const html = fs.readFileSync(PAGE, 'utf8');
  const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const fixed = { status: new El('span'), home: new El('button'), view: new El('div') };
  const docListeners = [];
  const document = {
    activeElement: null,
    createElement: (tag) => new El(tag),
    getElementById: (id) => fixed[id] || find(fixed.view, id),
    addEventListener: (type, fn) => docListeners.push({ type, fn }),
  };
  const context = vm.createContext({ document, window: { scrollTo() {} }, navigator: {}, console, setTimeout, Promise, URLSearchParams, AbortController });
  vm.runInContext(script, context);
  return { run: (code) => vm.runInContext(code, context), view: fixed.view, docListeners, context };
}

const lookCard = "({ id: 'look', question: 'Which look?', field: 'look', many: false, choices: [{ value: 'paper', label: 'Paper', recommended: false }, { value: 'propose', label: 'Let the studio propose', recommended: true }] })";
const answering = (p, reply = { job: 'j', questions: [], recorded: false, reason: 'Pick one of the cards' }) => {
  p.context.calls = [];
  p.context.reply = reply;
  p.run("state.host = 'ready'; state.job = 'j'; state.check = { job: 'j', questions: [] }; state.mcp = { callTool: async (host, tool, input) => { calls.push({ tool, input }); return { payload: reply }; } };");
};

const sent = (p, i) => JSON.parse(JSON.stringify(p.context.calls[i].input)); // out of the page's realm, for deepEqual

test('brief page: typed words are not sent with the untouched recommended card', async () => {
  const p = loadPage();
  answering(p);
  p.run(`q = ${lookCard}; reply.questions = [q]; state.sample = null; draftOf(q).words = 'something moody';`);
  await p.run('answerCard(q)');
  assert.deepEqual(sent(p, 0), { job: 'j', question: 'look', words: 'something moody' });
  p.run("state.sample = { json: async () => ({ value: 'paper' }) };");
  await p.run('answerCard(q)');
  assert.deepEqual(sent(p, 1), { job: 'j', question: 'look', value: 'paper', words: 'something moody' });
  p.run("state.sample = null; document.getElementById('view').replaceChildren(card(q));");
  find(p.view, 'choice-look-propose').listeners.click[0]();
  await p.run('answerCard(q)');
  assert.deepEqual(sent(p, 2), { job: 'j', question: 'look', value: 'propose', words: 'something moody' }); // a card they picked goes with the words
});

test('brief page: the hand-off speaks of three concepts only for a job at the Idea stage', () => {
  const p = loadPage();
  p.run("state.done = { job: 'j', stage: 'storyboard', next: 'Start a new chat' }; state.view = 'handoff'; render();");
  assert.doesNotMatch(textOf(p.view), /three concepts/);
  assert.match(textOf(p.view), /Storyboard stage/);
  p.run("state.done = { job: 'j', stage: 'idea', next: 'Start a new chat' }; render();");
  assert.match(textOf(p.view), /three concepts/);
});

test('brief page: library films show under the reference card, and reasons read as plain words', () => {
  const p = loadPage();
  p.run(`state.check = { job: 'j', preflight: [], more: 0, brand_status: 'ready', assumed: [
    { id: 'brand', value: 'acme', because: 'your only brand', said: false }, { id: 'size', value: '9:16', because: 'vertical', said: true }],
    questions: [{ id: 'reference', question: 'Is there a film?', field: 'references', many: false, choices: null, recommended: null, examples: [{ title: 'Board tour', type: 'Promo' }] }] };
    state.view = 'questions'; state.host = 'ready'; render();`);
  const text = textOf(p.view);
  assert.match(text, /Board tour \(Promo\)/);
  assert.match(text, /acme \(your only brand\)/);
  assert.match(text, /9:16 \(you said "vertical"\)/);
});

test('brief page: without the studio it says to approve damex-engine or run the start step again', () => {
  const text = textOf(loadPage().view);
  assert.match(text, /approve "damex-engine"/);
  assert.match(text, /start step again/);
});

test('brief page: a tool error shows the tool\'s own text, and ideas are reworded only after the first click', async () => {
  const p = loadPage();
  p.context.err = { code: 'tool_error', message: 'Tool failed', result: { content: [{ type: 'text', text: 'The plan changed since it was shown; show it again.' }] } };
  assert.equal(p.run('explain(err).text'), 'The plan changed since it was shown; show it again.');
  assert.equal(p.run("explain({ code: 'tool_error', message: 'Only a message' }).text"), 'Only a message');
  p.context.asked = 0;
  p.run("state.ideas = [{ text: 'An idea' }]; state.sample = { json: async () => { asked++; return { ideas: ['A reworded idea'] }; } };");
  await p.run('rewordIdeas()');
  assert.equal(p.context.asked, 0);
  for (const l of p.docListeners.filter((x) => x.type === 'click')) await l.fn();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(p.context.asked, 1);
});

/* ---------- The director's desk and the style library (page version 3) ---------- */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SKETCHES_FILE = fileURLToPath(new URL('../../library/styles/sketches.json', import.meta.url));
const TAB_IDS = ['filming', 'motion', 'animation', 'product-ui', 'sound'];

/** The page's own CSS (every <style> block) and the :root token block within it. */
function cssOf(html) {
  const css = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  const tokens = /:root\s*\{[^}]*\}/.exec(css);
  return { css, tokens: tokens ? tokens[0] : '', rest: tokens ? css.replace(tokens[0], '') : css };
}

/** The library as the publish set holds it (engine names under engine_names), loaded into the page's scope. */
async function withLibrary(p) {
  const { loadLibrary } = await import('../../tools/styles/lib/library.mjs');
  const lib = loadLibrary(ROOT);
  const tabs = {};
  const counts = {};
  for (const t of TAB_IDS) {
    tabs[t] = lib.tabs[t].map(({ engine, ...rest }) => ({ ...rest, engine_names: engine || [] }));
    const families = {};
    for (const e of tabs[t]) families[e.family] = (families[e.family] || 0) + 1;
    counts[t] = { total: tabs[t].length, families };
  }
  const meta = { counts, sketches: JSON.parse(fs.readFileSync(SKETCHES_FILE, 'utf8')), notes: [], sound_slices: {} };
  p.context.LIB_IN = { tabs, meta, brief: await import('../../tools/plan/lib/brief.mjs'), suggest: await import('../../tools/styles/lib/suggest.mjs'), prompt: await import('../../tools/styles/lib/prompt.mjs') };
  p.run('libLoaded(LIB_IN)');
  return Object.values(tabs).flat();
}

test('page: version 3', () => {
  assert.match(fs.readFileSync(PAGE, 'utf8'), /<meta name="brief-page-version" content="3">/);
});

test('page: five tabs in order', () => {
  const p = loadPage();
  assert.deepEqual(JSON.parse(p.run('JSON.stringify(LIB_TABS)')), [
    { id: 'filming', name: 'Filming' }, { id: 'motion', name: 'Motion' }, { id: 'animation', name: 'Animation' },
    { id: 'product-ui', name: 'Product UI' }, { id: 'sound', name: 'Sound' }]);
  const html = fs.readFileSync(PAGE, 'utf8');
  for (const id of ['brief', 'library', 'reel', 'engine-uses']) assert.match(html, new RegExp(`id="${id}"`), id);
});

test('page: every sketch id in sketches.json has an implementation', () => {
  const p = loadPage();
  const { css } = cssOf(fs.readFileSync(PAGE, 'utf8'));
  const ids = JSON.parse(fs.readFileSync(SKETCHES_FILE, 'utf8')).map((s) => s.id);
  assert.equal(ids.length, 8);
  for (const id of ids) {
    assert.equal(p.run(`typeof SKETCH_ART[${JSON.stringify(id)}]`), 'function', id);
    assert.match(p.run(`sketchHTML(${JSON.stringify(id)})`), new RegExp(`sk--${id}`), id);
    assert.ok(css.includes(`.sk--${id}`), `CSS for ${id}`);
  }
});

test('page: keyframes animate only transform and opacity', () => {
  const { css } = cssOf(fs.readFileSync(PAGE, 'utf8'));
  const blocks = [...css.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^}]*\})*)\s*\}/g)];
  assert.ok(blocks.length > 8);
  for (const [, name, body] of blocks) {
    const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    assert.deepEqual(props.filter((x) => !['transform', 'opacity', 'animation-timing-function'].includes(x)), [], name);
  }
});

test('page: no engine name pattern in visible copy outside the engine fold and #engine-uses', async () => {
  const { engineNames } = await import('../../tools/styles/lib/library.mjs');
  const n = engineNames(ROOT);
  // Only names that read as engine names (kebab-case, paths, prefixed ids, CamelCase), not plain words such as "camera".
  const names = new Set([...n.moves, ...n.registry, ...n.backgrounds, ...n.sounds].filter((x) => /[-/:]|[a-z][A-Z]/.test(x)));
  const visible = (html) => html
    .replace(/<details class="engine-fold"[\s\S]*?<\/details>/g, ' ')
    .replace(/<section[^>]*id="engine-uses"[\s\S]*?<\/section>/g, ' ')
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  const hits = (text) => (text.match(/[A-Za-z0-9][A-Za-z0-9_\-/:.]*[A-Za-z0-9]/g) || []).filter((tok) => names.has(tok));
  assert.deepEqual(hits(visible(fs.readFileSync(PAGE, 'utf8'))), []);
  const p = loadPage();
  const entries = await withLibrary(p);
  p.context.ONE = null;
  const found = new Set();
  for (const e of entries) {
    p.context.ONE = e;
    const html = p.run('cardHTML(ONE) + drawerHTML(ONE) + reelFrameHTML(ONE) + paletteItemHTML(ONE, 0)');
    assert.match(html, /class="engine-fold"/); // the drawer keeps the names, behind the fold
    for (const h of hits(visible(html))) found.add(`${e.id}: ${h}`);
  }
  assert.deepEqual([...found], []);
});

test('page: prefers-reduced-motion stops previews', () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  const { css } = cssOf(html);
  const rm = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(css);
  assert.ok(rm, 'a reduced-motion block');
  assert.match(rm[1], /animation-play-state:\s*paused\s*!important/);
  const p = loadPage();
  p.context.v = { played: 0, paused: 0, currentTime: 0, play() { this.played++; return Promise.resolve(); }, pause() { this.paused++; } };
  p.run("window.matchMedia = (q) => ({ matches: q.includes('reduce') });");
  p.run('playClip(v)');
  assert.equal(p.context.v.played, 0);
  assert.equal(p.run('autoplayInDrawer()'), false);
  p.run('window.matchMedia = () => ({ matches: false });');
  p.run('playClip(v)');
  assert.equal(p.context.v.played, 1);
  assert.equal(p.run('autoplayInDrawer()'), true);
});

test('page: no font-family outside the three tokens', () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  const { tokens, rest } = cssOf(html);
  for (const t of ['--font-display', '--font-body', '--font-swash']) assert.match(tokens, new RegExp(`${t}:`), t);
  const decls = [...rest.matchAll(/font-family\s*:\s*([^;}]+)/g)].map((m) => m[1].trim());
  assert.ok(decls.length > 0);
  for (const d of decls) assert.match(d, /^var\(--font-(display|body|swash)\)$/, d);
  const script = html.slice(html.indexOf('<script>'), html.lastIndexOf('</script>'));
  assert.doesNotMatch(script, /font-family|fontFamily/);
  assert.doesNotMatch(html.replace(/<style>[\s\S]*?<\/style>/g, ''), /font-family|monospace/i);
  assert.doesNotMatch(tokens, /monospace/i);
});

test('page: no hex colour outside the token block', () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  const { tokens } = cssOf(html);
  assert.ok(tokens.includes('#010B24') && tokens.includes('#BBFC9E') && tokens.includes('#FFA724'));
  const outside = html.replace(tokens, '');
  assert.deepEqual(outside.match(/(?<![&\w])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi) || [], []);
});

test('page: the expert prompt reads as the library\'s promptText, from the shared module the page imports', async () => {
  const { promptText } = await import('../../tools/styles/lib/library.mjs');
  const html = fs.readFileSync(PAGE, 'utf8');
  assert.match(html, /import\('\.\/lib\/prompt\.mjs'\)/);
  assert.doesNotMatch(html, /one beat every|function energyLine/); // no copy of its own
  const p = loadPage();
  const entries = await withLibrary(p);
  for (const e of entries) {
    p.context.ONE = e;
    assert.equal(p.run('promptText(ONE)'), promptText({ ...e, engine: e.engine_names }), e.id);
  }
});

/** A stand-in connector whose brief_pick runs the real pick rules (brief.mjs) on a list of picks it keeps. */
async function pickingStudio(p, { refuse = null, fail = null } = {}) {
  const { setPick, picksOf } = await import('../../tools/plan/lib/brief.mjs');
  const entries = await withLibrary(p);
  const styles = new Map(entries.map((e) => [e.id, e]));
  let brief = { style_picks: [] };
  p.context.calls = [];
  p.context.studio = async (host, tool, input) => {
    p.context.calls.push({ tool, input: JSON.parse(JSON.stringify(input)) });
    if (tool !== 'brief_pick') return { payload: { job: 'j', questions: [], picks: picksOf(brief, styles) } };
    if (fail && fail(input)) throw Object.assign(new Error('The studio did not answer'), { code: 'server_unavailable' });
    let reason = refuse ? refuse(input) : null;
    if (!reason) {
      try { brief = setPick(brief, styles.get(input.id), input.on, styles); } catch (e) { reason = e.message; }
    }
    const picks = picksOf(brief, styles);
    return { payload: { job: 'j', questions: [], picks, picked: picks.some((x) => x.id === input.id), reason } };
  };
  p.run("state.host = 'ready'; state.job = 'j'; state.check = { job: 'j', questions: [] }; state.mcp = { callTool: (...a) => studio(...a) };");
  return { entries, picks: () => JSON.parse(p.run('JSON.stringify(state.picks.map((x) => x.id))')) };
}

test('page: a second pick in one family swaps it, through brief_pick, after the connector accepts it', async () => {
  const p = loadPage();
  const s = await pickingStudio(p);
  const [a, b] = s.entries.filter((e) => e.tab === 'motion' && e.family === 'Transitions' && e.filters.energy.includes('confident'));
  p.context.A = a; p.context.B = b;
  await p.run('pickToggle(A)');
  assert.deepEqual(s.picks(), [a.id]);
  await p.run('pickToggle(B)');
  assert.deepEqual(s.picks(), [b.id]);
  assert.deepEqual(p.context.calls.map((c) => [c.input.id, c.input.on]), [[a.id, true], [a.id, false], [b.id, true]]);
  assert.match(p.run('state.libNote.text'), /Swapped/);
  await p.run('pickToggle(B)'); // picking it again takes it off
  assert.deepEqual(s.picks(), []);
});

test('page: a clash refused by the connector shows its reason in amber and leaves the pick unmade', async () => {
  const p = loadPage();
  const s = await pickingStudio(p, { refuse: (input) => (input.on && input.id === p.context.REFUSED ? 'That one does not go with your film' : null) });
  const [f1, f2] = s.entries.filter((e) => e.tab === 'filming' && e.family === 'Camera move' && e.filters.energy.includes('confident'));
  const anim = s.entries.find((e) => e.tab === 'animation' && e.filters.energy.includes('confident'));
  Object.assign(p.context, { F1: f1, F2: f2, N: anim, REFUSED: anim.id });
  await p.run('pickToggle(F1)');
  await p.run('pickToggle(N)');
  assert.deepEqual(s.picks(), [f1.id]);
  assert.deepEqual(JSON.parse(p.run('JSON.stringify(state.libNote)')), { id: anim.id, tone: 'warm', text: 'That one does not go with your film' });
  // A family swap the connector refuses puts the first pick back.
  p.context.REFUSED = f2.id;
  p.context.calls.length = 0;
  await p.run('pickToggle(F2)');
  assert.deepEqual(s.picks(), [f1.id]);
  assert.deepEqual(p.context.calls.map((c) => [c.input.id, c.input.on]), [[f1.id, false], [f2.id, true], [f1.id, true]]);
  assert.equal(p.run('state.libNote.tone'), 'warm');
});

test('page: without the studio a pick is held, checked by the brief rules, and saved with the brief', async () => {
  const p = loadPage();
  const entries = await withLibrary(p);
  p.context.saved = [];
  p.run("state.host = 'none'; state.mcp = null; state.db = { collection: () => ({ doc: (id) => ({ set: async (d) => { saved.push(JSON.parse(JSON.stringify(d))); } }), onSnapshot: () => {} }) };");
  const [a, b] = entries.filter((e) => e.tab === 'filming' && e.family === 'Camera move' && e.filters.energy.includes('calm'));
  const hype = entries.find((e) => e.tab === 'motion' && e.filters.energy.length === 1 && e.filters.energy[0] === 'hype');
  p.context.A = a; p.context.B = b; p.context.H = hype;
  await p.run('pickToggle(A)');
  await p.run('pickToggle(B)'); // same family: swapped
  await p.run('pickToggle(H)'); // no shared energy: refused by brief.mjs, in amber
  assert.deepEqual(JSON.parse(p.run('JSON.stringify(state.picks)')), [{ tab: 'filming', id: b.id }]);
  assert.equal(p.run('state.libNote.tone'), 'warm');
  await p.run("saveWithoutStudio('A calm demo for acme')");
  assert.deepEqual(JSON.parse(JSON.stringify(p.context.saved.at(-1).style_picks)), [{ tab: 'filming', id: b.id }]); // out of the page's realm
  assert.equal(p.context.saved.at(-1).words, 'A calm demo for acme');
});

test('page: a family swap whose new pick fails puts the old pick back and checks again', async () => {
  const p = loadPage();
  const s = await pickingStudio(p, { fail: (input) => input.on && input.id === p.context.FAILING });
  const [a, b] = s.entries.filter((e) => e.tab === 'filming' && e.family === 'Camera move' && e.filters.energy.includes('confident'));
  Object.assign(p.context, { A: a, B: b, FAILING: b.id });
  await p.run('pickToggle(A)');
  p.context.calls.length = 0;
  await p.run('pickToggle(B)');
  assert.deepEqual(s.picks(), [a.id]);
  assert.deepEqual(p.context.calls.filter((c) => c.tool === 'brief_pick').map((c) => [c.input.id, c.input.on]), [[a.id, false], [b.id, true], [a.id, true]]);
  assert.ok(p.context.calls.some((c) => c.tool === 'brief_check'), 'the page reads the brief again, as its note says');
  assert.equal(p.run('state.libNote.tone'), 'notice'); // the studio did not answer: a notice, not a clash
});

/** A page store with no snapshot yet (the listener has not answered, or failed). */
function quietStore(p, { update = false } = {}) {
  p.context.saved = [];
  p.context.updates = [];
  p.run(`state.host = 'none'; state.mcp = null; state.db = { collection: () => ({ doc: (id) => ({
    set: async (d) => { saved.push(JSON.parse(JSON.stringify(d))); },
    ${update ? 'update: async (d) => { updates.push(JSON.parse(JSON.stringify(d))); },' : ''}
  }), onSnapshot: () => {} }) };`);
}

test('page: a pick after a no-studio save keeps the words', async () => {
  const p = loadPage();
  const entries = await withLibrary(p);
  quietStore(p);
  const [a, b] = entries.filter((e) => e.tab === 'filming' && e.filters.ready && e.filters.energy.includes('calm') && e.family !== 'Camera move').slice(0, 1).concat(entries.filter((e) => e.tab === 'motion' && e.filters.ready && e.filters.energy.includes('calm')).slice(0, 1));
  Object.assign(p.context, { A: a, B: b });
  await p.run('pickToggle(A)');
  await p.run("saveWithoutStudio('A calm demo for acme')");
  await p.run('pickToggle(B)');
  const last = JSON.parse(JSON.stringify(p.context.saved.at(-1)));
  assert.equal(last.words, 'A calm demo for acme');
  assert.equal(last.at, JSON.parse(JSON.stringify(p.context.saved[0])).at);
  assert.deepEqual(last.style_picks.map((x) => x.id), [a.id, b.id]);
  // With a store that can update one field, only the picks are written, so nothing the chat added is lost.
  const q = loadPage();
  await withLibrary(q);
  quietStore(q, { update: true });
  Object.assign(q.context, { A: a, B: b });
  await q.run("saveWithoutStudio('A calm demo for acme')");
  await q.run('pickToggle(B)');
  assert.deepEqual(JSON.parse(JSON.stringify(q.context.updates)), [{ style_picks: [{ tab: 'motion', id: b.id }] }]);
  assert.equal(q.context.saved.length, 1);
});

test('page: a pick that left the library stays in the reel, removable, and still counts', async () => {
  const p = loadPage();
  const s = await pickingStudio(p);
  p.run("state.picks = [{ tab: 'motion', id: 'mo-gone', name: 'An old style', stale: true }];");
  const html = p.run("reelFrameHTML(stalePick('mo-gone'))");
  assert.match(html, /An old style/);
  assert.match(html, /data-action="unpick" data-id="mo-gone"/);
  assert.match(html, /no longer in the library/i);
  assert.equal(p.run("state.picks.filter((x) => x.tab === 'motion').length"), 1);
  await p.run("pickToggle(stalePick('mo-gone'))");
  assert.deepEqual(p.context.calls.map((c) => [c.tool, c.input.id, c.input.on]), [['brief_pick', 'mo-gone', false]]);
  assert.deepEqual(s.picks(), []);
});

test('page: picks made before the brief show as saving while they are sent', async () => {
  const p = loadPage();
  const s = await pickingStudio(p);
  const e = s.entries.find((x) => x.tab === 'filming' && x.filters.ready);
  p.context.E = e;
  p.context.busyAt = [];
  const inner = p.context.studio;
  p.context.studio = async (...a) => { p.context.busyAt.push(p.run('state.libBusy')); return inner(...a); };
  await p.run("sendHeldPicks([{ tab: E.tab, id: E.id }])");
  assert.deepEqual(p.context.busyAt, [e.id]);
  assert.equal(p.run('state.libBusy'), null);
});

test('page: one accessible state per toggle, labelled regions and search, lazy thumbnails', async () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  assert.match(html, /<input[^>]*id="pal-q"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="brief"[^>]*role="region"|role="region"[^>]*id="brief"/);
  assert.match(html, /id="library"[^>]*role="region"|role="region"[^>]*id="library"/);
  const p = loadPage();
  const entries = await withLibrary(p);
  const e = entries.find((x) => x.tab === 'filming' && x.filters.ready);
  p.context.E = e;
  const label = (h) => /class="sc-pick[^"]*"[^>]*aria-label="([^"]+)"/.exec(h)[1];
  const off = p.run('cardHTML(E)');
  p.run("state.picks = [{ tab: E.tab, id: E.id }]");
  const on = p.run('cardHTML(E)');
  assert.equal(label(off), label(on));
  assert.match(off, /aria-pressed="false"/);
  assert.match(on, /aria-pressed="true"/);
  const thumb = p.run("previewHTML(E, 'thumb')");
  assert.match(thumb, /data-src="previews\//);
  assert.doesNotMatch(thumb, / src="/);
});

test('page: a view change scrolls the brief pane, not only the window, when the pane scrolls by itself', () => {
  const p = loadPage();
  p.context.pane = { scrollTop: 240 };
  p.run("const byId = document.getElementById; document.getElementById = (id) => (id === 'brief' ? pane : byId(id)); window.getComputedStyle = () => ({ overflowY: 'auto' });");
  p.run('toTop()');
  assert.equal(p.context.pane.scrollTop, 0);
});

/* ---------- Part 2: the opening, the director's brief, suggestions and the engine block ---------- */

const GOOD_TAKE = {
  logline: 'A calm look at one export click for agency owners',
  first_three_seconds: 'The board fades in and the export button glows softly',
  beats: [{ at_s: 0, what: 'The board settles' }, { at_s: 3, what: 'The pointer clicks export' }, { at_s: 6, what: 'The report lands' }],
  camera: 'A slow push toward the button, then it holds',
  motion: 'Soft arrivals that settle without a bounce',
  type: 'One plain line at a time, held for two seconds',
  sound: 'A soft tap on the click over a quiet bed',
  ending: 'The finished report rests on screen with the logo',
};

test('page: imports understood and suggest from ./lib/ and defines no copy of them', () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  assert.match(html, /import\('\.\/lib\/brief\.mjs'\)/);
  assert.match(html, /import\('\.\/lib\/suggest\.mjs'\)/);
  assert.match(html, /\.understood\(/);
  assert.match(html, /\.suggest\(/);
  assert.match(html, /\.checkDirectorBrief\(/);
  assert.doesNotMatch(html, /function (understood|suggest|rank|reasonFor|readWords|checkDirectorBrief)\(/);
  assert.doesNotMatch(html, /calm\|gentle\|soft\|quiet|punchy\|hype/); // no copy of the reading of words
});

test('page: the checklist strip uses CHECKLIST_LABELS', async () => {
  const { CHECKLIST_LABELS } = await import('../../tools/plan/lib/brief.mjs');
  const p = loadPage();
  await withLibrary(p);
  const items = (n) => { const strip = find(p.view, 'strip'); assert.ok(strip, 'a strip'); return strip.children.map((li) => [textOf(li).replace(/, (known|still open)$/, ''), li.attrs['data-done']]); };
  p.run("state.view = 'start'; render();");
  assert.deepEqual(items(), CHECKLIST_LABELS.map((l) => [l, 'false']));
  p.run(`state.check = { job: 'j', questions: [], assumed: [], preflight: ['brand','product','audience','angle','look','hook','type','delivery'].map((id, i) => ({ id, label: 'x' + i, done: i < 2, known: 'k' })) };
    state.view = 'questions'; state.host = 'ready'; render();`);
  assert.deepEqual(items(), CHECKLIST_LABELS.map((l, i) => [l, String(i < 2)]));
});

test('page: sharpen is hidden without sample', async () => {
  const p = loadPage();
  await withLibrary(p);
  p.run("state.sample = null; state.words = 'A calm demo of the export button'; render();");
  assert.equal(find(p.view, 'sharpen'), null);
  p.run('state.sample = { json: async () => ({}) }; render();');
  assert.ok(find(p.view, 'sharpen'));
});

/** The page with the library, a stubbed sample that answers from a queue, and a spy on checkDirectorBrief. */
async function directing(p, takes) {
  await withLibrary(p);
  const real = p.context.LIB_IN.brief;
  p.context.checked = [];
  p.context.LIB_IN = { ...p.context.LIB_IN, brief: { ...real, checkDirectorBrief: (parts, o) => { p.context.checked.push(JSON.parse(JSON.stringify(parts))); return real.checkDirectorBrief(parts, o); } } };
  p.run('libLoaded(LIB_IN)');
  p.context.asks = [];
  p.context.takes = takes.slice();
  p.run("state.directorNotes = '# The director'; state.sample = { json: async (prompt) => { asks.push(prompt); const t = takes.shift(); if (t instanceof Error) throw t; return JSON.parse(JSON.stringify(t)); } };");
  p.run("state.words = 'A calm 20 second demo of the export button for acme'; state.understood = understoodOf(state.words); render();");
}

test('page: director reply is checked with checkDirectorBrief before showing', async () => {
  const p = loadPage();
  const { beats, ...noBeats } = GOOD_TAKE;
  await directing(p, [noBeats, GOOD_TAKE]);
  await p.run('sharpen()');
  assert.equal(p.context.checked.length, 1);
  assert.equal(p.run('state.dir.status'), 'error');
  assert.match(textOf(p.view), /That take did not come out right\. Try again/);
  assert.equal(p.run('state.words'), 'A calm 20 second demo of the export button for acme'); // the words stay
  assert.doesNotMatch(textOf(p.view), /The board settles/);
  await p.run('sharpen()');
  assert.equal(p.run('state.dir.status'), 'ready');
  assert.match(textOf(p.view), /A calm look at one export click for agency owners/);
  assert.match(textOf(p.view), /A calm 20 second demo of the export button for acme/); // beside the customer's words
  assert.match(p.context.asks[0], /# The director/); // director.md goes with every ask
  assert.match(p.context.asks[0], /A calm 20 second demo of the export button for acme/);
});

test('page: a part can be kept, changed or swapped for another take of that part only', async () => {
  const p = loadPage();
  await directing(p, [GOOD_TAKE, { camera: 'A locked-off wide shot, no moves at all' }, { camera: '' }]);
  await p.run('sharpen()');
  p.run("partKeep('logline')");
  assert.equal(p.run("state.dir.states.logline"), 'kept');
  await p.run("swapPart('camera')");
  assert.match(p.context.asks[1], /"camera"/);
  assert.equal(p.run('state.dir.parts.camera'), 'A locked-off wide shot, no moves at all');
  assert.equal(p.run("state.dir.states.camera"), 'swapped');
  assert.equal(p.run('state.dir.parts.logline'), GOOD_TAKE.logline); // the other parts stay
  await p.run("swapPart('camera')"); // a malformed take for one part keeps the part as it was
  assert.equal(p.run('state.dir.parts.camera'), 'A locked-off wide shot, no moves at all');
  assert.match(p.run("state.dir.partNotes.camera"), /That take did not come out right\. Try again/);
  p.run("partChange('ending', 'The report rests and the logo fades in')");
  assert.equal(p.run("state.dir.states.ending"), 'changed');
});

test('page: "Keep this brief" saves through brief_direct, with engine names only from the picks', async () => {
  const p = loadPage();
  await directing(p, [{ ...GOOD_TAKE, engine: ['camera-auto-zoom', 'not-picked-name'] }]);
  const s = await pickingStudio(p);
  const film = s.entries.find((e) => e.filters.ready && (e.engine_names || []).includes('camera-auto-zoom') && e.filters.energy.includes('calm'));
  p.context.F = film;
  await p.run('pickToggle(F)');
  await p.run('sharpen()');
  p.context.calls.length = 0;
  await p.run('keepDirectorBrief()');
  const call = p.context.calls.find((c) => c.tool === 'brief_direct');
  assert.ok(call, 'brief_direct called');
  assert.deepEqual(Object.keys(call.input.parts).sort(), Object.keys(GOOD_TAKE).sort());
  assert.deepEqual(call.input.engine, ['camera-auto-zoom']);
  assert.equal(call.input.job, 'j');
});

test('page: suggestions come from styles_suggest when connected, otherwise from suggest on the built-in library', async () => {
  const { suggest } = await import('../../tools/styles/lib/suggest.mjs');
  const p = loadPage();
  const entries = await withLibrary(p);
  p.run("state.host = 'none'; state.words = 'a punchy vertical launch reel'; state.understood = understoodOf(state.words);");
  await p.run('refreshSuggestions()');
  const local = suggest(entries, { text: 'a punchy vertical launch reel', understood: JSON.parse(p.run('JSON.stringify(state.understood)')), picked: [] });
  assert.deepEqual(JSON.parse(p.run('JSON.stringify(state.suggestions.map((x) => x.id))')), local.map((x) => x.id));
  assert.equal(local.length, 6);
  p.context.calls = [];
  p.run("state.host = 'ready'; state.mcp = { callTool: async (h, tool, input) => { calls.push({ tool, input }); return { payload: { suggestions: [{ id: 'film-wide-then-working-shot', tab: 'filming', name: 'Wide', reason: 'you used this on acme-launch' }], notes: [] } }; } };");
  await p.run('refreshSuggestions()');
  assert.equal(p.context.calls[0].tool, 'styles_suggest');
  assert.equal(p.context.calls[0].input.text, 'a punchy vertical launch reel');
  assert.deepEqual(JSON.parse(p.run('JSON.stringify(state.suggestions)')), [{ id: 'film-wide-then-working-shot', reason: 'you used this on acme-launch' }]);
});

test('page: the chips come from understood as the words are typed, and each can be changed', async () => {
  const p = loadPage();
  await withLibrary(p);
  p.run("state.words = 'A vertical demo, 20 s, punchy, for agency owners'; hearWords();");
  assert.deepEqual(JSON.parse(p.run('JSON.stringify(state.understood)')), { size: '9:16', kind: 'product-demo', length: 20, energy: 'hype', audience: 'agency owners' });
  p.run("changeChip('size', '1:1')");
  assert.equal(p.run('state.understood.size'), '1:1');
  p.run("state.words = 'A vertical demo, 20 s, punchy, for agency owners, and more'; hearWords();");
  assert.equal(p.run('state.understood.size'), '1:1'); // a change outlives new typing
  // Once a brief exists, a change is an answer to the brief.
  answering(p, { job: 'j', questions: [], recorded: true, reason: null });
  await p.run("changeChip('size', '16:9')");
  assert.deepEqual(sent(p, 0), { job: 'j', question: 'size', value: '16:9' });
});

test('page: the plan shows "What the engine will use" from the plan\'s engine groups', () => {
  const p = loadPage();
  p.run(`state.plan = { lines: ['Film: a 20 s demo'], outline: [], engine: { ui: ['cursor-presenter'], motion: ['camera-auto-zoom'], sound: [], skills: ['video-studio', 'zero-slop'] } };
    state.view = 'plan'; state.host = 'ready'; state.job = 'j'; render();`);
  const text = textOf(p.view);
  assert.match(text, /What the engine will use/);
  assert.match(text, /UI library[\s\S]*cursor-presenter/);
  assert.match(text, /Motion library[\s\S]*camera-auto-zoom/);
  assert.match(text, /Built-in skills[\s\S]*video-studio/);
  assert.doesNotMatch(text, /Sound kit/); // an empty group is left out
});

test('page: the opening is one headline with the swash S, and one box', () => {
  const p = loadPage();
  p.run("state.view = 'start'; render();");
  const text = textOf(p.view);
  assert.match(text, /Start with a/);
  assert.match(fs.readFileSync(PAGE, 'utf8'), /class: 'swash'/);
  assert.ok(find(p.view, 'brief-words'));
});

test('page: a reel pick shows as gone only when flagged or once the library has loaded', async () => {
  const p = loadPage();
  p.run("state.lib.status = 'loading'; state.picks = [{ tab: 'motion', id: 'mo-x' }];");
  assert.equal(p.run('reelItems()[0].stale'), false);
  p.run("state.picks = [{ tab: 'motion', id: 'mo-x', stale: true, name: 'Old' }];");
  assert.equal(p.run('reelItems()[0].stale'), true);
  p.run("state.lib.status = 'error'; state.picks = [{ tab: 'motion', id: 'mo-x' }];");
  assert.equal(p.run('reelItems()[0].stale'), false);
  await withLibrary(p);
  p.run("state.picks = [{ tab: 'motion', id: 'mo-x' }];");
  assert.equal(p.run('reelItems()[0].stale'), true);
});

test('page: a swap whose new pick finds no studio keeps the earlier pick', async () => {
  const p = loadPage();
  const s = await pickingStudio(p);
  const [a, b] = s.entries.filter((e) => e.tab === 'filming' && e.family === 'Camera move' && e.filters.energy.includes('confident'));
  Object.assign(p.context, { A: a, B: b });
  await p.run('pickToggle(A)');
  const inner = p.context.studio;
  p.context.studio = async (host, tool, input) => { if (tool === 'brief_pick' && input.on) throw Object.assign(new Error('gone'), { code: 'server_not_connected' }); return inner(host, tool, input); };
  await p.run('pickToggle(B)');
  assert.equal(p.run('state.host'), 'none');
  assert.deepEqual(JSON.parse(p.run('JSON.stringify(state.picks.map((x) => x.id))')), [a.id]);
});

test('page: the big pick button is named by what it shows; amber stays for clashes and made on request', async () => {
  const p = loadPage();
  const entries = await withLibrary(p);
  const e = entries.find((x) => x.filters.ready);
  p.context.E = e;
  p.run("state.picks = [{ tab: E.tab, id: E.id }];");
  const big = /<button class="sc-pick btn pick-lg"[^>]*>([^<]+)</.exec(p.run('drawerHTML(E)'));
  assert.ok(big);
  assert.equal(big[1], 'Picked: remove');
  assert.doesNotMatch(big[0], /aria-label|aria-pressed/);
  const { rest } = cssOf(fs.readFileSync(PAGE, 'utf8'));
  for (const sel of ['.status[data-host="none"]::before', '#view .note[data-tone="warm"]', '.lib-note']) {
    const rule = new RegExp(`${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^{]*\\{([^}]*)\\}`).exec(rest);
    assert.ok(rule, sel);
    assert.doesNotMatch(rule[1], /--color-warm/, sel);
  }
});

/* ---------- The director's brief stays with its own brief ---------- */

/** A sample whose answers the test releases by hand, to see what happens to a reply that comes back late. */
function heldSample(p) {
  p.context.pending = [];
  p.run('state.sample = { json: (prompt, opts) => new Promise((resolve) => { pending.push({ prompt, resolve, opts }); }) };');
}

test('page: "Keep this brief" after a page-only save saves the canonical director\'s brief with the words', async () => {
  const p = loadPage();
  await directing(p, [GOOD_TAKE]);
  quietStore(p);
  await p.run("saveWithoutStudio('A calm 20 second demo of the export button for acme')");
  p.run("state.words = 'A calm 20 second demo of the export button for acme';");
  await p.run('sharpen()');
  await p.run('keepDirectorBrief()');
  assert.doesNotMatch(String(p.run("(state.notes['director-keep'] || {}).text")), /could not be saved/);
  const last = JSON.parse(JSON.stringify(p.context.saved.at(-1)));
  assert.equal(last.words, 'A calm 20 second demo of the export button for acme');
  assert.deepEqual(Object.keys(last.director_brief).sort(), ['at', 'energy', 'engine', 'parts']);
  assert.deepEqual(last.director_brief.parts, GOOD_TAKE);
  assert.equal(last.director_brief.energy, 'calm');
});

test('page: opening another brief clears the director\'s brief and the changed chips', async () => {
  const p = loadPage();
  await directing(p, [GOOD_TAKE]);
  await p.run('sharpen()');
  p.run("state.chipEdits = { size: '1:1' }; state.chipOpen = 'size';");
  answering(p, { job: 'k', questions: [], assumed: [], preflight: [], director_brief: null });
  await p.run("openBrief({ job: 'k', words: 'Another brief' })");
  assert.equal(p.run('state.dir.status'), 'idle');
  assert.deepEqual(JSON.parse(p.run('JSON.stringify(state.chipEdits)')), {});
  assert.equal(p.run('state.chipOpen'), null);
  assert.doesNotMatch(textOf(p.view), /A calm look at one export click/);
  p.run("state.dir.status = 'ready'; state.dir.parts = { logline: 'stale' };");
  await p.run('goHome()');
  assert.equal(p.run('state.dir.status'), 'idle');
});

test('page: a sharpen reply that comes back after a newer one is dropped', async () => {
  const p = loadPage();
  await directing(p, []);
  heldSample(p);
  const first = p.run('sharpen()');
  await new Promise((r) => setTimeout(r, 0));
  const second = p.run('sharpen()');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(p.context.pending.length, 2);
  assert.equal(p.context.pending[0].opts?.signal?.aborted, true); // the first call is aborted
  p.context.pending[1].resolve({ ...GOOD_TAKE, logline: 'The newer take' });
  await second;
  p.context.pending[0].resolve({ ...GOOD_TAKE, logline: 'The older take' });
  await first;
  assert.equal(p.run('state.dir.parts.logline'), 'The newer take');
});

test('page: a held director\'s brief for other words is not saved to the brief started', async () => {
  const p = loadPage();
  await directing(p, [GOOD_TAKE]);
  await p.run('sharpen()');
  await p.run('keepDirectorBrief()');
  assert.equal(p.run('state.dir.kept'), 'held');
  p.context.calls = [];
  p.run(`state.host = 'ready'; state.mcp = { callTool: async (h, tool, input) => { calls.push({ tool, input }); return { payload: { job: 'n', questions: [], assumed: [], preflight: [], picks: [] } }; } };`);
  p.run("state.words = 'A totally different film about the pricing page';");
  await p.run('startBrief()');
  assert.equal(p.context.calls.filter((c) => c.tool === 'brief_direct').length, 0);
  assert.equal(p.run('state.dir.kept'), false);
});

test('page: with no energy known, the director names one and its beats are checked against it', async () => {
  const p = loadPage();
  const tight = { ...GOOD_TAKE, beats: [{ at_s: 0, what: 'a' }, { at_s: 0.5, what: 'b' }, { at_s: 1, what: 'c' }] };
  await directing(p, [{ ...tight, energy: 'calm' }, { ...tight }, { ...tight, energy: 'hype' }]);
  p.run("state.words = 'A demo of the export button for acme'; state.understood = understoodOf(state.words);");
  await p.run('sharpen()');
  assert.equal(p.run('state.dir.status'), 'error'); // calm beats must be 1.2 s apart
  assert.match(textOf(p.view), /too tight for a calm film/);
  await p.run('sharpen()');
  assert.equal(p.run('state.dir.status'), 'error'); // no energy known and none named
  await p.run('sharpen()');
  assert.equal(p.run('state.dir.status'), 'ready');
  assert.equal(p.run('state.dir.energy'), 'hype');
  assert.match(fs.readFileSync(fileURLToPath(new URL('../../library/styles/director.md', import.meta.url)), 'utf8'), /"energy"/);
});

test('page: the engine-name test is brief.mjs isEngineName, and a part being changed survives a render', async () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  assert.match(html, /\.isEngineName\(/);
  assert.doesNotMatch(html, /\[-\/:\]\|\[a-z\]\[A-Z\]/);
  const p = loadPage();
  await directing(p, [GOOD_TAKE]);
  await p.run('sharpen()');
  p.run("state.dir.editing = 'camera'; state.dir.editText = 'Typed so far'; render();");
  assert.equal(find(p.view, 'ed-camera').value, 'Typed so far');
});

test('page: without the studio or a page store, the copy box carries the kept director\'s brief', async () => {
  const p = loadPage();
  await directing(p, [GOOD_TAKE]);
  await p.run('sharpen()');
  p.run("state.host = 'none'; state.db = null;");
  await p.run('keepDirectorBrief()');
  await p.run("saveWithoutStudio('A calm 20 second demo of the export button for acme')");
  assert.match(p.run('state.copyText'), /A calm 20 second demo of the export button for acme/);
  assert.match(p.run('state.copyText'), /Logline: A calm look at one export click for agency owners/);
  assert.match(p.run('state.copyText'), /0 s: The board settles/);
});

/* ---------- Director calls survive a brief starting ---------- */

test('page: a sharpen in flight when the brief starts from the same words still lands', async () => {
  const p = loadPage();
  await directing(p, []);
  heldSample(p);
  p.run(`state.host = 'ready'; state.mcp = { callTool: async (h, tool) => ({ payload: { job: 'n', questions: [], assumed: [], preflight: [], picks: [] } }) };`);
  const sharpening = p.run('sharpen()');
  await new Promise((r) => setTimeout(r, 0));
  await p.run('startBrief()');
  assert.equal(p.run('state.job'), 'n');
  p.context.pending[0].resolve(GOOD_TAKE);
  await sharpening;
  assert.equal(p.run('state.dir.status'), 'ready');
});

test('page: a dropped sharpen or swap never leaves the buttons busy', async () => {
  const p = loadPage();
  await directing(p, []);
  heldSample(p);
  p.run(`state.host = 'ready'; state.mcp = { callTool: async () => ({ payload: { job: 'n', questions: [], assumed: [], preflight: [], picks: [] } }) };`);
  const sharpening = p.run('sharpen()');
  await new Promise((r) => setTimeout(r, 0));
  p.run("state.words = 'Other words for another film entirely';");
  await p.run('startBrief()');
  p.context.pending[0].resolve(GOOD_TAKE);
  await sharpening;
  assert.notEqual(p.run('state.dir.status'), 'loading');
  assert.ok(find(p.view, 'sharpen'));
  assert.equal(find(p.view, 'sharpen').attrs.disabled, undefined);
});

test('page: a late swap reply is dropped, and the part is free again', async () => {
  const p = loadPage();
  await directing(p, [GOOD_TAKE]);
  await p.run('sharpen()');
  heldSample(p);
  const swapping = p.run("swapPart('camera')");
  await new Promise((r) => setTimeout(r, 0));
  p.run('directorCall()'); // a newer call moves the sequence on
  p.context.pending[0].resolve({ camera: 'A late take of the camera' });
  await swapping;
  assert.equal(p.run('state.dir.parts.camera'), GOOD_TAKE.camera);
  assert.equal(p.run('state.dir.busyPart'), null);
});

test('page: an opened brief with its own director\'s brief shows it', async () => {
  const p = loadPage();
  await withLibrary(p);
  p.run('state.sample = { json: async () => ({}) };');
  answering(p, { job: 'k', questions: [], assumed: [], preflight: [], director_brief: { ...GOOD_TAKE, logline: 'The opened brief\'s own logline' } });
  await p.run("openBrief({ job: 'k', words: 'A calm demo' })");
  const text = textOf(p.view);
  assert.match(text, /A director's brief is kept with this brief/);
  assert.match(text, /The opened brief's own logline/);
  assert.match(text, /0 s: The board settles/);
});

test('page: "Keep this brief" without the studio attaches only to a saved brief with the same words', async () => {
  const p = loadPage();
  await directing(p, [GOOD_TAKE]);
  quietStore(p);
  await p.run("saveWithoutStudio('A brief about something else')");
  p.run("state.words = 'A calm 20 second demo of the export button for acme';");
  await p.run('sharpen()');
  p.run("state.words = '';");
  await p.run('keepDirectorBrief()');
  assert.equal(p.context.saved.length, 1);
  assert.equal(p.run("state.notes['director-keep'].tone"), 'warm');
  assert.match(p.run("state.notes['director-keep'].text"), /made for other words/);
});

test('page: the director section has no live region of its own; status goes through announce()', () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  assert.doesNotMatch(html, /id: 'director', 'aria-live'/);
  assert.match(html, /announce\(['"]The director is working on your brief\.['"]\)/);
});

/* ---------- Final review fixes ---------- */

test('page: every grid card after the first shows its own line, not its place in the list', async () => {
  const p = loadPage();
  const entries = await withLibrary(p);
  const two = entries.filter((e) => e.tab === 'motion').slice(0, 2);
  p.context.TWO = two;
  const html = p.run('gridCardsHTML(TWO)');
  const lines = [...html.matchAll(/<p class="sc-line">([^<]*)<\/p>/g)].map((m) => m[1]);
  assert.equal(lines.length, 2, html);
  assert.equal(lines[1], two[1].line.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;'));
  assert.doesNotMatch(html, /class="reason"/);
  const src = fs.readFileSync(PAGE, 'utf8');
  assert.doesNotMatch(src, /\.map\(cardHTML\)/);
});

test('page: one tab that does not load leaves the others, with a plain note on that tab', async () => {
  const p = loadPage();
  const { loadLibrary } = await import('../../tools/styles/lib/library.mjs');
  const lib = loadLibrary(ROOT);
  p.context.LISTS = Object.fromEntries(TAB_IDS.map((t) => [t, lib.tabs[t].map(({ engine, ...rest }) => ({ ...rest, engine_names: engine || [] }))]));
  p.run(`fetch = async (path) => {
    if (path === 'styles/motion.json') return { ok: false, status: 404, json: async () => null };
    if (path === 'styles/meta.json') return { ok: true, json: async () => ({ counts: {}, notes: [] }) };
    const tab = path.slice('styles/'.length, -'.json'.length);
    return { ok: true, json: async () => JSON.parse(JSON.stringify(LISTS[tab])) };
  };`);
  await p.run('startLibrary()');
  assert.equal(p.run('state.lib.status'), 'ready');
  assert.ok(p.run('state.lib.tabs.filming.length') > 0);
  assert.equal(p.run('state.lib.tabs.motion.length'), 0);
  assert.deepEqual(JSON.parse(p.run('JSON.stringify(state.lib.failed)')), ['motion']);
  assert.match(p.run("libTabNote('motion')"), /The Motion styles did not load/);
  assert.equal(p.run("libTabNote('filming')"), '');
  // every tab failing is still the whole library not loading
  p.run("fetch = async () => ({ ok: false, status: 500, json: async () => null });");
  await p.run('startLibrary()');
  assert.equal(p.run('state.lib.status'), 'error');
});

test('page: a refusal the studio could not answer is a notice, not amber; a clash stays amber', async () => {
  const p = loadPage();
  const entries = await withLibrary(p);
  p.context.E = entries.find((e) => e.filters.ready);
  p.run("refusePick(E, 'The studio did not answer.', 'notice')");
  assert.equal(p.run('state.libNote.tone'), 'notice');
  assert.match(p.run('noteHTML(E.id)'), /data-tone="notice"/);
  p.run("refusePick(E, 'It does not go with your film.')");
  assert.equal(p.run('state.libNote.tone'), 'warm');
  const { rest } = cssOf(fs.readFileSync(PAGE, 'utf8'));
  for (const sel of ['.clash[data-tone="notice"]', '.reel-hint[data-tone="notice"]']) {
    const rule = new RegExp(`${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^{]*\\{([^}]*)\\}`).exec(rest);
    assert.ok(rule, sel);
    assert.match(rule[1], /--color-notice/, sel);
  }
});

test('page: a second pick click while one saves says one moment, and is not sent', async () => {
  const p = loadPage();
  const s = await pickingStudio(p);
  const [a, b] = s.entries.filter((e) => e.tab === 'motion' && e.filters.ready);
  Object.assign(p.context, { A: a, B: b });
  p.run('state.libBusy = A.id;');
  await p.run('pickToggle(B)');
  assert.equal(p.context.calls.length, 0);
  assert.match(p.run('state.libNote.text'), /One moment/);
  assert.equal(p.run('state.libNote.id'), b.id);
  assert.notEqual(p.run('state.libNote.tone'), 'warm');
});

test('page: the clash note clears once the brief is confirmed', async () => {
  const p = loadPage();
  answering(p, { job: 'j', stage: 'idea', next: 'Start a new chat' });
  p.run("state.libNote = { id: 'x', tone: 'warm', text: 'It does not go with your film.' };");
  await p.run('confirmPlan()');
  assert.equal(p.run('state.libNote'), null);
});

test('page: an energy chip change goes to the brief, before and after it starts', async () => {
  const p = loadPage();
  await withLibrary(p);
  answering(p, { job: 'j', questions: [], recorded: true, reason: null, energy: 'hype' });
  await p.run("changeChip('energy', 'hype')");
  assert.deepEqual(sent(p, 0), { job: 'j', question: 'energy', value: 'hype' });
  assert.equal(p.run('energyNow()'), 'hype');
  // held before the brief existed, then sent with the others
  p.context.calls.length = 0;
  p.run("state.chipEdits = { energy: 'calm', size: '1:1' };");
  await p.run('sendHeldChips()');
  const sentIds = p.context.calls.filter((c) => c.tool === 'brief_answer').map((c) => c.input.question).sort();
  assert.deepEqual(sentIds, ['energy', 'size']);
});

test('page: the brief\'s chosen energy shows with the rest of what was understood, and can be changed', async () => {
  const p = loadPage();
  await withLibrary(p);
  p.run("state.host = 'ready'; state.job = 'j'; state.view = 'questions'; state.check = { job: 'j', questions: [], assumed: [], preflight: [], energy: 'hype' }; render();");
  const text = textOf(p.view);
  assert.match(text, /Energy Hype/);
  assert.ok(find(p.view, 'chip-energy'));
});

test('page: "Keep this brief" sends the energy its beats were checked against', async () => {
  const p = loadPage();
  await directing(p, [GOOD_TAKE]);
  await pickingStudio(p);
  await p.run('sharpen()');
  p.context.calls.length = 0;
  await p.run('keepDirectorBrief()');
  const call = p.context.calls.find((c) => c.tool === 'brief_direct');
  assert.equal(call.input.energy, 'calm');
});

test('page: the director\'s beats are checked against the length cap too', async () => {
  const p = loadPage();
  await directing(p, [{ ...GOOD_TAKE, beats: [{ at_s: 0, what: 'The board settles' }, { at_s: 25, what: 'Too late' }] }]);
  await p.run('sharpen()');
  assert.equal(p.run('state.dir.status'), 'error');
  assert.match(p.run('state.dir.reason'), /20 s film/);
});

test('page: without the studio or a page store, the copy box carries the picks by name', async () => {
  const p = loadPage();
  const entries = await withLibrary(p);
  const a = entries.find((e) => e.tab === 'motion' && e.filters.ready);
  p.context.A = a;
  p.run("state.host = 'none'; state.db = null; state.picks = [{ tab: A.tab, id: A.id }, { tab: 'sound', id: 'gone-sound', stale: true, name: 'gone-sound' }];");
  await p.run("saveWithoutStudio('A calm 20 second demo of the export button for acme')");
  assert.match(p.run('state.copyText'), /A calm 20 second demo of the export button for acme/);
  assert.match(p.run('state.copyText'), new RegExp(`Picked styles: Motion ${a.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}; Sound gone-sound \\(no longer in the library\\)`));
});
