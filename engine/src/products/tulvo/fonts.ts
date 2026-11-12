/**
 * Inter, loaded the way the live app uses it, from a local file only (a render never goes online for fonts).
 *
 * The app requests Inter from Google Fonts as a VARIABLE font with the optical-size axis
 * (`Inter:ital,opsz,wght@0,14..32,100..900`; meta.json of every snapshot reports
 * "Inter 100 900 loaded") and sets `font-optical-sizing: auto` on <body>, so text above 14px
 * uses Inter's tighter display spacing (e.g. the 24px onboarding title is ~5% narrower than
 * with the 14px "text" instance).
 *
 * The file is `public/brands/tulvo/fonts/inter-latin-opsz-normal.woff2`: the Latin subset of
 * @fontsource-variable/inter with both axes (wght 100..900, opsz 14..32), which tools/brand/sync.mjs
 * copies there because brands/tulvo/brand.json names it as the brand's "product" typeface.
 * Static Inter files (no opsz axis) render every heading above 14px about 5% too wide, so do not swap it.
 *
 * It is registered under a dedicated family name, "Tulvo Inter": other modules may register
 * Inter faces under "Inter", and same-name faces would make the match ambiguous.
 * tools/scope-css.mjs maps the app CSS's `font-family: Inter, …` to `"Tulvo Inter", Inter, …`.
 * Only Latin is loaded (the live app also loads Latin Extended); characters outside it fall back.
 *
 * delayRender() blocks every frame until the file is decoded, and cancelRender() stops the render
 * if it cannot load, so no frame is drawn in a fallback font. Import an export of this module
 * (TulvoApp does) before rendering any Tulvo screen.
 */
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";

/** CSS family name of the app UI font (the scoped app CSS references it). */
export const INTER_FAMILY = "Tulvo Inter";

/** The local variable font file (opsz + wght), relative to engine/public. */
export const INTER_FILE = "brands/tulvo/fonts/inter-latin-opsz-normal.woff2";

/** The Latin unicode-range Google Fonts gives the app's Inter request (the file holds this subset). */
export const INTER_LATIN_RANGE =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";

const GLOBAL_KEY = "__tulvoInterLoad";
type G = typeof globalThis & { [GLOBAL_KEY]?: Promise<void> };

const load = (): Promise<void> => {
  if (typeof FontFace === "undefined" || typeof document === "undefined") return Promise.resolve();
  const g = globalThis as G;
  // Module re-evaluation (Studio hot reload) must not register the face twice.
  if (g[GLOBAL_KEY]) return g[GLOBAL_KEY] as Promise<void>;
  const face = new FontFace(INTER_FAMILY, `url(${staticFile(INTER_FILE)}) format('woff2')`, {
    style: "normal",
    weight: "100 900",
    unicodeRange: INTER_LATIN_RANGE,
  });
  document.fonts.add(face);
  const handle = delayRender(`Loading ${INTER_FAMILY}`, { timeoutInMilliseconds: 60000 });
  const all = face.load().then(
    () => continueRender(handle),
    (err: unknown) => cancelRender(err),
  );
  g[GLOBAL_KEY] = all;
  return all;
};

const loading = load();

/** Resolves when the Inter file is loaded (rendering is already blocked until then). */
export const waitForTulvoFonts = (): Promise<void> => loading;
