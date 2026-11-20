// The families shown in the sized gallery (sized.tsx), in reel order. Each family folder lists its own demos in
// batch files; a batch is added here with one import, so builders working side by side never edit the same list.
import { openersDemos } from './openers';
import type { SizedFamily } from './sized';
import { shadersDemos } from './shaders';
import { textDemos } from './text';
import { transitionsDemos } from './transitions';
import { ugcDemos } from './ugc';

export const sizedFamilies: SizedFamily[] = [
  { id: 'text', title: 'Text moves', demos: textDemos },
  { id: 'transitions', title: 'Transitions', demos: transitionsDemos },
  { id: 'openers', title: 'Hook openers', demos: openersDemos },
  { id: 'shaders', title: 'Shader backgrounds', demos: shadersDemos },
  { id: 'ugc', title: 'Creator-style moves for phone films', demos: ugcDemos },
];
