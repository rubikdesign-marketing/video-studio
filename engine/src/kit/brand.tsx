// The brand in use. Wrap a composition in <BrandProvider brand="..."> once, outside everything else; every kit
// component then takes its colours, type voices, shapes and logos from useBrand().
// The list of brands comes from src/brands/index.ts, which tools/brand/sync.mjs writes from the brands/ folder.
import { createContext, useContext, useEffect, useMemo, useState, type FC, type ReactNode } from 'react';
import { continueRender, delayRender } from 'remotion';
import { brandFiles, brandNames, defaultBrand } from '../brands';
import { loadBrandFonts } from './fonts';
import { readBrand, type Brand } from './tokens';

export { brandNames, defaultBrand };
export type BrandName = (typeof brandNames)[number];

const read = new Map<BrandName, Brand>();

/** A brand by its folder name in brands/. */
export const getBrand = (name: BrandName): Brand => {
  let brand = read.get(name);
  if (!brand) {
    brand = readBrand(name, brandFiles[name]);
    read.set(name, brand);
  }
  return brand;
};

type BrandInUse = { brand: Brand; fontsLoaded: boolean };
const BrandContext = createContext<BrandInUse | null>(null);

/** Loads one brand's fonts and holds the render until they are in and the film has drawn again with them. */
const WithFonts: FC<{ brand: Brand; children: ReactNode }> = ({ brand, children }) => {
  const [loaded, setLoaded] = useState(false);
  const [handle] = useState(() => delayRender(`Waiting for the fonts of ${brand.name}`));

  useEffect(() => {
    let mounted = true;
    loadBrandFonts(brand).then(() => mounted && setLoaded(true));
    return () => {
      mounted = false;
      continueRender(handle);
    };
  }, [brand, handle]);

  useEffect(() => {
    if (loaded) continueRender(handle);
  }, [loaded, handle]);

  const value = useMemo(() => ({ brand, fontsLoaded: loaded }), [brand, loaded]);
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
};

/** Sets the brand for everything inside. One per composition, outside the MotionProvider and the Stage. */
export const BrandProvider: FC<{ brand: BrandName; children: ReactNode }> = ({ brand, children }) => (
  // Keyed by brand, so changing the brand in Remotion Studio's props panel loads the new brand's fonts.
  <WithFonts key={brand} brand={getBrand(brand)}>
    {children}
  </WithFonts>
);

const useBrandInUse = (): BrandInUse => {
  const inUse = useContext(BrandContext);
  if (!inUse) throw new Error('Wrap the composition in <BrandProvider brand="...">.');
  return inUse;
};

/** The current brand: colours by stage and role, type voices, shapes, caption settings and logo files. */
export const useBrand = (): Brand => useBrandInUse().brand;

/** True once the brand's fonts are in. For components that measure text: measure only when this is true. */
export const useFontsLoaded = (): boolean => useBrandInUse().fontsLoaded;
