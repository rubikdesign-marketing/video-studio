// The sound sprite: a short slice of each sound style's file, joined into one mp3 with a map of where each starts.
// Only node: modules and in-repo imports. The command runner is injected, so tests can stub ffmpeg and ffprobe.
import { existsSync, mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

export const SPRITE_MAX_S = 4;
export const SPRITE_FILE = 'library/styles/previews/sound-sprite.mp3';
export const SPRITE_MAP = 'library/styles/previews/sound-sprite.json';
const ffmpegBin = existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
const ffprobeBin = existsSync('/opt/homebrew/bin/ffprobe') ? '/opt/homebrew/bin/ffprobe' : 'ffprobe';

/** The default runner: spawns a command, resolves with its exit code and output. `ffmpeg` and `ffprobe` map to the installed binaries. */
export const spawnRun = (cmd, args, opts = {}) => new Promise((resolve) => {
  const bin = cmd === 'ffmpeg' ? ffmpegBin : cmd === 'ffprobe' ? ffprobeBin : cmd;
  const child = spawn(bin, args, { cwd: opts.cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.stderr.on('data', (d) => { stderr += d; });
  child.on('error', (e) => resolve({ code: 127, stdout, stderr: String(e.message) }));
  child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
});

const round = (n) => Math.round(n * 1000) / 1000;

/** The sound file under library/sounds/, with or without its extension. */
const soundPath = (root, sound) => {
  const base = join(root, 'library', 'sounds', sound);
  for (const p of [base, `${base}.mp3`, `${base}.wav`]) if (existsSync(p)) return p;
  return null;
};

/**
 * Takes up to 4 s from each sound entry's `preview.sound` at `from_s`, joins them in order into the sprite mp3 and
 * writes the map `{ [id]: [start_s, length_s] }` next to it. Offsets are contiguous. Voice samples are left out.
 * Returns `{ file, map, notes }`; `file` is the sprite's path under the root.
 */
export async function buildSprite(entries, root, { run = spawnRun } = {}) {
  const notes = [];
  const map = {};
  const parts = [];
  let at = 0;
  for (const e of entries) {
    const sound = e?.preview?.sound;
    if (!sound) continue;
    if (/^voice/i.test(sound)) { notes.push(`${e.id}: voice samples are not put in the sprite`); continue; }
    const file = soundPath(root, sound);
    if (!file) { notes.push(`${e.id}: the sound file ${sound} was not found`); continue; }
    const from = Math.max(0, Number(e.preview.from_s) || 0);
    const probe = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
    const total = probe.code === 0 ? parseFloat(probe.stdout) : NaN;
    if (!Number.isFinite(total)) { notes.push(`${e.id}: the length of ${sound} could not be read`); continue; }
    const length = round(Math.min(SPRITE_MAX_S, total - from));
    if (length <= 0) { notes.push(`${e.id}: from_s ${from} is past the end of ${sound}`); continue; }
    map[e.id] = [round(at), length];
    parts.push({ file, from, length });
    at = round(at + length);
  }
  const outDir = join(root, 'library', 'styles', 'previews');
  mkdirSync(outDir, { recursive: true });
  // Write both files beside the real ones and move them into place together, only when the whole build worked.
  const tempMp3 = join(outDir, 'sound-sprite.tmp.mp3');
  const tempMap = join(outDir, 'sound-sprite.tmp.json');
  try {
    if (parts.length) {
      const args = ['-y', '-v', 'error'];
      for (const p of parts) args.push('-ss', String(p.from), '-t', String(p.length), '-i', p.file);
      if (parts.length > 1) args.push('-filter_complex', `${parts.map((_, i) => `[${i}:a]`).join('')}concat=n=${parts.length}:v=0:a=1[out]`, '-map', '[out]');
      args.push('-c:a', 'libmp3lame', '-b:a', '64k', tempMp3);
      const made = await run('ffmpeg', args);
      if (made.code !== 0) throw new Error(`ffmpeg could not build the sound sprite: ${(made.stderr || '').trim().split('\n').pop()}`);
    }
    writeFileSync(tempMap, JSON.stringify(map, null, 2) + '\n');
    if (parts.length) renameSync(tempMp3, join(root, SPRITE_FILE));
    renameSync(tempMap, join(root, SPRITE_MAP));
  } finally {
    rmSync(tempMp3, { force: true });
    rmSync(tempMap, { force: true });
  }
  return { file: SPRITE_FILE, map, notes };
}
