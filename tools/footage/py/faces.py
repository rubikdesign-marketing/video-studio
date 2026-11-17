# faces.py <clip_dir> [--every 2] [--width 720]
# Finds where the face is in every frame of a clip's working copy (edit.mp4) and writes faces.json beside it.
# Positions and shapes only, for framing: it never works out who someone is and keeps no face prints
# (FOOTAGE-PLAN.md, principle 3). MediaPipe's face landmarker (Apache 2.0), model in tools/footage/models/.
#
# faces.json: { width, height, fps, every, frames: [ {t, box:[x,y,w,h], eyes:[x,y], chin:[x,y], top:[x,y], yaw, mouth} | null ] }
# in working-copy pixels; "smooth" holds the same series smoothed (a centred moving average over about 0.4 s),
# which is what framing uses so the frame never jitters. "frames" and "smooth" follow the biggest face (the presenter).
# "people" (phase 4) follows up to two faces per shot, kept apart by position from frame to frame within the shot (never
# by who they are; a camera change starts afresh): [{id, side, shot, shot_from, shot_to (the shot's own times), start, end, seen, frames: [{t, box, eyes, chin,
# top, yaw, mouth} | null], smooth: [...]}], shot by shot, left to right; frames and smooth cover the person's shot only.
import sys, os, json, argparse
import numpy as np, cv2
import mediapipe as mp
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(HERE, '..', 'models', 'face_landmarker.task')
# OpenCV's YuNet face detector (MIT, opencv_zoo): finds faces turned away from the camera (two people talking to each
# other) that the landmarker's own detector misses; the landmarker then measures each on a close crop. Positions only.
YUNET = os.path.join(HERE, '..', 'models', 'face_detection_yunet_2023mar.onnx')

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


class TurnedFaces:
    """Faces the landmarker missed in a frame: YuNet finds them (on a copy at most 1280 wide), and the landmarker
    measures each one on a close square crop around it, where it works on three-quarter and side views too."""
    def __init__(self, W, H):
        self.scale = min(1.0, 1280 / W)
        self.size = (max(1, int(W * self.scale)), max(1, int(H * self.scale)))
        self.det = cv2.FaceDetectorYN.create(YUNET, '', self.size, 0.8, 0.3, 5000)
        self.lm = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=mpt.BaseOptions(model_asset_path=MODEL), num_faces=1,
                                                                                       min_face_detection_confidence=0.3))
        self.W, self.H, self.used = W, H, 0

    def find(self, img, seen, t):
        small = cv2.resize(img, self.size, interpolation=cv2.INTER_AREA) if self.scale < 1 else img
        _, found = self.det.detect(small)
        out = []
        for b in (found if found is not None else []):
            bx, by, bw, bh = [float(v) / self.scale for v in b[:4]]
            if bh < 0.03 * self.H:
                continue
            if any(bx - 0.2 * bw <= f['eyes'][0] <= bx + 1.2 * bw and by - 0.2 * bh <= f['eyes'][1] <= by + 1.2 * bh for f in seen + out):
                continue  # already measured
            side = 2.4 * max(bw, bh); cx, cy = bx + bw / 2, by + bh / 2
            x0, y0 = int(max(0, cx - side / 2)), int(max(0, cy - side / 2)); x1, y1 = int(min(self.W, cx + side / 2)), int(min(self.H, cy + side / 2))
            if x1 - x0 < 8 or y1 - y0 < 8:
                continue
            crop = cv2.resize(img[y0:y1, x0:x1], (256, 256), interpolation=cv2.INTER_AREA)
            r = self.lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)))
            if r.face_landmarks:
                out.append(measure(r.face_landmarks[0], x0, y0, x1 - x0, y1 - y0, t)); self.used += 1
        return out


def load_json(path):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


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
        people.append({'last': seen[j]['eyes'], 'frames': [seen[j]]})


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


SMALL = 0.2  # a face under a fifth of the frame's height (hairline to chin) is looked for in the area around it


