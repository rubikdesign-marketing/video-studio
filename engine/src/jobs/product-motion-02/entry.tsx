// The render entry for the product-motion-02 job: only this film's compositions (product-motion-02 and product-motion-02-S01).
// Why not src/index.ts: tools/film/scaffold.mjs lists every folder in src/jobs in jobs/index.ts, including the
// hand-built rubik-ep1 (no `job` export), which stops that bundle. Use:  npx remotion render src/jobs/product-motion-02/entry.tsx product-motion-02 out.mp4
import { registerRoot } from 'remotion';
import { JobCompositions } from '../_film';
import { job } from './Film';

registerRoot(() => <JobCompositions jobs={[job]} />);
