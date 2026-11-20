"""Sound repair steps that need more than an ffmpeg filter (FOOTAGE-PLAN.md section 7). Each reads and writes 48 kHz
WAV and prints a JSON line saying what it did, so the recipe (sound.json) records it.

    python repair.py tracks <sound.wav>                      one microphone, or two (left and right are different
                                                             voices): which tracks to make
    python repair.py split <sound.wav> <out_dir>             one WAV per channel (ch1.wav, ch2.wav)
    python repair.py sync <camera.wav> <recorder.wav>        how far the recorder runs ahead of the camera, to the
                                                             sample, with how sure it is
    python repair.py align <recorder.wav> <out.wav> <offset> <seconds>   the recorder on the camera's clock
    python repair.py bleed <track.wav> <other.wav> <out.wav> each microphone's faint pickup of the other voice
                                                             turned down where only the other person speaks
    python repair.py hum <in> <out> <base_hz>                narrow notches on the mains hum and its overtones
    python repair.py lowcut <in> <out> --words words.json [--wind]
                                                             rumble cut set from the voice's own lowest notes
    python repair.py pops <in> <out>                         bursts of air on "p" and "b" softened
    python repair.py echo <in> <out> [--strength 1]          room echo reduced (WPE, nara_wpe)
    python repair.py breaths <in> <out> --words words.json [--db 8]
                                                             breaths between phrases lowered, never removed
    python repair.py tone <reference.wav> <in.wav> --ref-words a.json --words b.json
                                                             the EQ that matches this voice's tone to the reference
    python repair.py floor <in> --words words.json           the background level in the pauses (dBFS)
    python repair.py sibilance <in> --words words.json       how harsh the "s" sounds are (dB)
    python repair.py spread <in> --words words.json          how much the level jumps between sentences (dB)
"""
import json
import subprocess
import sys

import numpy as np
from scipy.signal import butter, fftconvolve, iirnotch, sosfiltfilt, filtfilt, welch

import os as _os, sys as _sys
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '.'))
from _ff import FFMPEG, FFPROBE  # noqa: E402
RATE = 48000


