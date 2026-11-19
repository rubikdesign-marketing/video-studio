import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { coreInstalled, importFrom, restoreDotfiles } from './start.mjs';

const scratch = () => fs.mkdtempSync(path.join(os.tmpdir(), 'start-test-'));
const write = (root, rel, text = 'x') => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), text);
};

test('restoreDotfiles puts back missing hidden files and never overwrites', () => {
  const root = scratch();
  write(root, 'setup/dotfiles/claude/skills/video-studio/SKILL.md', 'kit');
  write(root, 'setup/dotfiles/claude/settings.json', 'kit');
  write(root, 'setup/dotfiles/mcp.json', '{}');
  write(root, 'setup/dotfiles/README.md', 'about this folder');
  write(root, '.claude/settings.json', 'mine');

  const restored = restoreDotfiles(root);
  assert.deepEqual(restored.sort(), ['.claude', '.mcp.json']);
  assert.equal(fs.readFileSync(path.join(root, '.claude/skills/video-studio/SKILL.md'), 'utf8'), 'kit');
  assert.equal(fs.readFileSync(path.join(root, '.claude/settings.json'), 'utf8'), 'mine');
  assert.ok(!fs.existsSync(path.join(root, '.README.md')));
  assert.deepEqual(restoreDotfiles(root), [], 'second run has nothing to do');
});

test('restoreDotfiles is a no-op without setup/dotfiles (a git checkout)', () => {
  assert.deepEqual(restoreDotfiles(scratch()), []);
});

test('coreInstalled needs the engine packages, the render browser and the capture tool', () => {
  const root = scratch();
  write(root, 'tools/capture/package.json', '{}');
  assert.equal(coreInstalled(root), false);
  write(root, 'engine/node_modules/remotion/package.json', '{}');
  fs.mkdirSync(path.join(root, 'engine/node_modules/.remotion/chrome-headless-shell'), { recursive: true });
  assert.equal(coreInstalled(root), false, 'capture tool still missing');
  write(root, 'tools/capture/node_modules/playwright-core/package.json', '{}');
  assert.equal(coreInstalled(root), true);
});

test('importFrom brings the buyer\'s work, skips the demo and sample, and keeps what is already here', () => {
  const old = scratch(), now = scratch();
  write(old, 'brands/acme/brand.json', 'acme');
  write(old, 'brands/demo/brand.json', 'old demo');
  write(old, 'jobs/launch/job.json', 'job');
  write(old, 'jobs/_sample/job.json', 'old sample');
  write(old, '.env', 'ELEVENLABS_API_KEY=abc');
  write(old, 'studio.json', '{"default_brand":"acme"}');
  write(now, 'brands/demo/brand.json', 'new demo');
  write(now, 'jobs/launch/job.json', 'already here');
  write(now, 'studio.json', '{"default_brand":"demo"}');

  const { copied, kept } = importFrom(old, now);
  assert.deepEqual(copied.sort(), ['.env', path.join('brands', 'acme'), 'studio.json'].sort());
  assert.deepEqual(kept, [path.join('jobs', 'launch')]);
  assert.equal(fs.readFileSync(path.join(now, 'brands/demo/brand.json'), 'utf8'), 'new demo');
  assert.equal(fs.readFileSync(path.join(now, 'jobs/launch/job.json'), 'utf8'), 'already here');
  assert.equal(fs.readFileSync(path.join(now, 'studio.json'), 'utf8'), '{"default_brand":"acme"}');
});

test('importFrom refuses a folder that is not a studio, and this folder itself', () => {
  const now = scratch();
  write(now, 'brands/demo/brand.json');
  assert.throws(() => importFrom(scratch(), now), /does not look like a studio/);
  assert.throws(() => importFrom(now, now), /That is this folder/);
});
