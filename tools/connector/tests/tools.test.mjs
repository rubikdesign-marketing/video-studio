import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { scratchStudio, completeBrief } from '../../plan/tests/helpers.mjs';
import { loadJob, saveBrief } from '../../plan/lib/brief-store.mjs';
import { studioMemory } from '../lib/memory.mjs';
import { TOOLS, makeHandlers } from '../lib/tools.mjs';

const root = scratchStudio();
fs.mkdirSync(path.join(root, 'jobs', 'broken'), { recursive: true });
fs.writeFileSync(path.join(root, 'jobs', 'broken', 'brief.json'), '{ not json');
const demoOnlyRoot = scratchStudio();
fs.rmSync(path.join(demoOnlyRoot, 'brands', 'acme'), { recursive: true });
const h = makeHandlers(root);
const jobDir = (r, job) => path.join(r, 'jobs', job);
/** A scratch studio with two customer brands, acme and acme-two, so the brand is asked. */
const twoBrands = () => { const r = scratchStudio(); fs.mkdirSync(path.join(r, 'brands', 'acme-two'), { recursive: true }); fs.writeFileSync(path.join(r, 'brands', 'acme-two', 'brand.json'), '{}'); return r; };

test('tools: start, answer and plan a brief in the page\'s order', () => {
  const s = h.brief_start({ words: 'A vertical demo of the export button for acme' });
  assert.match(s.job, /^\d{4}-\d{2}-\d{2}-vertical-demo-export-button/);
  assert.ok(s.assumed.some((a) => a.id === 'size' && a.value === '9:16'));
  assert.ok(s.questions.length <= 3);
  assert.equal(s.brand_status, 'ready');
  const a = h.brief_answer({ job: s.job, question: 'look', value: 'neon', words: 'something neon' });
  assert.equal(a.recorded, false); assert.match(a.reason, /paper/);
  assert.ok(loadJob(jobDir(root, s.job)).brief.decisions.some((d) => /something neon/.test(d.what)));
});

test('tools: job names that leave jobs/ are refused', () => {
  for (const job of ['../.env', 'a/b', '/etc', 'C:\\x', '', undefined, 'nope']) assert.throws(() => h.brief_check({ job }), /Not a brief/);
  assert.throws(() => h.brief_answer({ job: '../.env', question: 'look', value: 'paper' }), /Not a brief/);
  assert.throws(() => h.brief_plan({ job: 'a/b' }), /Not a brief/);
  assert.throws(() => h.brief_confirm({ job: '/etc' }), /Not a brief/);
});

test('tools: a broken brief.json is a plain error', () => {
  assert.throws(() => h.brief_check({ job: 'broken' }), /broken: brief\.json cannot be read/);
});

test('tools: only the demo brand means parked, never demo by default', () => {
  const d = makeHandlers(demoOnlyRoot);
  const r = d.brief_start({ words: 'a launch reel for our new app' });
  assert.equal(r.brand_status, 'none'); assert.equal(r.parked, true); assert.equal(r.ready_for_plan, false);
  assert.ok(!r.assumed.some((x) => x.id === 'brand'));
  assert.equal(loadJob(jobDir(demoOnlyRoot, r.job)).brief.parked, 'no brand yet');
  assert.throws(() => d.brief_plan({ job: r.job }), /^Error: Not yet: set up your brand first/);
  const again = d.brief_answer({ job: r.job, question: 'voice', value: 'none' });
  assert.equal(again.recorded, true);
});

test('tools: the word demo asks for a product demo, it does not pick the demo brand', () => {
  for (const r of [twoBrands(), (() => { const x = twoBrands(); fs.writeFileSync(path.join(x, 'studio.json'), JSON.stringify({ default_brand: 'demo' })); return x; })()]) {
    const s = makeHandlers(r).brief_start({ words: 'a vertical demo of the export button' });
    assert.ok(!s.assumed.some((a) => a.id === 'brand'));
    assert.ok(s.assumed.some((a) => a.id === 'kind' && a.value === 'product-demo'));
    assert.ok(s.questions.some((q) => q.id === 'brand' && q.choices.every((c) => c.value !== 'demo')));
    assert.notEqual(loadJob(jobDir(r, s.job)).brief.brand, 'demo');
  }
});

