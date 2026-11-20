// Tests for the motion-graphics recipes (tools/plan/lib/recipes.mjs, tools/plan/recipe.mjs).
// Run: node --test tools/plan/tests/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { STUDIO, card, fillPrompt, loadRecipes, matchRecipes, moveNames, validateCatalog, words } from '../lib/recipes.mjs';

const recipe = (id, family, triggers, extra = {}) => ({
  id, name: id.replace(/-/g, ' '), family, summary: `A ${id.replace(/-/g, ' ')} film.`, triggers,
  defaults: { length_s: 30, aspects: ['16:9'], energy: 'confident', design_style: 'Night', sound: 'music-led', fps: 30 },
  structure: [{ beat: 'hook', share: '0-2 s', what: 'a strong first frame' }],
  starter_prompt: 'Make a {length}-second film for {brand} in {aspect}.',
  optimise: ['one thing'], avoid: ['another'], motion: { engine_moves: [] }, ...extra,
});
const FIXTURE = {
  families: [{ id: 'product', name: 'Product', summary: 'p' }, { id: 'type', name: 'Type', summary: 't' }, { id: 'brand', name: 'Brand', summary: 'b' }],
  recipes: [
    recipe('saas-launch-film', 'product', ['launch video', 'product launch', 'saas launch', 'launch film']),
    recipe('kinetic-type-reel', 'type', ['kinetic typography', 'kinetic type', 'type reel', 'text animation']),
    recipe('logo-sting', 'brand', ['logo sting', 'logo reveal', 'intro', 'logo animation']),
  ],
};

test('words: lower case, punctuation gone, light stemming', () => {
  assert.deepEqual(words("Our product's launches, animated!"), ['our', 'product', 'launche', 'animat']);
});

test('match: a whole trigger phrase picks its recipe clearly', () => {
  const m = matchRecipes('make me a slick launch video for our SaaS', FIXTURE);
  assert.equal(m.verdict, 'clear');
  assert.equal(m.ranked[0].id, 'saas-launch-film');
  assert.ok(m.ranked[0].phrases.includes('launch video'));
});

test('match: longer phrases weigh more than single words', () => {
  const m = matchRecipes('kinetic typography reel for our podcast', FIXTURE);
  assert.equal(m.ranked[0].id, 'kinetic-type-reel');
});

test('match: nothing related means "none", so the studio asks what kind of film', () => {
  assert.equal(matchRecipes('something nice please', FIXTURE).verdict, 'none');
  assert.equal(matchRecipes('', FIXTURE).verdict, 'none');
});

test('match: two recipes equally named is "close", so the studio asks which', () => {
  const m = matchRecipes('logo animation with text animation', FIXTURE);
  assert.equal(m.verdict, 'close');
});

