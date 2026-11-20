#!/usr/bin/env python3
"""A platform cut from an approved master, by cropping, only when nothing on screen is lost.

Usage:
  cut.py <master.mp4> <size> <out.mp4> [--focus 0.5] [--every 0.25]
      size: 4:5, 1:1, 9:16 or 16:9 (the shape of the cut). --focus: where the crop sits along the side that is cut,
      0 = top or left, 0.5 = centre (default), 1 = bottom or right.

Before cropping it samples the master every --every seconds and looks at the bands the crop would remove. A band that
holds anything but the background (text, a logo, a product, a face) stops the cut: the tool names the moments and the
side, and writes nothing. Then the film needs a native render at that size (its scenes re-framed), not a crop.
The background test: after a slight blur (to ignore grain), no row or column of a removed band may span more than
--range levels of brightness (default 28 of 255), the size of a soft gradient. Picture and sound are otherwise copied
as they are (the picture re-encoded at high quality; the sound copied).

Run it with the footage tools' Python: tools/footage/.venv/bin/python (on Windows: tools/footage/.venv/Scripts/python.exe) tools/film/cut.py ...
"""
import json, subprocess, sys

import numpy as np

SHAPES = {"4:5": (4, 5), "1:1": (1, 1), "9:16": (9, 16), "16:9": (16, 9)}


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration",
                          "-of", "json", path], capture_output=True, text=True, check=True).stdout
    j = json.loads(out)
    return j["streams"][0]["width"], j["streams"][0]["height"], float(j["format"]["duration"])


def frames(path, every, w, h, scale=4):
    """Grey frames at 1/scale size, one every `every` seconds."""
    sw, sh = w // scale, h // scale
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"fps=1/{every},scale={sw}:{sh},format=gray,gblur=sigma=1.5",
                          "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
    n = len(raw) // (sw * sh)
    return np.frombuffer(raw[: n * sw * sh], dtype=np.uint8).reshape(n, sh, sw), scale


def main(argv):
    args = [a for a in argv if not a.startswith("--")]
    opt = {argv[i][2:]: argv[i + 1] for i in range(len(argv) - 1) if argv[i].startswith("--")}
    if len(args) < 3 or args[1] not in SHAPES:
        print(__doc__); return 2
    master, size, out = args[:3]
    focus, every, limit = float(opt.get("focus", 0.5)), float(opt.get("every", 0.25)), int(opt.get("range", 28))
    w, h, dur = probe(master)
    a, b = SHAPES[size]
    if w * b > h * a:   # master is wider than the cut: crop the sides
        cw, ch = int(round(h * a / b / 2) * 2), h
    else:               # taller: crop top and bottom
        cw, ch = w, int(round(w * b / a / 2) * 2)
    x, y = int(round((w - cw) * focus / 2) * 2), int(round((h - ch) * focus / 2) * 2)
    if (cw, ch) == (w, h):
        print(f"The master is already {size}."); return 2
    imgs, s = frames(master, every, w, h)
    bands = []
    if ch < h:
        # Edges rounded outward at the reduced size, so the rows right at the crop line are checked too.
        bands += [("top", slice(0, -(-y // s)), slice(None)), ("bottom", slice((y + ch) // s, None), slice(None))]
    else:
        bands += [("left", slice(None), slice(0, -(-x // s))), ("right", slice(None), slice((x + cw) // s, None))]
    lost = []
    for i, img in enumerate(imgs):
        for side, rows, cols in bands:
            band = img[rows, cols].astype(int)
            if band.size == 0:
                continue
            spread = max((band.max(axis=1) - band.min(axis=1)).max(), (band.max(axis=0) - band.min(axis=0)).max())
            if spread > limit:
                lost.append((round(i * every, 2), side, int(spread)))
    if lost:
        print(f"Not cut: something on screen would be cropped away at {len(lost)} moments, e.g. "
              + ", ".join(f"{t} s ({side}, spread {sp})" for t, side, sp in lost[:6])
              + f". The film needs a native {size} render, or --focus moved toward what matters.")
        return 1
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", master, "-vf", f"crop={cw}:{ch}:{x}:{y}", "-c:v", "libx264", "-crf", "16",
                    "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", out], check=True)
    print(f"Cut {size} ({cw}x{ch}) from the {w}x{h} master: {len(imgs)} moments checked, nothing on screen lost. Wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