test('tools: a parked brief confirms without recording or making a job', () => {
  const d = makeHandlers(demoOnlyRoot);
  const r = d.brief_start({ words: 'a parked reel for acme friends' });
  saveBrief(jobDir(demoOnlyRoot, r.job), { ...completeBrief(), brand: 'acme', parked: 'no brand yet' });
  const c = d.brief_confirm({ job: r.job });
  assert.equal(c.stage, null); assert.match(c.next, /set up my brand/);
  assert.ok(!fs.existsSync(path.join(jobDir(demoOnlyRoot, r.job), 'job.json')));
  assert.ok(!(loadJob(jobDir(demoOnlyRoot, r.job)).brief.decisions || []).some((x) => x.what === 'plan confirmed'));
});

test('tools: long words with quotes and line breaks are kept word for word', () => {
  const words = `"Quoted"\nsecond line ${'x'.repeat(5000)}`;
  const s = h.brief_start({ words });
  assert.equal(loadJob(jobDir(root, s.job)).brief.in_their_words, words);
  assert.ok(studioMemory(root).briefs.find((b) => b.job === s.job).words.length <= 120);
  assert.ok(JSON.stringify(s).length < 6000);
});

test('tools: a second brief with the same name gets a number', () => {
  const a = h.brief_start({ words: 'twin launch film for acme' });
  const b = h.brief_start({ words: 'twin launch film for acme' });
  assert.equal(b.job, `${a.job}-2`);
  assert.equal(h.brief_start({ words: 'twin launch film for acme' }).job, `${a.job}-3`);
});

test('tools: brief_start needs words, and a style failure is the error', () => {
  assert.throws(() => h.brief_start({ words: '  ' }), /words/);
  assert.throws(() => h.brief_start({}), /words/);
  assert.throws(() => h.brief_start({ words: 'x film', style: '../x' }), /style/);
  assert.throws(() => h.brief_start({ words: 'styled film', style: 'acme/none' }));
});

test('tools: answers by value, by words, and the rules between them', () => {
  const s = h.brief_start({ words: 'answer rules film for acme' });
  const ok = h.brief_answer({ job: s.job, question: 'voice', value: 'voice over' });
  assert.equal(ok.recorded, true); assert.equal(ok.reason, null);
  assert.equal(loadJob(jobDir(root, s.job)).brief.voice, 'voice-over');
  const cards = h.brief_answer({ job: s.job, question: 'look', words: 'moody' });
  assert.equal(cards.recorded, false); assert.match(cards.reason, /Pick one of the cards/);
  const open = h.brief_answer({ job: s.job, question: 'angle', words: 'one click replaces the weekly report' });
  assert.equal(open.recorded, true);
  assert.equal(loadJob(jobDir(root, s.job)).brief.angle, 'one click replaces the weekly report');
  assert.ok(loadJob(jobDir(root, s.job)).brief.decisions.some((d) => d.what === 'angle: "one click replaces the weekly report"'));
  assert.throws(() => h.brief_answer({ job: s.job, question: 'angle' }), /value or words/);
  const unknown = h.brief_answer({ job: s.job, question: 'zzz', value: 'x' });
  assert.equal(unknown.recorded, false); assert.match(unknown.reason, /No question zzz/);
  const missing = h.brief_answer({ job: s.job, question: 'show-4', value: 'x', words: 'x' });
  assert.equal(missing.recorded, false);
});

test('tools: the brand question offers customer brands only, and only those are accepted', () => {
  const r = twoBrands();
  const hr = makeHandlers(r);
  const s = hr.brief_start({ words: 'a reel with no brand named' });
  const q = s.questions.find((x) => x.id === 'brand');
  assert.ok(q, 'brand is asked');
  assert.deepEqual(q.choices.map((c) => c.value), ['acme', 'acme-two']);
  assert.doesNotMatch(q.question, /demo/);
  assert.match(q.question, /new brand is set up in chat/);
  assert.equal(hr.brief_answer({ job: s.job, question: 'brand', value: 'demo' }).recorded, false);
  assert.equal(hr.brief_answer({ job: s.job, question: 'brand', value: 'acme' }).recorded, true);
  assert.equal(loadJob(jobDir(r, s.job)).brief.brand, 'acme');
});

