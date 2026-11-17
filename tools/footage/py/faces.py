# faces.py <clip_dir> [--every 2] [--width 720]
# Finds where the face is in every frame of a clip's working copy (edit.mp4) and writes faces.json beside it.
# Positions and shapes only, for framing: it never works out who someone is and keeps no face prints
# (FOOTAGE-PLAN.md, principle 3). MediaPipe's face landmarker (Apache 2.0), model in tools/footage/models/.
#
# faces.json: { width, height, fps, every, frames: [ {t, box:[x,y,w,h], eyes:[x,y], chin:[x,y], top:[x,y], yaw, mouth} | null ] }
# in working-copy pixels; "smooth" holds the same series smoothed (a centred moving average over about 0.4 s),
# which is what framing uses so the frame never jitters. "frames" and "smooth" follow the biggest face (the presenter).
# "people" (phase 4) follows up to two faces with steady ids, kept by position from frame to frame (never by who they
# are): [{id, side, seen, frames: [{t, box, eyes, chin, top, yaw, mouth} | null], smooth: [...]}], left to right.
import sys, os, json, argparse
import numpy as np, cv2
import mediapipe as mp
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(HERE, '..', 'models', 'face_landmarker.task')

# Landmark indices in MediaPipe's 478-point face mesh.
LEFT_EYE, RIGHT_EYE = [33, 133, 159, 145], [362, 263, 386, 374]
CHIN, FOREHEAD, NOSE = 152, 10, 1
UPPER_LIP, LOWER_LIP = 13, 14


def measure(f, X0, Y0, RW, RH, t):
    """One face's positions in working-copy pixels."""
    xs = X0 + np.array([p.x for p in f]) * RW; ys = Y0 + np.array([p.y for p in f]) * RH
    eye = lambda idx: (float(np.mean(xs[idx])), float(np.mean(ys[idx])))
    le, re_ = eye(LEFT_EYE), eye(RIGHT_EYE)
    eyes = [(le[0] + re_[0]) / 2, (le[1] + re_[1]) / 2]
    chin = [float(xs[CHIN]), float(ys[CHIN])]
    fh = [float(xs[FOREHEAD]), float(ys[FOREHEAD])]
    top = [fh[0], fh[1] - 0.22 * (chin[1] - fh[1])]
    eye_w = abs(re_[0] - le[0])
    return dict(t=t, box=[round(float(xs.min()), 1), round(float(min(ys.min(), top[1])), 1), round(float(xs.max() - xs.min()), 1), round(float(ys.max() - min(ys.min(), top[1])), 1)],
                eyes=[round(v, 1) for v in eyes], chin=[round(v, 1) for v in chin], top=[round(v, 1) for v in top],
                yaw=round(float((xs[NOSE] - eyes[0]) / (eye_w + 1e-6)), 3), mouth=round(float(abs(ys[LOWER_LIP] - ys[UPPER_LIP]) / (chin[1] - fh[1] + 1e-6)), 4))


def track_people(people, seen, t, W):
    """Gives each face seen this frame to the person whose last position is nearest (within a fifth of the frame
    width); a face near nobody starts a new person. Every person gets a sample (None when not seen)."""
    free = list(range(len(seen)))
    for p in people:
        best, bd = None, 0.2 * W
        for j in free:
            d = np.hypot(seen[j]['eyes'][0] - p['last'][0], seen[j]['eyes'][1] - p['last'][1])
            if d < bd:
                best, bd = j, d
        if best is not None:
            p['frames'].append(seen[best]); p['last'] = seen[best]['eyes']; free.remove(best)
        else:
            p['frames'].append(None)
    for j in free:
        people.append({'last': seen[j]['eyes'], 'frames': [None] * (len(people[0]['frames']) - 1 if people else 0) + [seen[j]]})


def smooth_series(fr, n):
    """A person's positions smoothed (centred moving average), holding the last known value through gaps."""
    first = next((f for f in fr if f), None)
    if first is None:
        return []
    keys = ['eyes', 'chin', 'top', 'box']
    last = first; filled = []
    for f in fr:
        if f: last = f
        filled.append(last)
    kern = np.ones(2 * n + 1) / (2 * n + 1)
    out = {}
    for k in keys:
        arr = np.array([f[k] for f in filled], float)
        pad = np.pad(arr, ((n, n), (0, 0)), mode='edge')
        out[k] = np.stack([np.convolve(pad[:, j], kern, mode='valid') for j in range(arr.shape[1])], 1)
    return [dict(t=filled[j]['t'], **{k: [round(float(v), 1) for v in out[k][j]] for k in keys}) for j in range(len(fr))]


