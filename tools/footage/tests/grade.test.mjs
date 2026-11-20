// Tests for the colour grade (tools/footage/lib/grade.mjs). Run: node --test tools/footage/tests/grade.test.mjs
// Pure checks first; the last two run ffmpeg on a tiny generated picture.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { FFMPEG } from '../lib/common.mjs';
import { beforeAfter, gradeClip, gradedChain, gradeFilter, gradeStill, isNeutral, loadGrade, LOOK_NAMES, looks, neutral, normalise, recipeFor, reset, saveGrade, withRecipe } from '../lib/grade.mjs';
import { pictureChain } from '../lib/workcopy.mjs';

test('a neutral recipe is the identity: empty filter, chain unchanged', () => {
  assert.equal(gradeFilter(neutral()), '');
  assert.equal(gradeFilter({}), '');
  assert.ok(isNeutral({}));
  const pic = pictureChain({ colour: { kind: 'sdr' }, width: 1920, height: 1080, rotation: 0, variable: false, fps: 30, target: '30' }).chain;
  assert.equal(gradedChain(pic, neutral()), pic);
});

test('a graded chain comes after the picture chain and ends in tagged bt709 yuv420p', () => {
  const pic = 'scale=100:100,format=yuv420p';
  const chain = gradedChain(pic, { exposure: 0.3 });
  assert.ok(chain.startsWith(`${pic},`));
  assert.ok(chain.endsWith('format=yuv420p,setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv'));
  assert.ok(chain.includes('out_color_matrix=bt709'));
});

test('each slider changes the filter, and the same recipe always gives the same filter', () => {
  const base = gradeFilter({ exposure: 0.3 });
  assert.equal(base, gradeFilter({ exposure: 0.3 }));
  for (const patch of [{ exposure: 0.5 }, { temperature: 20 }, { contrast: 15 }, { saturation: -20 }, { look: 'clean-cool' }]) {
    assert.notEqual(gradeFilter(patch), base);
    assert.notEqual(gradeFilter(patch), '');
  }
  assert.match(gradeFilter({ saturation: -100 }), /colorchannelmixer/);
  assert.match(gradeFilter({ exposure: 1 }), /\*2,1\/2\.2/); // +1 stop doubles the light
});

test('there are three original looks, each with a filter and a plain-words note', () => {
  assert.equal(LOOK_NAMES.filter((n) => n !== 'none').length, 3);
  for (const name of LOOK_NAMES.filter((n) => n !== 'none')) {
    assert.ok(looks[name].filters.length > 0 && looks[name].about.length > 10);
    assert.notEqual(gradeFilter({ look: name }), '');
  }
});

test('bad values are refused in plain words', () => {
  assert.throws(() => normalise({ exposure: 9 }), /exposure 9 is outside -3 to 3/);
  assert.throws(() => normalise({ look: 'nope' }), /look "nope"/);
  assert.throws(() => normalise({ contrast: 'high' }), /contrast must be a number/);
});

test('one recipe per clip, with a default, and reset returns a clip to neutral without touching others', () => {
  let g = { version: 1, default: neutral(), clips: {} };
  g = withRecipe(g, 'demo-2', { exposure: 0.3 });
  g = withRecipe(g, 'demo-3', { temperature: 10 });
  assert.equal(recipeFor(g, 'demo-2').exposure, 0.3);
  assert.equal(recipeFor(g, 'never-named').exposure, 0);
  const back = reset(g, 'demo-2');
  assert.ok(isNeutral(recipeFor(back, 'demo-2')));
  assert.equal(gradeFilter(recipeFor(back, 'demo-2')), '');
  assert.equal(recipeFor(back, 'demo-3').temperature, 10);
  assert.equal(g.clips['demo-2'].exposure, 0.3); // the original is not changed
});

test('the recipe file round-trips, and a job with none is neutral', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grade-'));
  assert.ok(isNeutral(recipeFor(loadGrade(dir), 'any')));
  saveGrade(dir, withRecipe(loadGrade(dir), 'a', { saturation: 10, look: 'warm-film' }));
  assert.ok(fs.existsSync(path.join(dir, 'edit', 'grade.json')));
  assert.deepEqual(recipeFor(loadGrade(dir), 'a'), { exposure: 0, temperature: 0, contrast: 0, saturation: 10, look: 'warm-film' });
});

const ffmpegOk = spawnSync(FFMPEG, ['-version']).status === 0;
const sample = (dir) => {
  const f = path.join(dir, 'in.png');
  spawnSync(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=1', '-frames:v', '1', f]);
  return f;
};
const meanOf = (file) => {
  const r = spawnSync(FFMPEG, ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 26 });
  const px = r.stdout; let sum = 0;
  for (const v of px) sum += v;
  return sum / px.length;
};

test('a neutral still comes back the same picture; a +exposure still is brighter; reset is neutral again', { skip: !ffmpegOk }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grade-'));
  const src = sample(dir);
  const n1 = gradeStill(src, path.join(dir, 'n1.png'), neutral());
  const up = gradeStill(src, path.join(dir, 'up.png'), { exposure: 0.3 });
  const back = gradeStill(src, path.join(dir, 'n2.png'), reset(withRecipe({ clips: {} }, 'c', { exposure: 0.3 }), 'c').clips.c);
  assert.ok(Math.abs(meanOf(n1) - meanOf(src)) < 1, 'neutral keeps the picture');
  assert.ok(meanOf(up) > meanOf(n1) + 0.5, 'exposure +0.3 is brighter');
  assert.equal(fs.readFileSync(n1).compare(fs.readFileSync(back)), 0, 'reset gives exactly the neutral picture');
});

