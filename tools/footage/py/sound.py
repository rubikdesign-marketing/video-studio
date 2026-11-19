"""Sound quality (FOOTAGE-PLAN.md section 3, "Sound quality"; the repairs come in phase 3).

    python sound.py <sound.wav> <quality.json> [--words words.json]

Measures, on the clip's own sound (48 kHz, all channels mixed for measuring):
  level, peak        per second, dBFS
  noise floor        the quiet between words (dBFS), and how far the voice stands above it (clarity, dB)
  clipping           runs of samples at full scale, per second
  clicks             single sharp spikes far above the sound around them, with their times
  hum                mains hum at 50 or 60 Hz and its overtones, with its level against the voice
  rumble and wind    low sound under 80 Hz in the pauses (hum excluded): steady is rumble, gusty is wind
  echo               how slowly the room dies away after a word (an estimate of the room's reverberation)
  music under speech a tonal sound (notes, not noise) in the pauses between words
The speech-quality score (DNSMOS) arrives with the repairs in phase 3. Writes the "sound" part of quality.json.
Thresholds are starting points set on the synthetic test clips; they are tuned on the owner's real clips.
"""
import json
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # run with -I: the helper beside this file
from report import update  # noqa: E402
from scipy.signal import butter, medfilt, sosfilt, welch

import os as _os, sys as _sys
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '.'))
from _ff import FFMPEG, FFPROBE  # noqa: E402
RATE = 48000

CLARITY_LOW = 20      # voice less than this many dB above the noise: noisy
HUM_DB = 12           # a hum overtone this far above its neighbours: hum
LOW_SHARE = 0.4       # share of the pauses' energy below 80 Hz above this (and loud enough): rumble or wind
ECHO_RT = 0.6         # estimated reverberation above this (seconds): echoey
TONAL = 0.12          # spectral flatness of the pauses below this: tonal (music)