def load(path, ch=None):
    probe = subprocess.run([FFPROBE, '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=channels', '-of', 'csv=p=0', path], capture_output=True, text=True).stdout.strip()
    n = int(probe or 1)
    raw = subprocess.run([FFMPEG, '-v', 'error', '-i', path, '-ar', str(RATE), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).astype(np.float64).reshape(-1, n)
    if ch is None:
        return x.mean(axis=1) if n > 1 else x[:, 0]
    return x[:, ch]


def save(path, x):
    x = np.clip(np.asarray(x, np.float64), -1, 1).astype(np.float32)
    subprocess.run([FFMPEG, '-v', 'error', '-y', '-f', 'f32le', '-ar', str(RATE), '-ac', '1', '-i', '-', '-c:a', 'pcm_s24le', path], input=x.tobytes(), check=True)


def db(v):
    return float(10 * np.log10(v + 1e-20))


def frames_db(x, hop=0.01):
    h = int(RATE * hop)
    n = len(x) // h
    return 10 * np.log10(np.mean(x[: n * h].reshape(n, h) ** 2, axis=1) + 1e-20)


def words_of(path):
    if not path:
        return []
    try:
        with open(path) as f:
            return json.load(f).get('words', [])
    except (OSError, ValueError):
        return []


def speech_mask(words, n, rate=RATE, pad=0.03):
    m = np.zeros(n, bool)
    for w in words:
        a, b = int(max(0, w['start'] - pad) * rate), int(min(n / rate, w['end'] + pad) * rate)
        m[a:b] = True
    return m


def smooth_gain(g_db, hop_s, attack=0.01, release=0.15):
    """A gain curve (one value per hop) that falls fast and recovers slowly, as a sample-rate array."""
    out = np.empty_like(g_db)
    a = np.exp(-hop_s / attack); r = np.exp(-hop_s / release)
    cur = 0.0
    for i, g in enumerate(g_db):
        k = a if g < cur else r
        cur = k * cur + (1 - k) * g
        out[i] = cur
    return out


def expand(curve, hop, n):
    lin = 10 ** (np.repeat(curve, hop) / 20)
    if len(lin) < n:
        lin = np.concatenate([lin, np.full(n - len(lin), lin[-1] if len(lin) else 1.0)])
    return lin[:n]


# ---------------------------------------------------------------- tracks and microphones

def tracks(path):
    probe = subprocess.run([FFPROBE, '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=channels', '-of', 'csv=p=0', path], capture_output=True, text=True).stdout.strip()
    n = int(probe or 1)
    if n < 2:
        return {'kind': 'one microphone', 'tracks': ['main']}
    l, r = load(path, 0), load(path, 1)
    el, er = frames_db(l), frames_db(r)
    active_l, active_r = np.percentile(el, 95) > -50, np.percentile(er, 95) > -50
    if not (active_l and active_r):
        return {'kind': 'one microphone', 'tracks': ['main']}
    corr = float(np.corrcoef(l, r)[0, 1])
    # Where one side is much louder than the other, a different voice is speaking into it.
    diff = el - er
    loud = (np.maximum(el, er) > np.percentile(np.maximum(el, er), 60))
    left_lead = float(np.mean(diff[loud] > 6)); right_lead = float(np.mean(diff[loud] < -6))
    two = corr < 0.6 and left_lead > 0.15 and right_lead > 0.15
    return {'kind': 'two microphones' if two else 'one microphone (stereo)', 'tracks': ['ch1', 'ch2'] if two else ['main'],
            'correlation': round(corr, 3), 'left_leads': round(left_lead, 2), 'right_leads': round(right_lead, 2)}


def assign(ch1, ch2, words_file, out1, out2):
    """Which microphone each word belongs to: the one that is louder for it, once the two mics' levels are evened.
    Writes one words file per track, so each track is measured and scored on its own speaker's words."""
    a, b = load(ch1), load(ch2)
    words = words_of(words_file)
    ea, eb = frames_db(a), frames_db(b)
    off = np.percentile(eb, 95) - np.percentile(ea, 95)
    w1, w2 = [], []
    for w in words:
        s, e = int(w['start'] * 100), max(int(w['start'] * 100) + 1, int(w['end'] * 100))
        la = db(np.mean(10 ** (ea[s:e] / 10))) if e <= len(ea) else -120
        lb = db(np.mean(10 ** (eb[s:e] / 10))) - off if e <= len(eb) else -120
        (w1 if la >= lb else w2).append(w)
    json.dump({'words': w1}, open(out1, 'w')); json.dump({'words': w2}, open(out2, 'w'))
    return {'ch1_words': len(w1), 'ch2_words': len(w2)}


def split(path, out_dir):
    for c in (0, 1):
        save(f'{out_dir}/ch{c + 1}.wav', load(path, c))
    return {'tracks': ['ch1', 'ch2']}


def channels(path):
    probe = subprocess.run([FFPROBE, '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=channels', '-of', 'csv=p=0', path], capture_output=True, text=True).stdout.strip()
    return int(probe or 1)


def sync(camera, recorder):
    """The best of sync_one against each of the camera's channels (one may be another person's microphone)."""
    n = channels(camera)
    results = [sync_one(load(camera, c) if n > 1 else load(camera), load(recorder)) for c in range(n)]
    best = max(results, key=lambda r: r['confidence'])
    if n > 1:
        best['channel'] = int(results.index(best)) + 1
    return best


def sync_one(a, b):
    """Lag (seconds) of the recorder against the camera: how much earlier the recorder started. Coarse on 1 kHz
    envelopes of the speech band, then to the sample on the sound itself."""
    sos = butter(4, [200, 4000], 'bandpass', fs=RATE, output='sos')
    fa, fb = sosfiltfilt(sos, a), sosfiltfilt(sos, b)
    d = 48
    ea = np.sqrt(np.convolve(fa ** 2, np.ones(d) / d, 'same')[::d]); eb = np.sqrt(np.convolve(fb ** 2, np.ones(d) / d, 'same')[::d])
    ea = (ea - ea.mean()) / (ea.std() + 1e-12); eb = (eb - eb.mean()) / (eb.std() + 1e-12)
    xc = fftconvolve(eb, ea[::-1], mode='full')
    lags = np.arange(-len(ea) + 1, len(eb))
    k = int(np.argmax(xc)); peak = xc[k]
    second = np.max(np.concatenate([xc[: max(0, k - 50)], xc[k + 50:]])) if len(xc) > 100 else 0
    coarse = lags[k] * d
    # Fine: the sound itself, around the coarse lag (±5 ms).
    seg = min(len(fa), len(fb) - max(0, coarse), RATE * 20)
    best, best_lag = -np.inf, coarse
    if seg > RATE:
        start = int(np.argmax(np.convolve(fa ** 2, np.ones(RATE), 'valid')[: len(fa) - seg + 1])) if len(fa) > seg else 0
        start = min(start, len(fa) - seg)
        ref = fa[start:start + seg]
        for lag in range(coarse - 240, coarse + 241):
            s = start + lag
            if s < 0 or s + seg > len(fb):
                continue
            v = float(np.dot(ref, fb[s:s + seg]))
            if abs(v) > best:
                best, best_lag, sign = abs(v), lag, np.sign(v)
    norm = float(peak / len(ea))
    return {'lead_seconds': round(best_lag / RATE, 5), 'lead_samples': int(best_lag), 'confidence': round(float(peak / (second + 1e-12)), 2),
            'match': round(norm, 3), 'polarity': 'inverted' if best != -np.inf and sign < 0 else 'same'}


def align(recorder, out, lead, seconds):
    x = load(recorder)
    s = int(round(float(lead) * RATE)); n = int(round(float(seconds) * RATE))
    y = np.zeros(n)
    src = x[max(0, s):]; dst0 = max(0, -s)
    m = min(len(src), n - dst0)
    if m > 0:
        y[dst0:dst0 + m] = src[:m]
    save(out, y)
    return {'aligned': True, 'lead_seconds': float(lead)}


def bleed(track, other, out, reduce_db=15.0):
    """Turn down a microphone where it hears only the other person: where the other mic is more than 6 dB louder
    (after evening their levels), this one drops by reduce_db, falling in 10 ms and recovering over 150 ms."""
    x, o = load(track), load(other)
    n = min(len(x), len(o)); x, o = x[:n], o[:n]
    hop = int(RATE * 0.01)
    ex, eo = frames_db(x), frames_db(o)
    m = min(len(ex), len(eo)); ex, eo = ex[:m], eo[:m]
    off = np.percentile(eo, 95) - np.percentile(ex, 95)  # even out the two mics' levels first
    lead = (eo - off) - ex
    g = np.where(lead > 6, -reduce_db, 0.0)
    gain = expand(smooth_gain(g, 0.01), hop, n)
    save(out, x * gain)
    return {'reduced_db': reduce_db, 'share_reduced': round(float(np.mean(g < 0)), 3)}


# ---------------------------------------------------------------- repairs

def hum(inp, out, base):
    x = load(inp); base = float(base)
    done = []
    for k in range(1, 12):
        f = base * k
        if f > 1000:
            break
        b, a = iirnotch(f, Q=35 if k == 1 else 45, fs=RATE)
        x = filtfilt(b, a, x)
        done.append(round(f))
    save(out, x)
    return {'notches_hz': done}


def voice_low(x, words):
    """The voice's lowest notes: the 10th percentile of its pitch over voiced frames (autocorrelation)."""
    mask = speech_mask(words, len(x)) if words else np.ones(len(x), bool)
    hop, win = int(RATE * 0.02), int(RATE * 0.04)
    f0 = []
    for s in range(0, len(x) - win, hop):
        if not mask[s + win // 2]:
            continue
        seg = x[s:s + win] * np.hanning(win)
        if np.sqrt(np.mean(seg ** 2)) < 0.01:
            continue
        ac = np.correlate(seg, seg, 'full')[win - 1:]
        lo, hi = int(RATE / 400), int(RATE / 60)
        if hi >= len(ac):
            continue
        k = lo + int(np.argmax(ac[lo:hi]))
        if ac[k] > 0.4 * ac[0]:
            f0.append(RATE / k)
    if len(f0) < 10:
        return None
    return float(np.percentile(f0, 10))


def lowcut(inp, out, words_file=None, wind=False):
    x = load(inp)
    low = voice_low(x, words_of(words_file) if words_file else [])
    cut = 80.0 if low is None else float(np.clip(low * 0.75, 60, 110))
    if wind:
        cut = max(cut, 120.0)
    sos = butter(4 if not wind else 6, cut, 'highpass', fs=RATE, output='sos')
    save(out, sosfiltfilt(sos, x))
    return {'cut_hz': round(cut), 'voice_low_hz': None if low is None else round(low), 'wind': wind}


def pops(inp, out, words_file=None):
    """Bursts of air on "p" and "b": low-band energy (under 150 Hz) that jumps more than 12 dB above its surroundings
    for under 80 ms while making up most of the sound, at the start of a word that begins with p or b (from the
    transcript; a low voice starts its other words with low energy too). There, a 150 Hz high-passed copy is faded in."""
    x = load(inp)
    words = words_of(words_file) if words_file else []
    low = sosfiltfilt(butter(4, 150, 'lowpass', fs=RATE, output='sos'), x)
    el, ea = frames_db(low, 0.005), frames_db(x, 0.005)
    base = np.array([np.median(el[max(0, i - 60):i + 60]) for i in range(len(el))])
    hit = (el - base > 12) & (el - ea > -3)
    if words:
        near = np.zeros(len(hit), bool)
        for w in words:
            t = ''.join(ch for ch in w['text'].lower() if ch.isalpha())
            if t[:1] in ('p', 'b'):
                near[max(0, int((w['start'] - 0.06) / 0.005)):int((w['start'] + 0.12) / 0.005)] = True
        hit &= near
    # Only short bursts count.
    found = []
    i = 0
    while i < len(hit):
        if hit[i]:
            j = i
            while j < len(hit) and hit[j]:
                j += 1
            if (j - i) * 0.005 <= 0.08:
                found.append((i, j))
            i = j
        else:
            i += 1
    if not found:
        save(out, x)
        return {'pops': 0}
    hp = sosfiltfilt(butter(4, 150, 'highpass', fs=RATE, output='sos'), x)
    w = np.zeros(len(x))
    h = int(RATE * 0.005)
    for a, b in found:
        w[max(0, a * h - 2 * h): b * h + 4 * h] = 1
    w = np.convolve(w, np.hanning(4 * h) / np.hanning(4 * h).sum(), 'same')
    save(out, x * (1 - w) + hp * w)
    return {'pops': len(found), 'at': [round(a * 0.005, 3) for a, _ in found[:20]]}


def tail_drop(x, words, after=0.25):
    """How far the sound has fallen `after` seconds past each sentence's last syllable (dB, mean over pauses of 0.4 s or
    more): bigger means a shorter, quieter tail."""
    env = frames_db(sosfiltfilt(butter(4, [200, 4000], 'bandpass', fs=RATE, output='sos'), x))
    out = []
    for a, b in zip(words, words[1:] + [None]):
        ge = b['start'] if b else len(x) / RATE
        if ge - a['end'] < 0.4:
            continue
        lo, hi = int((a['end'] - 0.6) * 100), int(a['end'] * 100)
        if lo < 0 or hi >= len(env):
            continue
        win = env[lo:hi + 1]
        p = lo + int(np.where(win >= win.max() - 10)[0][-1])
        k = min(len(env) - 1, p + int(after * 100))
        out.append(env[p] - env[k])
    return round(float(np.mean(out)), 1) if out else None


def echo(inp, out, strength=1.0, words_file=None):
    """Weighted prediction error (nara_wpe): predicts the late reflections from the past and takes them away. Mixed
    with the original by strength (1 = all of it), so the guard can turn it down."""
    from nara_wpe.utils import istft, stft
    from nara_wpe.wpe import wpe
    x = load(inp)
    # 2048-sample frames a 512-sample step apart (about 11 ms), 40 steps of prediction (about 0.43 s) after a 2-step
    # gap: tested 17 Nov on a room ringing 0.8 s, the tail fell 3-14 dB more 0.2-0.3 s after each sentence; shorter
    # predictions (12 steps of 5 ms) changed nothing.
    size, shift = 2048, 512
    Y = stft(x[np.newaxis, :], size=size, shift=shift).transpose(2, 0, 1)
    Z = wpe(Y, taps=40, delay=2, iterations=3, statistics_mode='full').transpose(1, 2, 0)
    z = istft(Z, size=size, shift=shift)[0][: len(x)]
    if len(z) < len(x):
        z = np.concatenate([z, np.zeros(len(x) - len(z))])
    s = float(strength)
    y = s * z + (1 - s) * x
    save(out, y)
    words = words_of(words_file)
    return {'strength': s, 'tail_drop_db': [tail_drop(x, words), tail_drop(y, words)] if words else None}


def breaths(inp, out, words_file, lower_db=8.0):
    """In the pauses between words: stretches of breathy sound (more than 10 dB over the room, noise-like, between
    120 ms and 0.8 s) are lowered by lower_db, with 20 ms ramps. Never removed."""
    x = load(inp); words = words_of(words_file)
    hop = int(RATE * 0.01)
    e = frames_db(x)
    floor = np.percentile(e, 10)
    g = np.zeros(len(e))
    found = 0
    for a, b in zip(words, words[1:]):
        s, t = int((a['end'] + 0.04) / 0.01), int((b['start'] - 0.04) / 0.01)
        if t - s < 12:
            continue
        seg = e[s:t]
        loud = seg > floor + 10
        if loud.sum() < 12 or loud.sum() > 80:
            continue
        chunk = x[s * hop:t * hop]
        f, p = welch(chunk, RATE, nperseg=min(len(chunk), 2048))
        band = p[(f > 300) & (f < 8000)] + 1e-20
        flat = float(np.exp(np.mean(np.log(band))) / np.mean(band))
        if flat < 0.2:
            continue  # tonal: a voice or music, not a breath
        g[s:t][loud] = -float(lower_db)
        found += 1
    gain = expand(smooth_gain(g, 0.01, attack=0.02, release=0.02), hop, len(x))
    save(out, x * gain)
    return {'breaths': found, 'lowered_db': float(lower_db)}


def ltas(x, words):
    """Long-term spectrum of the speech only, on third-octave bands from 100 Hz to 10 kHz (dB)."""
    m = speech_mask(words, len(x)) if words else np.ones(len(x), bool)
    s = x[m] if m.sum() > RATE else x
    f, p = welch(s, RATE, nperseg=4096)
    centres = 100 * 2 ** (np.arange(0, 21) / 3)
    out = []
    for c in centres:
        lo, hi = c / 2 ** (1 / 6), c * 2 ** (1 / 6)
        band = p[(f >= lo) & (f < hi)]
        out.append(db(band.mean()) if len(band) else -120)
    return centres, np.array(out)


def tone(ref, inp, ref_words, words):
    """The EQ (third-octave gains, at most 6 dB either way, the overall level left alone) that brings this voice's
    long-term tone to the reference's. Returned as an ffmpeg firequalizer gain_entry string."""
    xr, xi = load(ref), load(inp)
    fr, fi = voice_low(xr, words_of(ref_words)), voice_low(xi, words_of(words))
    if fr and fi and not (0.85 <= fi / fr <= 1.18):
        return {'same_voice': False, 'voice_low_hz': [round(fr), round(fi)], 'max_change_db': 0}
    c, a = ltas(xr, words_of(ref_words))
    _, b = ltas(xi, words_of(words))
    d = a - b
    d = np.convolve(np.pad(d, 1, mode='edge'), np.ones(3) / 3, 'valid')  # smooth across neighbouring bands
    d -= np.average(d, weights=10 ** (a / 10) / np.sum(10 ** (a / 10)))  # keep the loudness where the voice lives
    d = np.clip(d, -6, 6)
    entry = ';'.join(f'entry({int(round(f))},{g:.2f})' for f, g in zip(c, d))
    return {'same_voice': True, 'gain_entry': entry, 'max_change_db': round(float(np.max(np.abs(d))), 2), 'bands_db': [round(float(v), 2) for v in d]}


def sibilance(inp, words_file):
    """How harsh the "s" sounds are: the loudest moments of the 5-9 kHz band against the voice's 1-4 kHz body, in
    the speech only (dB). Clean speech sits around -1 to +2 dB; above +4 dB, a de-esser helps."""
    x = load(inp); words = words_of(words_file)
    m = speech_mask(words, len(x)) if words else np.ones(len(x), bool)
    s = x[m] if m.sum() > RATE else x
    hi = sosfiltfilt(butter(4, [5000, 9000], 'bandpass', fs=RATE, output='sos'), s)
    mid = sosfiltfilt(butter(4, [1000, 4000], 'bandpass', fs=RATE, output='sos'), s)
    eh, em = frames_db(hi, 0.01), frames_db(mid, 0.01)
    return {'sibilance_db': round(float(np.percentile(eh, 98) - np.percentile(em, 90)), 1)}


def floor(inp, words_file):
    x = load(inp); words = words_of(words_file)
    m = ~speech_mask(words, len(x), pad=0.08) if words else np.ones(len(x), bool)
    q = x[m] if m.sum() > RATE // 10 else x
    # The typical level of 50 ms stretches between words (the median), so a few loud moments at word edges do not
    # count as the room. Digital silence reads as -120.
    return {'floor_dbfs': round(max(-120.0, float(np.median(frames_db(q, 0.05)))), 1)}


def spread(inp, words_file):
    x = load(inp); words = words_of(words_file)
    if not words:
        return {'spread_db': 0}
    sents, cur = [], [words[0]]
    for a, b in zip(words, words[1:]):
        if b['start'] - a['end'] > 0.5 or a['text'].rstrip().endswith(('.', '?', '!')):
            sents.append(cur); cur = []
        cur.append(b)
    sents.append(cur)
    lv = []
    for s in sents:
        seg = x[int(s[0]['start'] * RATE):int(s[-1]['end'] * RATE)]
        if len(seg) > RATE // 4:
            lv.append(db(np.mean(seg ** 2)))
    return {'spread_db': round(float(np.percentile(lv, 90) - np.percentile(lv, 10)), 1) if len(lv) >= 2 else 0, 'sentences': len(lv)}


def main():
    cmd, args = sys.argv[1], sys.argv[2:]
    opt = lambda k, d=None: args[args.index(k) + 1] if k in args else d
    pos = [a for i, a in enumerate(args) if not a.startswith('--') and not (i > 0 and args[i - 1].startswith('--') and args[i - 1] not in ('--wind',))]
    if cmd == 'tracks': r = tracks(pos[0])
    elif cmd == 'assign': r = assign(pos[0], pos[1], pos[2], pos[3], pos[4])
    elif cmd == 'split': r = split(pos[0], pos[1])
    elif cmd == 'sync': r = sync(pos[0], pos[1])
    elif cmd == 'align': r = align(pos[0], pos[1], pos[2], pos[3])
    elif cmd == 'bleed': r = bleed(pos[0], pos[1], pos[2])
    elif cmd == 'hum': r = hum(pos[0], pos[1], pos[2])
    elif cmd == 'lowcut': r = lowcut(pos[0], pos[1], opt('--words'), '--wind' in args)
    elif cmd == 'pops': r = pops(pos[0], pos[1], opt('--words'))
    elif cmd == 'echo': r = echo(pos[0], pos[1], opt('--strength', 1.0), opt('--words'))
    elif cmd == 'breaths': r = breaths(pos[0], pos[1], opt('--words'), float(opt('--db', 8)))
    elif cmd == 'tone': r = tone(pos[0], pos[1], opt('--ref-words'), opt('--words'))
    elif cmd == 'floor': r = floor(pos[0], opt('--words'))
    elif cmd == 'sibilance': r = sibilance(pos[0], opt('--words'))
    elif cmd == 'spread': r = spread(pos[0], opt('--words'))
    else: raise SystemExit(f'Unknown step: {cmd}')
    print(json.dumps(r))


if __name__ == '__main__':
    main()
