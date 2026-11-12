# faces.py <clip_dir> [--every 2] [--width 720]
# Finds where the face is in every frame of a clip's working copy (edit.mp4) and writes faces.json beside it.
# Positions and shapes only, for framing: it never works out who someone is and keeps no face prints
# (FOOTAGE-PLAN.md, principle 3). MediaPipe's face landmarker (Apache 2.0), model in tools/footage/models/.
#
# faces.json: { width, height, fps, every, frames: [ {t, box:[x,y,w,h], eyes:[x,y], chin:[x,y], top:[x,y], yaw, mouth} | null ] }
# in working-copy pixels; "smooth" holds the same series smoothed (a centred moving average over about 0.4 s),
# which is what framing uses so the frame never jitters.
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
    rx, ry, rw, rh = [float(v) for v in a.roi.split(',')] if a.roi else (0, 0, 1, 1)
    X0, Y0, RW, RH = int(rx * W), int(ry * H), int(rw * W), int(rh * H)
    scale = a.width / RW
    opts = vision.FaceLandmarkerOptions(base_options=mpt.BaseOptions(model_asset_path=MODEL), running_mode=vision.RunningMode.VIDEO, num_faces=2,
                                        min_face_detection_confidence=0.4, min_tracking_confidence=0.4)
    lm = vision.FaceLandmarker.create_from_options(opts)
    frames = []; i = 0
    while True:
        ok, img = cap.read()
        if not ok: break
        if i % a.every == 0:
            small = cv2.resize(img[Y0:Y0 + RH, X0:X0 + RW], (a.width, int(RH * scale)), interpolation=cv2.INTER_AREA)
            rgb = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(small, cv2.COLOR_BGR2RGB))
            r = lm.detect_for_video(rgb, int(i / fps * 1000))
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
    out = dict(width=W, height=H, fps=fps, every=a.every, found=found, sampled=len(frames), frames=frames, smooth=smooth,
               note='Positions only, for framing. No identity, no face prints.')
    json.dump(out, open(os.path.join(a.clip, 'faces.json'), 'w'))
    print(f'{os.path.basename(a.clip)}: face in {found} of {len(frames)} sampled frames ({W}x{H}, {fps:.2f} fps)')


if __name__ == '__main__':
    main()
