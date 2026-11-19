"""A picture of the sound at every cut (FOOTAGE-PLAN.md section 7.3): the spectrogram 0.3 s either side of each join
in the joined dialogue, with the cut marked, so Claude can look for a click (a bright vertical line), a gap (a dark
band) or a change of room (the background changing colour across the line).

    python cuts.py <dialogue.wav> <cutlist.json> <out.png>
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

import os as _os, sys as _sys
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '.'))
from _ff import FFMPEG, FFPROBE  # noqa: E402
RATE = 48000
HALF = 0.3
W, H = 300, 170


def _font_paths():
    """Fonts to try, per OS. The first that opens wins; PIL's built-in font is the last resort."""
    if os.name == 'nt':
        d = os.path.join(os.environ.get('WINDIR', 'C:\\Windows'), 'Fonts')
        return [os.path.join(d, 'arial.ttf'), os.path.join(d, 'segoeui.ttf')]
    if sys.platform == 'darwin':
        return ['/System/Library/Fonts/Helvetica.ttc', '/System/Library/Fonts/Supplemental/Arial.ttf', '/Library/Fonts/Arial.ttf']
    return ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf',
            '/usr/share/fonts/TTF/DejaVuSans.ttf', '/usr/share/fonts/liberation/LiberationSans-Regular.ttf',
            '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf']


def font(size):
    for f in _font_paths():
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            continue
    return ImageFont.load_default()


def spectro(seg):
    n, hop = 1024, 128
    if len(seg) < n:
        seg = np.pad(seg, (0, n - len(seg)))
    frames = np.lib.stride_tricks.sliding_window_view(seg, n)[::hop] * np.hanning(n)
    # One fixed scale for every panel (dB against full scale, -100 to -20), so brightness means the same everywhere:
    # a quiet room stays dark, a click or a burst stays bright.
    spec = np.abs(np.fft.rfft(frames, axis=1)) / (np.sum(np.hanning(n)) / 2)
    mag = 20 * np.log10(spec + 1e-12).T  # freq x time
    freqs = np.fft.rfftfreq(n, 1 / RATE)
    keep = freqs <= 12000
    img = mag[keep][::-1]
    return np.clip((img + 100) / 80, 0, 1)


def colour(v):
    # Dark blue to yellow, readable on the dark sheet.
    r = np.clip(1.6 * v - 0.3, 0, 1); g = np.clip(1.4 * v - 0.25, 0, 1) ** 1.2; b = np.clip(0.9 - 1.2 * np.abs(v - 0.35), 0.1, 0.9)
    return (np.stack([r, g, b], -1) * 255).astype(np.uint8)


def main():
    wav, cutfile, out = sys.argv[1:4]
    raw = subprocess.run([FFMPEG, '-v', 'error', '-i', wav, '-ac', '1', '-ar', str(RATE), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).astype(np.float64)
    cut = json.load(open(cutfile))
    xf = cut.get('crossfade', 0.015)
    joins = cut.get('joins', [])
    times = []
    for k, p in enumerate(cut['pieces'][1:], start=1):
        j = next((j for j in joins if j['after'] == k - 1), None)
        times.append((p['at'] + xf / 2, p['kind'], j['kind'] if j else ('room tone' if p['kind'] == 'room tone' else '')))
    if not times:
        print(json.dumps({'cuts': 0}))
        return
    cols = 4
    rows = int(np.ceil(len(times) / cols))
    sheet = Image.new('RGB', (cols * (W + 16) + 16, rows * (H + 40) + 56), (22, 22, 24))
    d = ImageDraw.Draw(sheet)
    d.text((16, 14), f'Sound at each cut (0.3 s either side, 0-12 kHz, -100 to -20 dBFS on one scale): {len(times)} cuts', fill=(235, 235, 235), font=font(16))
    for i, (t, kind, jk) in enumerate(times):
        a, b = int((t - HALF) * RATE), int((t + HALF) * RATE)
        seg = x[max(0, a):max(0, b)]
        img = Image.fromarray(colour(spectro(seg))).resize((W, H))
        dd = ImageDraw.Draw(img)
        cx = int(W * (t - max(0, a) / RATE) / (2 * HALF)) if a >= 0 else W // 2
        dd.line([(cx, 0), (cx, H)], fill=(255, 80, 80), width=1)
        r, c = divmod(i, cols)
        X, Y = 16 + c * (W + 16), 48 + r * (H + 40)
        sheet.paste(img, (X, Y))
        m, s = divmod(t, 60)
        d.text((X, Y + H + 4), f'{int(m)}:{s:05.2f}  {jk or kind}', fill=(170, 170, 170), font=font(13))
    sheet.save(out)
    print(json.dumps({'cuts': len(times), 'sheet': out}))


if __name__ == '__main__':
    main()
