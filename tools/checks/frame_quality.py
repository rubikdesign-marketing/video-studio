#!/usr/bin/env python3
"""Measure the frames a film rests on, so a person or agent knows which ones to look at.

Usage: frame_quality.py <video> [--brand tulvo] [--times 3.5,12,40.2] [--max 12] [--json out.json]

With no --times it finds the film's rest frames itself (the middle of each stretch where
nothing moves, from tools/study/profile.py) and adds the first and last frame.

Per frame:
  edge       share of the outer 4% band that carries detail (things crowding the edge)
  focal      how many separate areas of strong detail there are (the squint test: want 1 or 2)
  clutter    share of the whole frame carrying detail
  offbrand   share of the frame in a colour the brand has rejected ("rejected" "colours" in
             brands/<brand>/brand.json; the brand is --brand, else studio.json's default)
  black/white  share that is pure black or pure white

A flag means "look at this frame". Product UI legitimately has coloured chips and dense tables.
A rejected colour the tool has no range for is named at the top, so a person checks it by eye.
Needs only ffmpeg; no Python packages.
"""
import argparse, colorsys, json, os, subprocess, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "study"))
from profile import frame_motion, probe, find_cuts, bucket, stretches, STEP

FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
W, H = 160, 90
LIMITS = dict(edge=0.18, focal_max=2, clutter=0.55, offbrand=0.03, black=0.35, white=0.60)
STUDIO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")

# Plain colour words, as a brand owner writes them, and the pixels they mean. Hue runs 0 to 1 around the wheel.
# A colour counts when the pixel is clearly that colour: saturated enough and not too dark. Greys are only a
# problem when they fill a large part of the frame (text and UI lines are grey), so they have a larger share.
SATURATED = dict(s_min=0.45, v_min=0.35, share=0.03)
COLOURS = {
    "red":    [dict(SATURATED, hues=[(0.0, 0.03), (0.94, 1.0)])],
    "orange": [dict(SATURATED, hues=[(0.03, 0.11)])],
    "yellow": [dict(SATURATED, hues=[(0.11, 0.19)])],
    "green":  [dict(SATURATED, hues=[(0.19, 0.45)])],
    "teal":   [dict(SATURATED, hues=[(0.45, 0.53)])],
    "blue":   [dict(SATURATED, hues=[(0.53, 0.72)])],
    "purple": [dict(SATURATED, hues=[(0.72, 0.83)])],
    "pink":   [dict(SATURATED, hues=[(0.83, 0.94)])],
    "brown":  [dict(s_min=0.4, v_min=0.15, v_max=0.6, share=0.03, hues=[(0.02, 0.11)])],
    "grey":   [dict(s_max=0.10, v_min=0.30, v_max=0.85, share=0.30, hues=[(0.0, 1.0)])],
}
SYNONYMS = {"gray": "grey", "violet": "purple", "lilac": "purple", "lavender": "purple", "orchid": "purple",
            "magenta": "pink", "blush": "pink", "rose": "pink", "fuchsia": "pink", "cyan": "teal",
            "turquoise": "teal", "navy": "blue", "crimson": "red", "scarlet": "red", "gold": "yellow"}


def rejected_colours(brand):
    """The brand's rejected colours, as (name, ranges) pairs, and the words with no range."""
    if not brand:
        try: brand = json.load(open(os.path.join(STUDIO, "studio.json")))["default_brand"]
        except (OSError, KeyError, ValueError): return [], []
    try: words = json.load(open(os.path.join(STUDIO, "brands", brand, "brand.json"))).get("rejected", {}).get("colours", [])
    except (OSError, ValueError): sys.exit(f"cannot read brands/{brand}/brand.json")
    known, unknown = [], []
    for word in words:
        found = [k for k in COLOURS if k in word.lower()] + [SYNONYMS[s] for s in SYNONYMS if s in word.lower()]
        if found: known.append((word, [r for k in dict.fromkeys(found) for r in COLOURS[k]]))
        else: unknown.append(word)
    return known, unknown


def is_colour(h, s, v, r):
    if s < r.get("s_min", 0) or s > r.get("s_max", 1) or v < r.get("v_min", 0) or v > r.get("v_max", 1): return False
    return any(a <= h < b for a, b in r["hues"])


