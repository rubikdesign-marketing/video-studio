// Product screens: faithful rebuilds of a brand's real product UI, one folder per brand (src/products/<brand>/).
// Unlike the rest of src, a product folder may name its brand, its colours and its typeface: a product screen
// must look exactly like the real product, so it takes nothing from the brand in use.
// Root.tsx registers every product's screen gallery with one line: <ProductCompositions />.
import type { FC } from 'react';
import { Folder } from 'remotion';
import { TulvoUiGallery } from './tulvo/Gallery';

/** Every product's gallery of screens, in the "products" folder of Remotion Studio. */
export const ProductCompositions: FC = () => (
  <Folder name="products">
    {/* Tulvo's web app: one "TulvoUi-<id>" composition per screen. */}
    <TulvoUiGallery />
  </Folder>
);