test('validate: missing fields, unknown family, unknown move and banned words are listed', () => {
  const bad = { families: FIXTURE.families, recipes: [
    recipe('a', 'nowhere', ['x'], { starter_prompt: 'no placeholders here' }),
    recipe('b', 'product', [], { motion: { engine_moves: ['no-such-move'] }, summary: 'made for acme corp' }),
    recipe('b', 'product', ['y']),
  ] };
  const e = validateCatalog(bad, { moves: new Set(['real-move']), banned: ['acme'] });
  assert.ok(e.some((x) => /recipe a: family "nowhere"/.test(x)));
  assert.ok(e.some((x) => /recipe a: the starter prompt has no \{placeholders\}/.test(x)));
  assert.ok(e.some((x) => /recipe b: no triggers/.test(x)));
  assert.ok(e.some((x) => /engine move "no-such-move"/.test(x)));
  assert.ok(e.some((x) => /recipe b: duplicate id/.test(x)));
  assert.ok(e.some((x) => /banned word \/acme\//.test(x)));
  assert.deepEqual(validateCatalog(FIXTURE, { moves: new Set() }), []);
});

test('card: fills the placeholders the brief answers and leaves the rest', () => {
  assert.equal(fillPrompt('A {length}-second film for {brand}.', { length: 15 }), 'A 15-second film for {brand}.');
  const c = card(FIXTURE.recipes[0], { values: { length: 20, aspect: '9:16' } });
  assert.match(c, /## Starter prompt\n\nMake a 20-second film for \{brand\} in 9:16\./);
  assert.match(c, /## Optimise/);
});

// ---------- the shipped catalogue ----------
const catalogFile = path.join(STUDIO, 'library/recipes/index.json');
const shipped = fs.existsSync(catalogFile);

test('the shipped catalogue is valid against the engine', { skip: !shipped }, () => {
  const banned = JSON.parse(fs.readFileSync(path.join(STUDIO, 'release/manifest.json'), 'utf8')).banned;
  assert.deepEqual(validateCatalog(loadRecipes(), { moves: moveNames(), banned }), []);
});

test('apply: records the recipe, fills only empty brief fields and writes the card', { skip: !shipped }, () => {
  const cat = loadRecipes();
  const r = cat.recipes[0];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recipe-apply-'));
  fs.writeFileSync(path.join(dir, 'brief.json'), JSON.stringify({ in_their_words: 'x', kind: '', deliver: [{ size: '', master: true }], length_cap_seconds: 12 }));
  const out = spawnSync(process.execPath, [path.join(STUDIO, 'tools/plan/recipe.mjs'), 'apply', dir, r.id], { encoding: 'utf8' });
  assert.equal(out.status, 0, out.stdout + out.stderr);
  const b = JSON.parse(fs.readFileSync(path.join(dir, 'brief.json'), 'utf8'));
  assert.equal(b.recipe, r.id);
  assert.equal(b.length_cap_seconds, 12);
  assert.equal(b.deliver[0].size, r.defaults.aspects[0]);
  if (r.brief_kind) assert.equal(b.kind, r.brief_kind);
  assert.match(fs.readFileSync(path.join(dir, 'recipe.md'), 'utf8'), /12-second|12 s|## Starter prompt/);
});

test('one-line briefs route to the right kind of film', { skip: !shipped }, () => {
  const cat = loadRecipes();
  const expect = {
    'make me a slick launch video for our SaaS': 'product-launch-film',
    'kinetic typography reel for our podcast trailer': 'kinetic-type',
    'explain how our API works in 45 seconds': 'how-it-works',
    'show our growth numbers this year': 'stat-story',
    'a 5 second logo sting for YouTube intros': 'logo-reveal',
    'animate our logo': 'logo-reveal',
    'a 15 second showreel that shows off what we can do': 'motion-showreel',
    'promo for our mobile app for Instagram reels': 'product-launch-film',
    'an ad for TikTok that stops the scroll': 'social-hook-ad',
    'animated lyric video for our jingle': 'lyric-video',
    'a timeline of our company history': 'timeline-history',
    'a product demo with the cursor clicking through the app': 'feature-walkthrough',
    'a personal intro reel for my portfolio': 'portfolio-reel',
    'make a hype teaser for our launch next week': 'product-teaser',
    'show how a payment flows through our system': 'how-it-works',
    'a recap video of our conference': 'occasion-post',
    "a changelog video for this week's updates": 'news-recap',
    'black friday sale promo': 'price-offer-film',
    'a customer testimonial video': 'customer-story',
    'a music visualiser for our track': 'beat-visualiser',
  };
  for (const [brief, id] of Object.entries(expect)) {
    const m = matchRecipes(brief, cat);
    assert.equal(m.verdict, 'clear', `${brief}: ${JSON.stringify(m.ranked.map((r) => [r.id, r.score]))}`);
    assert.equal(m.ranked[0].id, id, brief);
  }
  assert.equal(matchRecipes('motion graphics for our brand', cat).verdict, 'none', 'a vague request asks what kind of film');
});
