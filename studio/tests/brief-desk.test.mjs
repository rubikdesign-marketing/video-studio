// Static checks on the brief page (studio/brief-desk/index.html): it calls only the connector's tools and declares
// them all, carries the brand tokens, takes no uploads, has no banned words and keeps no briefs in browser storage.
//   node --test studio/tests/brief-desk.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
