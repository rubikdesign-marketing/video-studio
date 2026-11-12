// Written by tools/brand/sync.mjs: one entry per folder in brands/. Do not edit; run the sync again.
import demo from '../../../brands/demo/brand.json';
import tulvo from '../../../brands/tulvo/brand.json';

/** Every brand's brand.json, by folder name. */
export const brandFiles = { demo, tulvo };

export const brandNames = ['demo', 'tulvo'] as const;

/** studio.json, "default_brand". */
export const defaultBrand: (typeof brandNames)[number] = 'tulvo';
