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
  // Task 14 restores exact equality here once the page calls brief_pick, brief_direct and styles_suggest.
  const names = new Set(TOOLS.map((t) => t.name));
  assert.deepEqual([...new Set(called)].filter((n) => !names.has(n)), []);
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
  const context = vm.createContext({ document, window: { scrollTo() {} }, navigator: {}, console, setTimeout, Promise, URLSearchParams });
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
  p.context.LIB_IN = { tabs, meta, brief: await import('../../tools/plan/lib/brief.mjs'), suggest: await import('../../tools/styles/lib/suggest.mjs') };
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

test('page: the expert prompt reads as the library\'s promptText', async () => {
  const { promptText } = await import('../../tools/styles/lib/library.mjs');
  const p = loadPage();
  const entries = await withLibrary(p);
  for (const e of entries) {
    p.context.ONE = e;
    assert.equal(p.run('promptText(ONE)'), promptText({ ...e, engine: e.engine_names }), e.id);
  }
});

/** A stand-in connector whose brief_pick runs the real pick rules (brief.mjs) on a list of picks it keeps. */
async function pickingStudio(p, { refuse = null } = {}) {
  const { setPick, picksOf } = await import('../../tools/plan/lib/brief.mjs');
  const entries = await withLibrary(p);
  const styles = new Map(entries.map((e) => [e.id, e]));
  let brief = { style_picks: [] };
  p.context.calls = [];
  p.context.studio = async (host, tool, input) => {
    p.context.calls.push({ tool, input: JSON.parse(JSON.stringify(input)) });
    if (tool !== 'brief_pick') return { payload: { job: 'j', questions: [] } };
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
