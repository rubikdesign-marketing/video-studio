"""Face test footage with known answers (FOOTAGE-PLAN.md phase 4), made from openly licensed portrait photos
(CC0 from Openverse: `node tools/media/openverse.mjs get <id>`). No real recording of anyone: a still portrait is
placed in the frame, swayed or shaken by known amounts, and its mouth opened in time to synthetic speech.

    python make_face_clips.py <out_job> --presenter <photo> --second <photo> --speech <talking.wav>
        --duo-speech <interview stereo wav> --duo-lines <truth.json from make_clips.mjs, "interview" lines>

Writes <out_job>/footage/presenter.mp4 (3840x2160), duo.mp4 (1920x1080, two people, each mouth moving on that
person's lines) and shaky.mp4 (1920x1080, hand shake), and <out_job>/truth.json: per frame where each face's eyes are,
which person speaks each line, and the shake added.
"""
import argparse
import json
import os
import subprocess

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision

FFMPEG = '/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg'
MODEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'models', 'face_landmarker.task')
FPS = 30


def landmarks(img):
    lm = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=mpt.BaseOptions(model_asset_path=MODEL), num_faces=1))
    r = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(img, cv2.COLOR_BGR2RGB)))
    if not r.face_landmarks:
        raise SystemExit('No face found in the portrait.')
    f = r.face_landmarks[0]
    h, w = img.shape[:2]
    p = lambda i: np.array([f[i].x * w, f[i].y * h])
    return {'eyes': (p(33) + p(263)) / 2, 'mouth': (p(13) + p(14)) / 2, 'left': p(61), 'right': p(291), 'chin': p(152), 'top': p(10)}


