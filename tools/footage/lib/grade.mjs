// Colour grade: a per-clip recipe turned into ONE ffmpeg filter string, applied after pictureChain (workcopy.mjs).
//
// pictureChain hands over normal colour: BT.709 SDR, limited range, yuv420p. gradeFilter(recipe) takes that, works in
// 16-bit RGB, and hands back BT.709 SDR, limited range, yuv420p again, tagged bt709. A neutral recipe gives '' (no
// filter at all), so a project that never grades is untouched.
//
// Recipe  { exposure, temperature, contrast, saturation, look }   (every number 0 is "leave it")
//   exposure     stops, -3 to 3, in linear light (+1 doubles the light)
//   temperature  -100 (cooler) to 100 (warmer): red and blue gains in opposite directions
//   contrast     -100 to 100: stretches or squeezes around mid grey (100 is twice as contrasty)
//   saturation   -100 (grey) to 100 (twice as colourful)
//   look         "none" or one of the three studio looks below (made here, no third-party LUT)
//
// One recipe file per job: jobs/<job>/edit/grade.json  { "version": 1, "default": <recipe>, "clips": { "<clip>": <recipe> } }.
// The preview and the export both read it through loadGrade() + recipeFor() + gradeFilter(), and both show the graded
// pictures `apply` wrote once (engine/public/jobs/<slug>/graded/<clip>.png): nothing is graded twice or two ways.
//
//   node tools/footage/lib/grade.mjs apply <job_dir> --sources <sources.json> [--out <folder>]   write graded stills
//   node tools/footage/lib/grade.mjs set <job_dir> <clip> exposure=0.3 [temperature=10 ...]       change one clip's recipe
//   node tools/footage/lib/grade.mjs reset <job_dir> <clip>                                       that clip goes back to neutral
//   node tools/footage/lib/grade.mjs before-after <src> <out.png> [exposure=0.3 ...]              an hstack still: before | after
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FFMPEG, run } from './common.mjs';
import { pictureChain } from './workcopy.mjs';

/** The identity recipe. Its filter is ''. */
export const neutral = () => ({ exposure: 0, temperature: 0, contrast: 0, saturation: 0, look: 'none' });

const RANGES = { exposure: [-3, 3], temperature: [-100, 100], contrast: [-100, 100], saturation: [-100, 100] };

/**
 * Three looks, made for the studio from plain ffmpeg colour moves. Each is a list of filters that run last, in RGB.
 * Their strength is deliberately mild: a look is a mood, the four sliders do the correcting.
 */
export const looks = {
  none: { about: 'No look.', filters: [] },
  'soft-daylight': {
    about: 'Open, airy and a little warm: blacks lifted slightly, highlights kept creamy, colour eased back.',
    filters: ["curves=all='0/0.035 0.5/0.52 1/0.985'", 'colorbalance=rm=0.025:bm=-0.025:rh=0.015:bh=-0.015', 'colorchannelmixer=rr=0.94:rg=0.04:rb=0.02:gg=0.96:gr=0.02:gb=0.02:bb=0.95:br=0.02:bg=0.03'],
  },
  // The two looks below were retuned (corrective pass 5) so a skin tone keeps its hue to within 5 degrees (CIELAB, checked
  // by tools/footage/tests/grade.test.mjs on twelve synthetic tones): their colour casts are kept to the shadows and
  // the tone curve does the work of a look.
  'clean-cool': {
    about: 'Crisp and neutral-cool: a firm S-curve, a little more colour, shadows pushed a touch blue.',
    filters: ["curves=all='0/0 0.25/0.22 0.75/0.78 1/1'", 'colorchannelmixer=rr=1.047244:rg=-0.042912:rb=-0.004332:gr=-0.012756:gg=1.017088:gb=-0.004332:br=-0.012756:bg=-0.042912:bb=1.055668', 'colorbalance=rs=-0.0072:bs=0.012'],
  },
  'warm-film': {
    about: 'Warm highlights, faded blacks and a hint of green-teal in the shadows, like a lightly worn print.',
    filters: ["curves=all='0/0.05 0.5/0.5 1/0.96'", 'colorbalance=rs=-0.016:gs=0.006:bs=0.02:rh=0.015:bh=-0.02'],
  },
};
export const LOOK_NAMES = Object.keys(looks);

