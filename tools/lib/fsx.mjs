// File helpers that behave the same on every OS and on paths with accents or spaces.
// copyTree replaces fs.cpSync, which ended a Windows process on an accented path in CI.
import fs from 'node:fs';
import path from 'node:path';

/** Copy a file or a whole folder (contents included) to `to`. Symbolic links are copied as the files they point to. */
export function copyTree(from, to) {
  const stat = fs.statSync(from);
  if (!stat.isDirectory()) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    return;
  }
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from)) copyTree(path.join(from, entry), path.join(to, entry));
}
