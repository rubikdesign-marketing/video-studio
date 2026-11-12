"""Picture quality per second (FOOTAGE-PLAN.md section 3, "Picture quality").

    python picture.py <edit.mp4> <quality.json> [--shots shots.json]

Measures, per second of the working copy:
  brightness   average brightness, 0-100
  clipped      share of the picture blown to white (%), and crushed to black (%)
  spread       brightness spread (5th to 95th percentile), 0-100: very low means flat (Log footage, fog, a filter)
  sharp        detail relative to the picture's own contrast (higher is sharper)
  noise        grain, in 8-bit levels, measured on flat areas only
  flicker      frame-to-frame brightness wobble that is not a camera move, in 8-bit levels
  shake        hand shake: the picture's small fast movements, as % of the frame width (slow moves are not shake)
Faces are not measured yet (phase 4), so "blown out on the face" waits for the face tracks.
Writes the "picture" part of quality.json: {"seconds": [...], "flags": [{"what", "from", "to", "detail"}], "summary"}.
The thresholds are starting points set on the synthetic test clips; they are tuned on the owner's real clips.
"""
import json
import os
import subprocess
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # run with -I: the helper beside this file
from report import update  # noqa: E402

FFMPEG = '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
FFPROBE = '/opt/homebrew/opt/ffmpeg-full/bin/ffprobe'

SOFT = 0.9            # sharp below this: soft focus (crisp test footage 1.4-1.6, a 3 px blur 0.86)
NOISY = 3.0           # noise above this: grainy
DARK = 30             # brightness below this: too dark (well-exposed footage averages about 35-55)
BRIGHT = 85           # brightness above this: too bright
CLIPPED = 4.0         # % blown out above this
FLAT = 30             # spread below this: flat
FLICKER = 0.8         # flicker above this
SHAKY = 0.35          # shake above this


def frames(src, width, fps=None):
    vf = f'scale={width}:-2' + (f',fps={fps}' if fps else '')
    info = json.loads(subprocess.run([FFPROBE, '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,avg_frame_rate', '-of', 'json', src], capture_output=True, check=True).stdout)['streams'][0]
    w = width
    h = int(round(info['height'] * width / info['width'] / 2) * 2)
    a, b = info['avg_frame_rate'].split('/')
    rate = fps or float(a) / float(b)
    p = subprocess.Popen([FFMPEG, '-v', 'error', '-i', src, '-vf', vf + ',format=gray', '-f', 'rawvideo', '-'], stdout=subprocess.PIPE)
    size = w * h
    i = 0
    while True:
        buf = p.stdout.read(size)
        if len(buf) < size:
            break
        yield i / rate, np.frombuffer(buf, np.uint8).reshape(h, w), rate
        i += 1
    p.wait()


LAP = np.array([[1, -2, 1], [-2, 4, -2], [1, -2, 1]], np.float32)


def noise_sigma(g):
    """Immerkaer's noise estimate on the flat parts of the picture (edges excluded)."""
    f = g.astype(np.float32)
    edges = cv2.magnitude(cv2.Sobel(f, cv2.CV_32F, 1, 0), cv2.Sobel(f, cv2.CV_32F, 0, 1))
    flat = edges < np.percentile(edges, 50)
    r = np.abs(cv2.filter2D(f, -1, LAP))[1:-1, 1:-1][flat[1:-1, 1:-1]]
    return float(np.sqrt(np.pi / 2) * r.mean() / 6) if r.size else 0.0


