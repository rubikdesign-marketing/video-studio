// The REC badge's text must read on a light and on a dark stage: contrast >= 4.5:1 against its pill, measured over the
// worst picture it can sit on (a white one and a black one). Run: node --test tools/checks/tests/recbadge_contrast.test.mjs
// engine/src/kit/ugc/ScreenRecTell.tsx picks its colours with recBadgeColours() (the pill is the stage's shade at
// RECBADGE_PILL_ALPHA, the text is whichever of the stage's ink and onInk contrasts better); this repeats that rule on the brand's real colours.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const source = fs.readFileSync(path.join(ROOT, 'engine/src/kit/ugc/ScreenRecTell.tsx'), 'utf8');
// the first brand in brands/ (the export drops brands/, so the test then skips)
const brandDir = fs.existsSync(path.join(ROOT, 'brands')) ? fs.readdirSync(path.join(ROOT, 'brands')).sort().find((d) => fs.existsSync(path.join(ROOT, 'brands', d, 'brand.json'))) : undefined;
const brand = brandDir ? JSON.parse(fs.readFileSync(path.join(ROOT, 'brands', brandDir, 'brand.json'), 'utf8')) : null;

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = (c) => { const [r, g, b] = c.map((v) => v / 255).map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const over = (fg, alpha, bg) => fg.map((v, i) => v * alpha + bg[i] * (1 - alpha));

test('the REC badge text has contrast >= 4.5:1 on the light and the dark stage, over a white or a black picture', { skip: !brand }, () => {
  assert.match(source, /recBadgeColours\(stage\)/, 'the badge uses recBadgeColours');
  assert.ok(!/color: stage\.onInk/.test(source), 'the badge no longer sets its text to the stage onInk');
  const pillAlpha = Number(source.match(/RECBADGE_PILL_ALPHA = ([0-9.]+)/)[1]);
  const textOpacity = Number(source.match(/tabular-nums', opacity: ([0-9.]+)/)[1]); // the timer is the dimmer text
  const measured = [];
  for (const stageName of ['light', 'dark']) {
    const own = brand.colours[stageName], other = brand.colours[stageName === 'light' ? 'dark' : 'light'];
    const shade = lum(rgb(own.ink)) < lum(rgb(own.page)) ? own.ink : own.page;
    const onInk = other.ink;
    const text = ratio(rgb(onInk), rgb(shade)) >= ratio(rgb(own.ink), rgb(shade)) ? onInk : own.ink;
    for (const picture of [[255, 255, 255], [0, 0, 0]]) {
      const pill = over(rgb(shade), pillAlpha, picture);
      for (const [name, opacity] of [['label', 1], ['timer', textOpacity]]) {
        const ink = over(rgb(text), opacity, pill);
        const c = ratio(ink, pill);
        measured.push(`${stageName} stage, ${picture[0] ? 'white' : 'black'} picture, ${name}: ${c.toFixed(2)}`);
        assert.ok(c >= 4.5, `${stageName} stage over ${picture[0] ? 'white' : 'black'}: ${name} contrast ${c.toFixed(2)} is under 4.5`);
      }
    }
  }
  console.log(measured.join('\n'));
});
