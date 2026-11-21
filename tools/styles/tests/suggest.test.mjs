import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLibrary, promptText } from '../lib/library.mjs';
import { suggest } from '../lib/suggest.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, 'fixtures', 'lib');
const CLI = join(HERE, '..', 'styles.mjs');
const lib = loadLibrary(FIX);
const all = Object.values(lib.tabs).flat();
const perTab = (list) => list.reduce((m, s) => ({ ...m, [s.tab]: (m[s.tab] || 0) + 1 }), {});

test('suggest: energy and kind lead', () => {
  const out = suggest(all, { understood: { energy: 'hype', kind: 'animated-short' } });
  // hype (3) + product-demo-free: quick-cut and snappy and bright-pulse match hype; clay-hero matches kind (2) only
  const ids = out.map((s) => s.id);
  assert.ok(ids.indexOf('demo-snappy') < ids.indexOf('demo-clay-hero'));
  assert.ok(ids.indexOf('demo-quick-cut') < ids.indexOf('demo-clay-hero'));
  const o2 = suggest(all, { understood: { energy: 'confident', kind: 'product-demo' } });
  assert.ok(o2[0].reason.includes('product demo'));
  assert.ok(o2[0].reason.startsWith('because '));
});

test('suggest: at most two per tab and at least three tabs', () => {
  const out = suggest(all, { understood: { kind: 'promo', size: '9:16' } });
  assert.equal(out.length, 6);
  for (const c of Object.values(perTab(out))) assert.ok(c <= 2);
  assert.ok(Object.keys(perTab(out)).length >= 3);
});

test('suggest: memory ranks first with its job in the reason', () => {
  const out = suggest(all, { understood: { energy: 'hype' }, memory: [{ id: 'demo-held-wide', job: 'spring launch' }] });
  assert.equal(out[0].id, 'demo-held-wide');
  assert.ok(out[0].reason.includes('you used this on spring launch'));
});

test('suggest: picked ids are left out', () => {
  const out = suggest(all, { understood: { energy: 'hype' }, picked: ['demo-snappy', 'demo-quick-cut'] });
  assert.ok(!out.some((s) => ['demo-snappy', 'demo-quick-cut'].includes(s.id)));
});

test('suggest: the customer words show up in the reason', () => {
  const out = suggest(all, { text: 'I want a slow push for a vertical reel', understood: { size: '9:16' } });
  assert.equal(out[0].id, 'demo-slow-push');
  assert.ok(out[0].reason.includes('you said slow and push'));
  for (const s of out) assert.ok(!/\./.test(s.reason) && !/BlurIn|DollyIn/.test(s.reason));
});

test('suggest: a 5,000-character text returns in under 50 ms', () => {
  const text = ('punchy vertical product launch for the spring sale with quick cuts and soft arrive ').repeat(61).slice(0, 5000);
  assert.equal(text.length, 5000);
  const t0 = performance.now();
  const out = suggest(all, { text, understood: { energy: 'hype' } });
  assert.ok(performance.now() - t0 < 50);
  assert.ok(out.length > 0);
});

test('suggest: empty input returns six varied ready entries', () => {
  const out = suggest(all, {});
  assert.equal(out.length, 6);
  for (const s of out) assert.equal(lib.byId.get(s.id).filters.ready, true);
  for (const c of Object.values(perTab(out))) assert.ok(c <= 2);
  assert.ok(Object.keys(perTab(out)).length >= 3);
  for (const s of out) assert.ok(s.reason.length > 0);
});

const cli = (...args) => spawnSync('node', [CLI, ...args, '--root', FIX], { encoding: 'utf8' });

test('styles.mjs show prints the prompt text and the timing per energy', () => {
  const r = cli('show', 'demo-snappy');
  assert.equal(r.status, 0);
  assert.ok(r.stdout.includes('Snappy overshoot'));
  assert.ok(r.stdout.includes(promptText(lib.byId.get('demo-snappy'))));
  assert.match(r.stdout, /Confident: one beat every 0\.5 s/);
  assert.match(r.stdout, /Hype: one beat every 0\.25 s/);
});

test('styles.mjs show names the closest ready style for a made-on-request entry', () => {
  const r = cli('show', 'demo-clay-hero');
  assert.equal(r.status, 0);
  assert.ok(r.stdout.includes('made on request: closest ready style Kinetic type'));
});

test('styles.mjs show with an unknown id says so and exits 1', () => {
  const r = cli('show', 'nope');
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /No style with the id nope/);
});

test('styles.mjs list, find and suggest', () => {
  let r = cli('list', '--tab', 'sound');
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim().split('\n').length, 2);
  assert.ok(r.stdout.includes('acme-soft-tap'));
  r = cli('list', '--ready', '--energy', 'hype');
  assert.ok(r.stdout.includes('ready now') && !r.stdout.includes('made on request'));
  r = cli('list', '--kind', 'animated-short');
  assert.ok(r.stdout.includes('demo-clay-hero') && r.stdout.includes('made on request'));
  r = cli('find', 'slow', 'push');
  assert.ok(r.stdout.split('\n')[0].includes('demo-slow-push'));
  r = cli('suggest', 'quick punchy', '--energy', 'hype');
  assert.equal(r.status, 0);
  assert.ok(r.stdout.includes('because'));
});

test('styles.mjs suggest says ready now or made on request on each line', () => {
  const r = cli('suggest', 'clay hero', '--kind', 'animated-short');
  assert.equal(r.status, 0);
  const clay = r.stdout.split('\n').find((l) => l.includes('demo-clay-hero'));
  assert.ok(clay && clay.includes('made on request'));
  const ready = cli('suggest', 'slow push').stdout.split('\n').find((l) => l.includes('demo-slow-push'));
  assert.ok(ready && ready.includes('ready now'));
});

test('styles.mjs: a value flag without a value exits 1 with a plain message', () => {
  for (const args of [['list', '--energy', '--ready'], ['list', '--tab'], ['suggest', 'x', '--size']]) {
    const r = spawnSync('node', [CLI, ...args, ...(args.includes('--root') ? [] : ['--root', FIX])], { encoding: 'utf8' });
    assert.equal(r.status, 1, args.join(' '));
    assert.match(r.stdout + r.stderr, /needs a value/);
  }
  const noRoot = spawnSync('node', [CLI, 'list', '--root'], { encoding: 'utf8' });
  assert.equal(noRoot.status, 1);
  assert.match(noRoot.stdout + noRoot.stderr, /--root needs a value/);
});

test('styles.mjs: an unknown flag exits 1 instead of becoming a search word', () => {
  const r = cli('find', 'push', '--tabs', 'sound');
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /Unknown option --tabs/);
});

test('styles.mjs: energy, kind and size are checked against the allowed values', () => {
  for (const [cmd, flag, bad, allowed] of [
    ['list', '--energy', 'loud', 'calm, confident, hype'],
    ['list', '--kind', 'film', 'product-demo'],
    ['suggest', '--size', '3:2', '9:16'],
    ['suggest', '--energy', 'loud', 'calm, confident, hype'],
  ]) {
    const r = cmd === 'suggest' ? cli(cmd, 'x', flag, bad) : cli(cmd, flag, bad);
    assert.equal(r.status, 1, `${cmd} ${flag} ${bad}`);
    const out = r.stdout + r.stderr;
    assert.ok(out.includes(bad) && out.includes(allowed), out);
  }
});
