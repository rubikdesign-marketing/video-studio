#!/usr/bin/env python3
"""Does a highlight's outline run through text or pictures on the page?

Usage: outline_clear.py <items.json> [--max 0.02]

  items.json: [{"name": "S26 ring", "png": "<capture mark screenshot>", "box": [x, y, w, h], "pad": 10, "scale": 2}]
  box is in page pixels of the screenshot's viewport; pad is the gap the highlight leaves around it; scale is the
  screenshot's pixels per page pixel.

For each item it reads, edge by edge, a band 4 page pixels either side of the outline (the box grown by pad) and counts the pixels
that stand out from the band's own background (luma more than 60 away from its median): text, icons, picture edges.
An outline's score is its worst edge, so text along one side is not hidden by three clear ones.
Prints the share for each item and exits 1 if any is above --max (default 2%), naming it.
With --snug, also prints for each item the outline that sits in clear page (snug(): each edge in the nearest gap).
"""
import json, sys
import numpy as np

BAND = 4  # page px either side of the outline: half the highlight's stroke, plus its glow


def crossing(im, box, pad=10, scale=2):
    """Share of the outline band that is ink rather than background."""
    h, w = im.shape[:2]
    luma = im[..., :3].astype(np.float32) @ np.array([0.114, 0.587, 0.299], np.float32)  # BGR, as cv2 reads it
    x0, y0 = (box[0] - pad) * scale, (box[1] - pad) * scale
    x1, y1 = (box[0] + box[2] + pad) * scale, (box[1] + box[3] + pad) * scale
    b = BAND * scale
    def cut(a0, a1, c0, c1):
        a0, a1 = int(max(0, round(a0))), int(min(h, round(a1)))
        c0, c1 = int(max(0, round(c0))), int(min(w, round(c1)))
        return luma[a0:a1, c0:c1].ravel() if a1 > a0 and c1 > c0 else np.empty(0, np.float32)
    edges = [cut(y0 - b, y0 + b, x0, x1), cut(y1 - b, y1 + b, x0, x1), cut(y0, y1, x0 - b, x0 + b), cut(y0, y1, x1 - b, x1 + b)]
    allpx = np.concatenate(edges)
    if allpx.size == 0:
        return 0.0
    bg = np.median(allpx)
    return float(max(np.mean(np.abs(e - bg) > 60) for e in edges if e.size))



def _ink(luma, bg, y0, y1, x0, x1):
    h, w = luma.shape
    y0, y1, x0, x1 = int(max(0, round(y0))), int(min(h, round(y1))), int(max(0, round(x0))), int(min(w, round(x1)))
    band = luma[y0:y1, x0:x1]
    return float(np.mean(np.abs(band - bg) > 60)) if band.size else 0.0


def snug(im, box, scale=2, prefer=8, inward=2, outward=24, mx=0.02):
    """The outline (a box in page px, gap included) that sits in clear page around `box`: each edge moves to the
    clear line nearest `prefer` px out from the box, between `inward` px in and `outward` px out."""
    luma = im[..., :3].astype(np.float32) @ np.array([0.114, 0.587, 0.299], np.float32)
    bg = float(np.median(luma))
    b = BAND * scale; x, y, w, h = box
    def pick(score):
        cands = [(d, score(d)) for d in range(-inward, outward + 1)]
        clear = [d for d, v in cands if v <= mx]
        return min(clear, key=lambda d: (abs(d - prefer), -d)) if clear else min(cands, key=lambda c: c[1])[0]
    xa, xb = (x - prefer) * scale, (x + w + prefer) * scale
    top = pick(lambda d: _ink(luma, bg, (y - d) * scale - b, (y - d) * scale + b, xa, xb))
    bot = pick(lambda d: _ink(luma, bg, (y + h + d) * scale - b, (y + h + d) * scale + b, xa, xb))
    ya, yb = (y - top) * scale, (y + h + bot) * scale
    left = pick(lambda d: _ink(luma, bg, ya, yb, (x - d) * scale - b, (x - d) * scale + b))
    right = pick(lambda d: _ink(luma, bg, ya, yb, (x + w + d) * scale - b, (x + w + d) * scale + b))
    return (x - left, y - top, w + left + right, h + top + bot)


def main(argv):
    if not argv or argv[0].startswith('-'):
        print(__doc__); return 2
    import cv2
    items = json.load(open(argv[0]))
    mx = float(argv[argv.index('--max') + 1]) if '--max' in argv else 0.02
    bad = []
    for it in items:
        r = crossing(cv2.imread(it['png']), it['box'], it.get('pad', 10), it.get('scale', 2))
        line = f"{it['name']:<16} {r * 100:5.1f}%  {'clear' if r <= mx else 'CROSSES the page'}"
        if '--snug' in argv:
            o = snug(cv2.imread(it['png']), it['box'], it.get('scale', 2))
            line += f"   snug outline {[round(v, 1) for v in o]}"
        print(line)
        if r > mx:
            bad.append(it['name'])
    print(f"{len(items)} outlines, {len(bad)} cross the page{': ' + ', '.join(bad) if bad else ''}")
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
