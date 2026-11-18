#!/usr/bin/env python3
"""Make sound effects from numbers: whooshes, swishes, risers, impacts, glitches, transitions, stings and room tones.

Usage:
  synth.py <kind> <out.wav|out.mp3> [--seconds 0.8] [--seed 1] [--tone dark|neutral|bright]
           [--weight light|medium|heavy] [--key value ...]
  synth.py list                          print every kind and the settings it takes
  synth.py recipe <recipe.json> <out>    remake a sound from its recipe. The file may hold a recipe, one manifest
                                         line (with a "recipe"), or a whole index.json with --id <group/name>.

Run it with the footage tools' Python: tools/footage/.venv/bin/python tools/audio/synth.py ...

Every sound is made from random noise and sine waves, shaped by numbers. The same numbers and the same --seed always
give the same sound, to the last bit of the WAV, so a sound in the library can be remade from the "recipe" in its
manifest line. Change the seed for a new take of the same idea; change --tone (how bright) and --weight (how big)
to move it; any other setting is passed as --key value (see `synth.py list`).

What it takes care of, so a made sound is safe to drop into a film: a few milliseconds of fade at both ends (no
clicks), no DC offset (a 20 Hz high-pass), filtering before any lowering of the sample rate (no aliasing), sine
oscillators for every tone (nothing harsh above hearing folds back), 48 kHz, peak at -3 dBFS.

A .wav out is the raw render (32-bit float). A .mp3 out goes through level.py's `make`, the library's rule: peak
-3 dBFS, mono and trimmed for effects; ambience stays stereo and untrimmed (it is a loop), stings stay stereo.
It prints the recipe (and, for an MP3, the measures) as one line of JSON.

Needs numpy and scipy (both in tools/footage/.venv), and ffmpeg for MP3s.
"""
import json, os, struct, sys

import numpy as np
from scipy.interpolate import CubicSpline
from scipy.signal import butter, fftconvolve, istft, sosfilt, stft

SR = 48000
PEAK = 10 ** (-3 / 20)                       # -3 dBFS
TONES = {"dark": 0.55, "neutral": 1.0, "bright": 1.8}
WEIGHTS = {"light": 0, "medium": 1, "heavy": 2}
STEREO_KINDS = ("ambience", "sting")         # kept stereo as MP3; everything else is mono in the library
UNTRIMMED_KINDS = ("ambience",)

# ----------------------------------------------------------------------------------------------------------------
# The settings each kind takes: name -> (default, what it does). A default of None is filled from the style.

COMMON = {
    "seconds": (None, "length in seconds (default per kind)"),
    "seed": (1, "a whole number; the same seed gives the same sound"),
    "tone": ("neutral", "dark | neutral | bright: moves every band and tone down or up"),
    "weight": ("medium", "light | medium | heavy: how much low end, body and length of tail"),
}

WHOOSH = {
    "peak": (0.5, "where the loudest moment is, 0..1 of the length"),
    "centre": (900.0, "middle of the noise band at the start, Hz"),
    "sweep": (1.5, "octaves the band climbs as it comes near"),
    "doppler": (0.5, "octaves the band drops as it passes (higher coming, lower going)"),
    "width": (0.7, "width of the noise band in octaves (narrow = more tonal)"),
    "resonance": (0.6, "a narrow peak in the band, 0..3 (a whistle in the air)"),
    "rise": (2.0, "how slowly it fades in (1 = quickly, 3 = late)"),
    "fall": (2.5, "how quickly it fades out after the peak"),
    "air": (0.4, "amount of high air layer, 0..1"),
    "body": (None, "amount of low rumble layer, 0..1 (default from weight)"),
    "flutter": (0.0, "fast wobble in level, like cloth or a blade, 0..1"),
    "pan": (0.0, "stereo sweep left to right, 0..1 (0 = mono)"),
}
SWISH = dict(WHOOSH)
SWISH.update({
    "peak": (0.42, WHOOSH["peak"][1]), "centre": (1200.0, WHOOSH["centre"][1]), "sweep": (1.6, WHOOSH["sweep"][1]),
    "doppler": (0.9, WHOOSH["doppler"][1]), "width": (0.8, WHOOSH["width"][1]), "resonance": (0.6, WHOOSH["resonance"][1]),
    "rise": (1.8, WHOOSH["rise"][1]), "fall": (2.6, WHOOSH["fall"][1]), "air": (0.4, WHOOSH["air"][1]),
    "flutter": (0.0, WHOOSH["flutter"][1]),
})

