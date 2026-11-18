#!/usr/bin/env python3
"""Find moments where one part of the frame drops out: goes dark for a frame or two, or stops while the rest moves.

Usage: region_dropout.py <video> --box x,y,w,h [--from s] [--to s] [--json out.json]

  box   the region in the video's own pixels (a picture-in-picture window, say)

  dark   a frame whose region is more than 35% darker than the median of its 3 neighbours on each side
  flash  a frame whose region is far brighter than its neighbours (a blank page for one frame)
  stuck  the region repeats the same picture for 4 frames or more while the rest of the frame moves (a video that
         stalled or reloaded); a region that is still while everything is still is not reported

Prints each moment with its time and exits 1 if there are any.
"""
import json, subprocess, sys
import numpy as np

DARK = 0.65   # region mean below this share of its neighbours' median
STILL = 0.5   # mean absolute difference (0-255) under which two pictures count as the same
STUCK = 4     # frames in a row


def find(region, rest_moves):
    """region: per-frame 2D luma arrays of the region. rest_moves: per frame, whether the rest of the frame changed
    from the frame before. Returns [{frame, frames, kind}]."""
    n = len(region)
    means = np.array([float(r.mean()) for r in region])
    out = []
    i = 0
    while i < n:
        nb = np.concatenate([means[max(0, i - 3):i], means[i + 1:i + 4]])
        if nb.size and means[i] < DARK * np.median(nb):
            j = i
            while j + 1 < n and means[j + 1] < DARK * np.median(nb):
                j += 1
            out.append({'frame': i, 'frames': j - i + 1, 'kind': 'dark'})
            i = j + 1
            continue
        if nb.size and means[i] > max(1.35 * np.median(nb), np.median(nb) + 40):
            out.append({'frame': i, 'frames': 1, 'kind': 'flash'})
        i += 1
    same = np.array([False] + [float(np.abs(region[k] - region[k - 1]).mean()) < STILL for k in range(1, n)])
    k = 1
    while k < n:
        if same[k] and rest_moves[k]:
            j = k
            while j + 1 < n and same[j + 1] and rest_moves[j + 1]:
                j += 1
            if j - k + 1 >= STUCK:
                out.append({'frame': k, 'frames': j - k + 1, 'kind': 'stuck'})
            k = j + 1
            continue
        k += 1
    return sorted(out, key=lambda d: d['frame'])


def _frames(video, vf, w, h, ss, to):
    cmd = ['ffmpeg', '-v', 'error'] + (['-ss', str(ss)] if ss else []) + ['-i', video] + (['-t', str(to - ss)] if to else []) + \
          ['-vf', f'{vf},scale={w}:{h}:flags=area,format=gray', '-f', 'rawvideo', '-']
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.uint8).astype(np.float32)
    return a.reshape(-1, h, w)


def main(argv):
    if not argv or argv[0].startswith('-') or '--box' not in argv:
        print(__doc__); return 2
    video = argv[0]
    x, y, w, h = [int(float(v)) for v in argv[argv.index('--box') + 1].split(',')]
    ss = float(argv[argv.index('--from') + 1]) if '--from' in argv else 0.0
    to = float(argv[argv.index('--to') + 1]) if '--to' in argv else None
    fps_s = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate,width,height',
                            '-of', 'csv=p=0', video], capture_output=True, text=True, check=True).stdout.strip().split(',')
    vw, vh = int(fps_s[0]), int(fps_s[1]); n_, d_ = fps_s[2].split('/'); fps = float(n_) / float(d_)
    region = _frames(video, f'crop={w}:{h}:{x}:{y}', 96, 96, ss, to)
    full = _frames(video, 'null', 192, 108, ss, to)
    sx, sy = 192 / vw, 108 / vh
    mask = np.ones((108, 192), bool); mask[int(y * sy):int((y + h) * sy) + 1, int(x * sx):int((x + w) * sx) + 1] = False
    rest = np.array([True] + [float(np.abs(full[k] - full[k - 1])[mask].mean()) >= STILL for k in range(1, len(full))])
    got = find(list(region), rest)
    for d in got:
        d['t'] = round(ss + d['frame'] / fps, 3)
        print(f"{d['t']:8.3f} s  {d['kind']:<5}  {d['frames']} frame{'s' if d['frames'] > 1 else ''}")
    print(f"{len(got)} drop-out{'s' if len(got) != 1 else ''} in {len(region)} frames")
    if '--json' in argv:
        json.dump(got, open(argv[argv.index('--json') + 1], 'w'), indent=1)
    return 1 if got else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
