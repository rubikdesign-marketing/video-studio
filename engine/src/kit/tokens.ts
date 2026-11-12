// What a brand is, to the engine. A brand's values live in brands/<name>/brand.json; this file gives that file
// its shape, and turns it into the colours, type voices, shapes and logos the kit works with, all by role.
// Nothing here knows any one brand: no colour and no typeface is named in engine/src outside src/brands/index.ts,
// which tools/brand/sync.mjs writes.
import { z } from 'zod';

// ---------------------------------------------------------------- the shape of brand.json

const solid = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'a six-digit colour');
const colour = z.string().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/, 'a six- or eight-digit colour');
const share = z.number().min(0).max(1);

/** The seven colour roles of one page. Any stage is built from these. */
const pageSchema = z.object({
  page: solid,
  ink: solid,
  /** Second clause of a headline, supporting text. */
  second: colour,
  /** The one accent. */
  accent: solid,
  /** Old prices, deadlines, one warm note per scene. */
  warm: colour,
  soft: colour,
  line: colour,
  /** Text on an accent fill. Left out, it is whichever ink reads better on the accent. */
  on_accent: solid.optional(),
});

/** How a page is lit when it fills the frame. x and y are shares of the frame; radius is a share of its height. */
const lookSchema = z.object({
  lights: z.array(z.object({ x: z.number(), y: z.number(), radius: z.number(), colour: solid, opacity: share })),
  grain: share,
  vignette: share,
  screen_glow: share,
});

/** One type voice. Its file is either in the brand's fonts/ folder ("file") or in an installed npm package ("package"). */
const fontSchema = z.object({
  family: z.string().min(1),
  file: z.string().optional(),
  package: z.string().optional(),
  style: z.enum(['normal', 'italic']).optional(),
  weight: z.number(),
  /** The weights the file carries, such as "400 700" for a variable font. */
  weight_range: z.string().optional(),
  tracking_em: z.number().optional(),
  line_height: z.number().optional(),
  /** Size next to the headline it sits in. For an accent face that runs small or large. */
  scale: z.number().optional(),
});

const logoSchema = z.object({ wordmark: z.string(), mark: z.string() });

export const brandSchema = z.object({
  name: z.string().min(1),
  colours: z.object({
    light: pageSchema,
    dark: pageSchema,
    confetti: z.array(solid).min(1).optional(),
  }),
  stages: z.object({ light: lookSchema, dark: lookSchema }),
  fonts: z.object({ headline: fontSchema, accent: fontSchema.nullable(), label: fontSchema, product: fontSchema.nullable() }),
  logo: z.object({ light: logoSchema, dark: logoSchema }),
  shape: z.object({ control_radius: share, window_radius: share, pill_radius: z.union([z.literal('full'), z.number().min(0)]) }),
  captions: z.object({ weight: z.number(), text: solid, highlight: solid, glass_top: solid, glass_bottom: solid }),
  product_ui: z.looseObject({ background: solid }).nullable(),
});
export type BrandFile = z.infer<typeof brandSchema>;
type FontFile = z.infer<typeof fontSchema>;

// ---------------------------------------------------------------- colour helpers