RISER = {
    "start": (250.0, "noise band at the start, Hz"),
    "end": (5000.0, "noise band at the end, Hz"),
    "curve": (2.0, "how the rise speeds up: 1 = even, 3 = slow then fast"),
    "tonal": (0.5, "amount of the gliding tones against the noise, 0..1"),
    "low": (110.0, "the tones' starting pitch, Hz"),
    "high": (880.0, "the tones' ending pitch, Hz"),
    "voices": (3, "number of tones gliding together (1..6)"),
    "detune": (10.0, "spread between the tones, cents"),
    "pulse": (0.3, "depth of the speeding-up tremolo (tension), 0..1"),
    "pulse_from": (3.0, "tremolo speed at the start, per second"),
    "pulse_to": (18.0, "tremolo speed at the end, per second"),
    "resonance": (1.5, "a sharp peak riding up the noise band, 0..3"),
    "ending": ("cut", "cut (stops at its loudest) | fade (levels off and fades) | hit (lands on an impact)"),
    "hit": (0.6, "length of the landing hit in seconds, when ending is hit"),
}
DOWNER = {
    "start": (4000.0, "noise band at the start, Hz"),
    "end": (120.0, "noise band at the end, Hz"),
    "curve": (0.6, "how the fall goes: below 1 = fast first, then slow"),
    "tonal": (0.5, "amount of the falling tones, 0..1"),
    "high": (880.0, "the tones' starting pitch, Hz"),
    "low": (55.0, "the tones' ending pitch, Hz"),
    "voices": (2, "number of tones (1..6)"),
    "detune": (10.0, "spread between the tones, cents"),
    "resonance": (1.0, "a sharp peak riding down the noise band, 0..3"),
    "attack": ("soft", "soft (swells in) | hit (starts on a thump)"),
}
REVERSE = {
    "centre": (1800.0, "brightness of the swell's noise, Hz"),
    "tonal": (0.4, "amount of a held chord inside the swell, 0..1"),
    "note": (220.0, "root of that chord, Hz"),
    "space": (0.7, "how long the reversed tail is against the length, 0..1"),
    "ending": ("cut", "cut (stops sharp) | hit (lands on a soft boom)"),
    "hit": (0.5, "length of the landing hit in seconds, when ending is hit"),
}
IMPACT = {
    "style": ("punch", "boom | punch | thud | metallic"),
    "sub": (None, "the low thump's final pitch, Hz"),
    "drop": (None, "how far the thump's pitch falls (start = sub x drop)"),
    "sub_decay": (None, "the thump's decay, seconds"),
    "body": (None, "amount of mid body, 0..1"),
    "click": (None, "amount of the first click, 0..1"),
    "crack": (None, "amount of the broadband crack (air pushed by the hit), 0..1"),
    "tail": (None, "amount of the room tail (the hit ringing out in a big space), 0..1"),
    "tail_decay": (None, "the tail's decay, seconds"),
    "ring": (None, "amount of metal ring (struck-bar partials), 0..1"),
    "drive": (None, "soft saturation, 0..1 (more = fatter on small speakers)"),
}
IMPACT_STYLES = {
    "boom":     dict(sub=42.0, drop=3.5, sub_decay=0.7, body=0.45, click=0.25, crack=0.7, tail=0.9, tail_decay=0.6, ring=0.0, drive=0.35),
    "punch":    dict(sub=55.0, drop=2.6, sub_decay=0.22, body=1.0, click=0.8, crack=0.6, tail=0.55, tail_decay=0.3, ring=0.0, drive=0.5),
    "thud":     dict(sub=50.0, drop=2.0, sub_decay=0.18, body=0.6, click=0.0, crack=0.15, tail=0.25, tail_decay=0.12, ring=0.0, drive=0.2),
    "metallic": dict(sub=62.0, drop=1.6, sub_decay=0.25, body=0.5, click=1.0, crack=0.3, tail=0.5, tail_decay=0.45, ring=1.0, drive=0.15),
}
GLITCH = {
    "style": ("mixed", "stutter | crush | chirp | data | mixed"),
    "slice": (0.045, "average length of one glitch slice, seconds"),
    "bits": (6, "bit depth of the crushed slices (3..12)"),
    "rate": (8, "how much the crushed slices drop the sample rate (2..32)"),
    "repeat": (None, "share of slices that stutter (repeat a tiny buffer), 0..1"),
    "crush": (None, "share of slices that are bit-crushed, 0..1"),
    "chirps": (None, "share of slices that are digital chirps, 0..1"),
    "gaps": (0.12, "share of slices that drop out, 0..1"),
    "beep": (0.35, "amount of square-ish data tones in the source, 0..1"),
}
GLITCH_STYLES = {
    "stutter": dict(repeat=0.7, crush=0.1, chirps=0.05),
    "crush":   dict(repeat=0.15, crush=0.7, chirps=0.05),
    "chirp":   dict(repeat=0.1, crush=0.1, chirps=0.65),
    "data":    dict(repeat=0.35, crush=0.35, chirps=0.2),
    "mixed":   dict(repeat=0.35, crush=0.25, chirps=0.2),
}
TRANSITION = {
    "style": ("whoosh-hit", "whoosh-hit | rise-hit | reverse-hit | suck | tape-stop | spin"),
    "split": (0.7, "where the hit lands, 0..1 of the length (for the -hit styles)"),
    "spins": (4.0, "turns heard in a spin"),
    "hit_style": ("punch", "the landing hit's style: boom | punch | thud | metallic"),
}
STING = {
    "note": (293.66, "root of the warm tone, Hz (293.66 = D)"),
    "chord": ("major", "major | sus | fifth | add9"),
    "resolve": (0.35, "when the shimmer resolves into the tone, 0..1 of the length"),
    "sparkle": (24, "number of shimmer partials"),
    "width": (0.6, "stereo width, 0..1"),
}
AMBIENCE = {
    "style": ("room", "room | aircon | city | wind | rain"),
    "hum": (60.0, "mains hum, Hz (50 or 60), for room and aircon"),
    "crossfade": (1.5, "seconds of the end folded into the start to make the loop seamless"),
    "width": (0.7, "stereo width (how different the two sides are), 0..1"),
    "density": (1.0, "how busy: gusts, cars passing, drops of rain (0.3..3)"),
}

KINDS = {
    "whoosh":     (WHOOSH, 0.8, "filtered air rushing past: a band of noise that climbs, peaks and falls away"),
    "swish":      (SWISH, 0.35, "a short, bright, quick whoosh, like cloth or a fast hand"),
    "riser":      (RISER, 2.5, "tension building: noise and gliding tones rising, ending on a cut, a fade or a hit"),
    "downer":     (DOWNER, 1.5, "the opposite of a riser: noise and tones falling away"),
    "reverse":    (REVERSE, 1.5, "a reversed swell: a tail played backwards, rising into a sharp stop (or a hit)"),
    "impact":     (IMPACT, 1.2, "a hit in layers: a low thump with a falling pitch, mid body, a first click, a short tail"),
    "glitch":     (GLITCH, 0.6, "digital trouble: stutters, bit-crush, sample-rate drops, chirps, dropouts"),
    "transition": (TRANSITION, 1.5, "combinations for a cut: whoosh into a hit, rise into a hit, reverse swell, suck, tape stop, spin"),
    "sting":      (STING, 2.4, "a short logo sting: a soft rising shimmer that resolves into one warm tone (stereo)"),
    "ambience":   (AMBIENCE, 15.0, "a seamless loop: room tone, air conditioner, distant city, soft wind, rain (stereo)"),
}


# ----------------------------------------------------------------------------------------------------------------
# Building blocks

