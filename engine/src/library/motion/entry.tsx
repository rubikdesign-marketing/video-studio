// A render entry for the sized gallery only (text moves, transitions, openers, shaders and the creator-style moves),
// for a checkout where src/index.ts will not bundle (it also loads every job and every capture).
//   npx remotion render src/library/motion/entry.tsx move-ugc-comment-reply ../library/motion/ugc-comment-reply.mp4 --scale=0.5 --public-dir=out/lib-public
import { registerRoot } from 'remotion';
import { SizedCompositions } from './sized';

registerRoot(() => <SizedCompositions />);
