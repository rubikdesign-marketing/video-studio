# matte.py <plate.mp4> <out.mov> [--ratio 0.2] [--preview out.jpg]
# Cuts the person out of a treated plate with Robust Video Matting (RVM, ResNet-50, run through onnxruntime).
# RVM carries what it learned from frame to frame, so hair and edges stay steady instead of flickering the way
# a still-image cutout does. Writes ProRes 4444 with a straight alpha channel: the plate's own pixels where the
# person is, see-through elsewhere, at the plate's size and frame rate.
#
# Model: tools/footage/models/rvm_resnet50_fp32.onnx, from github.com/PeterL1n/RobustVideoMatting (GPL-3.0; used as
# a tool on this Mac, not shipped with the studio).
import sys, os, argparse, subprocess, json
import numpy as np
import onnxruntime as ort

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(HERE, '..', 'models', 'rvm_resnet50_fp32.onnx')


def probe(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate',
                          '-of', 'json', path], capture_output=True, text=True, check=True).stdout
    s = json.loads(out)['streams'][0]; n, d = s['r_frame_rate'].split('/')
    return s['width'], s['height'], n + '/' + d


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('plate'); ap.add_argument('out')
    ap.add_argument('--ratio', type=float, default=0.2, help='downsample ratio for the coarse pass (0.2 suits a person filling a 1440x2560 frame)')
    ap.add_argument('--preview', default='')
    ap.add_argument('--erode', type=float, default=0.0, help='pull the matte edge in by this many pixels (0 keeps it)')
    a = ap.parse_args()
    W, H, rate = probe(a.plate)
    providers = [p for p in ['CoreMLExecutionProvider', 'CPUExecutionProvider'] if p in ort.get_available_providers()]
    try:
        sess = ort.InferenceSession(MODEL, providers=providers)
    except Exception:
        sess = ort.InferenceSession(MODEL, providers=['CPUExecutionProvider'])
    dec = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', a.plate, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    enc = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{W}x{H}', '-r', rate, '-i', '-',
                            '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', '-vendor', 'apl0', a.out],
                           stdin=subprocess.PIPE)
    rec = [np.zeros([1, 1, 1, 1], dtype=np.float32)] * 4
    ratio = np.array([a.ratio], dtype=np.float32)
    size = W * H * 3; n = 0; coverage = []
    while True:
        buf = dec.stdout.read(size)
        if len(buf) < size: break
        rgb = np.frombuffer(buf, dtype=np.uint8).reshape(H, W, 3)
        src = (rgb.astype(np.float32) / 255.0).transpose(2, 0, 1)[None]
        fgr, pha, *rec = sess.run(None, {'src': src, 'r1i': rec[0], 'r2i': rec[1], 'r3i': rec[2], 'r4i': rec[3], 'downsample_ratio': ratio})
        alpha = np.clip(pha[0, 0], 0, 1)
        if a.erode > 0:
            import cv2
            k = max(1, int(round(a.erode)))
            alpha = cv2.erode(alpha, np.ones((2 * k + 1, 2 * k + 1), np.uint8))
        # Keep the plate's own pixels (not RVM's predicted foreground) so the cutout matches the plate exactly.
        rgba = np.dstack([rgb, (alpha * 255 + 0.5).astype(np.uint8)])
        enc.stdin.write(rgba.tobytes())
        coverage.append(float(alpha.mean()))
        if a.preview and n == 0:
            from PIL import Image
            bg = np.zeros_like(rgb); bg[..., 1] = 200  # green behind, to see the edge
            comp = (rgb * alpha[..., None] + bg * (1 - alpha[..., None])).astype(np.uint8)
            Image.fromarray(comp).save(a.preview, quality=88)
        n += 1
    enc.stdin.close(); enc.wait(); dec.wait()
    print(f'{os.path.basename(a.out)}: {n} frames {W}x{H}, person covers {100 * np.mean(coverage):.1f}% of the frame on average, '
          f'{100 * np.min(coverage):.1f}% to {100 * np.max(coverage):.1f}%')


if __name__ == '__main__':
    main()
