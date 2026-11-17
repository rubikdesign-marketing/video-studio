"""Cut points and room tone (FOOTAGE-PLAN.md section 4.3).

    python cutpoints.py points <sound.wav>        reads [{"t", "lo", "hi", "side"?, "pad"?}] on stdin, writes [t...]:
                                                  for each request, the quietest moment between lo and hi (nearest
                                                  to t); with "side" ("in" or "out"), "pad" seconds into the quiet dip
                                                  from that side
    python cutpoints.py roomtone <sound.wav> <words.json> <out.wav>
                                                  the clip's own quiet sound: the quietest stretch between words,
                                                  mirrored end to end so it runs on without a seam (up to 4 s)
"""
import json
import subprocess
import sys

import numpy as np

FFMPEG = '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
RATE = 48000


def load(path):
    raw = subprocess.run([FFMPEG, '-v', 'error', '-i', path, '-ac', '1', '-ar', str(RATE), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32)


def envelope(x, win=0.01, hop=0.002):
    w, h = int(RATE * win), int(RATE * hop)
    sq = np.concatenate([[0.0], np.cumsum(x.astype(np.float64) ** 2)])
    starts = np.arange(0, max(1, len(x) - w), h)
    return starts / RATE + win / 2, (sq[starts + w] - sq[starts]) / w


def points(sound):
    reqs = json.load(sys.stdin)
    x = load(sound)
    times, energy = envelope(x)
    out = []
    for r in reqs:
        lo, hi, t = max(0.0, r['lo']), r['hi'], r['t']
        m = (times >= lo) & (times <= hi)
        if not m.any():
            out.append(round(min(max(t, lo), hi), 4))
            continue
        e = energy[m]
        tt = times[m]
        floor = e.min()
        side = r.get('side')
        if side in ('in', 'out'):
            # The quiet dip around the quietest moment (within 3 dB of it); the cut goes a little way into it from
            # the kept word's side, so the struck word's sound stays out of the crossfade.
            i = int(np.argmin(e))
            a = i
            while a > 0 and e[a - 1] <= floor * 2 + 1e-12:
                a -= 1
            b = i
            while b < len(e) - 1 and e[b + 1] <= floor * 2 + 1e-12:
                b += 1
            pad = r.get('pad', 0.08)
            span = tt[b] - tt[a]
            point = tt[a] + min(pad, span / 2) if side == 'out' else tt[b] - min(pad, span / 2)
            out.append(round(float(point), 4))
            continue
        # Among the quiet moments (within 1 dB of the quietest), the one nearest the asked-for time.
        quiet = e <= floor * 1.26 + 1e-12
        cand = tt[quiet]
        out.append(round(float(cand[np.argmin(np.abs(cand - t))]), 4))
    print(json.dumps(out))


def roomtone(sound, words_file, dst):
    x = load(sound)
    words = json.load(open(words_file)).get('words', [])
    gaps = [(0.0, words[0]['start'])] if words else [(0.0, len(x) / RATE)]
    gaps += [(a['end'], b['start']) for a, b in zip(words, words[1:])]
    if words:
        gaps.append((words[-1]['end'], len(x) / RATE))
    best = None
    for a, b in gaps:
        a2, b2 = a + 0.08, b - 0.08  # away from the words' own edges
        if b2 - a2 < 0.25:
            continue
        seg = x[int(a2 * RATE):int(b2 * RATE)]
        level = float(np.sqrt(np.mean(seg ** 2)) + 1e-12)
        if best is None or level < best[0]:
            best = (level, seg)
    if best is None:
        seg = np.zeros(int(RATE * 0.5), np.float32)
        level = 0.0
    else:
        level, seg = best
    loop = seg
    while len(loop) < RATE * 4 and len(seg) > 0:
        loop = np.concatenate([loop, loop[::-1]])
    loop = loop[: RATE * 4]
    subprocess.run([FFMPEG, '-v', 'error', '-y', '-f', 'f32le', '-ar', str(RATE), '-ac', '1', '-i', '-', '-c:a', 'pcm_s24le', dst], input=loop.astype(np.float32).tobytes(), check=True)
    print(json.dumps({'seconds': round(len(seg) / RATE, 2), 'level_db': round(20 * np.log10(level + 1e-12), 1)}))


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'points':
        points(sys.argv[2])
    elif cmd == 'roomtone':
        roomtone(*sys.argv[2:5])
