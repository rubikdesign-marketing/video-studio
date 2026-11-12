#!/usr/bin/env python3
"""Find jumps and judder in a rendered film.

Usage: smoothness.py <video> [--planned-cuts 12.5,30.1] [--json out.json]

  jumps    a single frame that changes far more than the frames around it: a pop, a stutter,
           or a hard cut. Give the planned hard cuts so only unplanned ones are reported.
  judder   a quarter-second window of continuous movement that goes high-low-high instead of
           flowing (grain on the wrong cadence, fast shakes, dropped or doubled frames).
           Stepped changes such as typing are not movement and are skipped.

A one-frame change that was designed (a hard cut, an instant swap) looks the same as a pop,
so list every planned one in --planned-cuts. Without that list, "jumps" only means "instant changes".

Exit code 0 = smooth, 1 = something flagged. Needs only ffmpeg.
Thresholds are the ones that worked on the Black Friday film; change them in one place below.
"""
import argparse, json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "study"))
from profile import frame_motion, probe          # same per-frame measure the study tool uses

JUMP_MIN = 4.0        # a jump changes at least this much (0-255 scale, mean over the frame)
JUMP_RATIO = 4.0      # ...and this many times its four neighbours
JUDDER_MOVE = 0.6     # ignore windows that barely move
JUDDER_RATIO = 0.45   # roughness as a share of movement


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video"); ap.add_argument("--planned-cuts", default=""); ap.add_argument("--json")
    a = ap.parse_args()
    planned = [float(x) for x in a.planned_cuts.split(",") if x.strip()]
    dur, fps, w, h = probe(a.video)
    fr = frame_motion(a.video)
    t = [x[0] for x in fr]; d = [x[1] for x in fr]

    jumps = []
    for i in range(2, len(d) - 2):
        around = (d[i - 2] + d[i - 1] + d[i + 1] + d[i + 2]) / 4
        if d[i] > JUMP_MIN and d[i] > JUMP_RATIO * around + 1.0:
            if not any(abs(t[i] - p) < 0.1 for p in planned):
                jumps.append(dict(at=round(t[i], 2), change=round(d[i], 1), around=round(around, 1)))

    win = max(4, round(fps / 4))
    rough = [abs(d[i] - 0.5 * (d[i - 1] + d[i + 1])) for i in range(1, len(d) - 1)]
    judder = []
    for i in range(0, len(rough) - win, win):
        seg = d[i + 1:i + 1 + win]
        move = sum(seg) / win
        r = sum(rough[i:i + win]) / win
        if min(seg) < 0.25 * move:            # some frames do not move at all: stepped change, not judder
            continue
        near_jump = any(abs(t[i + 1] - j["at"]) < 0.3 for j in jumps) or any(abs(t[i + 1] - p) < 0.3 for p in planned)
        if move > JUDDER_MOVE and r / (move + 1e-6) > JUDDER_RATIO and not near_jump:
            judder.append(dict(at=round(t[i + 1], 2), roughness=round(r / move, 2), movement=round(move, 2)))

    rep = dict(file=os.path.basename(a.video), fps=round(fps, 2), frames=len(d), jumps=jumps, judder=judder)
    if a.json:
        json.dump(rep, open(a.json, "w"), indent=1)
    print(f"{rep['file']}: {len(d)} frames at {fps:.0f} fps")
    print(f"  unplanned jumps: {len(jumps)}" + ("  " + ", ".join(f"{j['at']}s" for j in jumps[:12]) if jumps else ""))
    print(f"  judder windows: {len(judder)}" + ("  " + ", ".join(f"{j['at']}s" for j in judder[:12]) if judder else ""))
    sys.exit(1 if jumps or judder else 0)


if __name__ == "__main__":
    main()