/** A recipe with every missing field filled from neutral, checked. Throws a plain-words error on a bad value. */
export function normalise(recipe = {}) {
  const out = { ...neutral(), ...recipe };
  for (const [key, [lo, hi]] of Object.entries(RANGES)) {
    const v = out[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`grade: ${key} must be a number, not ${JSON.stringify(v)}.`);
    if (v < lo || v > hi) throw new Error(`grade: ${key} ${v} is outside ${lo} to ${hi}.`);
  }
  if (!looks[out.look]) throw new Error(`grade: look "${out.look}" is not one of ${LOOK_NAMES.join(', ')}.`);
  return { exposure: out.exposure, temperature: out.temperature, contrast: out.contrast, saturation: out.saturation, look: out.look };
}

/** True when the recipe changes nothing. */
export const isNeutral = (recipe) => {
  const r = normalise(recipe);
  return r.exposure === 0 && r.temperature === 0 && r.contrast === 0 && r.saturation === 0 && r.look === 'none';
};

const num = (n) => String(Math.round(n * 1e6) / 1e6);
const LUMA = [0.2126, 0.7152, 0.0722]; // BT.709, so saturation moves colour and not brightness

/** The 16-bit RGB filters for the four sliders, in a fixed order: light, tone, white balance, colour. Pure. */
function sliderFilters(r) {
  const out = [];
  const gain = 2 ** r.exposure;
  const warm = r.temperature / 100;
  const redGain = 1 + 0.12 * warm;
  const blueGain = 1 - 0.12 * warm;
  const k = 1 + r.contrast / 100;
  if (r.exposure !== 0 || r.temperature !== 0 || r.contrast !== 0) {
    // One lookup per channel: exposure in linear light (gamma 2.2), then the white-balance gain, then contrast around 0.5.
    const channel = (balance) => {
      const light = r.exposure !== 0 ? `pow(pow(val/maxval,2.2)*${num(gain)},1/2.2)` : 'val/maxval';
      const balanced = balance === 1 ? light : `${light}*${num(balance)}`;
      const toned = r.contrast !== 0 ? `(${balanced}-0.5)*${num(k)}+0.5` : balanced;
      return `clip(${toned},0,1)*maxval`;
    };
    out.push(`lutrgb=r='${channel(redGain)}':g='${channel(1)}':b='${channel(blueGain)}'`);
  }
  if (r.saturation !== 0) {
    const s = 1 + r.saturation / 100;
    const row = (i) => LUMA.map((l, j) => num(l * (1 - s) + (i === j ? s : 0)));
    const [rr, rg, rb] = row(0), [gr, gg, gb] = row(1), [br, bg, bb] = row(2);
    out.push(`colorchannelmixer=rr=${rr}:rg=${rg}:rb=${rb}:gr=${gr}:gg=${gg}:gb=${gb}:br=${br}:bg=${bg}:bb=${bb}`);
  }
  return out;
}

// Down and up between the picture chain's yuv420p and 16-bit RGB, with the matrix and range named, so nothing is guessed.
const TO_RGB = 'scale=in_color_matrix=bt709:in_range=tv:out_range=pc:flags=accurate_rnd+full_chroma_int,format=gbrp16le';
const TO_YUV = 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_inp,format=yuv420p,setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv';

/** The whole grade as one filter string to append after pictureChain's chain (with a comma). '' for a neutral recipe. Pure. */
export function gradeFilter(recipe) {
  const r = normalise(recipe);
  if (isNeutral(r)) return '';
  return [TO_RGB, ...sliderFilters(r), ...looks[r.look].filters, TO_YUV].join(',');
}

