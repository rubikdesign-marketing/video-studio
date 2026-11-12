"""Decode the pixel-encoded widths written by measure-inter.tsx (see its header).

    python3 -I decode-widths.py out.png   -> prints JSON {"400": {chars, samples}, "600": {chars, samples}}
"""
import json
import subprocess
import sys

SAMPLES = ["Prospecting", "Pitch Sent", "Negotiation", "Contract Review", "Signed", "Live", "Closed",
           "Oct 2026", "Nov 2026", "Dec 2026", "Sep 2026"]
CHARS = [chr(c) for c in range(32, 127)]
per = len(CHARS) + len(SAMPLES)
n = per * 2
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", sys.argv[1], "-vf", f"format=rgb24,crop={n}:1:0:0",
                      "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
vals = [((raw[i * 3] << 16) | (raw[i * 3 + 1] << 8) | raw[i * 3 + 2]) / 1000 for i in range(n)]
out = {}
for k, w in enumerate((400, 600)):
    v = vals[k * per:(k + 1) * per]
    out[str(w)] = {"chars": dict(zip(CHARS, v[:len(CHARS)])), "samples": dict(zip(SAMPLES, v[len(CHARS):]))}
print(json.dumps(out))
