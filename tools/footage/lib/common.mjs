// Shared helpers for the footage tool (FOOTAGE-PLAN.md). Paths, programs, and running them.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TOOL = path.resolve(HERE, '..');
export const STUDIO = path.resolve(TOOL, '..', '..');

const fullFF = '/opt/homebrew/opt/ffmpeg-full/bin';
export const FFMPEG = process.env.FFMPEG || (fs.existsSync(`${fullFF}/ffmpeg`) ? `${fullFF}/ffmpeg` : 'ffmpeg');
export const FFPROBE = process.env.FFPROBE || (fs.existsSync(`${fullFF}/ffprobe`) ? `${fullFF}/ffprobe` : 'ffprobe');
export const PYTHON = path.join(TOOL, '.venv', 'bin', 'python');
export const MODELS = path.join(os.homedir(), '.cache', 'hyperframes', 'whisper', 'models');

/** Video and audio files ingest picks up from a job's footage folder. */
export const MEDIA = /\.(mov|mp4|m4v|mkv|webm|avi|mts|m2ts|mxf|wav|m4a|mp3|aif|aiff|flac)$/i;
export const AUDIO_ONLY = /\.(wav|m4a|mp3|aif|aiff|flac)$/i;

/** Run a program; throws a plain-words error on failure unless allowFail. Returns stdout (string). */
export function run(cmd, args, { allowFail = false, input, cwd, maxBuffer = 1 << 30, env } = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', input, cwd, maxBuffer, env: env ? { ...process.env, ...env } : process.env });
  if (r.error) throw new Error(`Could not start ${path.basename(cmd)}: ${r.error.message}`);
  if (r.status !== 0 && !allowFail) {
    const tail = (r.stderr || '').trim().split('\n').slice(-6).join('\n');
    throw new Error(`${path.basename(cmd)} failed (exit ${r.status}).\n${tail}`);
  }
  return allowFail ? { out: r.stdout, err: r.stderr, status: r.status } : r.stdout;
}

/** Run one of the footage tool's Python programs (tools/footage/py/<name>.py) in its own environment. */
export function py(name, args, opts = {}) {
  if (!fs.existsSync(PYTHON)) throw new Error('The footage tool\'s Python environment is missing. Run: bash setup/install.sh');
  // Nothing about a job leaves this Mac: onnxruntime's and Hugging Face's telemetry are switched off for every run.
  const env = { ORT_DISABLE_TELEMETRY: '1', HF_HUB_DISABLE_TELEMETRY: '1', ...(opts.env || {}) };
  return run(PYTHON, ['-I', path.join(TOOL, 'py', `${name}.py`), ...args], { ...opts, env });
}

export const readJson = (f, fallback) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : fallback);
export const writeJson = (f, data) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, `${JSON.stringify(data, null, 2)}\n`); };

/** A clip's folder name: its file name without the extension, in lower case, letters, digits and dashes. */
export const slug = (file) => path.basename(file, path.extname(file)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'clip';

/** The first megabyte, the last megabyte and the size of a file: enough to tell whether a source changed. */
export function fingerprint(f) {
  const size = fs.statSync(f).size;
  const fd = fs.openSync(f, 'r');
  const h = crypto.createHash('sha1');
  const take = (pos) => { const b = Buffer.alloc(Math.min(1 << 20, size)); fs.readSync(fd, b, 0, b.length, pos); h.update(b); };
  take(0); if (size > 2 << 20) take(size - (1 << 20));
  fs.closeSync(fd);
  return `${size}:${h.digest('hex')}`;
}

/** True when out exists and is newer than every input. */
export const fresh = (out, ...inputs) => fs.existsSync(out) && inputs.every((i) => !fs.existsSync(i) || fs.statSync(i).mtimeMs <= fs.statSync(out).mtimeMs);

export const round = (n, d = 3) => (Number.isFinite(n) ? Math.round(n * 10 ** d) / 10 ** d : n);

/** 75.4 -> "1:15"; 3725 -> "1:02:05". */
export function clock(s) {
  const t = Math.round(s);
  const h = Math.floor(t / 3600); const m = Math.floor((t % 3600) / 60); const sec = t % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(sec)}` : `${m}:${p(sec)}`;
}
