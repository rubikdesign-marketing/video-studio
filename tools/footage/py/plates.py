# plates.py <job_dir> <shots.json>
# Makes the treated picture ("plate") for each shot of a footage edit: the working copy's stretch, framed by a
# crop window, colour-matched on skin to one reference shot, given the film's look, and scaled to the plate size.
# FOOTAGE-PLAN.md sections 6.1 to 6.4, in the simple form this first real edit needs.
#
# shots.json: { "reference": "<shot id>", "look": {...}, "shots": [ { "id", "clip", "in", "out", "crop": [x, y, w, h],
#               "size": [W, H], "denoise": 0..3, "match": 0..1 } ] }   (crop in working-copy pixels, upright)
# Writes <job>/edit/plates/<id>.mp4 (H.264, high quality, the film's frame rate) and plates.json with what was
# measured and applied. Skin is measured inside the face box from faces.json (tools/footage/py/faces.py).
import sys, os, json, subprocess
import numpy as np, cv2

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # run with -I: the helper beside this file
from _ff import FFMPEG  # noqa: E402

def srgb_to_lin(c): c = c / 255.0; return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

def skin(clip_dir, t0, t1, n=7):
    """Mean linear RGB of the cheeks, over n frames between t0 and t1."""
    faces = json.load(open(os.path.join(clip_dir, 'faces.json')))
    cap = cv2.VideoCapture(os.path.join(clip_dir, 'edit.mp4')); fps = cap.get(cv2.CAP_PROP_FPS)
    vals = []
    for t in np.linspace(t0 + 0.1, t1 - 0.1, n):
        s = min(faces['smooth'], key=lambda f: abs(f['t'] - t))
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(t * fps)); ok, img = cap.read()
        if not ok: continue
        ex, ey = s['eyes']; cy = s['chin'][1]; fh = cy - s['top'][1]; w = s['box'][2]
        # Cheeks: a band between the eyes and the mouth, either side of the nose.
        y0, y1 = int(ey + 0.12 * fh), int(ey + 0.32 * fh)
        for side in (-1, 1):
            x0 = int(ex + side * 0.28 * w - 0.08 * w); x1 = int(x0 + 0.16 * w)
            patch = img[max(0, y0):y1, max(0, x0):x1][..., ::-1].reshape(-1, 3).astype(float)
            if len(patch): vals.append(srgb_to_lin(patch).mean(0))
    cap.release()
    return np.mean(vals, 0)

def main():
    job, spec = sys.argv[1], json.load(open(sys.argv[2]))
    clips = os.path.join(job, 'edit', 'clips'); out_dir = os.path.join(job, 'edit', 'plates'); os.makedirs(out_dir, exist_ok=True)
    shots = spec['shots']; fps = spec.get('fps', 30); look = spec.get('look', {})
    only = set(sys.argv[3].split(',')) if len(sys.argv) > 3 else None
    stats = {s['id']: skin(os.path.join(clips, s['clip']), s['in'], s['out']) for s in shots if not only or s['id'] in only or s['id'] == spec['reference']}
    ref = stats[spec['reference']]
    lum = lambda c: 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    report = {}
    for s in shots:
        if only and s['id'] not in only: continue
        c = stats[s['id']]; m = s.get('match', 0.8)
        # White balance on skin: per-channel gains that make the cheek colour match the reference's, at equal brightness.
        wb = (ref / lum(ref)) / (c / lum(c)); wb = wb / lum(wb * np.ones(3)) if False else wb / wb[1]
        wb = 1 + (wb - 1) * m
        expo = (lum(ref) / lum(c)) ** (0.5 * m)          # half the exposure gap, scaled by match (rooms keep some of their own light)
        expo = float(np.clip(expo, 0.8, 1.35))
        # In linear light these are multiplies; applied through lutrgb on 8-bit sRGB values.
        g = [float(np.clip(wb[i] * expo, 0.6, 1.6)) for i in range(3)]
        def ch(gain):
            return f"'clip(255*pow(min(1,pow(val/255,2.2)*{gain:.4f}),1/2.2),0,255)'"
        x, y, w, h = s['crop']; W, H = s['size']
        dn = s.get('denoise', 1)
        den = {0: '', 1: 'hqdn3d=1.2:1.2:4:4,', 2: 'hqdn3d=2.2:2:6:6,', 3: 'hqdn3d=3.5:3:8:8,'}[dn]
        contrast, sat, warm = look.get('contrast', 1.05), look.get('saturation', 1.06), look.get('warm', 0.02)
        vf = (f"trim=start={s['in']}:end={s['out']},setpts=PTS-STARTPTS,fps={fps},crop={w}:{h}:{x}:{y},{den}"
              f"lutrgb=r={ch(g[0] * (1 + warm))}:g={ch(g[1])}:b={ch(g[2] * (1 - warm))},"
              f"scale={W}:{H}:flags=lanczos,"
              f"eq=contrast={contrast}:saturation={sat}:gamma={look.get('gamma', 1.0)},"
              f"unsharp=5:5:{look.get('sharpen', 0.35)}:5:5:0,format=yuv420p")
        out = os.path.join(out_dir, f"{s['id']}.mp4")
        src = os.path.join(clips, s['clip'], 'edit.mp4')
        r = subprocess.run([FFMPEG, '-v', 'error', '-y', '-i', src, '-vf', vf, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '12',
                            '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', out],
                           capture_output=True, text=True)
        if r.returncode: sys.exit(f"{s['id']}: ffmpeg failed\n{r.stderr[-800:]}")
        report[s['id']] = dict(skin_linear=[round(float(v), 4) for v in c], gains=[round(v, 3) for v in g], exposure=round(expo, 3), crop=s['crop'], size=s['size'],
                               upscale=round(W / w, 3))
        print(f"{s['id']:10} gains R {g[0]:.3f} G {g[1]:.3f} B {g[2]:.3f}  exposure x{expo:.2f}  scale x{W / w:.2f}  -> {out}")
    json.dump(dict(reference=spec['reference'], look=look, shots=report), open(os.path.join(out_dir, 'plates.json'), 'w'), indent=1)

if __name__ == '__main__':
    main()
