// CI diagnostic: does fs.cpSync (used by tools/brand/new.mjs) survive a source folder whose path holds
// a space and a non-ASCII character? On the Windows runner, the collect step died inside a try/catch
// while doing exactly this. Prints one line and exits 0 on success; a native crash shows as a non-zero exit.
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.RUNNER_TEMP || process.env.TMPDIR || '/tmp';
const src = path.join(base, 'Vidéo probe', 'src');
const dest = path.join(base, 'Vidéo probe', 'dest');
fs.rmSync(path.dirname(src), { recursive: true, force: true });
fs.mkdirSync(path.join(src, 'inner'), { recursive: true });
fs.writeFileSync(path.join(src, 'inner', 'a.txt'), 'ok');
console.log(`node ${process.version} ${process.platform}: cpSync from "${src}"`);
fs.cpSync(src, dest, { recursive: true });
console.log('cpSync ok: ' + fs.readFileSync(path.join(dest, 'inner', 'a.txt'), 'utf8'));
