// The catalogue of backgrounds: library/backgrounds/index.json, joined to the components in kit/backgrounds.
// A new background needs its component listed in `components` here and an entry in that file; the reel and its
// own "bg-<name>" composition then follow.
import type { FC } from 'react';
import { z } from 'zod';
import index from '../../../../library/backgrounds/index.json';
import {
  Aurora,
  Blueprint,
  ColourField,
  Editorial,
  Glass,
  Horizon,
  Night,
  Paper,
  PerspectiveLines,
  SoftShapes,
  Spotlight,
  Waves,
  type BackgroundProps,
} from '../../kit/backgrounds';
import { stageNames, type StageName } from '../../kit/tokens';

const components: Record<string, FC<BackgroundProps>> = {
  Paper,
  Night,
  Glass,
  ColourField,
  Editorial,
  Blueprint,
  Aurora,
  Horizon,
  Waves,
  Spotlight,
  PerspectiveLines,
  SoftShapes,
};

/** What the engine reads from each entry of index.json. The rest of an entry is for people choosing a background. */
const catalogueSchema = z.object({
  backgrounds: z.array(
    z.object({
      /** Lower case with hyphens: it names the composition "bg-<name>" and the preview file. */
      name: z.string().regex(/^[a-z]+(-[a-z]+)*$/),
      /** The name as shown on screen, in sentence case. */
      label: z.string().min(1),
      component: z.string(),
      /** The pages it is made for. Most work on both; Paper is the light page's own stage and Night the dark page's. */
      pages: z.array(z.enum(stageNames)).min(1),
      best_page: z.enum(stageNames),
      /** "accent" when the background fills the frame with the accent colour, so type on it takes the onAccent colour. */
      content_on: z.enum(['page', 'accent']),
    }),
  ),
});

export type Entry = { name: string; label: string; Component: FC<BackgroundProps>; pages: StageName[]; page: StageName; onAccent: boolean };

export const catalogue: Entry[] = catalogueSchema.parse(index).backgrounds.map((entry) => {
  const Component = components[entry.component];
  if (!Component) throw new Error(`library/backgrounds/index.json names the component "${entry.component}", which is not listed in engine/src/library/backgrounds/catalogue.ts.`);
  if (!entry.pages.includes(entry.best_page)) throw new Error(`library/backgrounds/index.json gives "${entry.name}" a best page that is not one of its pages.`);
  return { name: entry.name, label: entry.label, Component, pages: entry.pages, page: entry.best_page, onAccent: entry.content_on === 'accent' };
});
