// The transitions family's gallery scenes, batch by batch, in reel order.
import type { SizedDemo } from '../sized';
import { batch1 } from './batch1';
import { batch2 } from './batch2';
import { batch3 } from './batch3';
import { batch4 } from './batch4';

export const transitionsDemos: SizedDemo[] = [...batch1, ...batch2, ...batch3, ...batch4];