/** pictureChain's chain with the grade after it. A neutral recipe returns the picture chain unchanged. */
export function gradedChain(pictureChainString, recipe) {
  const g = gradeFilter(recipe);
  return g ? `${pictureChainString},${g}` : pictureChainString;
}

/** The output tags every graded or neutral clip carries (the same as workcopy.mjs makeWorkingCopy). */
export const TAG_ARGS = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];

// ---------------------------------------------------------------- the recipe file

export const gradeFile = (jobDir) => path.join(jobDir, 'edit', 'grade.json');

/** jobs/<job>/edit/grade.json, or an empty one (everything neutral) when the job never graded. */
export function loadGrade(jobDir) {
  const file = gradeFile(jobDir);
  if (!fs.existsSync(file)) return { version: 1, default: neutral(), clips: {} };
  const g = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { version: 1, default: normalise(g.default), clips: Object.fromEntries(Object.entries(g.clips || {}).map(([k, v]) => [k, normalise(v)])) };
}

export function saveGrade(jobDir, grade) {
  fs.mkdirSync(path.dirname(gradeFile(jobDir)), { recursive: true });
  fs.writeFileSync(gradeFile(jobDir), JSON.stringify(grade, null, 1) + '\n');
}

/** The recipe one clip gets: its own, else the file's default, else neutral. */
export const recipeFor = (grade, clip) => normalise(grade.clips?.[clip] ?? grade.default ?? neutral());

/** The grade with one clip's recipe changed (the others untouched). Pure: returns a new grade. */
export const withRecipe = (grade, clip, patch) => ({ ...grade, clips: { ...grade.clips, [clip]: normalise({ ...recipeFor(grade, clip), ...patch }) } });

/** The grade with one clip back to neutral. The clip stays in the file, as neutral, so the reset is visible and exact. Pure. */
export const reset = (grade, clip) => ({ ...grade, clips: { ...grade.clips, [clip]: neutral() } });

// ---------------------------------------------------------------- stills and clips

/** What pictureChain needs to know about a still: normal sRGB colour, no rotation, a steady frame rate. */
const stillVideo = (width, height) => ({ colour: { kind: 'sdr' }, width, height, rotation: 0, variable: false, fps: 30, target: '30' });

/**
 * The filter chain for a still (PNG, untagged sRGB, treated as BT.709 SDR): the RGB is first named BT.709 limited
 * range (swscale would otherwise guess BT.601), pictureChain runs as for any clip (its last step kept 4:4:4 so a
 * thin line of UI text keeps its colour), then the grade, then back to RGB for the PNG.
 */
export function stillChain(recipe, { width = 3840, height = 2160 } = {}) {
  const pic = pictureChain(stillVideo(width, height)).chain.replace(/,format=yuv420p$/, ',format=yuv444p');
  const head = 'scale=in_range=pc:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv444p';
  const g = gradeFilter(recipe);
  const tail = 'scale=in_color_matrix=bt709:in_range=tv:out_range=pc:flags=accurate_rnd+full_chroma_int,format=rgb24';
  // The grade's own entry and exit hop between 4:2:0 and RGB; for a still the 4:4:4 stays until the very end.
  return [head, pic, ...(g ? [g] : []), tail].join(',');
}

/** Grade one still into a PNG. Returns the output path. The source is never changed. */
export function gradeStill(src, out, recipe) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  // A neutral recipe is the identity: no re-encode, no new picture; the source passes through byte for byte.
  if (isNeutral(recipe)) {
    if (path.resolve(src) !== path.resolve(out)) fs.copyFileSync(src, out);
    return out;
  }
  run(FFMPEG, ['-hide_banner', '-v', 'error', '-y', '-i', src, '-vf', stillChain(recipe), '-frames:v', '1', out]);
  return out;
}