def load(path):
    """All channels, as an array of shape (samples, channels)."""
    ch = int(subprocess.run([FFPROBE, '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=channels', '-of', 'csv=p=0', path], capture_output=True, text=True, check=True).stdout.strip() or 1)
    raw = subprocess.run([FFMPEG, '-v', 'error', '-i', path, '-ar', str(RATE), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).copy()


def db(v):
    return float(10 * np.log10(v + 1e-12))


def frame_db(x, hop):
    n = len(x) // hop
    f = x[: n * hop].reshape(n, hop)
    return 10 * np.log10(np.mean(f ** 2, axis=1) + 1e-12)


def clipping(x):
    """Runs of at least 2 samples at or above 95% of full scale (a flattened peak), as times."""
    hot = np.abs(x) >= 0.95
    if not hot.any():
        return []
    edges = np.diff(np.concatenate([[0], hot.astype(np.int8), [0]]))
    starts, ends = np.where(edges == 1)[0], np.where(edges == -1)[0]
    return [float(s / RATE) for s, e in zip(starts, ends) if e - s >= 2]


def clicks(x):
    """Single sharp spikes: a sample that jumps far above the jumps around it (15 times the 20 ms average), stands out
    from a 9-sample median of its neighbours, and is at least four times taller than the sound's own loudness there.
    Speech, even a hard "p" or "t", does none of these at once."""
    win = int(RATE * 0.02)
    k = np.ones(win) / win
    d = np.abs(np.diff(x, prepend=x[:1]))
    r = np.abs(x - medfilt(x, 9))
    rms = np.sqrt(np.convolve(x ** 2, k, mode='same'))
    cand = np.where((d > 15 * (np.convolve(d, k, mode='same') + 1e-5)) & (r > 0.05) & (r > 4 * rms))[0]
    out = []
    for c in cand:
        t = float(c / RATE)
        if not out or t - out[-1] > 0.05:
            out.append(round(t, 3))
    return out


def hum(x):
    """Mains hum, measured in the pauses when there are enough of them (a low voice has notes near 100 Hz)."""
    if len(x) < RATE:
        return None
    f, p = welch(x, RATE, nperseg=RATE)  # 1 Hz bins
    pdb = 10 * np.log10(p + 1e-20)
    best = None
    for base in (50, 60):
        rises = []
        for h in (1, 2, 3, 4):
            fr = base * h
            peak = pdb[fr - 1:fr + 2].max()
            around = np.concatenate([pdb[fr - 15:fr - 4], pdb[fr + 5:fr + 16]])
            rises.append(float(peak - np.median(around)))
        strong = [r for r in rises if r >= HUM_DB]
        # A steady, narrow peak at the mains frequency is hum (a voice never holds one); small microphones can lose
        # the fundamental, so two strong overtones also count.
        if (rises[0] >= HUM_DB or len(strong) >= 2) and (best is None or sum(rises) > sum(best[1])):
            best = (base, rises)
    if not best:
        return None
    base = best[0]
    band = sum(p[base * h - 1:base * h + 2].sum() for h in (1, 2, 3, 4))
    return {'base_hz': base, 'overtones_db_above_surroundings': [round(r, 1) for r in best[1]], 'level_db': round(db(band), 1)}


def low_share(x, hum_base, spans):
    """In the pauses (so the voice's own low notes do not count): share of energy below 80 Hz, hum overtones removed,
    its level, and how gusty it is (spread of its level over 100 ms steps)."""
    out = []
    for a, b in spans:
        seg = x[int(a * RATE):int(b * RATE)]
        if len(seg) < RATE // 4:
            continue
        f, p = welch(seg, RATE, nperseg=min(len(seg), 9600))
        keep = np.ones_like(f, bool)
        if hum_base:
            for h in range(1, 5):
                keep &= np.abs(f - hum_base * h) > 6
        df = f[1] - f[0]
        low = p[(f >= 20) & (f < 80) & keep].sum()
        total = p[(f >= 20) & keep].sum() + 1e-20
        lp = sosfilt(butter(4, 80, 'lowpass', fs=RATE, output='sos'), seg)
        e = frame_db(lp, RATE // 10)
        out.append({'from': a, 'to': b, 'share': float(low / total), 'level': db(low * df), 'gusty': float(np.std(e)) if len(e) > 2 else 0.0})
    return out


def pauses_from(words, total):
    if not words:
        return []
    gaps = [(0.0, words[0]['start'])] + [(a['end'], b['start']) for a, b in zip(words, words[1:])] + [(words[-1]['end'], total)]
    return [(a + 0.05, b - 0.05) for a, b in gaps if b - a >= 0.3]


def echo(x, words):
    """How long the room rings: the reverberation time (RT60), from the slope of the slow tail after a sentence.
    For each pause of 0.4 s or more: from the last syllable (the last moment within 10 dB of the loudest, searched from
    0.6 s before the pause, since the word edges include the tail), skip the first 30 ms (the voice itself stopping), then fit a line to the
    level while it is between 10 dB under the peak and 6 dB over the background, counted only when it falls in a
    nearly straight line (R² 0.75 or more). RT60 = 60 dB / the slope.
    Returns the median over the pauses, or None when there are none to measure."""
    if not words:
        return None
    env = frame_db(sosfilt(butter(4, [200, 4000], 'bandpass', fs=RATE, output='sos'), x), RATE // 100)
    floor_all = float(np.percentile(env, 10))
    rts = []
    for a, b in zip(words, words[1:] + [None]):
        gap_end = b['start'] if b else len(x) / RATE
        if gap_end - a['end'] < 0.4:
            continue
        lo = max(0, int((a['end'] - 0.6) * 100)); hi = int(a['end'] * 100); end = min(len(env), int(gap_end * 100))
        if hi <= lo or end - hi < 10:
            continue
        win = env[lo:hi + 1]
        p = lo + int(np.where(win >= win.max() - 10)[0][-1])  # the last syllable: the last moment near the loudest
        top = env[p]
        tail = env[p + 3:end]
        floor = max(floor_all, float(np.percentile(env[max(p, end - 15):end], 50)))
        if top - floor < 25:
            continue
        t = np.arange(len(tail)) / 100
        use = (tail <= top - 10) & (tail >= floor + 6)
        # Only the first continuous stretch: the next word must not count as the room.
        idx = np.where(use)[0]
        if len(idx) < 8:
            continue
        run = [idx[0]]
        for i in idx[1:]:
            if i - run[-1] <= 2:
                run.append(i)
            else:
                break
        if len(run) < 8:
            continue
        slope, icpt = np.polyfit(t[run], tail[run], 1)
        fit = slope * t[run] + icpt
        r2 = 1 - np.sum((tail[run] - fit) ** 2) / (np.sum((tail[run] - tail[run].mean()) ** 2) + 1e-9)
        # A room's ring falls in a nearly straight line (in dB); a wobbling plateau (bleed, noise, a breath) does not.
        if slope < -5 and r2 >= 0.75:
            rts.append(min(5.0, -60.0 / slope))
    return round(float(np.median(rts)), 2) if rts else None


def flatness(seg):
    f, p = welch(seg, RATE, nperseg=4096)
    band = p[(f >= 200) & (f <= 4000)] + 1e-20
    return float(np.exp(np.mean(np.log(band))) / np.mean(band))


def main():
    src, dst = sys.argv[1:3]
    words = []
    if '--words' in sys.argv:
        wf = sys.argv[sys.argv.index('--words') + 1]
        if os.path.exists(wf):
            words = json.load(open(wf)).get('words', [])
    chans = load(src)
    x = chans.mean(axis=1)  # measuring: the average of the channels (a sum would push peaks over full scale)
    total = len(x) / RATE
    hop = RATE // 20
    fdb = frame_db(x, hop)
    clip_t = sorted({t for c in range(chans.shape[1]) for t in clipping(chans[:, c])})
    click_t = sorted({t for c in range(chans.shape[1]) for t in clicks(chans[:, c])})
    # Distortion makes its own spikes: clicks right next to clipping are part of the clipping.
    click_t = [t for i, t in enumerate(click_t) if not any(abs(t - c) < 0.15 for c in clip_t) and (i == 0 or t - click_t[i - 1] > 0.05)]
    ps = pauses_from(words, total)
    quiet_parts = np.concatenate([x[int(a * RATE):int(b * RATE)] for a, b in ps]) if ps else np.array([])
    hm = hum(quiet_parts if len(quiet_parts) >= RATE else x)
    lows = low_share(x, hm['base_hz'] if hm else None, ps if ps else [(s, s + 1) for s in range(int(total))])
    if ps:
        quiet = np.concatenate([x[int(a * RATE):int(b * RATE)] for a, b in ps])
        floor = db(np.mean(quiet ** 2)) if len(quiet) else float(np.percentile(fdb, 10))
        # Music holds steady through a pause; a room's echo dies away. Only the later part of each pause is used,
        # and only when its level is steady.
        tonal, tonal_level = [], []
        for a, b in ps:
            a2 = a + 0.4 * (b - a)
            seg = x[int(a2 * RATE):int(b * RATE)]
            if len(seg) < RATE // 4:
                continue
            fl = frame_db(seg, RATE // 20)
            if np.std(fl) > 3:
                continue
            tonal.append(flatness(seg))
            tonal_level.append(db(np.mean(seg ** 2)))
    else:
        floor = float(np.percentile(fdb, 10))
        tonal, tonal_level = [], []
    speech = float(np.percentile(fdb, 95))
    rt = echo(x, words)
    seconds = []
    for s in range(int(np.ceil(total))):
        seg = x[s * RATE:(s + 1) * RATE]
        if not len(seg):
            break
        seconds.append({
            't': s,
            'level': round(db(np.mean(seg ** 2)), 1),
            'peak': round(20 * np.log10(np.abs(chans[s * RATE:(s + 1) * RATE]).max() + 1e-9), 1),
            'clipped': sum(1 for t in clip_t if s <= t < s + 1),
            'clicks': sum(1 for t in click_t if s <= t < s + 1),
        })
    flags = []

    def add(what, a, b, detail, value=None):
        flags.append({'what': what, 'from': a, 'to': b, 'detail': detail, 'value': value})

    clipped_secs = [s['t'] for s in seconds if s['clipped'] >= 3]
    for t in clipped_secs:
        if flags and flags[-1]['what'] == 'clipping' and flags[-1]['to'] == t:
            flags[-1]['to'] = t + 1
        else:
            add('clipping', t, t + 1, 'the voice hit full scale and was flattened (distortion)')
    if click_t:
        add('clicks', min(click_t), max(click_t) + 0.05, f'{len(click_t)} sharp click{"s" if len(click_t) > 1 else ""} at ' + ', '.join(f'{t:.2f} s' for t in click_t[:8]), len(click_t))
    clarity = speech - floor
    if words and clarity < CLARITY_LOW:
        add('noisy', 0, total, f'the voice is only {clarity:.0f} dB above the background (clean recordings are 30 dB or more)', round(clarity, 1))
    if hm:
        add('hum', 0, total, f'mains hum at {hm["base_hz"]} Hz with overtones', hm['level_db'])
    loud_low = [l for l in lows if l['share'] > LOW_SHARE and l['level'] > -50]
    if lows and len(loud_low) >= max(1, len(lows) // 2):
        gusty = np.median([l['gusty'] for l in loud_low]) > 6
        add('wind' if gusty else 'rumble', 0, total, 'gusts of low sound (wind on the microphone)' if gusty else 'a steady low rumble under the voice (traffic, air conditioning, handling)', round(float(np.median([l['share'] for l in loud_low])), 2))
    if rt is not None and rt > ECHO_RT:
        add('echo', 0, total, f'the room rings for about {rt:.1f} s after each sentence', rt)
    if tonal and np.median(tonal) < TONAL and np.median(tonal_level) > -55:
        add('music under speech', 0, total, 'a tonal sound (most likely music) continues in the pauses between words; its rights must be checked', round(float(np.median(tonal)), 3))
    part = {
        'seconds': seconds, 'flags': flags,
        'summary': {'noise_floor_db': round(floor, 1), 'voice_db': round(speech, 1), 'clarity_db': round(clarity, 1) if words else None,
                    'hum': hm, 'echo_rt60_s': rt, 'pause_flatness': round(float(np.median(tonal)), 3) if tonal else None,
                    'clipped_runs': len(clip_t), 'clicks': click_t, 'measured_from_pauses': bool(ps)},
        'not_yet': 'speech-quality score (DNSMOS) arrives with the repairs in phase 3',
        'thresholds': {'clarity_low_db': CLARITY_LOW, 'hum_db': HUM_DB, 'low_share': LOW_SHARE, 'echo_rt60_s': ECHO_RT, 'tonal_flatness': TONAL},
    }
    update(dst, 'sound', part)
    print(json.dumps({'summary': part['summary'], 'flags': [(f['what'], f['from'], f['to'], f['value']) for f in flags]}, default=float))


if __name__ == '__main__':
    main()
