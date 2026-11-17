// Tests for the beat frameworks. Run: node --test tools/plan/tests/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultFor, loadFrameworks, validateFrameworks } from '../lib/frameworks.mjs';

test('the studio\'s frameworks are sound, and each film type starts from its playbook', () => {
  const lib = loadFrameworks();
  assert.deepEqual(validateFrameworks(lib), []);
  assert.equal(defaultFor('promo'), 'studio-promo'); assert.equal(defaultFor('ad'), 'studio-promo');
  assert.equal(defaultFor('edit (screen recording)'), 'studio-edit'); assert.equal(defaultFor('Tutorial'), 'studio-tutorial');
  const promo = lib.frameworks.find((f) => f.id === 'studio-promo');
  assert.deepEqual(promo.beats[0].seconds, [3, 5]); assert.deepEqual(promo.beats.at(-1).seconds, [4, 6]); // as promo.md says
});

test('the validator names what is wrong', () => {
  const base = { sources: [{ id: 's', licence: 'MIT' }], frameworks: [] };
  const f = (beats, over = {}) => ({ ...base, frameworks: [{ id: 'x', name: 'X', what: 'w', source: 's', suits: { types: ['promo'], lengths: [30] }, beats, ...over }] });
  const b = (id, size, required = true) => ({ id, name: id, job: 'j', size, seconds: null, required });
  const has = (lib, re) => assert.ok(validateFrameworks(lib).some((p) => re.test(p)), `${re}: ${validateFrameworks(lib).join(' | ')}`);
  has(f([b('a', [0.6, 0.7]), b('b', [0.6, 0.7])]), /minimums add up/);
  has(f([b('a', [0.1, 0.2]), b('b', [0.1, 0.2])]), /maximums add up to only/);
  has(f([b('a', [0.5, 0.4]), b('b', [0.5, 0.6])]), /min <= max/);
  has(f([b('a', [0.5, 0.6], false), b('b', [0.4, 0.5], false)]), /no beat is required/);
  has(f([b('a', [0.5, 0.6])]), /fewer than two beats/);
  has({ ...f([b('a', [0.5, 0.6]), b('b', [0.4, 0.5])]), sources: [{ id: 's', licence: 'CC BY-NC 4.0' }] }, /allows copying/);
  has(f([b('a', [0.5, 0.6]), b('b', [0.4, 0.5])]), /studio-promo is missing/);
});
