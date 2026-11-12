// Written by tools/film/scaffold.mjs: one entry per job folder here. Do not edit; run the scaffold again.
import type { Job } from './_film';
import { job as job_sample } from './sample/Film';

export { JobCompositions } from './_film';
export const jobs: Job[] = [job_sample];