def rng_for(p, layer):
    """A random stream of its own for each layer, so changing one layer never changes another."""
    return np.random.default_rng([int(p["seed"]), int(layer)])


def part(p, kind, **settings):
    """Settings for a layer made by another kind (the hit at the end of a riser, say): the same tone and weight,
    a seed of its own."""
    return resolve(kind, dict(settings, seed=int(p["seed"]) + 1000, tone=p["tone"], weight=p["weight"]))


def frames(seconds):
    return max(16, int(round(float(seconds) * SR)))


def per_sample(v, n):
    return np.full(n, float(v)) if np.ndim(v) == 0 else np.asarray(v, dtype=float)


def band_noise(rng, n, centre, width=0.8, resonance=0.0, tilt=0.0, top=18000.0):
    """White noise through a band-pass whose middle (centre, Hz, one value or one per sample) and width (octaves)
    may move over time. Done in short overlapping frames (STFT), so the band glides without steps. resonance adds a
    narrow peak at the centre; tilt leans the band (negative = darker). Returns RMS ~ 1."""
    nper, hop = 1024, 256
    x = rng.standard_normal(n + nper)
    f, tt, Z = stft(x, fs=SR, nperseg=nper, noverlap=nper - hop)
    idx = np.clip(np.round(tt * SR).astype(int), 0, n - 1)
    fc = np.maximum(per_sample(centre, n)[idx], 20.0)
    w = np.maximum(per_sample(width, n)[idx], 0.05)
    lf = np.log2(np.maximum(f, 1.0)[:, None] / fc[None, :])
    g = np.exp(-0.5 * (lf / w[None, :]) ** 2)
    if resonance:
        g = g + resonance * np.exp(-0.5 * (lf / (0.08 + 0.1 * w[None, :])) ** 2)
    if tilt:
        g = g * (np.maximum(f, 20.0) / 1000.0)[:, None] ** tilt
    g = g / (1 + (f / top) ** 8)[:, None]
    g[f < 18] = 0
    _, y = istft(Z * g, fs=SR, nperseg=nper, noverlap=nper - hop)
    y = y[:n]
    return y / (np.sqrt(np.mean(y ** 2)) + 1e-12)


def hump(n, peak=0.5, rise=2.0, fall=2.0):
    """A level curve from 0 up to 1 at `peak` (0..1 of the length) and back to 0, with smooth ends."""
    t = np.linspace(0, 1, n)
    peak = min(max(peak, 0.02), 0.98)
    up = np.sin(0.5 * np.pi * np.clip(t / peak, 0, 1)) ** rise
    down = np.sin(0.5 * np.pi * np.clip((1 - t) / (1 - peak), 0, 1)) ** fall
    return np.where(t < peak, up, down)


def smooth_random(rng, n, rate):
    """A slowly wandering value (mean 0, about -1..1), changing about `rate` times a second."""
    pts = max(4, int(n / SR * rate) + 4)
    xs = np.linspace(0, n, pts)
    ys = rng.standard_normal(pts)
    y = CubicSpline(xs, ys)(np.arange(n))
    return y / (np.std(y) + 1e-12) * 0.5


def glide(f):
    """Phase of a sine whose frequency (Hz, per sample) moves: integrate, so the pitch glides without jumps."""
    return 2 * np.pi * np.cumsum(f) / SR


def tones(freq, harmonics=1, rolloff=1.5, phase0=0.0):
    """A tone at freq (Hz per sample) built from sine harmonics, each kept below 18 kHz (so nothing aliases)."""
    ph = glide(freq) + phase0
    y = np.zeros_like(ph)
    fmax = np.max(freq)
    for k in range(1, harmonics + 1):
        if k * fmax >= 18000:
            break
        y += np.sin(k * ph) / k ** rolloff
    return y


def lowpass(x, hz, order=4):
    return sosfilt(butter(order, min(hz, 0.45 * SR), "lowpass", fs=SR, output="sos"), x, axis=0)


def highpass(x, hz, order=2):
    return sosfilt(butter(order, hz, "highpass", fs=SR, output="sos"), x, axis=0)


def pan_stereo(x, pos):
    """Equal-power pan: pos -1 (left) .. +1 (right), one value or one per sample."""
    a = (np.clip(per_sample(pos, len(x)), -1, 1) + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=1)


