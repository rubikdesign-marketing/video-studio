// The openers family's gallery scenes, batch by batch, in reel order.
import type { SizedDemo } from '../sized';
import { batch1 } from './batch1';
import { batch2 } from './batch2';

export const openersDemos: SizedDemo[] = [...batch1, ...batch2];
