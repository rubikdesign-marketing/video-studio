#!/usr/bin/env python3
"""Catalogue a sound pack someone handed the studio, for local use only.

Usage: local_pack.py <pack folder> <name> [--licence "<what is known>"]

Copies the pack into library/sounds-local/<name>/ (a copy-on-write clone where the disk allows it), measures every
sound and writes library/sounds-local/<name>/index.json in the shape of library/sounds/*/index.json, plus:
  group        from the folder (whoosh, impact, riser, glitch, click, transition, chime, camera, meme, other)
  centroid_hz  how bright it is
  attack_ms    how long it takes to reach its loudest (a hit is under 30 ms; a swell takes hundreds)
  licence      what is known about it; "unknown, owner-supplied, local use only" by default

library/sounds-local/ is never synced (.gitignore): a pack with no known licence must not reach the public
repository. node tools/audio/sounds.mjs find --local reads these catalogues and warns on every use.
"""
import json, os, re, shutil, subprocess, sys
import numpy as np

SR = 22050
AUDIO = ('.wav', '.mp3', '.aif', '.aiff', '.flac', '.m4a', '.ogg')
GROUPS = [('famous', 'meme'), ('faaa', 'meme'), ('subdrop', 'impact'), ('impact', 'impact'), ('hit', 'impact'), ('boom', 'impact'),
          ('riser', 'riser'), ('rise', 'riser'), ('glitch', 'glitch'), ('button', 'click'), ('click', 'click'), ('bell', 'chime'),
          ('chime', 'chime'), ('camera', 'camera'), ('shutter', 'camera'), ('transition', 'transition'), ('horn', 'transition'),
          ('whoosh', 'whoosh'), ('swoosh', 'whoosh'), ('swish', 'whoosh')]
STOP = {'sfx', 'sound', 'sounds', 'effect', 'effects', 'pack', 'the', 'and', 'of', 'mp3', 'wav'}


def measure(x, sr):
    """seconds, peak_db, loudest_db (loudest 400 ms RMS, dBFS), centroid_hz, attack_ms of a mono float signal."""
    x = np.asarray(x, np.float32)
    n = len(x)
    peak = float(np.max(np.abs(x))) if n else 0.0
    out = {'seconds': round(n / sr, 3), 'peak_db': round(20 * np.log10(peak), 1) if peak > 1e-6 else -120.0}
    if peak <= 1e-6:
        return {**out, 'loudest_db': -120.0, 'centroid_hz': 0.0, 'attack_ms': 0.0}
    w = max(1, int(0.4 * sr))
    sq = np.convolve(x.astype(np.float64) ** 2, np.ones(w) / w, mode='valid') if n >= w else np.array([np.mean(x ** 2)])
    out['loudest_db'] = round(10 * np.log10(max(float(sq.max()), 1e-12)), 1)
    spec = np.abs(np.fft.rfft(x[: sr * 4] * np.hanning(min(n, sr * 4))))
    f = np.fft.rfftfreq(min(n, sr * 4), 1 / sr)
    out['centroid_hz'] = round(float((spec * f).sum() / max(spec.sum(), 1e-12)), 0)
    e = np.abs(x)
    k = max(1, int(0.005 * sr))
    env = np.convolve(e, np.ones(k) / k, mode='same')
    top = float(env.max())
    start = int(np.argmax(env > 0.1 * top))
    reach = int(np.argmax(env >= 0.9 * top))
    out['attack_ms'] = round(max(0, reach - start) / sr * 1000, 1)
    return out


def group_of(rel):
    low = rel.lower()
    for key, g in GROUPS:
        if key in low:
            return g
    return 'other'


def feel_words(name):
    base = os.path.splitext(os.path.basename(name))[0]
    words = [w.lower() for w in re.split(r'[^A-Za-z]+', base) if len(w) > 2]
    seen = []
    for w in words:
        if w not in STOP and w not in seen:
            seen.append(w)
    return seen


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32)


def main(argv):
    if len(argv) < 2:
        print(__doc__); return 2
    src, name = argv[0], argv[1]
    licence = argv[argv.index('--licence') + 1] if '--licence' in argv else 'unknown, owner-supplied, local use only'
    here = os.path.dirname(os.path.abspath(__file__))
    dst = os.path.join(here, '..', '..', 'library', 'sounds-local', name)
    if not os.path.isdir(dst):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if subprocess.run(['cp', '-Rc', src, dst]).returncode != 0:
            shutil.copytree(src, dst)
    sounds = []
    for root, _, files in os.walk(dst):
        for fn in sorted(files):
            if not fn.lower().endswith(AUDIO):
                continue
            p = os.path.join(root, fn); rel = os.path.relpath(p, dst)
            m = measure(decode(p), SR)
            g = group_of(rel)
            sounds.append({'id': f'{name}/{g}/{len([s for s in sounds if s["group"] == g]) + 1:03d}', 'file': rel, 'name': os.path.splitext(fn)[0],
                           'group': g, 'feel': feel_words(fn) + feel_words(os.path.basename(root)), **m, 'licence': licence, 'source': 'owner-supplied pack'})
    json.dump({'pack': name, 'licence': licence, 'local_only': True, 'sounds': sounds}, open(os.path.join(dst, 'index.json'), 'w'), indent=1)
    by = {}
    for s in sounds:
        by[s['group']] = by.get(s['group'], 0) + 1
    print(f"{len(sounds)} sounds catalogued in library/sounds-local/{name}: " + ', '.join(f'{g} {n}' for g, n in sorted(by.items(), key=lambda x: -x[1])))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
