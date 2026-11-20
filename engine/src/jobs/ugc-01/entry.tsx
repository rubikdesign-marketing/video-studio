// The render entry for the ugc-01 job: only this film's compositions (ugc-01 and ugc-01-S01 .. S04).
// Why not src/index.ts: tools/film/scaffold.mjs lists every folder in src/jobs in jobs/index.ts, including the
// hand-built rubik-ep1 (no `job` export), which stops that bundle. Use:  npx remotion render src/jobs/ugc-01/entry.tsx ugc-01 out.mp4
import { registerRoot } from 'remotion';
import { JobCompositions } from '../_film';
import { job } from './Film';

registerRoot(() => <JobCompositions jobs={[job]} />);
