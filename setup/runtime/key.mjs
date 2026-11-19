#!/usr/bin/env node
// Save an API key into the studio's .env without showing it on screen or putting it in shell history.
// Same command on macOS, Linux and Windows:   node setup/runtime/key.mjs [NAME]   (default ELEVENLABS_API_KEY)
// The key stays on this computer. Other lines in .env are kept; an existing value for NAME is replaced.
import fs from 'node:fs';
import path from 'node:path';
import { STUDIO } from './resolve.mjs';

const NAME = process.argv[2] || 'ELEVENLABS_API_KEY';
if (!/^[A-Z][A-Z0-9_]*$/.test(NAME)) { console.log(`Not a key name: ${NAME}`); process.exit(2); }
const ENV = path.join(STUDIO, '.env');

function askHidden(question) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    stdout.write(question);
    if (!stdin.isTTY) {   // piped in: read one line
      let buf = '';
      stdin.setEncoding('utf8');
      stdin.on('data', (d) => { buf += d; });
      stdin.on('end', () => resolve(buf.split(/\r?\n/)[0]));
      return;
    }
    let value = '';
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
    const done = (v) => { stdin.setRawMode(false); stdin.pause(); stdin.removeListener('data', onData); stdout.write('\n'); resolve(v); };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') return done(value);
        if (ch === '\u0003') { stdout.write('\n'); process.exit(130); }   // Ctrl-C
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);   // Backspace
        else if (ch >= ' ') value += ch;                                  // pasted or typed text; nothing is echoed
      }
    };
    stdin.on('data', onData);
  });
}

const key = (await askHidden(`Paste the ${NAME}, then press Enter (it will not show): `)).trim();
if (!key) { console.log('Nothing was saved.'); process.exit(1); }
let lines = [];
try { lines = fs.readFileSync(ENV, 'utf8').split(/\r?\n/).filter((l) => l !== '' && !l.startsWith(`${NAME}=`)); } catch {}
lines.push(`${NAME}=${key}`);
fs.writeFileSync(ENV, lines.join('\n') + '\n', { mode: 0o600 });
try { fs.chmodSync(ENV, 0o600); } catch {}   // only you can read it (no effect on Windows, where .env sits in your user folder)
console.log(`Saved ${NAME} to .env.`);
