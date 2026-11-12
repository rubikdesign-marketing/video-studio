// What every brand tool shares: where brands live, how a brand.json is checked, and which files the engine
// needs from it. Used by tools/brand/{sync,check,new}.mjs, tools/film/{scaffold,captions}.mjs and tools/audio/voice.mjs.
//
// A brand is one folder in brands/. Folders that start with "_" (such as _template) are never used for a video.
// The shape of brand.json is explained in brands/_template/README.md and inside brands/_template/brand.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BRANDS = path.join(STUDIO, 'brands');
export const ENGINE = path.join(STUDIO, 'engine');
export const TEMPLATE = '_template';

export const PAGES = ['light', 'dark'];
export const ROLES = ['page', 'ink', 'second', 'accent', 'warm', 'soft', 'line'];
export const VOICES = ['headline', 'accent', 'label', 'product'];
const FONT_FILE = /\.(woff2|woff|ttf|otf)$/i;
const LOGO_FILE = /\.(svg|png|jpg|jpeg|webp)$/i;
const SOLID = /^#[0-9a-f]{6}$/i;
const COLOUR = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;

export const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
export const rel = (file) => path.relative(STUDIO, file);
export const brandDir = (name) => path.join(BRANDS, name);
export const isBrandName = (name) => /^[a-z0-9][a-z0-9-]*$/.test(name);

/** The brand a job uses when its job.json does not name one (studio.json, "default_brand"). */
export function defaultBrand() {
  const file = path.join(STUDIO, 'studio.json');
  const name = fs.existsSync(file) ? readJson(file).default_brand : undefined;
  if (!name) throw new Error('studio.json must name the default brand, like { "default_brand": "tulvo" }.');
  return name;
}

/** Every brand folder that can be used for a video, in alphabetical order. */
export function brandNames() {
  if (!fs.existsSync(BRANDS)) return [];
  return fs.readdirSync(BRANDS).filter((name) => isBrandName(name) && fs.existsSync(path.join(BRANDS, name, 'brand.json'))).sort();
}

/** The brand of a job: job.json "brand", else the studio's default. Stops with plain words if that brand is not set up. */
export function brandOfJob(job) {
  const name = job?.brand || defaultBrand();
  if (!fs.existsSync(path.join(brandDir(name), 'brand.json'))) {
    throw new Error(`The brand "${name}" has no folder brands/${name}/ with a brand.json. Brands set up here: ${brandNames().join(', ') || 'none'}. Make one with: node tools/brand/new.mjs ${name}`);
  }
  return name;
}

/** A copy without the "_about" style notes: every key that starts with an underscore is a note for people. */
export function withoutNotes(value) {
  if (Array.isArray(value)) return value.map(withoutNotes);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !key.startsWith('_')).map(([key, v]) => [key, withoutNotes(v)]));
  }
  return value;
}

// ---------------------------------------------------------------- colour

const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

