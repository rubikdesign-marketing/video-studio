#!/usr/bin/env node
// Which worker model aliases the settings allow. Reads settings only (see lib/models.mjs); never writes them.
//   models.mjs [--json]      override the files with CONDUCTOR_SETTINGS_FILES='a.json|managed:b.json'
import { report } from './lib/models.mjs';

const r = report();
if (process.argv.includes('--json')) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }
console.log(`lead model: ${r.lead ? `${r.lead} (${r.leadFrom})` : 'not set in settings (the session picks)'}`);
console.log(`settings read: ${r.files.length ? r.files.join(', ') : 'none found'}`);
for (const a of r.aliases) console.log(`${a.alias.padEnd(8)} ${a.allowed ? 'allowed' : 'BLOCKED'}  ${a.reason}`);
for (const w of r.workers) console.log(`  ${w.name.padEnd(18)} ${w.allowed ? 'allowed' : 'BLOCKED'}`);
if (r.aliases.some((a) => !a.allowed)) console.log('A blocked model is never swapped for another. Surface it; the alternative is to do that task in the lead session.');
