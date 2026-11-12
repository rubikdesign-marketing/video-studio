// Loads the font files of the brand in use, from local files only: a render never needs the network.
// tools/brand/sync.mjs copies each brand's font files into public/brands/<name>/fonts/, whether they come from
// the brand's own fonts/ folder or from an installed npm package.
import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';
import type { Brand, FontFace } from './tokens';

/** One load per font file, however many brands and components ask for it. */
const loading = new Map<string, Promise<void>>();

const loadFace = (face: FontFace): Promise<void> => {
  const key = [face.family, face.url, face.style].join('|');
  let pending = loading.get(key);
  if (!pending) {
    // loadFont() holds the render with delayRender() until its file is in, and cancels the render if the file
    // fails, so no frame is drawn in a fallback font.
    pending = loadFont({ family: face.family, url: staticFile(face.url), weight: face.weight, style: face.style });
    loading.set(key, pending);
  }
  return pending;
};

/** Starts loading every font file of a brand, once, and resolves when all of them are in. */
export const loadBrandFonts = (brand: Brand): Promise<void> => Promise.all(brand.fontFaces.map(loadFace)).then(() => undefined);