/** Grade a video clip's working copy (edit.mp4) into out.mp4: pictureChain's output is already in it, so the grade runs on that. */
export function gradeClip(src, out, recipe) {
  const g = gradeFilter(recipe);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  // A neutral recipe is the identity: no re-encode; the working copy passes through byte for byte.
  if (!g) {
    if (path.resolve(src) !== path.resolve(out)) fs.copyFileSync(src, out);
    return out;
  }
  run(FFMPEG, ['-hide_banner', '-v', 'error', '-y', '-i', src, ...(g ? ['-vf', g] : []), '-c:v', 'libx264', '-preset', 'fast', '-crf', '14', '-g', '10', '-bf', '0', '-profile:v', 'high', '-pix_fmt', 'yuv420p', ...TAG_ARGS, '-c:a', 'copy', '-movflags', '+faststart', out]);
  return out;
}

/** A still with the clip as it is on the left and graded on the right (hstack), scaled to `height` pixels tall. */
export function beforeAfter(src, out, recipe, { height = 1080 } = {}) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const side = (r) => stillChain(r);
  const filter = `[0:v]${side(neutral())},scale=-2:${height}[a];[1:v]${side(recipe)},scale=-2:${height}[b];[a][b]hstack=inputs=2`;
  run(FFMPEG, ['-hide_banner', '-v', 'error', '-y', '-i', src, '-i', src, '-filter_complex', filter, '-frames:v', '1', out]);
  return out;
}

/** Grade every source in a sources map { "<clip>": "<path to still>" } with the job's one recipe file. Returns what was written. */
export function applyGrade(jobDir, sources, outDir) {
  const grade = loadGrade(jobDir);
  const written = [];
  for (const [clip, src] of Object.entries(sources)) {
    const recipe = recipeFor(grade, clip);
    const out = path.join(outDir, `${clip}.png`);
    gradeStill(src, out, recipe);
    written.push({ clip, out, recipe, filter: gradeFilter(recipe) });
  }
  fs.writeFileSync(path.join(outDir, 'graded.json'), JSON.stringify({ gradeFile: path.relative(process.cwd(), gradeFile(jobDir)), clips: written.map(({ clip, recipe }) => ({ clip, recipe })) }, null, 1) + '\n');
  return written;
}

// ---------------------------------------------------------------- command line

const parseSettings = (items) => Object.fromEntries(items.map((item) => {
  const [key, value] = item.split('=');
  if (!(key in neutral())) throw new Error(`grade: "${key}" is not a recipe field (exposure, temperature, contrast, saturation, look).`);
  return [key, key === 'look' ? value : Number(value)];
}));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const flag = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest.splice(i, 2)[1] : undefined; };
  try {
    if (cmd === 'apply') {
      const sources = flag('--sources');
      const outDir = flag('--out');
      const jobDir = rest[0];
      if (!jobDir || !sources || !outDir) throw new Error('usage: grade.mjs apply <job_dir> --sources <sources.json> --out <folder>');
      for (const w of applyGrade(jobDir, JSON.parse(fs.readFileSync(sources, 'utf8')), outDir)) console.log(`${w.clip}: ${w.filter ? 'graded' : 'neutral'} -> ${w.out}`);
    } else if (cmd === 'set') {
      const [jobDir, clip, ...settings] = rest;
      saveGrade(jobDir, withRecipe(loadGrade(jobDir), clip, parseSettings(settings)));
      console.log(`${clip}: ${JSON.stringify(recipeFor(loadGrade(jobDir), clip))}`);
    } else if (cmd === 'reset') {
      const [jobDir, clip] = rest;
      saveGrade(jobDir, reset(loadGrade(jobDir), clip));
      console.log(`${clip}: back to neutral`);
    } else if (cmd === 'before-after') {
      const [src, out, ...settings] = rest;
      console.log(beforeAfter(src, out, normalise(parseSettings(settings))));
    } else {
      console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(15, 20).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
      process.exit(cmd ? 2 : 0);
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
