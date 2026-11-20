"""Contact sheet and scopes (FOOTAGE-PLAN.md section 3, "Contact sheet and scopes"; section 6.6).

    python sheet.py <clip folder>

From the clip folder's edit.mp4, shots.json and words.json: one picture per shot (every 10 s in a long shot, at most
24 pictures), each with the words said around it, a brightness scope (waveform: how bright each column of the
picture is, 0 to 100) and a colour scope (vectorscope, with the line natural skin tones sit on). Writes
scopes/<seconds>.png for each picture and sheet.jpg with all of them, so Claude can look at the footage and its
colour instead of guessing from numbers.
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
FW = 480          # frame width on the sheet
WAVE_W = 256
VEC = 180
INK = (235, 235, 235)
MUTED = (150, 150, 150)
BG = (22, 22, 24)
SKIN_ANGLE = 123  # degrees from +Cb: the line natural skin tones of every complexion sit on


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


def grab(src, t, width):
    raw = subprocess.run([FFMPEG, '-v', 'error', '-ss', f'{t:.3f}', '-i', src, '-frames:v', '1', '-vf', f'scale={width}:-2', '-f', 'image2pipe', '-vcodec', 'png', '-'], capture_output=True, check=True).stdout
    return Image.open(__import__('io').BytesIO(raw)).convert('RGB')


def waveform(rgb, h):
    a = np.asarray(rgb).astype(np.float32)
    y = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    cols = np.array_split(np.arange(y.shape[1]), WAVE_W)
    img = np.zeros((h, WAVE_W), np.float32)
    for i, c in enumerate(cols):
        hist, _ = np.histogram(y[:, c], bins=h, range=(0, 256))
        img[:, i] = hist[::-1]
    img = np.log1p(img)
    img = (img / (img.max() + 1e-6) * 255).astype(np.uint8)
    out = Image.fromarray(np.stack([img * 0.55, img, img * 0.7], -1).astype(np.uint8))
    d = ImageDraw.Draw(out)
    for pct in (0, 50, 100):
        yy = int((1 - pct / 100) * (h - 1))
        d.line([(0, yy), (WAVE_W, yy)], fill=(90, 90, 90))
    return out


def vectorscope(rgb):
    a = np.asarray(rgb).astype(np.float32) / 255
    y = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    cb = (a[..., 2] - y) / 1.8556
    cr = (a[..., 0] - y) / 1.5748
    hist, _, _ = np.histogram2d(-cr.ravel(), cb.ravel(), bins=VEC, range=[[-0.5, 0.5], [-0.5, 0.5]])
    img = np.log1p(hist)
    img = (img / (img.max() + 1e-6) * 255).astype(np.uint8)
    out = Image.fromarray(np.stack([img, img, img], -1))
    d = ImageDraw.Draw(out)
    c = VEC / 2
    d.ellipse([2, 2, VEC - 3, VEC - 3], outline=(70, 70, 70))
    d.line([(c, 0), (c, VEC)], fill=(55, 55, 55))
    d.line([(0, c), (VEC, c)], fill=(55, 55, 55))
    ang = np.radians(SKIN_ANGLE)
    d.line([(c, c), (c + np.cos(ang) * c, c - np.sin(ang) * c)], fill=(220, 150, 110), width=2)
    return out


def samples(shots, duration, limit=24):
    ts = []
    for s in shots:
        a, b = s['start'], s['end']
        if b - a <= 12:
            ts.append((a + b) / 2)
        else:
            ts.extend(np.arange(a + 5, b, 10).tolist())
    if len(ts) > limit:
        ts = [ts[int(i)] for i in np.linspace(0, len(ts) - 1, limit)]
    return [round(min(max(t, 0), max(0, duration - 0.05)), 2) for t in ts]


def said(words, t, around=4.0):
    near = [w['text'] for w in words if w['end'] >= t - around and w['start'] <= t + around]
    text = ' '.join(near)
    return (text[:110] + '...') if len(text) > 110 else text


def main():
    d = sys.argv[1]
    src = os.path.join(d, 'edit.mp4')
    shots = json.load(open(os.path.join(d, 'shots.json')))['shots'] if os.path.exists(os.path.join(d, 'shots.json')) else None
    words = json.load(open(os.path.join(d, 'words.json')))['words'] if os.path.exists(os.path.join(d, 'words.json')) else []
    dur = float(subprocess.run([FFPROBE, '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src], capture_output=True, text=True, check=True).stdout)
    if not shots:
        shots = [{'start': 0, 'end': dur}]
    os.makedirs(os.path.join(d, 'scopes'), exist_ok=True)
    f_big, f_small = font(17), font(14)
    rows = []
    for t in samples(shots, dur):
        frame = grab(src, t, FW)
        if frame.height > frame.width:  # an upright phone picture: keep the row short
            frame = frame.resize((int(frame.width * 270 / frame.height), 270))
        h = max(frame.height, VEC)
        row = Image.new('RGB', (FW + WAVE_W + VEC + 40, h + 46), BG)
        row.paste(frame, (0, 0))
        row.paste(waveform(frame, h), (FW + 12, 0))
        row.paste(vectorscope(frame), (FW + WAVE_W + 24, 0))
        dr = ImageDraw.Draw(row)
        m, s = divmod(int(t), 60)
        dr.text((0, h + 6), f'{m}:{s:02d}', fill=INK, font=f_big)
        dr.text((52, h + 8), said(words, t) or '(no words)', fill=MUTED, font=f_small)
        row.save(os.path.join(d, 'scopes', f'{t:08.2f}.png'))
        rows.append(row)
    cols = 2 if len(rows) > 8 else 1
    w = max(r.width for r in rows)
    per = int(np.ceil(len(rows) / cols))
    heights = [sum(r.height + 10 for r in rows[c * per:(c + 1) * per]) for c in range(cols)]
    sheet = Image.new('RGB', (w * cols + 20 * (cols + 1), max(heights) + 70), BG)
    dr = ImageDraw.Draw(sheet)
    dr.text((20, 18), f'{os.path.basename(os.path.normpath(d))}   brightness scope 0-100   colour scope with the skin line', fill=INK, font=f_big)
    for c in range(cols):
        y = 56
        for r in rows[c * per:(c + 1) * per]:
            sheet.paste(r, (20 + c * (w + 20), y))
            y += r.height + 10
    sheet.save(os.path.join(d, 'sheet.jpg'), quality=88)
    print(json.dumps({'pictures': len(rows), 'sheet': os.path.join(d, 'sheet.jpg')}))


if __name__ == '__main__':
    main()
