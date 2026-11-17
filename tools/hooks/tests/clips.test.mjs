// Tests for the gate on Viral Hooks clips. Run: node --test tools/hooks/tests/*.test.mjs  (no network is used)
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkJob, creditLine, mayUse, paidField, rightsRecord, slugOf } from '../lib/clips.mjs';

const ok = { post: 'organic', approvedBy: 'Sam', words: 'Yes, use the cat one for the Tuesday post' };
const tool = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'clips.mjs');

test('only a viralhooks.org clip address is taken', () => {
  assert.equal(slugOf('https://viralhooks.org/hook/wide-eyed-cat-turns-during-car-wash/'), 'wide-eyed-cat-turns-during-car-wash');
  assert.equal(slugOf('https://viralhooks.org/hooks/wide-eyed-cat-turns-during-car-wash.mp4'), 'wide-eyed-cat-turns-during-car-wash');
  for (const bad of ['https://example.org/hook/x/', 'https://viralhooks.org/hook/../etc/', 'http://viralhooks.org/hook/x/', 'x', '']) assert.equal(slugOf(bad), null);
});

test('a paid ad is refused, by the post and by the job', () => {
  assert.equal(mayUse({}, ok).ok, true);
  assert.match(mayUse({}, { ...ok, post: 'ads' }).why, /never a paid ad/);
  assert.match(mayUse({}, { ...ok, post: undefined }).why, /organic/);
  assert.equal(mayUse({ type: 'promo (paid ad)' }, ok).ok, false);
  assert.equal(mayUse({ channel: 'Meta ads' }, ok).ok, false);
  assert.equal(mayUse({ type: 'promo', channel: 'Instagram Reels' }, ok).ok, true);
  assert.equal(mayUse({ type: 'tutorial', name: 'How to add a board' }, ok).ok, true); // "add" is not "ad"
});

test('a paid job is caught however it is written, at any depth, and only in fields about where the film goes', () => {
  for (const job of [{ channel: 'reels_ad' }, { channel: 'meta_ads' }, { purpose: 'paid_social' }, { kind: 'paid ad' }, { objective: 'paid' }, { campaign: 'sponsored' }, { placement: ['organic', 'paid'] },
    { plan: { distribution: { channel: 'Boosted post' } } }, { platform: { instagram: 'adset 3' } }]) assert.equal(mayUse(job, ok).ok, false, JSON.stringify(job));
  // Words about the product or the offer are not a placement: a film about a paid plan can still be an organic post.
  for (const job of [{ name: 'Paid plan launch', offer_wording: 'Half price on the paid plan' }, { type: 'promo', notes: 'no ads this time' }, { channel: 'Instagram Reels, organic' }, { type: 'upload walkthrough' }]) assert.equal(mayUse(job, ok).ok, true, JSON.stringify(job));
  assert.deepEqual(paidField({ a: { channel: 'x_ads' } }), { key: 'a.channel', value: 'x_ads' });
});

test('the owner\'s decision must name who decided, in their words', () => {
  assert.match(mayUse({}, { ...ok, approvedBy: '' }).why, /who decided/);
  assert.match(mayUse({}, { ...ok, words: ' ' }).why, /own words/);
});

test('the decision is written down and checked', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clips-'));
  const folder = path.join(dir, 'media', 'viralhooks'); fs.mkdirSync(folder, { recursive: true });
  assert.deepEqual(checkJob(dir), []);
  fs.writeFileSync(path.join(folder, 'a-cat.mp4'), 'x');
  assert.match(checkJob(dir)[0], /a-cat.mp4: no decision recorded/);
  const rec = rightsRecord({ slug: 'a-cat', approvedBy: ok.approvedBy, words: ok.words, post: 'organic', date: '2026-11-18' });
  fs.writeFileSync(path.join(folder, 'a-cat.rights.json'), JSON.stringify(rec));
  assert.deepEqual(checkJob(dir), []);
  assert.match(creditLine(rec), /No licence is stated/);
  fs.writeFileSync(path.join(folder, 'a-cat.rights.json'), JSON.stringify({ ...rec, post: 'ads' }));
  assert.match(checkJob(dir)[0], /only for an organic post/);
  // A job that has become a paid one by delivery fails, whatever the decision said; so does a decision for another clip.
  fs.writeFileSync(path.join(folder, 'a-cat.rights.json'), JSON.stringify(rec));
  fs.writeFileSync(path.join(dir, 'job.json'), JSON.stringify({ purpose: 'paid' }));
  assert.match(checkJob(dir)[0], /may not be in a paid ad/);
  fs.writeFileSync(path.join(dir, 'job.json'), JSON.stringify({ type: 'promo' }));
  fs.writeFileSync(path.join(folder, 'B-DOG.MP4'), 'x'); // an upper-case ending is still a clip
  assert.match(checkJob(dir).join('\n'), /B-DOG.MP4: no decision recorded/);
  fs.writeFileSync(path.join(folder, 'B-DOG.rights.json'), JSON.stringify(rec));
  assert.match(checkJob(dir).join('\n'), /for another clip/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the tool refuses before fetching anything: a paid job, a missing decision, a foreign address', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clips-'));
  fs.writeFileSync(path.join(dir, 'job.json'), JSON.stringify({ type: 'promo', channel: 'paid social' }));
  const run = (...a) => spawnSync('node', [tool, ...a], { encoding: 'utf8' });
  const page = 'https://viralhooks.org/hook/a-cat/';
  const paid = run('use', page, '--job', dir, '--post', 'organic', '--approved-by', 'Sam', '--words', 'yes');
  assert.equal(paid.status, 1); assert.match(paid.stdout, /may not be used in a paid ad/);
  fs.writeFileSync(path.join(dir, 'job.json'), JSON.stringify({ type: 'promo' }));
  assert.equal(run('use', page, '--job', dir, '--post', 'organic', '--approved-by', 'Sam').status, 1);
  assert.equal(run('use', 'https://example.org/x.mp4', '--job', dir, '--post', 'organic').status, 2);
  // A flag's name is not a value: "--approved-by --words x" names nobody.
  const nobody = run('use', page, '--job', dir, '--post', 'organic', '--approved-by', '--words', 'yes');
  assert.equal(nobody.status, 1); assert.match(nobody.stdout, /who decided/);
  // A job.json that cannot be read is refused, not crashed on.
  fs.writeFileSync(path.join(dir, 'job.json'), '{"type":"promo","post":"paid"');
  const broken = run('use', page, '--job', dir, '--post', 'organic', '--approved-by', 'Sam', '--words', 'yes');
  assert.equal(broken.status, 1); assert.match(broken.stdout, /cannot be read/);
  assert.ok(!fs.existsSync(path.join(dir, 'media')));
  fs.rmSync(dir, { recursive: true, force: true });
});