test('tools: a studio with one customer brand assumes it, with a plain reason', () => {
  for (const r of [scratchStudio(), (() => { const x = scratchStudio(); fs.rmSync(path.join(x, 'studio.json')); return x; })()]) {
    const s = makeHandlers(r).brief_start({ words: 'a reel with no brand named' });
    assert.deepEqual(s.assumed.find((a) => a.id === 'brand'), { id: 'brand', value: 'acme', because: 'your only brand', said: false });
    assert.ok(!s.questions.some((q) => q.id === 'brand'));
    assert.equal(s.brand_status, 'ready');
  }
});

test('tools: the reasons behind an assumption are plain words', () => {
  const r = twoBrands();
  fs.writeFileSync(path.join(r, 'studio.json'), JSON.stringify({ default_brand: 'acme-two' }));
  const hr = makeHandlers(r);
  const s = hr.brief_start({ words: 'a reel with no brand named' });
  assert.deepEqual(s.assumed.find((a) => a.id === 'brand'), { id: 'brand', value: 'acme-two', because: "your studio's default brand", said: false });
  fs.writeFileSync(path.join(jobDir(r, s.job), 'job.json'), JSON.stringify({ brand: 'acme' }));
  assert.deepEqual(hr.brief_check({ job: s.job }).assumed.find((a) => a.id === 'brand'), { id: 'brand', value: 'acme', because: 'already set for this job', said: false });
  assert.doesNotMatch(JSON.stringify(hr.brief_check({ job: s.job }).assumed), /job\.json|studio default/);
});

test('tools: no file paths reach the page: discovery lines, library films as text, no "a file"', () => {
  const r = scratchStudio();
  fs.writeFileSync(path.join(r, 'brands', 'acme', 'product', 'discovery.md'), [
    '# Product discovery: acme', '', 'Approved by: Owner', '', '## 1. The product in one breath', '', '- **What it is:** a board',
    '', '## 2. Who it is for', '', '### Ideal customer', '| | |', '|---|---|', '| Kind of business or person | Agencies that still send reports by hand |', '',
    '## 3. Positioning and proof', '', `- **Key messages, in order of importance:** ${'One click replaces the weekly report. '.repeat(6)}`, '',
  ].join('\n'));
  fs.mkdirSync(path.join(r, 'library', 'references'), { recursive: true });
  fs.writeFileSync(path.join(r, 'library', 'references', 'index.json'), JSON.stringify([
    { file: 'acme/acme_promo_board-tour_20s.mp4', type: 'promo', title: 'Board tour', study_card: 'acme/acme_promo_board-tour_20s.study.md' },
    { file: 'acme/acme_tutorial_first-export_30s.mp4', type: 'tutorial' },
  ]));
  const hr = makeHandlers(r);
  const s = hr.brief_start({ words: 'A vertical demo of the export button for acme' });
  saveBrief(jobDir(r, s.job), { ...loadJob(jobDir(r, s.job)).brief, product: 'Acme export', must_show: [{ what: 'export', evidence: 'the file lands' }], viewer_should: 'try it', length_cap_seconds: 20, voice: 'none', look: 'paper', hook: { family: 'proof' } });
  const c = hr.brief_check({ job: s.job });
  const all = c.questions; // three at a time: reference, audience and angle are the open ones here
  const ref = all.find((q) => q.id === 'reference');
  assert.ok(ref, 'reference is asked');
  assert.doesNotMatch(ref.question, /a file/);
  assert.deepEqual(ref.examples, [{ title: 'Board tour', type: 'Promo' }, { title: 'acme tutorial first export 30s', type: 'Tutorial' }]);
  const aud = all.find((q) => q.id === 'audience');
  assert.equal(aud.recommended, 'Kind of business or person: Agencies that still send reports by hand');
  const angle = all.find((q) => q.id === 'angle');
  assert.equal(angle.recommended.length, 120);
  assert.match(angle.recommended, /^Key messages, in order of importance: One click replaces/);
  assert.doesNotMatch(JSON.stringify(c), /brands\/|discovery\.md|library\/references|\.mp4|study\.md/);
  fs.writeFileSync(path.join(r, 'brands', 'acme', 'product', 'discovery.md'), '# Discovery\n\nApproved by: Owner\n');
  const bare = hr.brief_check({ job: s.job }).questions.find((q) => q.id === 'audience');
  assert.equal(bare.recommended, 'the ideal customer in your product discovery, with an awareness level');
});

