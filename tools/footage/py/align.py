"""Snap word edges to the real sound (FOOTAGE-PLAN.md section 3, "Transcribe").

Transcribers place words to within a few hundred milliseconds. Cuts happen at pauses, so every word edge next to a
pause is moved onto where the sound really starts or stops. Words inside continuous speech keep the transcriber's
times (there is no pause there to find).

    python align.py <sound.wav> <words.json in> <words.json out>

The speech band (200-4000 Hz) is measured every 10 ms. A pause is at least 120 ms below the quiet threshold
(the noise floor plus a quarter of the way to the speech level, at least 6 dB above the floor). An edge moves only
to a pause edge within 350 ms of it, and only when that pause lies between the word and its neighbour.
Writes each word's "snapped" ("start", "end", "both" or absent) and a summary.
"""
import json
import subprocess
import sys

import numpy as np
from scipy.signal import butter, sosfilt

HOP = 0.01
MIN_PAUSE = 0.12
WINDOW = 0.35
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '.'))
from _ff import FFMPEG, FFPROBE  # noqa: E402


def load(path, rate=16000):
    raw = subprocess.run([FFMPEG, '-v', 'error', '-i', path, '-ac', '1', '-ar', str(rate), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32), rate


def envelope(x, rate):
    sos = butter(4, [200, 4000], btype='bandpass', fs=rate, output='sos')
    y = sosfilt(sos, x)
    hop = int(rate * HOP)
    n = len(y) // hop
    frames = y[: n * hop].reshape(n, hop)
    return 10 * np.log10(np.mean(frames ** 2, axis=1) + 1e-12)


def pauses(db):
    floor = np.percentile(db, 10)
    speech = np.percentile(db, 95)
    thr = floor + max(6.0, 0.25 * (speech - floor))
    quiet = db < thr
    out = []
    i = 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]:
                j += 1
            if (j - i) * HOP >= MIN_PAUSE or i == 0 or j == len(quiet):
                a, b = refine(db, i, j)
                out.append((a * HOP, b * HOP))
            i = j
        else:
            i += 1
    return out, {'floor_db': round(float(floor), 1), 'speech_db': round(float(speech), 1), 'threshold_db': round(float(thr), 1)}


def refine(db, i, j):
    """Move a pause's edges in until the sound is down at the pause's own background level (noise, room, music).

    A word's tail fades below the quiet threshold before it ends, and an onset can start below it. The background
    is the pause's median level; an edge moves while the sound is more than 3 dB above it, at most 150 ms at the
    start of the pause (tails are long) and 60 ms at its end (onsets are sharp)."""
    if j - i < 3:
        return i, j
    bg = float(np.median(db[i:j]))
    a = i
    while a < j - 1 and a - i < 15 and db[a] > bg + 3:
        a += 1
    b = j
    while b > a + 1 and j - b < 6 and db[b - 1] > bg + 3:
        b -= 1
    return a, b


def split_swallowed(words, ps):
    """A word cannot hold a whole pause. Transcribers often stretch a sentence's last word across the pause after it
    (its end set to the next word's start); such a word ends where the pause begins."""
    for w in words:
        for a, b in ps:
            if b - a >= 0.2 and w['start'] + 0.04 < a and b <= w['end'] + 0.05:
                w['end'] = round(a, 3)
                break
    return words


def snap(words, ps):
    split_swallowed(words, ps)
    for k, w in enumerate(words):
        prev_end = words[k - 1]['end'] if k else 0.0
        next_start = words[k + 1]['start'] if k + 1 < len(words) else float('inf')
        moved = []
        # Start: the end of a pause that sits between the previous word and this one.
        best = None
        for a, b in ps:
            if abs(b - w['start']) <= WINDOW and a <= w['start'] + WINDOW and b < w['end'] and a >= prev_end - WINDOW:
                if best is None or abs(b - w['start']) < abs(best - w['start']):
                    best = b
        if best is not None and best > prev_end - 1e-9:
            w['start'] = round(best, 3)
            moved.append('start')
        # End: the start of a pause that sits between this word and the next.
        best = None
        for a, b in ps:
            if abs(a - w['end']) <= WINDOW and a > w['start'] and b >= w['end'] - WINDOW and a <= next_start + WINDOW:
                if best is None or abs(a - w['end']) < abs(best - w['end']):
                    best = a
        if best is not None:
            w['end'] = round(min(best, next_start) if next_start > w['start'] else best, 3)
            moved.append('end')
        if moved:
            w['snapped'] = 'both' if len(moved) == 2 else moved[0]
    # Keep the words in order and never empty.
    for k, w in enumerate(words):
        if k and w['start'] < words[k - 1]['end']:
            w['start'] = words[k - 1]['end']
        if w['end'] <= w['start']:
            w['end'] = round(w['start'] + 0.04, 3)
    return words


def main():
    sound, src, dst = sys.argv[1:4]
    data = json.load(open(src))
    x, rate = load(sound)
    db = envelope(x, rate)
    ps, levels = pauses(db)
    data['words'] = snap(data['words'], ps)
    edges = sum(2 if w.get('snapped') == 'both' else 1 for w in data['words'] if w.get('snapped'))
    data['alignment'] = {'pauses': len(ps), 'edges_snapped': edges, **levels}
    json.dump(data, open(dst, 'w'), indent=1)
    print(json.dumps(data['alignment']))


if __name__ == '__main__':
    main()
