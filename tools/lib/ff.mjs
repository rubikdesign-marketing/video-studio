// ffmpeg and ffprobe for the Node tools, found the same way on macOS, Linux and Windows (setup/runtime/resolve.mjs).
//   ffmpegBin()   a full ffmpeg (loudnorm, drawtext, segment ...). FFMPEG, then DAMEX_FFMPEG, .runtime, package managers, PATH.
//   ffprobeBin()  ffprobe. FFPROBE, then DAMEX_FFPROBE, Remotion's own copy, .runtime, package managers, PATH.
// Each returns { path, cwd, env } to spawn with, or throws an Error whose message says how to add the program.
// Remotion's own ffprobe loads its libraries from its folder, so it must run from there: pass ABSOLUTE paths in args.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { resolveBinary, runContext, which, fixFor } from '../../setup/runtime/resolve.mjs';

function fromEnvName(name) {
  const v = process.env[name];
  if (!v) return null;
  if (fs.existsSync(v)) return { path: v, source: name };
  const found = which(v);
  return found ? { path: found, source: name } : null;
}

function locate(tool) {
  const legacy = fromEnvName(tool.toUpperCase());
  const r = legacy ?? resolveBinary(tool);
  if (!r.path) {
    const why = r.error ? `${r.error}. ` : '';
    const extra = tool === 'ffmpeg' ? ' This step needs a full ffmpeg (the one inside Remotion is smaller).' : '';
    throw new Error(`${why}${tool} was not found.${extra} To add it: ${fixFor('ffmpeg')}`);
  }
  const ctx = runContext(r);
  return { path: r.path, source: r.source, cwd: ctx.cwd, env: ctx.env };
}

export const ffmpegBin = () => locate('ffmpeg');
export const ffprobeBin = () => locate('ffprobe');

/** Like ffmpegBin() but null instead of throwing. */
export const tryBin = (tool) => { try { return locate(tool); } catch { return null; } };

/** Run a resolved program to the end and capture its output as text. Never throws for a non-zero exit. */
export function runBin(bin, args, opts = {}) {
  return spawnSync(bin.path, args, { encoding: 'utf8', maxBuffer: 1 << 28, windowsHide: true, cwd: opts.cwd ?? bin.cwd, env: bin.env, ...opts.spawn });
}

/** Run a resolved program with its output shown on the screen. Resolves the exit code. */
export function runBinLive(bin, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(bin.path, args, { stdio: 'inherit', windowsHide: true, cwd: opts.cwd ?? bin.cwd, env: bin.env });
    child.on('error', () => resolve(127));
    child.on('close', (code) => resolve(code ?? 1));
  });
}

/** An environment for child programs (Python tools) that tells them which ffmpeg and ffprobe to use. */
export function toolEnv(base = process.env) {
  const env = { ...base };
  const ff = tryBin('ffmpeg');
  if (ff) env.FFMPEG = ff.path;
  // Prefer the ffprobe that sits beside the full ffmpeg: it runs from any folder, Remotion's own copy must run from its own.
  let probe = null;
  if (ff) {
    const sibling = path.join(path.dirname(ff.path), process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
    if (fs.existsSync(sibling)) probe = { path: sibling, env: base };
  }
  probe ??= tryBin('ffprobe');
  if (probe) {
    env.FFPROBE = probe.path;
    if (probe.env?.LD_LIBRARY_PATH) env.LD_LIBRARY_PATH = probe.env.LD_LIBRARY_PATH;
  }
  return env;
}
