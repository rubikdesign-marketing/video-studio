#!/usr/bin/env python3
"""Measure how a video moves and sounds over time.

Usage: profile.py <video> [out_dir]

Writes <name>.profile.json and <name>.profile.svg into out_dir (default: beside the video).
Needs only ffmpeg and ffprobe; no Python packages.

What it measures, in 0.25 s steps:
  motion  how much the picture changes (0 = still, higher = more movement),
          scaled to a 30 fps frame so films at 24, 30 and 60 fps compare fairly
  audio   loudness in dB
and from the per-frame motion:
  cuts    hard cuts (a one-frame spike far above its neighbours)
  stills  stretches where nothing moves
"""
import json, os, re, statistics as st, subprocess, sys

STEP = 0.25          # seconds per bucket
STILL = 0.15         # motion below this counts as "nothing moves"
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True).stdout


def probe(path):
    j = json.loads(run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                        "stream=width,height,r_frame_rate:format=duration", "-of", "json", path]))
    a, b = j["streams"][0]["r_frame_rate"].split("/")
    return float(j["format"]["duration"]), float(a) / float(b), j["streams"][0]["width"], j["streams"][0]["height"]


def frame_motion(path):
    """Mean brightness of |frame - previous frame| at 160x90, one value per frame."""
    out = run([FFMPEG, "-v", "error", "-i", path, "-an", "-vf",
               "scale=160:90,format=gray,tblend=all_mode=difference,signalstats,"
               "metadata=print:key=lavfi.signalstats.YAVG:file=-", "-f", "null", "-"])
    t, vals = None, []
    for line in out.splitlines():
        m = re.search(r"pts_time:([0-9.]+)", line)
        if m:
            t = float(m.group(1)); continue
        m = re.search(r"YAVG=([0-9.]+(?:[eE][-+]?[0-9]+)?)", line)     # tiny values are printed as 6.9e-05
        if m and t is not None:
            vals.append((t, float(m.group(1))))
    return vals


def audio_levels(path):
    out = run([FFMPEG, "-v", "error", "-i", path, "-vn", "-af",
               f"aresample=8000,asetnsamples={int(8000 * STEP)},astats=metadata=1:reset=1,"
               "ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-", "-f", "null", "-"])
    vals = []
    for m in re.finditer(r"RMS_level=(-?[0-9.]+|-inf)", out):
        vals.append(-90.0 if m.group(1) == "-inf" else max(-90.0, float(m.group(1))))
    return vals


def find_cuts(frames):
    """A hard cut is a single-frame spike: far above the typical change and above both neighbours."""
    v = [x for _, x in frames]
    if len(v) < 5:
        return []
    base = st.median(v) or 0.01
    cuts = []
    for i in range(2, len(v) - 2):
        around = (v[i - 2] + v[i - 1] + v[i + 1] + v[i + 2]) / 4
        if v[i] > 12 and v[i] > 6 * max(around, base) and v[i] >= max(v[i - 1], v[i + 1]):
            if not cuts or frames[i][0] - cuts[-1] > 0.2:
                cuts.append(round(frames[i][0], 3))
    return cuts


def bucket(frames, cuts, dur):
    n = int(dur / STEP) + 1
    sums, counts = [0.0] * n, [0] * n
    cutset = set(cuts)
    for t, x in frames:
        if round(t, 3) in cutset:
            continue                      # a cut is not movement
        i = min(n - 1, int(t / STEP))
        sums[i] += x; counts[i] += 1
    return [round(sums[i] / counts[i], 3) if counts[i] else 0.0 for i in range(n)]


def stretches(motion):
    out, start = [], None
    for i, m in enumerate(motion + [9e9]):
        if m < STILL and start is None:
            start = i
        elif m >= STILL and start is not None:
            if (i - start) * STEP >= 0.75:
                out.append([round(start * STEP, 2), round(i * STEP, 2)])
            start = None
    return out