test('tools: an audience card without words asks who it is for, it does not loop', () => {
  const r = scratchStudio();
  const hr = makeHandlers(r);
  const s = hr.brief_start({ words: 'audience film for acme' });
  const a = hr.brief_answer({ job: s.job, question: 'audience', value: 'cold' });
  assert.equal(a.recorded, false); assert.equal(a.reason, 'Say who it is for in a few words.');
  assert.notEqual(loadJob(jobDir(r, s.job)).brief.awareness, 'cold');
  const b = hr.brief_answer({ job: s.job, question: 'audience', value: 'cold', words: 'agency owners' });
  assert.equal(b.recorded, true);
  assert.ok(!b.questions.some((q) => q.id === 'audience'));
});

test('tools: a confirmed brief takes no answers, and showing its plan does not rewrite plan.md', () => {
  const r = scratchStudio();
  const hr = makeHandlers(r);
  const s = hr.brief_start({ words: 'A vertical demo of the export button for acme' });
  saveBrief(jobDir(r, s.job), { ...completeBrief(), in_their_words: 'A vertical demo of the export button for acme' });
  hr.brief_plan({ job: s.job });
  hr.brief_confirm({ job: s.job });
  const before = loadJob(jobDir(r, s.job)).brief;
  assert.throws(() => hr.brief_answer({ job: s.job, question: 'look', value: 'night', words: 'darker' }), /^Error: This brief is confirmed and its video has started\. To change it, say so in a chat in the studio folder\.$/);
  assert.deepEqual(loadJob(jobDir(r, s.job)).brief, before);
  const planFile = path.join(jobDir(r, s.job), 'plan.md');
  fs.writeFileSync(planFile, 'as shown');
  const p = hr.brief_plan({ job: s.job });
  assert.ok(p.lines.length);
  assert.equal(fs.readFileSync(planFile, 'utf8'), 'as shown');
});

test('tools: confirming a plan that changed since it was shown asks to show it again', () => {
  const r = scratchStudio();
  const hr = makeHandlers(r);
  const s = hr.brief_start({ words: 'A vertical demo of the export button for acme' });
  saveBrief(jobDir(r, s.job), { ...completeBrief(), in_their_words: 'A vertical demo of the export button for acme' });
  hr.brief_plan({ job: s.job });
  saveBrief(jobDir(r, s.job), { ...loadJob(jobDir(r, s.job)).brief, look: 'night' });
  assert.throws(() => hr.brief_confirm({ job: s.job }), /^Error: The plan changed since it was shown; show it again\.$/);
  assert.ok(!fs.existsSync(path.join(jobDir(r, s.job), 'job.json')));
  hr.brief_plan({ job: s.job });
  assert.equal(hr.brief_confirm({ job: s.job }).stage, 'idea');
  assert.equal(hr.brief_confirm({ job: s.job }).stage, 'idea');
});

test('tools: brand_status says what is missing', () => {
  const s = h.brief_start({ words: 'status film for acme' });
  assert.equal(h.brief_check({ job: s.job }).brand_status, 'ready');
  fs.rmSync(path.join(root, 'brands', 'acme', 'product'), { recursive: true });
  try {
    saveBrief(jobDir(root, s.job), { ...loadJob(jobDir(root, s.job)).brief, brand: 'acme', product: 'Acme export', kind: 'product-demo' });
    assert.equal(h.brief_check({ job: s.job }).brand_status, 'needs-discovery');
    saveBrief(jobDir(root, s.job), { ...loadJob(jobDir(root, s.job)).brief, brand: 'ghost' });
    assert.equal(h.brief_check({ job: s.job }).brand_status, 'needs-setup');
  } finally {
    fs.mkdirSync(path.join(root, 'brands', 'acme', 'product'), { recursive: true });
    fs.writeFileSync(path.join(root, 'brands', 'acme', 'product', 'discovery.md'), '# Discovery\n\nApproved by: Owner\n');
  }
});

test('tools: confirm makes job.json at the Idea stage', () => {
  const s = h.brief_start({ words: 'confirm film for acme' });
  saveBrief(jobDir(root, s.job), completeBrief());
  const chk = h.brief_check({ job: s.job });
  assert.equal(chk.ready_for_plan, true); assert.equal(chk.questions.length, 0);
  const p = h.brief_plan({ job: s.job });
  assert.ok(p.lines.length && p.outline.length && ['n', 'name', 'from', 'to', 'shows'].every((k) => k in p.outline[0]));
  const c = h.brief_confirm({ job: s.job });
  assert.equal(c.stage, 'idea'); assert.match(c.next, /continue the video/);
  const made = JSON.parse(fs.readFileSync(path.join(jobDir(root, s.job), 'job.json'), 'utf8'));
  assert.equal(made.stage_next, 'idea');
  assert.equal(h.brief_confirm({ job: s.job }).stage, 'idea');
});

