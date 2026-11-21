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