/** A brand colour at an opacity, as rgba(). A colour that is already see-through becomes more so. */
export const alpha = (hex: string, opacity: number) => {
  const n = parseInt(hex.slice(1, 7), 16);
  const own = hex.length > 7 ? parseInt(hex.slice(7, 9), 16) / 255 : 1;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.round(own * opacity * 1000) / 1000})`;
};

/** How light a solid colour is, 0 to 1, as the contrast rules measure it. */
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Contrast between two solid colours, 1 to 21. */
export const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// ---------------------------------------------------------------- what the kit works with

export const stageNames = ['light', 'dark'] as const;
export type StageName = (typeof stageNames)[number];

/** Colour by role on one stage, plus the logo files that sit on it. */
export type StagePalette = {
  page: string;
  ink: string;
  /** Second clause of a headline, supporting text. */
  second: string;
  /** The one accent. */
  accent: string;
  /** Old prices, deadlines, one warm note per scene. */
  warm: string;
  soft: string;
  line: string;
  /** Text on an ink-coloured fill, such as a button. */
  onInk: string;
  /** Text on an accent-coloured fill. */
  onAccent: string;
  /** Shadows and vignette. */
  shade: string;
  /** Opacity of the accent glow around a product window. On a dark stage the light comes from the product. */
  screenGlow: number;
  /** Wordmark and mark for this stage, as files in public/. */
  wordmark: string;
  mark: string;
};

/** A soft pool of light. x and y are shares of the frame; radius is a share of its height. */
export type Light = { x: number; y: number; radius: number; colour: string; opacity: number };
export type StageLook = { lights: Light[]; grain: number; vignette: number };

/** One type voice, ready for CSS. */
export type Voice = {
  family: string;
  /** The CSS font-family value. */
  css: string;
  weight: number;
  style: 'normal' | 'italic';
  /** Letter spacing in em. Undefined keeps the spacing of the text around it. */
  tracking?: number;
  lineHeight?: number;
  scale: number;
};

/** A font file to load before any frame is drawn. `url` is a file in public/. */
export type FontFace = { family: string; url: string; weight: string; style: 'normal' | 'italic' };

export type Brand = {
  /** The folder name in brands/. */
  key: string;
  name: string;
  stages: Record<StageName, StagePalette>;
  looks: Record<StageName, StageLook>;
  fonts: {
    headline: Voice;
    /** The starred word of a headline. Without an accent face of its own, a brand gets its headline face, heavier or in italic. */
    accent: Voice;
    label: Voice;
    /** Inside product UI. A brand without a product gets its label voice. */
    product: Voice;
  };
  /** False when the accent voice is the fallback. */
  hasAccentFont: boolean;
  fontFaces: FontFace[];
  /** Corner radii as percentages of frame height, ready for useVh(). */
  shape: { control: number; window: number; pill: number };
  captions: { weight: number; text: string; highlight: string; glassTop: string; glassBottom: string };
  /** The pointer: a dark arrow with a light outline, so it shows on any page. */
  cursor: { fill: string; outline: string };
  confetti: string[];
  /** The page colour of the brand's product, behind a capture. */
  screen: string;
  /** The product's own colours, as brand.json gives them. Null for a brand with no product. */
  productUi: BrandFile['product_ui'];
};

/** brand.json without its "_about" style notes: every key that starts with an underscore is a note for people. */
const withoutNotes = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(withoutNotes);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([key]) => !key.startsWith('_')).map(([key, v]) => [key, withoutNotes(v)]));
  }
  return value;
};

/** How much heavier the starred word is set when a brand has no accent face. */
const ACCENT_FALLBACK_WEIGHT = 200;

const fileName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

/** Turns one brand.json into what the kit works with. `key` is the brand's folder name. */
export const readBrand = (key: string, json: unknown): Brand => {
  const parsed = brandSchema.safeParse(withoutNotes(json));
  if (!parsed.success) {
    throw new Error(`brands/${key}/brand.json does not have the shape the engine expects. Run: node tools/brand/check.mjs ${key}\n${z.prettifyError(parsed.error)}`);
  }
  const file = parsed.data;
  const { light, dark } = file.colours;
  // Where tools/brand/sync.mjs puts the brand's files inside public/.
  const asset = (path: string) => `brands/${key}/${path}`;
  const fontUrl = (font: FontFile) => asset(font.file ?? `fonts/${fileName(font.package ?? '')}`);

  const stage = (name: StageName): StagePalette => {
    const own = file.colours[name];
    const other = name === 'light' ? dark : light;
    return {
      page: own.page,
      ink: own.ink,
      second: own.second,
      accent: own.accent,
      warm: own.warm,
      soft: own.soft,
      line: own.line,
      onInk: other.ink,
      onAccent: own.on_accent ?? (contrast(light.ink, own.accent) >= contrast(dark.ink, own.accent) ? light.ink : dark.ink),
      shade: luminance(own.ink) < luminance(own.page) ? own.ink : own.page,
      screenGlow: file.stages[name].screen_glow,
      wordmark: asset(file.logo[name].wordmark),
      mark: asset(file.logo[name].mark),
    };
  };
  const look = (name: StageName): StageLook => {
    const { lights, grain, vignette } = file.stages[name];
    return { lights, grain, vignette };
  };

  const voice = (font: FontFile): Voice => ({
    family: font.family,
    css: `"${font.family}", sans-serif`,
    weight: font.weight,
    style: font.style ?? 'normal',
    tracking: font.tracking_em,
    lineHeight: font.line_height,
    scale: font.scale ?? 1,
  });
  const headline = voice(file.fonts.headline);
  const label = voice(file.fonts.label);
  // No accent face: the starred word stays in the headline face, heavier if the file carries a heavier weight,
  // otherwise in italic.
  const heaviest = Number(file.fonts.headline.weight_range?.split(' ').at(-1) ?? headline.weight);
  const heavier = Math.min(heaviest, headline.weight + ACCENT_FALLBACK_WEIGHT);
  const accentFallback: Voice =
    heavier > headline.weight
      ? { ...headline, weight: heavier, tracking: undefined, lineHeight: undefined, scale: 1 }
      : { ...headline, style: 'italic', tracking: undefined, lineHeight: undefined, scale: 1 };

  const faces = new Map<string, FontFace>();
  for (const font of [file.fonts.headline, file.fonts.accent, file.fonts.label, file.fonts.product]) {
    if (!font) continue;
    const face: FontFace = { family: font.family, url: fontUrl(font), weight: font.weight_range ?? String(font.weight), style: font.style ?? 'normal' };
    faces.set([face.family, face.url, face.style].join('|'), face);
  }

  return {
    key,
    name: file.name,
    stages: { light: stage('light'), dark: stage('dark') },
    looks: { light: look('light'), dark: look('dark') },
    fonts: {
      headline,
      accent: file.fonts.accent ? voice(file.fonts.accent) : accentFallback,
      label,
      product: file.fonts.product ? voice(file.fonts.product) : label,
    },
    hasAccentFont: file.fonts.accent !== null,
    fontFaces: [...faces.values()],
    shape: {
      control: file.shape.control_radius * 100,
      window: file.shape.window_radius * 100,
      pill: file.shape.pill_radius === 'full' ? 100 : file.shape.pill_radius * 100,
    },
    captions: {
      weight: file.captions.weight,
      text: file.captions.text,
      highlight: file.captions.highlight,
      glassTop: file.captions.glass_top,
      glassBottom: file.captions.glass_bottom,
    },
    cursor: { fill: light.ink, outline: dark.ink },
    confetti: file.colours.confetti ?? [dark.accent, dark.second, dark.ink, dark.warm, light.accent, light.soft],
    screen: file.product_ui?.background ?? light.page,
    productUi: file.product_ui,
  };
};