test('beforeAfter writes one still twice as wide as the picture', { skip: !ffmpegOk }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grade-'));
  const out = beforeAfter(sample(dir), path.join(dir, 'ba.png'), { temperature: 40 }, { height: 180 });
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', out], { encoding: 'utf8' });
  assert.equal(probe.stdout.trim(), '640,180');
});

test('a neutral recipe passes a still and a clip through byte for byte (no re-encode, no new picture)', { skip: !ffmpegOk }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grade-'));
  const src = sample(dir);
  const still = gradeStill(src, path.join(dir, 'still-out.png'), neutral());
  assert.equal(fs.readFileSync(src).compare(fs.readFileSync(still)), 0, 'the still is the source, byte for byte');
  const clip = path.join(dir, 'in.mp4');
  spawnSync(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=160x90:rate=10:duration=1', '-pix_fmt', 'yuv420p', clip]);
  const out = gradeClip(clip, path.join(dir, 'clip-out.mp4'), neutral());
  assert.equal(fs.readFileSync(clip).compare(fs.readFileSync(out)), 0, 'the clip is the source, byte for byte');
  assert.notEqual(gradeStill(src, path.join(dir, 'g.png'), { exposure: 0.3 }), src);
  assert.notEqual(fs.readFileSync(src).compare(fs.readFileSync(path.join(dir, 'g.png'))), 0, 'a real grade does change the picture');
});

// ---- skin tones: twelve synthetic patches (no real person), light to dark. A look must move a skin hue by 5 degrees at most
// (CIELAB hue angle, D50 white as the verifier measured it; D65 is held to 6 as a second opinion: soft-daylight, unchanged, is 4.9 and 5.5) and must not collapse the colour of a tone that has some.
const SKIN = [[246, 237, 228], [243, 231, 219], [247, 234, 208], [234, 218, 186], [215, 189, 150], [160, 126, 86], [130, 92, 67], [96, 65, 52], [58, 49, 42], [41, 36, 32], [115, 82, 68], [194, 150, 130]];
const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const RGB_TO_XYZ = { D65: [[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.072175], [0.0193339, 0.119192, 0.9503041]], D50: [[0.4360747, 0.3850649, 0.1430804], [0.2225045, 0.7168786, 0.0606169], [0.0139322, 0.0971045, 0.7141733]] };
const WHITE = { D65: [0.95047, 1, 1.08883], D50: [0.96422, 1, 0.82521] };
const toLab = (rgb, ill) => {
  const c = rgb.map(lin);
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const [fx, fy, fz] = RGB_TO_XYZ[ill].map((row, i) => f((row[0] * c[0] + row[1] * c[1] + row[2] * c[2]) / WHITE[ill][i]));
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};
const hueOf = (l) => (Math.atan2(l[2], l[1]) * 180) / Math.PI;
const chromaOf = (l) => Math.hypot(l[1], l[2]);
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

/** The twelve patches graded with one look: returns the graded RGB of each patch's middle pixel. */
function gradePatches(dir, look) {
  const args = ['-v', 'error', '-y'];
  SKIN.forEach((t) => args.push('-f', 'lavfi', '-i', `color=c=0x${t.map((v) => v.toString(16).padStart(2, '0')).join('')}:s=80x160,format=rgb24`));
  args.push('-filter_complex', `${SKIN.map((_, i) => `[${i}:v]`).join('')}hstack=inputs=12`, '-frames:v', '1', path.join(dir, 'skin.png'));
  spawnSync(FFMPEG, args);
  gradeStill(path.join(dir, 'skin.png'), path.join(dir, `skin-${look}.png`), { look });
  const px = spawnSync(FFMPEG, ['-v', 'error', '-i', path.join(dir, `skin-${look}.png`), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 26 }).stdout;
  return SKIN.map((_, i) => { const o = (80 * 960 + 40 + 80 * i) * 3; return [px[o], px[o + 1], px[o + 2]]; });
}

test('every look keeps skin hue within 5 degrees and does not collapse skin colour; the looks stay distinct', { skip: !ffmpegOk }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grade-'));
  const outs = {};
  for (const look of LOOK_NAMES.filter((n) => n !== 'none')) {
    outs[look] = gradePatches(dir, look);
    for (const ill of ['D65', 'D50']) {
      SKIN.forEach((tone, i) => {
        const before = toLab(tone, ill), after = toLab(outs[look][i], ill);
        if (chromaOf(before) < 6) return; // a near-grey tone has no stable hue
        assert.ok(Math.abs(wrap(hueOf(after) - hueOf(before))) <= (ill === 'D50' ? 5 : 6), `${look} ${ill}: tone ${i} ${tone} moves hue by ${wrap(hueOf(after) - hueOf(before)).toFixed(1)} degrees`);
        assert.ok(chromaOf(after) >= 6, `${look} ${ill}: tone ${i} ${tone} loses its colour (chroma ${chromaOf(after).toFixed(1)})`);
      });
    }
  }
  const names = Object.keys(outs);
  for (let a = 0; a < names.length; a++) for (let b = a + 1; b < names.length; b++) {
    const mean = SKIN.reduce((sum, _, i) => { const x = toLab(outs[names[a]][i], 'D65'), y = toLab(outs[names[b]][i], 'D65'); return sum + Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); }, 0) / SKIN.length;
    assert.ok(mean >= 2, `${names[a]} and ${names[b]} stay distinct (mean difference ${mean.toFixed(2)})`);
  }
});