def fade(x, fin=0.003, fout=0.005):
    """Raised-cosine fades: the first and the last sample are exactly zero."""
    n = len(x)
    a, b = min(int(fin * SR), n // 2), min(int(fout * SR), n // 2)
    w = np.ones(n)
    if a:
        w[:a] = 0.5 - 0.5 * np.cos(np.pi * np.arange(a) / a)
    if b:
        w[n - b:] = 0.5 + 0.5 * np.cos(np.pi * np.arange(1, b + 1) / b)
    return x * (w if x.ndim == 1 else w[:, None])


def norm(x):
    return x / (np.max(np.abs(x)) + 1e-12)


def place(dst, src, at):
    """Add src into dst starting at sample `at` (cut at the end of dst)."""
    m = min(len(src), len(dst) - at)
    if m > 0:
        dst[at:at + m] += src[:m]
    return dst


# ----------------------------------------------------------------------------------------------------------------
# The kinds. Each takes the number of samples and the full settings, and returns raw samples (mono, or n x 2).

def make_whoosh(n, p):
    k, w = TONES[p["tone"]], WEIGHTS[p["weight"]]
    t = np.linspace(0, 1, n)
    peak = float(p["peak"])
    spread = max(0.06, 0.18 * min(peak, 1 - peak) * 2)
    near = hump(n, peak, 1.2, 1.2)
    centre = (float(p["centre"]) * k * 2 ** (float(p["sweep"]) * (near - 0.3))
              * 2 ** (-float(p["doppler"]) * np.tanh((t - peak) / spread)))
    width = float(p["width"]) * (1.15 - 0.3 * near)          # the band tightens as it passes close
    main = band_noise(rng_for(p, 1), n, centre, width, float(p["resonance"]))
    air = band_noise(rng_for(p, 2), n, np.minimum(centre * 3.2, 14000), 1.1, 0.0)
    body_amt = (0.0, 0.3, 0.65)[w] if p["body"] is None else float(p["body"])
    body = band_noise(rng_for(p, 3), n, np.maximum(centre * 0.22, 60), 0.9, 0.3)
    y = main + float(p["air"]) * 0.6 * air * near ** 0.5 + body_amt * body
    env = hump(n, peak, float(p["rise"]), float(p["fall"]))
    if float(p["flutter"]) > 0:
        rate = 25 + 35 * near                                    # flutters faster as it passes
        fl = 0.5 + 0.5 * np.sin(glide(rate) + rng_for(p, 4).uniform(0, 6.28))
        env = env * (1 - float(p["flutter"]) * 0.6 * fl)
    y = y * env
    if float(p["pan"]) > 0:
        y = pan_stereo(y, float(p["pan"]) * np.tanh((t - peak) / (spread * 1.5)))
    return y


def make_riser(n, p):
    k, w = TONES[p["tone"]], WEIGHTS[p["weight"]]
    nh = frames(float(p["hit"])) if p["ending"] == "hit" else 0
    nh = min(nh, n // 2)
    nr = n - nh + (frames(0.004) if nh else 0)
    t = np.linspace(0, 1, nr)
    tc = t ** float(p["curve"])
    centre = float(p["start"]) * k * (float(p["end"]) / float(p["start"])) ** tc
    noise = band_noise(rng_for(p, 1), nr, centre, 0.7, float(p["resonance"]))
    ton = np.zeros(nr)
    v = max(1, min(6, int(p["voices"])))
    r = rng_for(p, 2)
    for i in range(v):
        cents = (i - (v - 1) / 2) * float(p["detune"]) + r.uniform(-2, 2)
        octave = 2 ** (i % 3 - (1 if i % 3 == 2 else 0))     # voices sit on the root, an octave up and down
        f = float(p["low"]) * k ** 0.5 * octave * (float(p["high"]) / float(p["low"])) ** tc * 2 ** (cents / 1200)
        ton += tones(f, harmonics=5, rolloff=1.6, phase0=r.uniform(0, 6.28)) / v
    ton = ton / (np.sqrt(np.mean(ton ** 2)) + 1e-12)
    body = band_noise(rng_for(p, 3), nr, 80 + 120 * tc, 0.8) * (0.0, 0.25, 0.5)[w] * (0.3 + 0.7 * tc)
    y = (1 - 0.6 * float(p["tonal"])) * noise + float(p["tonal"]) * ton + body
    pulse = float(p["pulse"])
    if pulse > 0:
        rate = float(p["pulse_from"]) * (float(p["pulse_to"]) / float(p["pulse_from"])) ** tc
        y = y * (1 - pulse * 0.5 * (1 - np.cos(glide(rate))))
    env = (0.02 + 0.98 * t ** (1.0 + 0.5 * float(p["curve"])))
    if p["ending"] == "fade":
        env = env * hump(nr, 0.85, 0.01, 1.5)
    y = fade(y * env, 0.01, 0.006 if p["ending"] != "fade" else 0.02)
    if not nh:
        return y
    out = np.zeros(n)
    place(out, norm(y), 0)
    hp = part(p, "impact", style="punch" if w < 2 else "boom")
    hit = fade(make_impact(nh, hp), 0.0005, 0.01)
    return place(out, norm(hit) * 0.9, nr - frames(0.004))


def make_downer(n, p):
    k, w = TONES[p["tone"]], WEIGHTS[p["weight"]]
    t = np.linspace(0, 1, n)
    tc = t ** float(p["curve"])
    centre = float(p["start"]) * k * (float(p["end"]) / float(p["start"])) ** tc
    noise = band_noise(rng_for(p, 1), n, centre, 0.7, float(p["resonance"]))
    ton = np.zeros(n)
    v = max(1, min(6, int(p["voices"])))
    r = rng_for(p, 2)
    for i in range(v):
        cents = (i - (v - 1) / 2) * float(p["detune"])
        f = float(p["high"]) * k ** 0.5 * (float(p["low"]) / float(p["high"])) ** tc * 2 ** (cents / 1200) * (1 + i % 2)
        ton += tones(f, harmonics=4, rolloff=1.8, phase0=r.uniform(0, 6.28)) / v
    ton = ton / (np.sqrt(np.mean(ton ** 2)) + 1e-12)
    y = (1 - 0.6 * float(p["tonal"])) * noise + float(p["tonal"]) * ton
    if p["attack"] == "hit":
        env = (1 - t) ** 1.6
        hp = part(p, "impact", style="thud" if w == 0 else "boom")
        hit = np.zeros(n)
        place(hit, norm(make_impact(min(n, frames(0.8)), hp)), 0)
        return norm(y * env) * 0.7 + hit
    env = hump(n, 0.12, 1.0, 1.4)
    return y * env


def make_reverse(n, p):
    """A tail (noise and a chord through a decaying 'room'), played backwards: it swells and stops sharp."""
    k, w = TONES[p["tone"]], WEIGHTS[p["weight"]]
    nh = min(frames(float(p["hit"])), n // 2) if p["ending"] == "hit" else 0
    ns = n - nh
    t = np.arange(ns) / SR
    span = max(0.1, float(p["space"]) * ns / SR)
    out = []
    for ch in range(2):
        r = rng_for(p, 10 + ch)
        decay = np.exp(-t / (span / 5.5))
        src = band_noise(r, ns, float(p["centre"]) * k * (1 - 0.5 * (1 - decay)), 1.4, 0.0) * decay
        if float(p["tonal"]) > 0:
            chord = sum(tones(np.full(ns, float(p["note"]) * k ** 0.5 * m * 2 ** (r.uniform(-4, 4) / 1200)), 4, 1.7,
                              r.uniform(0, 6.28)) for m in (1, 1.5, 2, 2.5))
            src = src + float(p["tonal"]) * 0.7 * chord / 4 * np.sqrt(decay) * 1.6
        out.append(src[::-1])
    y = fade(np.stack(out, axis=1), 0.01, 0.006)
    if not nh:
        return y
    full = np.zeros((n, 2))
    place(full, norm(y), 0)
    hp = part(p, "impact", style="boom" if w else "thud")
    hit = norm(make_impact(nh, hp)) * 0.85
    return place(full, np.stack([hit, hit], axis=1), ns - frames(0.003))


def make_impact(n, p):
    k, w = TONES[p["tone"]], WEIGHTS[p["weight"]]
    t = np.arange(n) / SR
    size = (0.7, 1.0, 1.4)[w]                                  # weight: longer, lower, bigger
    sub_end = float(p["sub"]) / size ** 0.4
    f = sub_end * (1 + (float(p["drop"]) - 1) * np.exp(-t / (0.035 * size)))
    sub = np.sin(glide(f)) * np.exp(-t / (float(p["sub_decay"]) * size))
    sub = sub + 0.35 * np.sin(2 * glide(f)) * np.exp(-t / (float(p["sub_decay"]) * size * 0.4))
    body = band_noise(rng_for(p, 1), n, 320 * k, 1.0, 0.8) * np.exp(-t / (0.045 * size))
    body += 0.8 * np.sin(glide(f * 3.1)) * np.exp(-t / (0.06 * size))
    click = band_noise(rng_for(p, 2), n, 4500 * k, 1.3) * np.exp(-t / 0.0025)
    td = float(p["tail_decay"]) * size
    # the crack: a burst of broadband noise whose top closes quickly, like the air pushed by the hit
    crack = band_noise(rng_for(p, 3), n, 150 + 2800 * k * np.exp(-t / (0.06 * size)), 2.0, 0.0, -0.2)
    crack = crack * (1 - np.exp(-t / 0.0015)) * np.exp(-t / (0.12 * size))
    dry = (1.0 + 0.3 * w) * sub + float(p["body"]) * 0.6 * body + float(p["click"]) * 0.5 * click + float(p["crack"]) * 0.5 * crack
    # the tail: the hit heard in a large space (a decaying, darkening noise response), so it rings out like a film hit
    L = min(n, frames(6 * td))
    tl = np.arange(L) / SR
    ir = band_noise(rng_for(p, 5), L, 250 + 5000 * k * np.exp(-tl / (0.5 * td)), 2.2, 0.0, -0.3) * np.exp(-tl / td)
    ir *= 1 - np.exp(-tl / 0.004)
    wet = fftconvolve(dry, ir)[:n]
    wet = wet / (np.max(np.abs(wet)) + 1e-12) * np.max(np.abs(dry))
    y = dry + float(p["tail"]) * 0.8 * wet
    if float(p["ring"]) > 0:
        r = rng_for(p, 4)
        base = 520 * k * r.uniform(0.85, 1.2)
        ring = np.zeros(n)
        for i, m in enumerate((1.0, 2.756, 5.404, 8.933, 13.34)):  # partials of a struck bar
            fm = base * m * r.uniform(0.99, 1.01)
            if fm > 16000:
                break
            ring += np.sin(2 * np.pi * fm * t + r.uniform(0, 6.28)) * np.exp(-t / ((1.1 * size) / (1 + 0.8 * i))) / (1 + 0.5 * i)
        y = y + float(p["ring"]) * 0.5 * ring
    drive = float(p["drive"])
    if drive > 0:
        g = 1 + 4 * drive
        y = norm(y)
        y = np.tanh(g * y) / np.tanh(g)
    # the hit lands at once (half a millisecond), and its tail is brought gently to rest in the last fifth
    rest = np.clip((t - 0.8 * t[-1]) / (0.2 * t[-1] + 1e-9), 0, 1)
    return fade(y, 0.0005, 0.0) * (0.5 + 0.5 * np.cos(np.pi * rest))


def make_glitch(n, p):
    k, w = TONES[p["tone"]], WEIGHTS[p["weight"]]
    r = rng_for(p, 1)
    src = band_noise(rng_for(p, 2), n, 2500 * k, 1.5, 0.0)
    if float(p["beep"]) > 0:
        steps = np.repeat(r.choice([700, 1000, 1400, 2000, 2800, 4000], size=n // frames(0.02) + 1) * k, frames(0.02))[:n]
        steps = lowpass(steps.astype(float), 60, 2)          # the data tones step, but never click
        src = src + float(p["beep"]) * 2.0 * tones(steps, 7, 1.0)
    if w:
        src = src + w * 0.8 * np.sin(glide(np.full(n, 70.0 * (1 + r.integers(0, 3)))))
    src = src / (np.max(np.abs(src)) + 1e-12)
    rep, cru, chi, gap = (float(p[x]) for x in ("repeat", "crush", "chirps", "gaps"))
    total = rep + cru + chi + gap
    rest = max(0.0, 1 - total)
    probs = np.array([rep, cru, chi, gap, rest]) / max(total + rest, 1e-9)
    y = np.zeros(n)
    i = 0
    edge = frames(0.0006)
    while i < n:
        m = int(np.clip(r.exponential(float(p["slice"])) * SR, frames(0.008), frames(0.2)))
        m = min(m, n - i)
        op = r.choice(5, p=probs)
        seg = src[i:i + m].copy()
        if op == 0 and m > 64:                                 # stutter: one tiny buffer, again and again
            b = int(min(m, r.uniform(0.004, 0.03) * SR))
            start = int(r.integers(0, max(1, n - b)))
            buf = fade(src[start:start + b].copy(), 0.0006, 0.0006)
            seg = np.tile(buf, m // b + 1)[:m]
        elif op == 1 and m > 64:                               # crush: lower the rate (filtered first), fewer bits
            fac = int(np.clip(float(p["rate"]) * r.uniform(0.6, 1.5), 2, 48))
            pad = frames(0.01)
            lo = max(0, i - pad)
            ctx = lowpass(src[lo:i + m], 0.45 * SR / fac, 8)[i - lo:]
            held = np.repeat(ctx[::fac], fac)[:m]
            q = 2 ** (int(np.clip(float(p["bits"]) + r.integers(-1, 2), 2, 16)) - 1)
            seg = np.round(held * q) / q
            seg = lowpass(seg, 12000, 4)
        elif op == 2:                                          # chirp: a fast sine sweep
            f0, f1 = r.uniform(300, 6000) * k, r.uniform(300, 6000) * k
            f = f0 * (f1 / f0) ** np.linspace(0, 1, m)
            seg = 0.8 * np.sin(glide(f))
        elif op == 3:                                          # dropout
            seg = np.zeros(m)
        y[i:i + m] = fade(seg, edge / SR, edge / SR) if m > 2 * edge else 0.0
        i += m
    return y


def make_transition(n, p):
    style, w = p["style"], WEIGHTS[p["weight"]]
    base = {key: p[key] for key in ("seed", "tone", "weight")}
    split = float(np.clip(p["split"], 0.2, 0.92))
    if style in ("whoosh-hit", "rise-hit", "reverse-hit"):
        n1 = int(n * split)
        if style == "whoosh-hit":
            lead = make_whoosh(n1, resolve("whoosh", dict(base, peak=0.9, rise=2.4, fall=1.0, sweep=1.8, doppler=0.2)))
        elif style == "rise-hit":
            lead = make_riser(n1, resolve("riser", dict(base, ending="cut", curve=2.2, pulse=0.2)))
        else:
            lead = make_reverse(n1, resolve("reverse", dict(base, ending="cut"))).mean(axis=1)
        lead = fade(norm(lead), 0.005, 0.004)
        hp = part(p, "impact", style=p["hit_style"])
        hit = norm(make_impact(n - n1 + frames(0.004), hp))
        out = np.zeros(n)
        place(out, lead * 0.75, 0)
        return place(out, hit, n1 - frames(0.004))
    if style == "suck":                                        # a whoosh pulled in, ending sharp
        return fade(make_whoosh(n, resolve("whoosh", dict(base, peak=0.94, rise=3.0, fall=0.6, sweep=2.2,
                                                           doppler=-0.3, resonance=1.0))), 0.003, 0.004)
    if style == "tape-stop":                                   # a held chord, slowing to a halt like a stopped deck
        t = np.arange(n) / SR
        r = rng_for(p, 1)
        root = 220 * TONES[p["tone"]] ** 0.5 * 2 ** (r.integers(0, 7) / 12)
        chord = sum(tones(np.full(n, root * m), 6, 1.4, r.uniform(0, 6.28)) for m in (1, 1.25, 1.5, 2))
        src = norm(chord) + 0.3 * band_noise(rng_for(p, 2), n, 2000, 1.5)
        if w:                                                  # medium and heavy add a beat under it
            kick = np.zeros(n)
            for b in np.arange(0, n / SR, 0.25):
                tt = t[int(b * SR):] - b
                kick[int(b * SR):] += np.sin(glide(48 + 110 * np.exp(-tt / 0.025))) * np.exp(-tt / 0.12)
            src = src + 0.25 * w * norm(kick)
        hold = int(n * (1 - split))                            # split: where the slowing starts
        x = np.linspace(0, 1, n - hold)
        rate = np.concatenate([np.ones(hold), 1 - x])          # the speed (and so the pitch) falls to nothing
        pos = np.cumsum(rate) - rate[0]
        y = np.interp(pos, np.arange(n), src) * np.concatenate([np.ones(hold), (1 - x) ** 0.1])
        return fade(y, 0.01, 0.01)
    if style == "spin":                                        # something turning past the ear
        t = np.linspace(0, 1, n)
        turns = float(p["spins"])
        phase = 2 * np.pi * turns * (t + 0.35 * np.sin(np.pi * t) / np.pi)  # quickest in the middle
        near = 0.5 + 0.5 * np.cos(phase)
        centre = 1100 * TONES[p["tone"]] * 2 ** (0.9 * (near - 0.5))
        y = band_noise(rng_for(p, 1), n, centre, 0.6, 0.8)
        y = y * (0.25 + 0.75 * near ** 1.5) * hump(n, 0.5, 1.6, 1.6)
        return pan_stereo(y, 0.8 * np.sin(phase))
    raise SystemExit(f"transition: unknown style {style!r} (whoosh-hit, rise-hit, reverse-hit, suck, tape-stop, spin)")


CHORDS = {"major": (1, 1.25, 1.5, 2), "sus": (1, 1.335, 1.5, 2), "fifth": (1, 1.5, 2, 3), "add9": (1, 1.25, 1.5, 2.245)}


def make_sting(n, p):
    k = TONES[p["tone"]] ** 0.5
    r = rng_for(p, 1)
    t = np.arange(n) / SR
    nr = int(n * float(np.clip(p["resolve"], 0.1, 0.8)))
    ratios = CHORDS.get(p["chord"], CHORDS["major"])
    root = float(p["note"]) * k
    width = float(p["width"])
    out = np.zeros((n, 2))
    # the shimmer: high chord partials starting one by one, each gliding up a little into tune, a swell of air
    for i in range(int(p["sparkle"])):
        m = ratios[r.integers(0, len(ratios))] * 2 ** r.integers(2, 5)
        f_to = root * m
        if f_to > 12000:
            f_to /= 2
        on = int(r.uniform(0, 0.85) * nr)
        L = n - on
        tt = np.arange(L) / SR
        f = f_to * 2 ** (-(0.6 / 12) * np.exp(-tt / 0.12))
        env = (1 - np.exp(-tt / 0.03)) * np.exp(-tt / r.uniform(0.25, 0.7)) * (0.4 + 0.6 * on / max(nr, 1))
        s = np.sin(glide(f) + r.uniform(0, 6.28)) * env * 0.12
        out[on:] += pan_stereo(s, width * r.uniform(-1, 1))
    air = band_noise(rng_for(p, 2), n, 6000 * k, 1.0) * 0.05 * hump(n, nr / n, 2.0, 6.0)
    out += np.stack([air, np.roll(air, 37)], axis=1)
    # the warm tone: the chord, soft attack, long decay, each side a few cents apart for width
    tr = np.clip(t - nr / SR, 0, None)
    env = np.where(t >= nr / SR, (1 - np.exp(-tr / 0.04)) * np.exp(-tr / max(0.4, (n - nr) / SR * 0.55)), 0.0)
    for j, m in enumerate(ratios):
        for ch, sgn in enumerate((-1, 1)):
            f = np.full(n, root * m * 2 ** (sgn * width * 3 / 1200))
            out[:, ch] += tones(f, 6, 2.0, r.uniform(0, 6.28)) * env * (0.5 if j == 0 else 0.3)
    bell = np.sin(2 * np.pi * root * 4 * t) * np.where(t >= nr / SR, (1 - np.exp(-tr / 0.005)) * np.exp(-tr / 0.35), 0)
    out += 0.08 * np.stack([bell, bell], axis=1)
    tail = np.where(t > 0.75 * t[-1], 0.5 + 0.5 * np.cos(np.pi * (t - 0.75 * t[-1]) / (0.25 * t[-1])), 1.0)
    return out * tail[:, None]


def make_ambience(n, p):
    """Made longer than asked, then the extra end is cross-faded into the start, so the last sample runs straight
    into the first and the file loops with no seam."""
    style, k, w = p["style"], TONES[p["tone"]], WEIGHTS[p["weight"]]
    x = frames(float(p["crossfade"]))
    pre = frames(0.5)                                          # thrown away: lets the filters settle
    m = n + x + pre
    dens = float(p["density"])
    t = np.arange(m) / SR

    def side(ch):
        r = rng_for(p, 100 + ch)
        if style == "room":
            y = band_noise(r, m, 300 * k, 2.2, 0.0, -0.4, top=9000 * k) * 0.6
            y += 0.08 * (np.sin(2 * np.pi * float(p["hum"]) * t) + 0.5 * np.sin(4 * np.pi * float(p["hum"]) * t))
            y += 0.25 * (0.6 + 0.4 * w) * band_noise(r, m, 70, 0.8)
            return y * (1 + 0.08 * smooth_random(r, m, 0.2))
        if style == "aircon":
            fan = band_noise(r, m, 450 * k, 1.8, 0.4, -0.2, top=10000 * k)
            blade = 1 + 0.12 * np.sin(2 * np.pi * 13.5 * t + ch)
            hum = sum(np.sin(2 * np.pi * float(p["hum"]) * h * t * (1 + 0.0004 * h)) / h for h in (1, 2, 3, 4))
            hiss = band_noise(r, m, 3500 * k, 0.9)
            return fan * blade + 0.12 * (0.5 + 0.5 * w) * hum + 0.15 * hiss
        if style == "city":
            rumble = band_noise(r, m, 90, 1.2, 0.0, -0.5) * (1 + 0.25 * smooth_random(r, m, 0.15))
            y = rumble * (0.7 + 0.2 * w)
            cars = int(max(1, dens * m / SR / 4))
            for _ in range(cars):                             # distant cars passing, each a slow low whoosh
                c = r.uniform(0, m / SR)
                d = r.uniform(3, 7)
                bump = np.exp(-0.5 * ((t - c) / (d / 4)) ** 2)
                if bump.max() < 1e-3:
                    continue
                y += 0.5 * r.uniform(0.4, 1) * bump * band_noise(r, m, 300 * k * (1.3 - 0.6 * np.tanh((t - c) / d)), 1.0)
            return lowpass(y, 2500 * k, 2)
        if style == "wind":
            centre = 450 * k * 2 ** (0.9 * smooth_random(r, m, 0.25 * dens))
            gust = np.clip(0.55 + 0.6 * smooth_random(r, m, 0.2 * dens), 0.08, None)
            y = band_noise(r, m, centre, 0.9, 0.5) * gust
            return y + 0.3 * band_noise(r, m, 120, 1.0) * (0.3 + 0.35 * w)
        if style == "rain":
            hiss = band_noise(r, m, 4000 * k, 1.5) * 0.5
            drops = np.zeros(m)
            count = int(250 * dens * m / SR)
            pos = r.integers(0, m, count)
            np.add.at(drops, pos, r.uniform(-1, 1, count) * r.uniform(0.2, 1, count) ** 3)
            drops = sosfilt(butter(2, [1500 * k, min(11000 * k, 18000)], "bandpass", fs=SR, output="sos"), drops) * 6
            big = np.zeros(m)
            for c in r.integers(0, m - frames(0.05), int(4 * dens * m / SR)):
                L = frames(0.04)
                tt = np.arange(L) / SR
                fq = r.uniform(1500, 4500) * k
                big[c:c + L] += np.sin(2 * np.pi * fq * tt * (1 + 2 * tt)) * np.exp(-tt / 0.006) * r.uniform(0.2, 0.6)
            return hiss + drops + 0.5 * big + 0.2 * band_noise(r, m, 200, 1.0) * (0.5 + 0.5 * w)
        raise SystemExit(f"ambience: unknown style {style!r} (room, aircon, city, wind, rain)")

    a, b = side(0), side(1)
    width = float(np.clip(p["width"], 0, 1))
    mid = 0.5 * (a + b)
    y = np.stack([mid + width * (a - mid), mid + width * (b - mid)], axis=1)
    y = highpass(y, 20)[pre:]
    out = y[:n].copy()
    ramp = np.linspace(0, 1, x, endpoint=False)[:, None]
    # equal-power for noise: the join sounds as loud as the rest
    out[:x] = y[:x] * np.sin(0.5 * np.pi * ramp) + y[n:n + x] * np.cos(0.5 * np.pi * ramp)
    return out


MAKERS = {"whoosh": make_whoosh, "swish": make_whoosh, "riser": make_riser, "downer": make_downer,
          "reverse": make_reverse, "impact": make_impact, "glitch": make_glitch, "transition": make_transition,
          "sting": make_sting, "ambience": make_ambience}


# ----------------------------------------------------------------------------------------------------------------
# Settings in, sound out

def coerce(v):
    if isinstance(v, (int, float)) or v is None:
        return v
    s = str(v)
    try:
        return int(s)
    except ValueError:
        pass
    try:
        return float(s)
    except ValueError:
        return s


def resolve(kind, given):
    """Every setting the kind takes, filled in: what was given, then the style's values, then the defaults.
    The result is the recipe: rendering it again gives the same samples."""
    if kind not in KINDS:
        raise SystemExit(f"unknown kind {kind!r}. Kinds: {', '.join(KINDS)}")
    spec, secs, _ = KINDS[kind]
    allowed = dict(COMMON, **spec)
    extra = [key for key in given if key not in allowed and key != "kind"]
    if extra:
        raise SystemExit(f"{kind}: unknown setting(s) {', '.join(extra)}. It takes: {', '.join(allowed)}")
    p = {"kind": kind}
    for key, (default, _) in allowed.items():
        p[key] = coerce(given[key]) if given.get(key) is not None else default
    if p["seconds"] is None:
        p["seconds"] = secs
    p["seconds"] = float(p["seconds"])
    p["seed"] = int(p["seed"])
    if p["tone"] not in TONES or p["weight"] not in WEIGHTS:
        raise SystemExit("tone is dark|neutral|bright, weight is light|medium|heavy")
    styles = {"impact": IMPACT_STYLES, "glitch": GLITCH_STYLES}.get(kind)
    if styles:
        if p["style"] not in styles:
            raise SystemExit(f"{kind}: style is one of {', '.join(styles)}")
        for key, v in styles[p["style"]].items():
            if p.get(key) is None:
                p[key] = v
    return p


def render(kind, given=None, **kw):
    """The finished samples (float32; mono, or n x 2), and the recipe that makes them."""
    p = resolve(kind, dict(given or {}, **kw))
    n = frames(p["seconds"])
    y = np.asarray(MAKERS[kind](n, p), dtype=float)
    if len(y) != n:
        raise RuntimeError(f"{kind}: made {len(y)} samples, wanted {n}")
    if kind != "ambience":                                     # ambience was high-passed and must not be faded
        y = highpass(y, 20)
        y = y - np.mean(y, axis=0)
        y = fade(y, 0.0005 if kind == "impact" else 0.003, 0.005)   # an impact lands at once: half a millisecond
    y = y / (np.max(np.abs(y)) + 1e-12) * PEAK
    return y.astype(np.float32), p


def write_wav(path, y):
    """A plain 32-bit float WAV with nothing else in it (soundfile adds a PEAK chunk with the time of writing, so two
    writes of the same samples would differ; this one is the same file every time)."""
    y = np.asarray(y, dtype="<f4")
    ch = 1 if y.ndim == 1 else y.shape[1]
    data = y.tobytes()
    fmt = struct.pack("<HHIIHH", 3, ch, SR, SR * ch * 4, ch * 4, 32)
    with open(path, "wb") as f:
        f.write(b"RIFF" + struct.pack("<I", 4 + 8 + len(fmt) + 8 + len(data)) + b"WAVE")
        f.write(b"fmt " + struct.pack("<I", len(fmt)) + fmt)
        f.write(b"data" + struct.pack("<I", len(data)) + data)


def write(kind, out, given=None):
    y, p = render(kind, given)
    os.makedirs(os.path.dirname(os.path.abspath(out)) or ".", exist_ok=True)
    result = {"recipe": p}
    if out.lower().endswith(".mp3"):
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from level import make
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            wav = os.path.join(tmp, "render.wav")
            write_wav(wav, y)
            m = make(wav, out, peak=-3.0, mono=kind not in STEREO_KINDS, trim=kind not in UNTRIMMED_KINDS)
        result["measure"] = m
        result["channels"] = 2 if kind in STEREO_KINDS else 1
    else:
        write_wav(out, y)
        result["channels"] = 1 if y.ndim == 1 else 2
    print(json.dumps(result))
    return result


def load_recipe(path, sound_id=None):
    data = json.load(open(path))
    if "sounds" in data:
        if not sound_id:
            raise SystemExit("this is a whole index.json: say which sound with --id <group/name>")
        hits = [s for s in data["sounds"] if s.get("id") == sound_id]
        if not hits:
            raise SystemExit(f"no sound {sound_id!r} in {path}")
        data = hits[0]
    recipe = data.get("recipe", data)
    if "kind" not in recipe:
        raise SystemExit("the recipe has no 'kind'")
    return recipe


def print_list():
    for kind, (spec, secs, about) in KINDS.items():
        print(f"{kind}  ({secs:g} s by default): {about}")
        for key, (default, what) in dict(COMMON, **spec).items():
            if key == "seconds":
                continue
            d = "" if default is None else f" [{default}]"
            print(f"    --{key}{d}  {what}")
        if kind == "impact":
            print("    styles fill the empty settings: " + "; ".join(f"{s}: " + ", ".join(f"{a}={b}" for a, b in v.items())
                                                            for s, v in IMPACT_STYLES.items()))
        if kind == "glitch":
            print("    styles fill the empty settings: " + "; ".join(f"{s}: " + ", ".join(f"{a}={b}" for a, b in v.items())
                                                            for s, v in GLITCH_STYLES.items()))
        print()


def parse_flags(args):
    given, pos, i = {}, [], 0
    while i < len(args):
        a = args[i]
        if a.startswith("--"):
            if i + 1 >= len(args):
                raise SystemExit(f"{a} needs a value")
            given[a[2:].replace("-", "_")] = args[i + 1]
            i += 2
        else:
            pos.append(a)
            i += 1
    return given, pos


def main(argv):
    if not argv or argv[0] in ("-h", "--help", "help"):
        sys.exit(__doc__)
    if argv[0] == "list":
        return print_list()
    if argv[0] == "recipe":
        given, pos = parse_flags(argv[1:])
        if len(pos) != 2:
            sys.exit("usage: synth.py recipe <recipe.json> <out.wav|out.mp3> [--id group/name]")
        recipe = load_recipe(pos[0], given.get("id"))
        return write(recipe["kind"], pos[1], {k: v for k, v in recipe.items() if k != "kind"})
    kind = argv[0]
    given, pos = parse_flags(argv[1:])
    if len(pos) != 1:
        sys.exit(__doc__)
    write(kind, pos[0], given)


if __name__ == "__main__":
    main(sys.argv[1:])
