#!/usr/bin/env node
// Print where a task class goes: lead | script | haiku | sonnet. No argument lists every class.
//   route.mjs <task-class> [--json]      exit 2 for an unknown class
import { policy, usageExit } from './lib/util.mjs';

const routes = policy().routes;
const [cls] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!cls) { for (const [k, v] of Object.entries(routes)) console.log(`${k.padEnd(22)} ${v.route}${v.worker ? ` (${v.worker})` : ''}`); process.exit(0); }
const r = routes[cls];
if (!r) usageExit(`Unknown task class "${cls}". Classes: ${Object.keys(routes).join(', ')}`);
if (process.argv.includes('--json')) { console.log(JSON.stringify({ class: cls, ...r })); process.exit(0); }
console.log(`${cls}: ${r.route}${r.worker ? ` (worker: ${r.worker})` : ''}`);
console.log(`examples: ${r.examples.join('; ')}`);
