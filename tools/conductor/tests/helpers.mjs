import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TOOLS = path.resolve(HERE, '..');
export const tmp = (p = 'conductor-') => fs.mkdtempSync(path.join(os.tmpdir(), p));
/** A job folder with some files. */
export function job(files = {}) {
  const dir = path.join(tmp(), 'jobs', 'j1'); fs.mkdirSync(dir, { recursive: true });
  for (const [f, c] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), c); }
  return dir;
}
/** Settings fixture: availableModels etc. Returns the env value for CONDUCTOR_SETTINGS_FILES. */
export function settings(obj, managed = false) {
  const f = path.join(tmp('settings-'), 'settings.json'); fs.writeFileSync(f, JSON.stringify(obj));
  return `${managed ? 'managed:' : ''}${f}`;
}
/** Run a conductor CLI in a fresh process. Settings default to "none" so the real machine's settings never leak in. */
export function run(tool, args, env = {}, { cwd } = {}) {
  const r = spawnSync(process.execPath, [path.join(TOOLS, tool), ...args], { encoding: 'utf8', cwd, env: { ...process.env, CONDUCTOR_SETTINGS_FILES: '', ...env } });
  return { code: r.status, out: r.stdout.trim(), err: r.stderr.trim() };
}
export const claim = (dir, o, env) => run('dispatch.mjs', ['claim', dir, '--stage', o.stage || 'animation', '--task', o.task, '--worker', o.worker || 'scene-builder', '--model', o.model || 'sonnet', '--writes', o.writes || '', ...(o.paid ? ['--paid'] : [])], env);