test('tools: plan lists the open items', () => {
  const s = h.brief_start({ words: 'unfinished film for acme' });
  assert.throws(() => h.brief_plan({ job: s.job }), /^Error: Not yet: /);
});

test('tools: studio_context is the memory summary', () => {
  assert.deepEqual(h.studio_context({}).brands.map((b) => b.name), ['acme']);
});

test('tools: TOOLS names match the handlers, and only check and context are read only', () => {
  assert.deepEqual(TOOLS.map((t) => t.name).sort(), Object.keys(h).sort());
  assert.deepEqual(TOOLS.filter((t) => t.annotations.readOnlyHint).map((t) => t.name).sort(), ['brief_check', 'studio_context']);
  for (const t of TOOLS) assert.ok(t.description && t.inputSchema?.type === 'object');
});

test('tools: brief_reopen opens one checklist item again and replies like brief_check', () => {
  const r = scratchStudio();
  const hr = makeHandlers(r);
  const s = hr.brief_start({ words: 'A vertical demo of the export button for acme' });
  saveBrief(jobDir(r, s.job), { ...completeBrief(), in_their_words: 'A vertical demo of the export button for acme' });
  assert.equal(hr.brief_check({ job: s.job }).ready_for_plan, true);
  const o = hr.brief_reopen({ job: s.job, item: 'look' });
  assert.equal(o.ready_for_plan, false);
  assert.deepEqual(o.questions.map((q) => q.id), ['look']);
  assert.deepEqual(hr.brief_check({ job: s.job }).questions.map((q) => q.id), ['look']);
  assert.ok(loadJob(jobDir(r, s.job)).brief.decisions.some((d) => d.what === 'reopened look'));
  const t = hr.brief_reopen({ job: s.job, item: 'type' });
  assert.ok(t.questions.some((q) => q.id === 'kind'));
  assert.ok(!t.assumed.some((a) => a.id === 'kind'));
  assert.throws(() => hr.brief_reopen({ job: s.job, item: 'colour' }), /No checklist item colour/);
  for (const job of ['../.env', 'a/b', '/etc', 'nope']) assert.throws(() => hr.brief_reopen({ job, item: 'look' }), /Not a brief/);
});

test('tools: brief_reopen refuses an item that comes from the saved style, with a plain message', () => {
  const r = scratchStudio();
  const hr = makeHandlers(r);
  const s = hr.brief_start({ words: 'A vertical demo of the export button for acme' });
  const brief = { ...completeBrief(), style: 'acme/launch', in_their_words: 'A vertical demo of the export button for acme' };
  saveBrief(jobDir(r, s.job), brief);
  assert.throws(() => hr.brief_reopen({ job: s.job, item: 'look' }), /^Error: That comes from your saved style acme\/launch\. To change it, say so in a chat in the studio folder\.$/);
  assert.equal(loadJob(jobDir(r, s.job)).brief.look, 'paper');
  assert.ok(!(loadJob(jobDir(r, s.job)).brief.decisions || []).some((d) => d.what === 'reopened look'));
});

test('tools: brief_reopen refuses a confirmed brief, whose video has started', () => {
  const r = scratchStudio();
  const hr = makeHandlers(r);
  const s = hr.brief_start({ words: 'A vertical demo of the export button for acme' });
  saveBrief(jobDir(r, s.job), { ...completeBrief(), in_their_words: 'A vertical demo of the export button for acme' });
  hr.brief_plan({ job: s.job });
  assert.equal(hr.brief_confirm({ job: s.job }).stage, 'idea');
  const before = loadJob(jobDir(r, s.job)).brief;
  assert.throws(() => hr.brief_reopen({ job: s.job, item: 'delivery' }), /^Error: This brief is confirmed and its video has started\. To change it, say so in a chat in the studio folder\.$/);
  const after = loadJob(jobDir(r, s.job)).brief;
  assert.deepEqual(after, before);
});
