// Tests for the readable-after-zoom check's measuring rules (tools/checks/text_size.mjs).
// Run: node --test tools/checks/tests/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emOf, judgeMoment, parseTsv } from '../text_size.mjs';

test('the size of type from the height of its ink, whatever letters it has', () => {
  // Ink heights of 100 px type: capitals and descenders 95, capitals only 74, x-height only 55.
  assert.ok(Math.abs(emOf('Typing', 95) - 100) < 1);
  assert.ok(Math.abs(emOf('NEW', 74) - 100) < 1);
  assert.ok(Math.abs(emOf('Lead', 74) - 100) < 1);
  assert.ok(Math.abs(emOf('own', 55) - 100) < 1);
  assert.ok(Math.abs(emOf('gap', 75) - 100) < 1);
  assert.equal(emOf('...', 20), null);
});

test('tesseract word rows are read, low-confidence and one-letter words dropped', () => {
  const tsv = [
    'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
    '5\t1\t1\t1\t1\t1\t100\t200\t80\t30\t96.1\tLeads',
    '5\t1\t1\t1\t1\t2\t190\t200\t10\t30\t91.0\t|',
    '5\t1\t1\t1\t1\t3\t220\t200\t80\t30\t20.0\tNoise',
    '5\t1\t1\t1\t1\t4\t320\t200\t80\t30\t88.0\tDeals',
  ].join('\n');
  const words = parseTsv(tsv, 2);
  assert.deepEqual(words.map((w) => w.text), ['Leads', 'Deals']);
  assert.deepEqual([words[0].x, words[0].y, words[0].width, words[0].height], [50, 100, 40, 15]);
});

const H = 1080;
const word = (text, x, y, inkPx) => ({ text, x, y, width: 60, height: inkPx, conf: 95 });

test('UI text at the click under the floor fails; between the two floors it is reported against both', () => {
  // "Leads" with 33 px of ink: 44.6 px type = 4.13% of 1080. "Board" 24 px: 3.0%.
  const focus = { x: 0, y: 0, width: 400, height: 200 };
  const big = judgeMoment({ words: [word('Leads', 10, 10, 33)], focus, caption: null, regions: [{ x: 0, y: 0, width: 1920, height: 1080 }] }, { height: H, floor: 4, also: 3, min: 2.6 });
  assert.equal(big.focus.pass, true);
  const mid = judgeMoment({ words: [word('Board', 10, 10, 24)], focus, caption: null, regions: [{ x: 0, y: 0, width: 1920, height: 1080 }] }, { height: H, floor: 4, also: 3, min: 2.6 });
  assert.equal(mid.focus.pass, false);
  assert.equal(mid.focus.passAlso, true);
  assert.ok(Math.abs(mid.focus.share - 3.0) < 0.1);
});

test('film text outside the product under 2.6% fails; caption words are measured apart', () => {
  const caption = { x: 500, y: 930, width: 900, height: 86 };
  const r = judgeMoment(
    {
      words: [word('Change', 600, 950, 41), word('tiny', 100, 100, 12), word('label', 160, 100, 15)],
      focus: null,
      caption,
      regions: [],
    },
    { height: H, floor: 4, also: 3, min: 2.6 },
  );
  assert.ok(r.caption.share > 3.8 && r.caption.share < 4.2, `caption ${r.caption.share}`);
  assert.equal(r.film.pass, false);
});

test('a moment with no words read at the click says so instead of passing', () => {
  const r = judgeMoment({ words: [], focus: { x: 0, y: 0, width: 50, height: 50 }, caption: null, regions: [{ x: 0, y: 0, width: 1920, height: 1080 }] }, { height: H, floor: 4, also: 3, min: 2.6 });
  assert.equal(r.focus.read, false);
});

test('icons read as letters ("88", "oo", "000") and two-letter scraps are not words', () => {
  const head = 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext';
  const row = (text) => `5\t1\t1\t1\t1\t1\t0\t0\t40\t30\t95\t${text}`;
  const words = parseTsv([head, row('88'), row('oo'), row('000'), row('to'), row('Launc...'), row('New')].join('\n'));
  assert.deepEqual(words.map((w) => w.text), ['Launc...', 'New']);
});