/** How light a colour is, 0 (black) to 1 (white), as the contrast rules measure it. */
export function luminance(hex) {
  const [r, g, b] = channels(hex).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast between two solid colours, from 1 (the same) to 21 (black on white). */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// ---------------------------------------------------------------- files the engine needs

/** Where a font's file is on disk, and where the engine finds it inside engine/public/. */
export function fontFile(name, font) {
  if (font.package) {
    return { from: path.join(ENGINE, 'node_modules', font.package), to: `brands/${name}/fonts/${path.basename(font.package)}` };
  }
  return { from: path.join(brandDir(name), font.file), to: `brands/${name}/${font.file}` };
}

/** Where a logo file is on disk, and where the engine finds it inside engine/public/. */
export const logoFile = (name, file) => ({ from: path.join(brandDir(name), file), to: `brands/${name}/${file}` });

/** Every file sync.mjs copies for a brand, once each. Only call it with a brand.json that passed checkBrand(). */
export function brandFiles(name, brand) {
  const fonts = VOICES.map((voice) => brand.fonts[voice]).filter(Boolean).map((font) => fontFile(name, font));
  const logos = PAGES.flatMap((page) => [brand.logo[page].wordmark, brand.logo[page].mark]).map((file) => logoFile(name, file));
  const seen = new Map();
  for (const file of [...fonts, ...logos]) seen.set(file.to, file);
  return [...seen.values()];
}

// ---------------------------------------------------------------- checking a brand.json

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const isText = (v) => typeof v === 'string' && v.trim() !== '';
const inside = (folder, file) => !path.relative(folder, file).startsWith('..') && !path.isAbsolute(path.relative(folder, file));

/**
 * Reads brands/<name>/brand.json and checks it against the shape the engine expects.
 * Returns { brand, problems }: `brand` is the file without its notes, and `problems` is a list of sentences
 * a person can act on. An empty list means the engine can use the brand.
 */
export function checkBrand(name) {
  const problems = [];
  const say = (text) => problems.push(text);
  const file = path.join(brandDir(name), 'brand.json');
  if (!isBrandName(name) && name !== TEMPLATE) return { brand: null, problems: [`The folder name "${name}" must be lower-case letters, digits and hyphens only.`] };
  if (!fs.existsSync(file)) return { brand: null, problems: [`${rel(file)} does not exist.`] };
  let brand;
  try {
    brand = withoutNotes(readJson(file));
  } catch (error) {
    return { brand: null, problems: [`${rel(file)} is not valid JSON: ${error.message}`] };
  }
  const group = (key) => (isObject(brand[key]) ? brand[key] : (say(`"${key}" is missing.`), null));

  if (!isText(brand.name)) say('"name" is empty. Write the brand\'s name as it should be shown.');

  // Colours: the same roles on a light page and a dark page.
  const colours = group('colours');
  for (const page of PAGES) {
    const roles = colours?.[page];
    if (!isObject(roles)) { if (colours) say(`colours.${page} is missing.`); continue; }
    for (const role of ROLES) {
      const value = roles[role];
      const mustBeSolid = role === 'page' || role === 'ink' || role === 'accent';
      if (value === undefined || value === '') say(`colours.${page}.${role} is missing.`);
      else if (!(mustBeSolid ? SOLID : COLOUR).test(value)) {
        say(`colours.${page}.${role} is "${value}". Write it as ${mustBeSolid ? 'a six-digit colour like #1A2B3C' : 'a colour like #1A2B3C (or #1A2B3C80 for a see-through one)'}.`);
      }
    }
    if (roles.on_accent !== undefined && !SOLID.test(roles.on_accent)) say(`colours.${page}.on_accent must be a six-digit colour like #FFFFFF.`);
  }
  if (colours?.confetti !== undefined && !(Array.isArray(colours.confetti) && colours.confetti.length && colours.confetti.every((c) => SOLID.test(c)))) {
    say('colours.confetti must be a list of six-digit colours, or left out.');
  }
  if (colours?.other !== undefined && !(isObject(colours.other) && Object.values(colours.other).every((c) => COLOUR.test(c)))) {
    say('colours.other must be a list of named colours, like { "navy": "#0A1430" }, or left out.');
  }

  // Stages: how each page is lit.
  const stages = group('stages');
  for (const page of PAGES) {
    const look = stages?.[page];
    if (!isObject(look)) { if (stages) say(`stages.${page} is missing.`); continue; }
    if (!Array.isArray(look.lights)) say(`stages.${page}.lights must be a list (it may be empty).`);
    else {
      look.lights.forEach((light, i) => {
        const where = `stages.${page}.lights, light ${i + 1}`;
        if (!isObject(light)) return say(`${where} must have x, y, radius, colour and opacity.`);
        for (const key of ['x', 'y', 'radius', 'opacity']) if (!isNumber(light[key])) say(`${where}: "${key}" must be a number.`);
        if (!SOLID.test(light.colour ?? '')) say(`${where}: "colour" must be a six-digit colour like #1A2B3C.`);
      });
    }
    for (const key of ['grain', 'vignette', 'screen_glow']) {
      if (!isNumber(look[key]) || look[key] < 0 || look[key] > 1) say(`stages.${page}.${key} must be a number from 0 to 1.`);
    }
  }

  // Fonts: one per voice. The accent and the product voice may be null.
  const fonts = group('fonts');
  for (const voice of fonts ? VOICES : []) {
    const font = fonts[voice];
    const optional = voice === 'accent' || voice === 'product';
    if (font === null && optional) continue;
    if (!isObject(font)) { say(`fonts.${voice} is missing.${optional ? ' Write null if the brand has none.' : ''}`); continue; }
    if (!isText(font.family)) say(`fonts.${voice}.family is empty. Write the typeface's name.`);
    if (!isNumber(font.weight)) say(`fonts.${voice}.weight must be a number such as 400 or 600.`);
    if (font.weight_range !== undefined && !/^\d{3} \d{3}$/.test(font.weight_range)) say(`fonts.${voice}.weight_range must look like "400 700".`);
    if (font.style !== undefined && !['normal', 'italic'].includes(font.style)) say(`fonts.${voice}.style must be "normal" or "italic".`);
    for (const key of ['tracking_em', 'line_height', 'scale', 'body_weight']) {
      if (font[key] !== undefined && !isNumber(font[key])) say(`fonts.${voice}.${key} must be a number.`);
    }
    if (isText(font.file) === isText(font.package)) {
      say(`fonts.${voice} must say where its file is in exactly one way: "file" (a file in brands/${name}/fonts/) or "package" (a file of an installed npm package).`);
      continue;
    }
    const source = font.file ?? font.package;
    if (!FONT_FILE.test(source)) { say(`fonts.${voice}: "${source}" must be a .woff2, .woff, .ttf or .otf file.`); continue; }
    const { from } = fontFile(name, font);
    if (font.file && !(font.file.startsWith('fonts/') && inside(path.join(brandDir(name), 'fonts'), from))) {
      say(`fonts.${voice}.file must be inside the brand's fonts/ folder, like "fonts/MyFont.woff2".`);
    } else if (font.package && !inside(path.join(ENGINE, 'node_modules'), from)) {
      say(`fonts.${voice}.package must be a file inside an installed package, like "@fontsource-variable/inter/files/inter-latin-opsz-normal.woff2".`);
    } else if (!fs.existsSync(from)) {
      say(font.file
        ? `fonts.${voice}: the file ${rel(from)} does not exist. Put the font file there.`
        : `fonts.${voice}: ${rel(from)} does not exist. Install the package in engine/ first (npm install in engine/), or check the path.`);
    }
  }
  if (fonts) {
    const targets = new Map();
    for (const voice of VOICES) {
      const font = fonts[voice];
      if (!isObject(font) || isText(font.file) === isText(font.package)) continue;
      const { from, to } = fontFile(name, font);
      if (targets.has(to) && targets.get(to) !== from) say(`fonts.${voice}: two different font files share the file name "${path.basename(to)}". Rename one.`);
      targets.set(to, from);
    }
  }

  // Logo: a wordmark and a mark for each page.
  const logo = group('logo');
  for (const page of logo ? PAGES : []) {
    if (!isObject(logo[page])) { say(`logo.${page} is missing.`); continue; }
    for (const kind of ['wordmark', 'mark']) {
      const value = logo[page][kind];
      const where = `logo.${page}.${kind}`;
      if (!isText(value)) { say(`${where} is missing. Name a file in the brand's logo/ folder.`); continue; }
      const from = path.join(brandDir(name), value);
      if (!LOGO_FILE.test(value)) say(`${where}: "${value}" must be an .svg, .png, .jpg or .webp file.`);
      else if (!(value.startsWith('logo/') && inside(path.join(brandDir(name), 'logo'), from))) say(`${where} must be inside the brand's logo/ folder, like "logo/wordmark.svg".`);
      else if (!fs.existsSync(from)) say(`${where}: the file ${rel(from)} does not exist.`);
    }
  }

  // Shape: corner radii as shares of frame height.
  const shape = group('shape');
  if (shape) {
    for (const key of ['control_radius', 'window_radius']) {
      if (!isNumber(shape[key]) || shape[key] < 0 || shape[key] > 0.5) say(`shape.${key} must be a share of frame height, such as 0.011.`);
    }
    if (shape.pill_radius !== 'full' && !(isNumber(shape.pill_radius) && shape.pill_radius >= 0)) say('shape.pill_radius must be "full" or a share of frame height.');
  }

  // Captions: the few settings a brand may change.
  const captions = group('captions');
  if (captions) {
    if (!isNumber(captions.weight)) say('captions.weight must be a number such as 600.');
    for (const key of ['text', 'highlight', 'glass_top', 'glass_bottom']) {
      if (!SOLID.test(captions[key] ?? '')) say(`captions.${key} must be a six-digit colour like #FFFFFF.`);
    }
  }

  // Product UI: null, or the product's own colours.
  if (brand.product_ui === undefined) say('"product_ui" is missing. Write null if the brand has no product to show.');
  else if (brand.product_ui !== null && !(isObject(brand.product_ui) && SOLID.test(brand.product_ui.background ?? ''))) {
    say('product_ui must be null, or a group with at least "background" as a six-digit colour.');
  }
  if (isObject(brand.product_ui) && !brand.fonts?.product) say('product_ui is filled in, so fonts.product must name the typeface the product is set in.');

  // Rejected: what the owner has said no to.
  const rejected = group('rejected');
  for (const key of rejected ? ['colours', 'patterns', 'type'] : []) {
    if (!(Array.isArray(rejected[key]) && rejected[key].every((item) => typeof item === 'string'))) say(`rejected.${key} must be a list of words (it may be empty: []).`);
  }

  return { brand, problems };
}