def find_area(src, W, H, width, samples=6, t0=0.0, t1=None):
    """Where to look. The landmarker finds faces on a small square of the picture, so a face that is a sixth of a 4K
    wide shot's height comes out a few pixels tall and is missed, and one a seventh of a 720p frame is found only now
    and then. A few frames of the stretch are searched whole and in overlapping tiles; when the faces found are small
    (under a fifth of the frame's height), the area around all of them (one and a half face-heights each way, widened
    to the frame's shape) is returned, and the frame by frame pass looks there. Positions only."""
    cap = cv2.VideoCapture(src)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
    f0 = int(t0 * fps); f1 = min(n, int(t1 * fps)) if t1 is not None else n
    f1 = max(f0 + 1, f1)
    det = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=mpt.BaseOptions(model_asset_path=MODEL), num_faces=4,
                                                                                min_face_detection_confidence=0.4))
    def look(img, x0, y0, w0, h0):
        s = min(1.0, width / w0)
        small = cv2.resize(img[y0:y0 + h0, x0:x0 + w0], (max(1, int(w0 * s)), max(1, int(h0 * s))), interpolation=cv2.INTER_AREA)
        r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(small, cv2.COLOR_BGR2RGB)))
        return [(x0 + min(p.x for p in f) * w0, y0 + min(p.y for p in f) * h0, x0 + max(p.x for p in f) * w0, y0 + max(p.y for p in f) * h0) for f in r.face_landmarks or []]
    tiled = []
    for k in range(samples):
        cap.set(cv2.CAP_PROP_POS_FRAMES, f0 + int((k + 0.5) * (f1 - f0) / samples))
        ok, img = cap.read()
        if not ok: continue
        tiled += look(img, 0, 0, W, H)
        tw, th = int(0.6 * W), int(0.6 * H)
        for ty in (0, H - th):
            for tx in (0, (W - tw) // 2, W - tw):
                tiled += look(img, tx, ty, tw, th)
    cap.release(); det.close()
    if not tiled:
        return 0, 0, W, H
    fh = float(np.median([b[3] - b[1] for b in tiled]))
    if fh >= SMALL * H:  # faces big enough to be found reliably in the whole frame
        return 0, 0, W, H
    x0 = min(b[0] for b in tiled) - 1.5 * fh; x1 = max(b[2] for b in tiled) + 1.5 * fh
    y0 = min(b[1] for b in tiled) - 1.5 * fh; y1 = max(b[3] for b in tiled) + 1.5 * fh
    w, h = x1 - x0, y1 - y0
    if w / h < W / H: w = h * W / H
    else: h = w * H / W
    w, h = min(W, w), min(H, h)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    X0 = int(np.clip(cx - w / 2, 0, W - w)); Y0 = int(np.clip(cy - h / 2, 0, H - h))
    print(f'small faces from {t0:.1f} s: looking at {int(w)}x{int(h)} from ({X0},{Y0}) of {W}x{H}')
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
    # Shots (shots.json from ingest): each camera change starts afresh. People are kept apart only within a shot, by
    # position; across a camera change nothing says who is who (that would take recognising faces, which this tool
    # never does), so every shot has its own people. The small-face search runs per shot too.
    dur = (cap.get(cv2.CAP_PROP_FRAME_COUNT) or 1) / (fps or 30)
    cuts = (load_json(os.path.join(a.clip, 'shots.json')) or {}).get('cuts', [])
    bounds = [0.0] + [c for c in cuts if 0 < c < dur] + [dur + 1]
    shots = [(bounds[k], bounds[k + 1]) for k in range(len(bounds) - 1)]
    def area_of(k):
        if a.roi:
            rx, ry, rw, rh = [float(v) for v in a.roi.split(',')]
            return int(rx * W), int(ry * H), int(rw * W), int(rh * H)
        return find_area(src, W, H, a.width, samples=6 if len(shots) == 1 else 3, t0=shots[k][0], t1=min(dur, shots[k][1]))
    opts = vision.FaceLandmarkerOptions(base_options=mpt.BaseOptions(model_asset_path=MODEL), running_mode=vision.RunningMode.VIDEO, num_faces=2,
                                        min_face_detection_confidence=0.4, min_tracking_confidence=0.4)
    frames = []; i = 0
    people = []  # [{last: eyes, frames, at: {sample number: face}, shot}]: kept apart by position, frame to frame, within a shot
    shot = -1; lm = None; active = []
    turned = TurnedFaces(W, H) if os.path.exists(YUNET) else None
    while True:
        ok, img = cap.read()
        if not ok: break
        if i % a.every == 0:
            t_now = round(i / fps, 4)
            k = next(j for j, (s0, s1) in enumerate(shots) if s0 <= t_now < s1)
            if k != shot:
                shot = k
                X0, Y0, RW, RH = area_of(k)
                width = min(a.width, RW); scale = width / RW
                if lm: lm.close()
                lm = vision.FaceLandmarker.create_from_options(opts)
                for p in active: p['open'] = False
                active = []
            small = cv2.resize(img[Y0:Y0 + RH, X0:X0 + RW], (width, int(RH * scale)), interpolation=cv2.INTER_AREA)
            rgb = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(small, cv2.COLOR_BGR2RGB))
            r = lm.detect_for_video(rgb, int(i / fps * 1000))
            seen = [measure(f, X0, Y0, RW, RH, t_now) for f in (r.face_landmarks or [])]
            if turned:
                seen += turned.find(img, seen, t_now)
            before = len(active)
            track_people(active, seen, t_now, W)
            for p in active[before:]:
                p['shot'] = shot; p['at'] = {}; people.append(p)
            for p in active:  # by sample number, so every person lines up with the clip's frames
                p['at'][len(frames)] = p['frames'][-1]
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
    # Each person's series, smoothed like the presenter's, within their shot; people seen in under a tenth of their
    # shot's frames are dropped. Sides are within the shot.
    out_people = []
    for k, (s0, s1) in enumerate(shots):
        in_shot = [j for j, f in enumerate(frames) if s0 <= f['t'] < s1]
        if not in_shot:
            continue
        kept = [p for p in people if p['shot'] == k and sum(1 for f in p['at'].values() if f) >= max(3, 0.1 * len(in_shot))]
        kept.sort(key=lambda p: np.median([f['eyes'][0] for f in p['at'].values() if f]))
        for m, p in enumerate(kept):
            side = 'centre' if len(kept) == 1 else 'left' if m == 0 else 'right' if m == len(kept) - 1 else 'middle'
            own = [p['at'].get(j) for j in in_shot]
            sm = smooth_series(own, n)
            out_people.append(dict(id=len(out_people) + 1, side=side, shot=k, shot_from=round(s0, 3), shot_to=round(min(s1, dur), 3), start=round(frames[in_shot[0]]['t'], 3), end=round(frames[in_shot[-1]]['t'], 3),
                                   seen=sum(1 for f in own if f), frames=[f for f in own], smooth=sm))
    out = dict(width=W, height=H, fps=fps, every=a.every, shots=len(shots), turned_faces=turned.used if turned else 'YuNet not installed', found=found, sampled=len(frames), frames=frames, smooth=smooth, people=out_people,
               note='Positions only, for framing. No identity, no face prints.')
    json.dump(out, open(os.path.join(a.clip, 'faces.json'), 'w'))
    print(f'{os.path.basename(a.clip)}: face in {found} of {len(frames)} sampled frames ({W}x{H}, {fps:.2f} fps)')


if __name__ == '__main__':
    main()