def grab(video, t):
    raw = subprocess.run([FFMPEG, "-v", "error", "-ss", f"{t:.3f}", "-i", video, "-frames:v", "1",
                          "-vf", f"scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         capture_output=True).stdout
    if len(raw) < W * H * 3:
        return None
    return [[(raw[(y * W + x) * 3], raw[(y * W + x) * 3 + 1], raw[(y * W + x) * 3 + 2]) for x in range(W)] for y in range(H)]


def luma(p):
    return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]


def detail_map(px):
    """Local contrast per pixel: how different it is from its right and lower neighbours."""
    L = [[luma(p) for p in row] for row in px]
    D = [[0.0] * W for _ in range(H)]
    for y in range(H - 1):
        for x in range(W - 1):
            D[y][x] = abs(L[y][x] - L[y][x + 1]) + abs(L[y][x] - L[y + 1][x])
    return D


def cells(D, cw=8, ch=6):
    """Sum detail into a coarse grid (20 x 15 cells): the squinted view."""
    gx, gy = W // cw, H // ch
    return [[sum(D[y][x] for y in range(j * ch, (j + 1) * ch) for x in range(i * cw, (i + 1) * cw)) / (cw * ch)
             for i in range(gx)] for j in range(gy)]


def blobs(G, thr):
    """Count connected groups of hot cells."""
    gy, gx = len(G), len(G[0]); seen = [[False] * gx for _ in range(gy)]; sizes = []
    for j in range(gy):
        for i in range(gx):
            if G[j][i] > thr and not seen[j][i]:
                stack, n = [(j, i)], 0; seen[j][i] = True
                while stack:
                    a, b = stack.pop(); n += 1
                    for da in (-1, 0, 1):
                        for dbb in (-1, 0, 1):
                            c, d = a + da, b + dbb
                            if 0 <= c < gy and 0 <= d < gx and not seen[c][d] and G[c][d] > thr:
                                seen[c][d] = True; stack.append((c, d))
                sizes.append(n)
    return sorted(sizes, reverse=True)


def measure(px, rejected=()):
    D = detail_map(px)
    band_x, band_y = max(1, round(W * 0.04)), max(1, round(H * 0.04))
    edge = [D[y][x] for y in range(H) for x in range(W)
            if x < band_x or x >= W - band_x or y < band_y or y >= H - band_y]
    G = cells(D)
    flat = sorted(v for row in G for v in row)
    top = flat[-1] or 1e-6
    hot = max(12.0, 0.5 * top)                       # "strong detail" relative to this frame's strongest area
    b = [s for s in blobs(G, hot) if s >= 2]
    n = W * H
    black = white = 0
    off = {word: 0 for word, _ in rejected}
    for row in px:
        for r, g, bl in row:
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, bl / 255)
            for word, ranges in rejected:
                if any(is_colour(h, s, v, rg) for rg in ranges): off[word] += 1
            if max(r, g, bl) < 6: black += 1
            if min(r, g, bl) > 250: white += 1
    return dict(edge=round(sum(1 for v in edge if v > 14) / len(edge), 3), focal=len(b),
                clutter=round(sum(1 for v in flat if v > 10) / len(flat), 3),
                offbrand=round(sum(off.values()) / n, 3), black=round(black / n, 3), white=round(white / n, 3),
                rejected={w: round(c / n, 3) for w, c in off.items()},
                over=[w for w, ranges in rejected if off[w] / n > min(r["share"] for r in ranges)])


def flags(m):
    f = []
    if m["edge"] > LIMITS["edge"]: f.append("crowded edge")
    if m["focal"] == 0: f.append("no focal point")
    if m["focal"] > LIMITS["focal_max"]: f.append(f"{m['focal']} focal areas")
    if m["clutter"] > LIMITS["clutter"]: f.append("cluttered")
    for word in m["over"]: f.append(f"rejected colour: {word}")
    if m["black"] > LIMITS["black"]: f.append("large pure black")
    if m["white"] > LIMITS["white"]: f.append("large pure white")
    return f


def rest_times(video, limit):
    dur, fps, w, h = probe(video)
    raw = frame_motion(video)
    cuts = find_cuts(raw)
    motion = bucket([(t, x * fps / 30.0) for t, x in raw], cuts, dur)
    mids = [round((a + b) / 2, 2) for a, b in stretches(motion)]
    times = [0.5] + mids + [round(dur - 0.5, 2)]
    if len(times) > limit:                                # keep an even spread
        step = len(times) / limit
        times = [times[int(i * step)] for i in range(limit)]
    return sorted(set(times))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video"); ap.add_argument("--times", default=""); ap.add_argument("--max", type=int, default=12)
    ap.add_argument("--json"); ap.add_argument("--brand", default="")
    a = ap.parse_args()
    rejected, unchecked = rejected_colours(a.brand)
    times = [float(x) for x in a.times.split(",") if x.strip()] or rest_times(a.video, a.max)
    rows = []
    for t in times:
        px = grab(a.video, t)
        if px is None: continue
        m = measure(px, rejected); m["at"] = t; m["flags"] = flags(m); rows.append(m)
    if a.json:
        json.dump(dict(file=os.path.basename(a.video), limits=LIMITS, rejected_checked=[w for w, _ in rejected],
                       rejected_not_checked=unchecked, frames=rows), open(a.json, "w"), indent=1)
    print(os.path.basename(a.video))
    print("  rejected colours checked: " + (", ".join(w for w, _ in rejected) or "none (the brand lists none)"))
    if unchecked: print("  NOT checked, look by eye: " + ", ".join(unchecked))
    print(f"  {'time':>7} {'edge':>6} {'focal':>6} {'clutter':>8} {'offbrand':>9} {'black':>6} {'white':>6}  look at")
    for m in rows:
        print(f"  {m['at']:>6.1f}s {m['edge']:>6.2f} {m['focal']:>6} {m['clutter']:>8.2f} {m['offbrand']:>9.3f} "
              f"{m['black']:>6.2f} {m['white']:>6.2f}  {', '.join(m['flags'])}")
    flagged = sum(1 for m in rows if m["flags"])
    print(f"  {flagged} of {len(rows)} frames flagged for a look")
    sys.exit(1 if flagged else 0)


if __name__ == "__main__":
    main()
