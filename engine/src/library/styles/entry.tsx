// A render entry for the style library's preview clips: only the "style-preview" composition, so it bundles on a
// checkout where src/index.ts will not (it also loads every job and every capture).
//   npx remotion render src/library/styles/entry.tsx style-preview out.mp4 --props=entry.json
import { registerRoot } from 'remotion';
import { StylePreviewComposition } from './StylePreview';

registerRoot(StylePreviewComposition);
