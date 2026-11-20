#!/usr/bin/env python3
"""Sync spot checks on a finished film: where each sound's first audible sample is, against the first frame of its cause on screen.
   python3 jobs/2026-11-19-ugc-01/check-sync.py <film.mp4> [--json]
Picture: the film is decoded at 270x480 grey; a cause is the first frame whose region differs from a reference frame.
Sound: the film's own mastered audio (bed and all): the cue's first audible millisecond is found in the effects stem (nothing under it), then moved by how far the film's audio sits after audio/mix.wav (whole-file envelope match, 1 ms steps).
Pure Python (no numpy).
"""
import array, json, os, subprocess, sys
FF = "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg"
film = sys.argv[1]
W, H, FPS, SR = 270, 480, 30, 48000
raw = subprocess.run([FF, "-v", "error", "-i", film, "-vf", f"scale={W}:{H},format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
N = len(raw) // (W * H)
frame = lambda i: raw[i * W * H:(i + 1) * W * H]
pcm = array.array("h"); pcm.frombytes(subprocess.run([FF, "-v", "error", "-i", film, "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"], capture_output=True).stdout)
# 2 ms RMS envelope in 2 ms steps
STEP = 96
env = [ (sum(v * v for v in pcm[i:i + STEP]) / STEP) ** 0.5 / 32768 for i in range(0, len(pcm) - STEP, STEP)]

def diff(a, b, box=None, stride=2):
    x0, y0, x1, y1 = box or (0, 0, W, H)
    tot = n = 0
    for y in range(y0, y1, stride):
        ra, rb = a[y * W + x0:y * W + x1:stride], b[y * W + x0:y * W + x1:stride]
        tot += sum(abs(p - q) for p, q in zip(ra, rb)); n += len(ra)
    return tot / max(1, n)

def box_of(x, y, r): return (max(0, (x - r) // 4), max(0, (y - r) // 4), min(W, (x + r) // 4), min(H, (y + r) // 4))  # 1080x1920 frame pixels -> grey frame

def first_change(start, end, base, box, thr):
    ref = frame(base)
    for f in range(start, end):
        if diff(frame(f), ref, box) > thr: return f

HERE = os.path.dirname(os.path.abspath(__file__))
def envelope(path):
    """1 ms level envelope (mean abs over 2 ms) of a file's audio, at 1 kHz."""
    a = array.array("h"); a.frombytes(subprocess.run([FF, "-v", "error", "-i", path, "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], capture_output=True).stdout)
    return [sum(abs(v) for v in a[i:i + 16]) / 16 / 32768 for i in range(0, len(a) - 16, 8)]

film_env = envelope(film)
mix_env = envelope(os.path.join(HERE, "audio", "mix.wav"))
sfx_env = envelope(os.path.join(HERE, "audio", "stems", "sfx.wav"))

def file_lag():
    """How far the film's audio sits after audio/mix.wav (what the render was given), by matching the two whole envelopes. Milliseconds."""
    def z(v): m = sum(v) / len(v); return [x - m for x in v]
    best = (0, -1e9); a = z(mix_env)
    for lag in range(-120, 121):
        seg = film_env[max(0, lag):len(film_env) + min(0, lag)]; ref = a[max(0, -lag):max(0, -lag) + len(seg)]
        n = min(len(seg), len(ref)); seg, ref = z(seg[:n]), ref[:n]
        score = sum(x * y for x, y in zip(seg, ref)) / ((sum(x * x for x in seg) * sum(y * y for y in ref)) ** 0.5 + 1e-12)
        if score > best[1]: best = (lag, score)
    return best

def wave(path, seconds=None):
    cmd = [FF, "-v", "error", "-i", path, "-ac", "1", "-ar", "8000", *(["-t", str(seconds)] if seconds else []), "-f", "s16le", "-"]
    a = array.array("h"); a.frombytes(subprocess.run(cmd, capture_output=True).stdout); return a

sfx_wave = wave(os.path.join(HERE, "audio", "stems", "sfx.wav"))

def onset(cue):
    """Where the cue's sound starts in the effects stem (no bed under it): the first 0.12 s of the library sound is found in the stem by
    waveform cross-correlation (0.125 ms steps, +-100 ms around its planned time, so an overlapping tail of another sound cannot hide it);
    its own lead-in (the time before it first rises above 6 percent of its peak, from audio/cues.json) is then added."""
    ref = wave(os.path.join(HERE, "..", "..", "library", "sounds", cue["library"] + ".mp3"), 0.12)
    rn = sum(v * v for v in ref) ** 0.5 or 1
    p = int(cue["at"] * 8000); best = (None, -1.0)
    for lag in range(max(0, p - 800), p + 800):
        win = sfx_wave[lag:lag + len(ref)]
        if len(win) < len(ref): break
        score = sum(x * y for x, y in zip(ref, win)) / (rn * (sum(v * v for v in win) ** 0.5 + 1e-9))
        if score > best[1]: best = (lag, score)
    return best[0] / 8000 + cue["onset"], best[1]

LAG, LAG_SCORE = file_lag()
print(f"film audio vs audio/mix.wav: offset {LAG} ms (envelope match {LAG_SCORE:.3f})")

cues = {c["id"]: c for c in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "audio", "cues.json")))}
d = [diff(frame(i), frame(i - 1), None, 6) for i in range(70, 80)]
cut = 70 + d.index(max(d))  # the first frame of the new scene
checks = [
    ("whip", "the hard cut to the demo (first frame of S02)", cut),
    ("finger-tap", "the pointer clicks the sidebar item (pointer presses, ring opens)", first_change(149, 160, 148, box_of(177, 661, 45), 0.8)),
    ("toast-pop", "the glow opens on New", first_change(236, 250, 236, box_of(973, 283, 80), 0.8)),
    ("offer-sting", "the offer line lands", first_change(399, 420, 398, (0, 150, W, 330), 0.5)),
    ("logo-sting", "the wordmark appears", first_change(420, 440, 419, box_of(540, 1085, 220), 0.6)),
]
out = []
for cid, what, f in checks:
    t0, score = onset(cues[cid]); t = t0 + LAG / 1000
    out.append(dict(cue=cid, cause=what, picture_frame=f, picture_s=round(f / FPS, 3) if f is not None else None, sound_onset_s=round(t, 4) if t is not None else None,
                    sound_frame=round(t * FPS, 2) if t is not None else None, match=round(score, 2), offset_frames=round(t * FPS - f, 2) if f is not None and t is not None else None))
if "--json" in sys.argv: print(json.dumps(out, indent=1))
else:
    for o in out: print(f"{o['cue']:12} picture frame {o['picture_frame']} ({o['picture_s']} s)  sound onset {o['sound_onset_s']} s = frame {o['sound_frame']}   offset {o['offset_frames']} frames   [{o['cause']}]")