def corr(a, b):
    n = min(len(a), len(b))
    if n < 4:
        return None
    a, b = a[:n], b[:n]
    ma, mb = sum(a) / n, sum(b) / n
    da = sum((x - ma) ** 2 for x in a) ** 0.5
    db = sum((x - mb) ** 2 for x in b) ** 0.5
    if not da or not db:
        return None
    return round(sum((x - ma) * (y - mb) for x, y in zip(a, b)) / (da * db), 2)


def svg(name, dur, motion, audio, cuts, stills, path):
    W, H, pad = 1200, 300, 40
    x = lambda t: pad + (W - 2 * pad) * t / dur
    top = max(sorted(motion)[int(len(motion) * 0.98)] if motion else 1, 0.5)
    ym = lambda v: H - pad - (H - 2 * pad) * min(v, top) / top
    ya = lambda v: H - pad - (H - 2 * pad) * (max(v, -60) + 60) / 60
    pts = lambda vals, f: " ".join(f"{x(i * STEP):.1f},{f(v):.1f}" for i, v in enumerate(vals))
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="sans-serif" font-size="11">',
         f'<rect width="{W}" height="{H}" fill="#fff"/>',
         f'<text x="{pad}" y="18" font-size="13">{name} — blue: movement, grey: loudness, red: hard cut, shaded: nothing moves</text>']
    for a, b in stills:
        o.append(f'<rect x="{x(a):.1f}" y="{pad}" width="{x(b) - x(a):.1f}" height="{H - 2 * pad}" fill="#f2c94c" opacity=".35"/>')
    for c in cuts:
        o.append(f'<line x1="{x(c):.1f}" x2="{x(c):.1f}" y1="{pad}" y2="{H - pad}" stroke="#e5484d" stroke-width="1"/>')
    o.append(f'<polyline points="{pts(audio, ya)}" fill="none" stroke="#9aa0a6" stroke-width="1"/>')
    o.append(f'<polyline points="{pts(motion, ym)}" fill="none" stroke="#2b5ce6" stroke-width="1.6"/>')
    s = 5 if dur <= 90 else 10
    for t in range(0, int(dur) + 1, s):
        o.append(f'<text x="{x(t):.1f}" y="{H - pad + 16}" text-anchor="middle">{t}s</text>')
    o.append("</svg>")
    open(path, "w").write("\n".join(o))


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    path = sys.argv[1]
    out_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(path) or "."
    os.makedirs(out_dir, exist_ok=True)
    name = os.path.splitext(os.path.basename(path))[0]
    dur, fps, w, h = probe(path)
    raw = frame_motion(path)
    cuts = find_cuts(raw)                                   # cut detection uses unscaled frame differences
    frames = [(t, x * fps / 30.0) for t, x in raw]          # same speed reads the same at any frame rate
    motion = bucket(frames, cuts, dur)
    audio = audio_levels(path)
    stills = stretches(motion)
    edges = [0.0] + cuts + [dur]
    shots = [round(b - a, 2) for a, b in zip(edges, edges[1:])]
    moving = [m for m in motion if m >= STILL]
    summary = dict(
        seconds=round(dur, 2), fps=round(fps, 2), size=f"{w}x{h}",
        hard_cuts=len(cuts), median_shot=round(st.median(shots), 2), longest_shot=max(shots),
        still_seconds=round(sum(b - a for a, b in stills), 2),
        share_of_time_moving=round(len(moving) / max(1, len(motion)), 2),
        typical_movement=round(st.median(moving), 2) if moving else 0,
        peak_movement=round(max(motion), 2) if motion else 0,
        movement_follows_sound=corr(motion, [a + 90 for a in audio]),
    )
    data = dict(file=os.path.basename(path), step=STEP, summary=summary, cuts=cuts, shots=shots,
                still_stretches=stills, motion=motion, audio_db=audio)
    json.dump(data, open(os.path.join(out_dir, name + ".profile.json"), "w"))
    svg(name, dur, motion, audio, cuts, stills, os.path.join(out_dir, name + ".profile.svg"))
    print(name)
    for k, v in summary.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