def sharpness(g):
    """Edge steepness relative to edge contrast, after light denoising: about 1 / blur width, so it does not depend on
    how much contrast the scene has. Measured on the strongest 2% of edges; a picture with no edges returns None."""
    f = cv2.medianBlur(g, 3).astype(np.float32)
    gx = cv2.Sobel(f, cv2.CV_32F, 1, 0)
    gy = cv2.Sobel(f, cv2.CV_32F, 0, 1)
    grad = cv2.magnitude(gx, gy)
    thr = np.percentile(grad, 98)
    if thr < 20:
        return None
    edge = grad >= thr
    band = cv2.dilate(edge.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
    lap = np.abs(cv2.Laplacian(f, cv2.CV_32F, ksize=3))
    return float(np.percentile(lap[band], 90) / (np.percentile(grad[edge], 50) + 1e-6))


def camera_move(prev, cur):
    """The camera's own movement between two frames (dx, dy in pixels): feature points tracked from one frame to the
    next, and the move most of them agree on (RANSAC), so things moving in the scene do not count as camera moves."""
    pts = cv2.goodFeaturesToTrack(prev, maxCorners=300, qualityLevel=0.01, minDistance=8)
    if pts is None or len(pts) < 12:
        return None
    nxt, st, _ = cv2.calcOpticalFlowPyrLK(prev, cur, pts, None, winSize=(21, 21), maxLevel=3)
    ok = st.ravel() == 1
    if ok.sum() < 12:
        return None
    m, inl = cv2.estimateAffinePartial2D(pts[ok], nxt[ok], method=cv2.RANSAC, ransacReprojThreshold=1.0)
    if m is None or inl is None or inl.sum() < 0.4 * ok.sum():
        return None
    return float(m[0, 2]), float(m[1, 2])


def ranges(seconds, key, test):
    out = []
    for s in seconds:
        if s[key] is not None and test(s[key]):
            if out and s['t'] - out[-1][1] <= 1.01:
                out[-1][1] = s['t'] + 1
            else:
                out.append([s['t'], s['t'] + 1])
    return out


def main():
    src, dst = sys.argv[1:3]
    shots = None
    if '--shots' in sys.argv:
        shots = json.load(open(sys.argv[sys.argv.index('--shots') + 1]))
    cuts = shots['cuts'] if shots else []
    per = {}
    # Brightness: 5 times a second at 640 wide.
    for t, g, _ in frames(src, 640, fps=5):
        s = per.setdefault(int(t), {'b': [], 'clip': [], 'crush': [], 'spread': [], 'sharp': [], 'noise': []})
        f = g.astype(np.float32)
        lo, hi = np.percentile(f, [5, 95])
        s['b'].append(f.mean() / 2.55)
        s['clip'].append((g >= 250).mean() * 100)
        s['crush'].append((g <= 5).mean() * 100)
        s['spread'].append((hi - lo) / 2.55)
    # Detail and grain: twice a second at full size (up to 1920 wide), where softness and grain show.
    info = json.loads(subprocess.run([FFPROBE, '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width', '-of', 'json', src], capture_output=True, check=True).stdout)['streams'][0]
    for t, g, _ in frames(src, min(1920, info['width'] // 2 * 2), fps=2):
        rec = per.setdefault(int(t), {'b': [], 'clip': [], 'crush': [], 'spread': [], 'sharp': [], 'noise': []})
        rec['noise'].append(noise_sigma(g))
        v = sharpness(g)
        if v is not None:
            rec['sharp'].append(v)
    # Flicker and shake: every frame at 480 wide.
    means, moves, times, rate = [], [], [], 30.0
    prev = None
    for t, g, rate in frames(src, 480):
        means.append(float(g.mean()))
        times.append(t)
        mv = camera_move(prev, g) if prev is not None else (0.0, 0.0)
        moves.append(mv if mv is not None else (0.0, 0.0))
        prev = g
    means = np.array(means)
    times = np.array(times)
    near_cut = np.zeros(len(times), bool)
    for c in cuts:
        near_cut |= np.abs(times - c) < 0.2
    k = max(3, int(rate * 0.5) | 1)
    pad = k // 2
    med = np.array([np.median(means[max(0, i - pad):i + pad + 1]) for i in range(len(means))])
    resid = means - med
    path = np.cumsum(np.array(moves), axis=0)
    # A cut is a jump, not a move: start the path again after each cut.
    for i in np.where(near_cut)[0]:
        if i:
            path[i:] -= path[i] - path[i - 1]
    kk = max(3, int(rate) | 1)
    kernel = np.ones(kk) / kk
    smooth = np.stack([np.convolve(np.pad(path[:, j], kk // 2, mode='edge'), kernel, mode='valid') for j in range(2)], axis=1)
    jitter = np.linalg.norm(path - smooth, axis=1) / 480 * 100
    seconds = []
    for sec in sorted(per):
        s = per[sec]
        if not s['b']:
            continue
        m = (times >= sec) & (times < sec + 1) & ~near_cut
        seconds.append({
            't': sec,
            'brightness': round(float(np.mean(s['b'])), 1),
            'clipped': round(float(np.mean(s['clip'])), 2),
            'crushed': round(float(np.mean(s['crush'])), 2),
            'spread': round(float(np.mean(s['spread'])), 1),
            'sharp': round(float(np.median(s['sharp'])), 3) if s['sharp'] else None,
            'noise': round(float(np.median(s['noise'])), 2) if s['noise'] else None,
            'flicker': round(float(np.std(resid[m])), 2) if m.sum() > 3 else 0.0,
            'shake': round(float(np.sqrt(np.mean(jitter[m] ** 2))), 3) if m.sum() > 3 else 0.0,
        })
    flags = []
    for what, key, test, detail in [
        ('soft focus', 'sharp', lambda v: v < SOFT, 'little fine detail'),
        ('grainy', 'noise', lambda v: v > NOISY, 'visible grain or sensor noise'),
        ('too dark', 'brightness', lambda v: v < DARK, 'average brightness low'),
        ('too bright', 'brightness', lambda v: v > BRIGHT, 'average brightness high'),
        ('blown highlights', 'clipped', lambda v: v > CLIPPED, 'part of the picture is pure white'),
        ('flat picture', 'spread', lambda v: v < FLAT, 'little contrast (Log footage, haze or a filter)'),
        ('flicker', 'flicker', lambda v: v > FLICKER, 'brightness wobbles from frame to frame (LED or office lights)'),
        ('shaky', 'shake', lambda v: v > SHAKY, 'hand shake'),
    ]:
        for a, b in ranges(seconds, key, test):
            vals = [s[key] for s in seconds if a <= s['t'] < b and s[key] is not None]
            flags.append({'what': what, 'from': a, 'to': b, 'detail': detail, 'value': round(float(np.mean(vals)), 3)})
    summary = {k: round(float(np.median([s[k] for s in seconds if s[k] is not None] or [0])), 3) for k in ('brightness', 'clipped', 'crushed', 'spread', 'sharp', 'noise', 'flicker', 'shake')} if seconds else {}
    part = {'seconds': seconds, 'flags': flags, 'summary': summary,
                       'thresholds': {'soft': SOFT, 'noisy': NOISY, 'dark': DARK, 'bright': BRIGHT, 'clipped': CLIPPED, 'flat': FLAT, 'flicker': FLICKER, 'shaky': SHAKY}}
    update(dst, 'picture', part)
    print(json.dumps({'summary': summary, 'flags': [(f['what'], f['from'], f['to']) for f in flags]}))


if __name__ == '__main__':
    main()
