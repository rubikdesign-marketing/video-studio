#!/usr/bin/env python3
"""Find flashing and sudden large brightness changes in any render (DESIGN.md section 14 item 12).

Usage: flashes.py <video> [--area 25] [--json out.json]

  flashes   the general flash rule: no more than three flashes in any one second over a large area. A flash is a
            pair of opposite changes in brightness (relative luminance, 0 to 1) of at least 0.1, where the darker
            state is below 0.8 (WCAG 2.3.1 and ITU-R BT.1702 count the same way). "Large" is --area per cent of the
            frame (25 by default, the broadcast limit, Ofcom's quarter of the screen). The frame is looked at in a
            48 x 27 grid; a grid cell fails in a second when it flashes four times or more in it, and the film fails
            when the failing cells of one second cover the area.
  jumps     sudden large brightness changes of the whole frame: the average brightness moving by 0.4 or more within
            two frames (a cut from dark to light, a white flash frame). Listed with their times to look at: one is
            a hard cut, many close together are flashing (two jumps make one flash, so the flash rule above is what
            fails them: more than three flashes, eight jumps, in a second).

Not checked: saturated red flashing (a separate broadcast rule), and flashes smaller than one grid cell (2% of the
frame width). A pass is not a medical clearance; a film for broadcast still goes through the broadcaster's own test.
Exit code 0 = pass, 1 = fails a rule. Needs only ffmpeg.
"""
import argparse, json, subprocess, sys

GRID_W, GRID_H = 48, 27
STEP = 0.1          # least change in relative luminance that counts as a transition
DARK = 0.8          # the darker state must be below this
MAX_FLASHES = 3     # flashes allowed in any one second
JUMP = 0.4          # whole-frame brightness change counted as a sudden jump


def _lin(c):
    c /= 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


LIN = [_lin(float(i)) for i in range(256)]


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "stream=r_frame_rate:format=duration", "-of", "json", path], capture_output=True, text=True).stdout
    j = json.loads(out)
    a, b = j["streams"][0]["r_frame_rate"].split("/")
    return float(a) / float(b), float(j["format"]["duration"])


def cells_of(path):
    """Relative luminance per grid cell per frame: a list of cells, each a list over frames."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-an", "-vf", f"scale={GRID_W}:{GRID_H}:flags=area",
                          "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
    size = GRID_W * GRID_H * 3
    n = len(raw) // size
    cells = [[0.0] * n for _ in range(GRID_W * GRID_H)]
    for f in range(n):
        base = f * size
        for c in range(GRID_W * GRID_H):
            i = base + c * 3
            cells[c][f] = 0.2126 * LIN[raw[i]] + 0.7152 * LIN[raw[i + 1]] + 0.0722 * LIN[raw[i + 2]]
    return cells


def transitions(series, fps):
    """Frame indices where the brightness turned by at least STEP from its last extreme, the darker side below DARK."""
    out = []
    if not series:
        return out
    direction, lo, hi, ext = 0, series[0], series[0], series[0]
    for i, v in enumerate(series):
        if direction == 0:
            lo, hi = min(lo, v), max(hi, v)
            if v - lo >= STEP and lo < DARK:
                out.append(i); direction, ext = 1, v
            elif hi - v >= STEP and v < DARK:
                out.append(i); direction, ext = -1, v
        elif direction == 1:
            if v > ext:
                ext = v
            elif ext - v >= STEP and v < DARK:
                out.append(i); direction, ext = -1, v
        else:
            if v < ext:
                ext = v
            elif v - ext >= STEP and ext < DARK:
                out.append(i); direction, ext = 1, v
    return out


def judge(cells, fps, area=25.0):
    """Counts flashes per cell in every one-second window; fails where cells with more than three cover `area` %."""
    n = len(cells[0]) if cells else 0
    win = max(1, int(round(fps)))
    need = 2 * (MAX_FLASHES + 1)                      # transitions that make four flashes
    prefix = []
    for series in cells:
        marks = [0] * (n + 1)
        for i in transitions(series, fps):
            marks[i + 1] += 1
        for i in range(n):
            marks[i + 1] += marks[i]
        prefix.append(marks)
    worst = {"t": 0.0, "flashes": 0, "area": 0.0}
    for s in range(0, max(1, n - win + 1)):
        e = min(n, s + win)
        counts = [p[e] - p[s] for p in prefix]
        failing = sum(1 for c in counts if c >= need) / len(counts)
        most = max(counts) // 2
        if (failing, most) > (worst["area"] / 100, worst["flashes"]):
            worst = {"t": round(s / fps, 2), "flashes": most, "area": round(failing * 100, 1)}
    return {"pass": worst["area"] < area, "worst": worst, "area_limit": area}


def jumps(cells, fps):
    """Whole-frame brightness jumps: times where the average moved by JUMP or more within two frames."""
    n = len(cells[0]) if cells else 0
    mean = [sum(c[f] for c in cells) / len(cells) for f in range(n)]
    out, last = [], -10
    for f in range(2, n):
        d = max(abs(mean[f] - mean[f - 1]), abs(mean[f] - mean[f - 2]))
        if d >= JUMP and f - last > 2:
            out.append({"t": round(f / fps, 2), "from": round(mean[f - 2], 2), "to": round(mean[f], 2)})
            last = f
    worst = 0
    for i, j in enumerate(out):
        worst = max(worst, sum(1 for k in out[i:] if k["t"] - j["t"] < 1.0))
    return out, worst


def check(path, area=25.0):
    fps, dur = probe(path)
    cells = cells_of(path)
    r = judge(cells, fps, area)
    js, most = jumps(cells, fps)
    r.update(jumps=js, most_jumps_in_a_second=most, fps=fps, seconds=round(dur, 2))
    return r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video"); ap.add_argument("--area", type=float, default=25.0); ap.add_argument("--json")
    a = ap.parse_args()
    r = check(a.video, a.area)
    w = r["worst"]
    print(f"Flashes: {a.video} ({r['seconds']} s at {r['fps']:g} fps)")
    if w["flashes"]:
        print(f"  most flashing: {w['flashes']} flash{'es' if w['flashes'] != 1 else ''} in the second from {w['t']} s; "
              f"cells flashing more than {MAX_FLASHES} times then cover {w['area']}% of the frame (limit {a.area:g}%)")
    else:
        print("  no flashing anywhere in the frame")
    if r["jumps"]:
        print(f"  sudden brightness changes: {len(r['jumps'])} (" + ", ".join(f"{j['t']} s from {j['from']} to {j['to']}" for j in r["jumps"][:8])
              + (" ..." if len(r["jumps"]) > 8 else "") + f"); at most {r['most_jumps_in_a_second']} in one second")
    else:
        print("  no sudden brightness changes")
    if a.json:
        json.dump(r, open(a.json, "w"), indent=1)
    print("Pass: no flashing over the limit." if r["pass"] else "Fail: flashing over the limit. Slow it to three flashes a second or fewer, make it smaller, or lower the change in brightness.")
    sys.exit(0 if r["pass"] else 1)


if __name__ == "__main__":
    main()