def envelope(wav, n_frames):
    raw = subprocess.run([FFMPEG, '-v', 'error', '-i', wav, '-ac', '1', '-ar', '48000', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32)
    hop = 48000 // FPS
    e = np.array([np.sqrt(np.mean(x[i * hop:(i + 1) * hop] ** 2)) if i * hop < len(x) else 0 for i in range(n_frames)])
    e = np.convolve(e, np.ones(3) / 3, 'same')
    return np.clip(e / (np.percentile(e, 95) + 1e-9), 0, 1)


def open_mouth(img, lm, amount):
    """Opens the mouth by `amount` (0-1): the jaw below the mouth is pushed down, and the gap between the lips drawn."""
    if amount < 0.04:
        return img
    h, w = img.shape[:2]
    mw = np.linalg.norm(lm['right'] - lm['left'])
    d = amount * 0.32 * mw
    cx, my = lm['mouth']; cy = lm['chin'][1]
    bottom = cy + 0.35 * (cy - my)
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    band = np.clip(1 - np.abs(xs - cx) / (1.1 * mw), 0, 1) ** 0.8
    t = np.clip((ys - my) / (bottom - my), 0, 1)
    shift = np.where(ys > my, d * (1 - t) * band, 0).astype(np.float32)
    out = cv2.remap(img, xs, ys - shift, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    mask = np.zeros((h, w), np.float32)
    cv2.ellipse(mask, (int(cx), int(my + d / 2)), (int(0.42 * mw), max(1, int(d / 2))), 0, 0, 360, 1, -1)
    mask = cv2.GaussianBlur(mask, (0, 0), 1.2)[..., None]
    return (out * (1 - mask) + np.array([40, 30, 55], np.float32) * mask).astype(np.uint8)


def place(photo, size, face_at, face_h):
    """The photo scaled so the face is face_h tall and its eyes land at face_at (shares of the frame)."""
    img = cv2.imread(photo)
    lm = landmarks(img)
    fh = lm['chin'][1] - lm['top'][1]
    s = face_h * size[1] / fh
    img = cv2.resize(img, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    lm = {k: v * s for k, v in lm.items()}
    off = np.array([face_at[0] * size[0], face_at[1] * size[1]]) - lm['eyes']
    return img, lm, off


def frame_of(img, lm, off, size, dx=0, dy=0, mouth=0.0):
    W, H = size
    m = np.float32([[1, 0, off[0] + dx], [0, 1, off[1] + dy]])
    moved = {k: v + off + np.array([dx, dy]) for k, v in lm.items()}
    face = open_mouth(img, lm, mouth)
    return cv2.warpAffine(face, m, (W, H), borderMode=cv2.BORDER_REPLICATE), moved


def write(path, frames_iter, size, audio):
    p = subprocess.Popen([FFMPEG, '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{size[0]}x{size[1]}', '-r', str(FPS), '-i', '-',
                          '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-shortest', path],
                         stdin=subprocess.PIPE)
    for f in frames_iter:
        p.stdin.write(f.tobytes())
    p.stdin.close(); p.wait()


def duration(wav):
    return float(subprocess.run(['/opt/homebrew/opt/ffmpeg-full/bin/ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav], capture_output=True, text=True).stdout)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('out'); ap.add_argument('--presenter', required=True); ap.add_argument('--second', required=True)
    ap.add_argument('--speech', required=True); ap.add_argument('--duo-speech', required=True); ap.add_argument('--duo-lines', required=True)
    a = ap.parse_args()
    foot = os.path.join(a.out, 'footage'); os.makedirs(foot, exist_ok=True)
    truth = {}

    # 1. The presenter, 4K: eyes a little right of centre, swaying slowly (known amounts), mouth on the speech.
    size = (3840, 2160)
    img, lm, off = place(a.presenter, size, (0.6, 0.4), 0.16)
    n = int(duration(a.speech) * FPS)
    env = envelope(a.speech, n)
    eyes = []
    def presenter():
        for i in range(n):
            t = i / FPS
            dx, dy = 60 * np.sin(2 * np.pi * t / 7), 18 * np.sin(2 * np.pi * t / 5)
            f, mv = frame_of(img, lm, off, size, dx, dy, env[i])
            eyes.append([round(float(v), 1) for v in mv['eyes']])
            yield f
    write(os.path.join(foot, 'presenter.mp4'), presenter(), size, a.speech)
    truth['presenter'] = {'size': size, 'fps': FPS, 'eyes': eyes, 'face_h_share': 0.16}

    # 2. Two people, 1080p: left and right, each mouth moving only on that person's lines.
    size = (1920, 1080)
    lines = json.load(open(a.duo_lines))['interview']['lines']
    left = place(a.second, size, (0.3, 0.4), 0.3); right = place(a.presenter, size, (0.72, 0.4), 0.3)
    n = int(duration(a.duo_speech) * FPS)
    env = envelope(a.duo_speech, n)
    who = np.array(['' for _ in range(n)], dtype=object)
    for ln in lines:
        who[int(ln['start'] * FPS):int(ln['end'] * FPS) + 1] = ln['who']
    eyes_l, eyes_r = [], []
    def duo():
        for i in range(n):
            fl, ml = frame_of(*left, size, mouth=env[i] if who[i] == 'A' else 0)
            fr, mr = frame_of(*right, size, mouth=env[i] if who[i] == 'B' else 0)
            m = np.zeros((size[1], size[0], 1), np.float32); m[:, :size[0] // 2] = 1
            m = cv2.GaussianBlur(m, (0, 0), 25)[..., None] if m.ndim == 2 else cv2.GaussianBlur(m[..., 0], (0, 0), 25)[..., None]
            eyes_l.append([round(float(v), 1) for v in ml['eyes']]); eyes_r.append([round(float(v), 1) for v in mr['eyes']])
            yield (fl * m + fr * (1 - m)).astype(np.uint8)
    write(os.path.join(foot, 'duo.mp4'), duo(), size, a.duo_speech)
    truth['duo'] = {'size': size, 'fps': FPS, 'lines': [{'who': l['who'], 'face': 'left' if l['who'] == 'A' else 'right', 'start': l['start'], 'end': l['end'], 'text': l['text']} for l in lines], 'eyes_left': eyes_l[0], 'eyes_right': eyes_r[0]}

    # 3. Hand-held: the presenter at 1080p with shake (known, 6-11 Hz, up to about 20 px).
    size = (1920, 1080)
    img, lm, off = place(a.presenter, size, (0.55, 0.4), 0.22)
    n = int(min(duration(a.speech), 10) * FPS)
    env = envelope(a.speech, n)
    rng = np.random.default_rng(11)
    sx = np.convolve(rng.standard_normal(n + 8), np.ones(4) / 4, 'same')[:n] * 14
    sy = np.convolve(rng.standard_normal(n + 8), np.ones(4) / 4, 'same')[:n] * 10
    def shaky():
        for i in range(n):
            f, _ = frame_of(img, lm, off, size, sx[i], sy[i], env[i])
            yield f
    write(os.path.join(foot, 'shaky.mp4'), shaky(), size, a.speech)
    truth['shaky'] = {'size': size, 'fps': FPS, 'shake_px_rms': round(float(np.sqrt(np.mean(sx ** 2 + sy ** 2))), 1)}

    json.dump(truth, open(os.path.join(a.out, 'truth.json'), 'w'))
    print(json.dumps({k: list(v.keys()) for k, v in truth.items()}))


if __name__ == '__main__':
    main()