def find_area(src, W, H, width, samples=6):
    """Where to look. The landmarker finds faces on a small square of the picture, so a face that is a sixth of a 4K
    wide shot's height comes out a few pixels tall and is missed. A few frames are searched whole and then in
    overlapping tiles; when faces only show up in the tiles, the area around all of them (one and a half
    face-heights each way, widened to the frame's shape) is returned, and the frame by frame pass looks there. Positions only."""
    cap = cv2.VideoCapture(src)
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
    det = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=mpt.BaseOptions(model_asset_path=MODEL), num_faces=4,
                                                                                min_face_detection_confidence=0.4))
    def look(img, x0, y0, w0, h0):
        s = min(1.0, width / w0)
        small = cv2.resize(img[y0:y0 + h0, x0:x0 + w0], (max(1, int(w0 * s)), max(1, int(h0 * s))), interpolation=cv2.INTER_AREA)
        r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(small, cv2.COLOR_BGR2RGB)))
        return [(x0 + min(p.x for p in f) * w0, y0 + min(p.y for p in f) * h0, x0 + max(p.x for p in f) * w0, y0 + max(p.y for p in f) * h0) for f in r.face_landmarks or []]
    whole, tiled = 0, []
    for k in range(samples):
        cap.set(cv2.CAP_PROP_POS_FRAMES, int((k + 0.5) * n / samples))
        ok, img = cap.read()
        if not ok: continue
        if look(img, 0, 0, W, H):
            whole += 1; continue
        tw, th = int(0.6 * W), int(0.6 * H)
        for ty in (0, H - th):
            for tx in (0, (W - tw) // 2, W - tw):
                tiled += look(img, tx, ty, tw, th)
    cap.release(); det.close()
    if whole >= samples / 2 or not tiled:
        return 0, 0, W, H
    fh = float(np.median([b[3] - b[1] for b in tiled]))
    x0 = min(b[0] for b in tiled) - 1.5 * fh; x1 = max(b[2] for b in tiled) + 1.5 * fh
    y0 = min(b[1] for b in tiled) - 1.5 * fh; y1 = max(b[3] for b in tiled) + 1.5 * fh
    w, h = x1 - x0, y1 - y0
    if w / h < W / H: w = h * W / H
    else: h = w * H / W
    w, h = min(W, w), min(H, h)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    X0 = int(np.clip(cx - w / 2, 0, W - w)); Y0 = int(np.clip(cy - h / 2, 0, H - h))
    print(f'small faces: looking at {int(w)}x{int(h)} from ({X0},{Y0}) of {W}x{H}')
    return X0, Y0, int(w), int(h)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('clip')
    ap.add_argument('--every', type=int, default=2)
    ap.add_argument('--width', type=int, default=720)
    ap.add_argument('--roi', default='', help='x,y,w,h as shares of the frame: look only there (small faces in wide shots)')
    a = ap.parse_args()
    src = os.path.join(a.clip, 'edit.mp4')
    cap = cv2.VideoCapture(src)
    fps = cap.get(cv2.CAP_PROP_FPS); W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)); H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if a.roi:
        rx, ry, rw, rh = [float(v) for v in a.roi.split(',')]
        X0, Y0, RW, RH = int(rx * W), int(ry * H), int(rw * W), int(rh * H)
    else:
        X0, Y0, RW, RH = find_area(src, W, H, a.width)
    width = min(a.width, RW)
    scale = width / RW
    opts = vision.FaceLandmarkerOptions(base_options=mpt.BaseOptions(model_asset_path=MODEL), running_mode=vision.RunningMode.VIDEO, num_faces=2,
                                        min_face_detection_confidence=0.4, min_tracking_confidence=0.4)
    lm = vision.FaceLandmarker.create_from_options(opts)
    frames = []; i = 0
    people = []  # [{last: eyes, frames: []}]: faces kept apart by where they are, frame to frame
    while True:
        ok, img = cap.read()
        if not ok: break
        if i % a.every == 0:
            small = cv2.resize(img[Y0:Y0 + RH, X0:X0 + RW], (width, int(RH * scale)), interpolation=cv2.INTER_AREA)
            rgb = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(small, cv2.COLOR_BGR2RGB))
            r = lm.detect_for_video(rgb, int(i / fps * 1000))
            t_now = round(i / fps, 4)
            seen = [measure(f, X0, Y0, RW, RH, t_now) for f in (r.face_landmarks or [])]
            track_people(people, seen, t_now, W)
            if r.face_landmarks:
                # The biggest face is the presenter.
                faces = sorted(r.face_landmarks, key=lambda f: -(max(p.x for p in f) - min(p.x for p in f)))
                f = faces[0]
                xs = X0 + np.array([p.x for p in f]) * RW; ys = Y0 + np.array([p.y for p in f]) * RH
                eye = lambda idx: (float(np.mean(xs[idx])), float(np.mean(ys[idx])))
                le, re_ = eye(LEFT_EYE), eye(RIGHT_EYE)
                eyes = [(le[0] + re_[0]) / 2, (le[1] + re_[1]) / 2]
                chin = [float(xs[CHIN]), float(ys[CHIN])]
                # The mesh's top (point 10) is mid-forehead; the hairline sits about a fifth of the face higher.
                fh = [float(xs[FOREHEAD]), float(ys[FOREHEAD])]
                top = [fh[0], fh[1] - 0.22 * (chin[1] - fh[1])]
                eye_w = abs(re_[0] - le[0])
                yaw = float((xs[NOSE] - eyes[0]) / (eye_w + 1e-6))
                mouth = float(abs(ys[LOWER_LIP] - ys[UPPER_LIP]) / (chin[1] - fh[1] + 1e-6))
                box = [float(xs.min()), float(min(ys.min(), top[1])), float(xs.max() - xs.min()), float(ys.max() - min(ys.min(), top[1]))]
                frames.append(dict(t=round(i / fps, 4), box=[round(v, 1) for v in box], eyes=[round(v, 1) for v in eyes], chin=[round(v, 1) for v in chin],
                                   top=[round(v, 1) for v in top], yaw=round(yaw, 3), mouth=round(mouth, 4), faces=len(r.face_landmarks)))
            else:
                frames.append(dict(t=round(i / fps, 4), box=None))
        i += 1
    cap.release()
    # Smooth: centred moving average over ~0.4 s, holding the last known value through gaps.
    n = max(1, int(round(0.4 * fps / a.every)))
    keys = ['eyes', 'chin', 'top']
    series = {k: [] for k in keys}; boxes = []
    last = None
    for f in frames:
        if f.get('box') is not None: last = f
        for k in keys: series[k].append(last[k] if last else None)
        boxes.append(last['box'] if last else None)
    first = next((f for f in frames if f.get('box') is not None), None)
    if first is None:
        print(f'{a.clip}: no face found'); smooth = []
    else:
        def fill(lst, dflt):
            return np.array([v if v is not None else dflt for v in lst], dtype=float)
        smooth = []
        arrs = {k: fill(series[k], first[k]) for k in keys}; barr = fill(boxes, first['box'])
        kern = np.ones(2 * n + 1) / (2 * n + 1)
        def sm(x):
            pad = np.pad(x, ((n, n), (0, 0)), mode='edge')
            return np.stack([np.convolve(pad[:, j], kern, mode='valid') for j in range(x.shape[1])], 1)
        S = {k: sm(arrs[k]) for k in keys}; B = sm(barr)
        for j, f in enumerate(frames):
            smooth.append(dict(t=f['t'], eyes=[round(v, 1) for v in S['eyes'][j]], chin=[round(v, 1) for v in S['chin'][j]],
                               top=[round(v, 1) for v in S['top'][j]], box=[round(v, 1) for v in B[j]]))
    found = sum(1 for f in frames if f.get('box') is not None)
    # Each person's series, smoothed like the presenter's; people seen in under a tenth of the frames are dropped.
    kept = [p for p in people if sum(1 for f in p['frames'] if f) >= max(3, 0.1 * len(frames))]
    kept.sort(key=lambda p: np.median([f['eyes'][0] for f in p['frames'] if f]))
    out_people = []
    for k, p in enumerate(kept):
        side = 'centre' if len(kept) == 1 else 'left' if k == 0 else 'right' if k == len(kept) - 1 else 'middle'
        out_people.append(dict(id=k + 1, side=side, seen=sum(1 for f in p['frames'] if f), frames=p['frames'], smooth=smooth_series(p['frames'], n)))
    out = dict(width=W, height=H, fps=fps, every=a.every, area=[X0, Y0, RW, RH], found=found, sampled=len(frames), frames=frames, smooth=smooth, people=out_people,
               note='Positions only, for framing. No identity, no face prints.')
    json.dump(out, open(os.path.join(a.clip, 'faces.json'), 'w'))
    print(f'{os.path.basename(a.clip)}: face in {found} of {len(frames)} sampled frames ({W}x{H}, {fps:.2f} fps)')


if __name__ == '__main__':
    main()
