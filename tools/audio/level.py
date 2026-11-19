#!/usr/bin/env python3
"""Level a sound for the library, and measure it.

Usage:
  level.py measure <file> [...]                 print each file's length, peak and loudness as JSON lines
  level.py make <in> <out.mp3> [--peak -3] [--mono] [--trim]
                                                 write a levelled copy: 48 kHz, peak at --peak dBFS, MP3 (VBR ~ 160 kbit/s)

The library's rule (library/sounds/README.md): every sound peaks at -3 dBFS, like the brand kits, and its loudness
is measured and recorded; the mixer (mix.py) sets the final level against the voice from that measure. Ambience and
music beds are levelled the same way: their place in the mix is set by their gain, not by the file.

--trim cuts silence (57 dB below the sound's own peak, never above -60 dBFS) from the start and the end, keeping 5 ms before the first sound, so a cue placed at
a time sounds at that time. Needs ffmpeg only.
"""
import json, math, os, re, subprocess, sys, tempfile

import sys as _sys
_sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'footage', 'py'))
from _ff import FFMPEG as FF, FFPROBE  # noqa: E402
SR = 48000


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit("ffmpeg failed:\n" + r.stderr[-1200:])
    return r


def measure(path):
    """Length (s), sample peak (dBFS), loudest 400 ms (LUFS, momentary max) and integrated loudness (LUFS)."""
    # Short sounds are padded with a second of silence so the 400 ms meter has room; silence does not change the max.
    r = run([FF, "-hide_banner", "-nostats", "-v", "verbose", "-i", path, "-af",
             "apad=pad_dur=1,ebur128=peak=sample:framelog=verbose,astats=metadata=0:measure_overall=Peak_level",
             "-f", "null", "-"])
    err = r.stderr
    moments = [float(x) for x in re.findall(r"\bM:\s*(-?[\d.]+)", err)]
    integ = re.findall(r"I:\s*(-?[\d.]+) LUFS", err)
    peak = re.findall(r"Peak:\s*(-?[\d.]+|-inf) dBFS", err)
    probe = subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                           capture_output=True, text=True).stdout.strip()
    seconds = float(probe) if probe else 0.0
    loudest = max([m for m in moments if m > -120], default=-120.0)
    return {
        "file": path,
        "seconds": round(seconds, 3),
        "peak_db": None if not peak or peak[-1] == "-inf" else round(float(peak[-1]), 2),
        "loudest_lufs": round(loudest, 1),
        "integrated_lufs": None if not integ else round(float(integ[-1]), 1),
    }


def make(src, out, peak=-3.0, mono=False, trim=False):
    chain = []
    if trim:
        # Silence is judged against the sound's own peak, not a fixed level, so a quiet source loses no more of its
        # tail than a loud one: 57 dB below the peak, and never above -60 dBFS (which is where a sound already
        # levelled to -3 dBFS lands, so remakes of the library's sounds are unchanged).
        src_peak = measure(src)["peak_db"]
        floor = -60.0 if src_peak is None else min(-60.0, src_peak - 57.0)
        chain.append(f"silenceremove=start_periods=1:start_threshold={floor:.1f}dB:start_silence=0.005,"
                     f"areverse,silenceremove=start_periods=1:start_threshold={floor:.1f}dB:start_silence=0.02,areverse")
    chain.append(f"aresample={SR}")
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, "a.wav")
        run([FF, "-y", "-hide_banner", "-i", src, "-af", ",".join(chain), *(["-ac", "1"] if mono else []),
             "-c:a", "pcm_f32le", wav])
        now = measure(wav)["peak_db"]
        if now is None:
            sys.exit(f"{src}: silent after trimming")
        gain = peak - now
        os.makedirs(os.path.dirname(os.path.abspath(out)) or ".", exist_ok=True)
        # MP3 encoding moves a short sound's peak by up to a decibel or so: measure the encoded file and, if it
        # missed by more than 0.3 dB, encode again from the same WAV with the gain corrected (twice at most).
        for _ in range(3):
            run([FF, "-y", "-hide_banner", "-i", wav, "-af", f"volume={gain:.3f}dB", "-c:a", "libmp3lame", "-q:a", "2",
                 "-ar", str(SR), out])
            got = measure(out)
            if got["peak_db"] is None or abs(got["peak_db"] - peak) <= 0.3:
                break
            gain += peak - got["peak_db"]
    return got


def main(argv):
    if len(argv) < 2 or argv[0] not in ("measure", "make"):
        sys.exit(__doc__)
    if argv[0] == "measure":
        for f in argv[1:]:
            print(json.dumps(measure(f)))
        return
    args = argv[1:]
    opts = {"peak": -3.0, "mono": False, "trim": False}
    pos = []
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--peak":
            opts["peak"] = float(args[i + 1]); i += 2; continue
        if a in ("--mono", "--trim"):
            opts[a[2:]] = True; i += 1; continue
        pos.append(a); i += 1
    if len(pos) != 2:
        sys.exit(__doc__)
    print(json.dumps(make(pos[0], pos[1], **opts)))


if __name__ == "__main__":
    main(sys.argv[1:])
