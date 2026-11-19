// Written by tools/brand/sync.mjs: one entry per folder in brands/. Do not edit; run the sync again.
import demo from '../../../brands/demo/brand.json';

/** Every brand's brand.json, by folder name. */
export const brandFiles = { demo };

export const brandNames = ['demo'] as const;

/** studio.json, "default_brand". */
export const defaultBrand: (typeof brandNames)[number] = 'demo';
