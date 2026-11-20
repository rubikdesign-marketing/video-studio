"""Speech-quality score (FOOTAGE-PLAN.md section 7.8): Microsoft's DNSMOS P.835, as in its reference script
(github.com/microsoft/DNS-Challenge, DNSMOS/dnsmos_local.py; models CC BY 4.0, in tools/footage/models/dnsmos/).

    python dnsmos.py <sound> [--segments segments.json] [--json out.json]

Scores, from 1 (bad) to 5 (excellent), what a panel of listeners would say:
  SIG   the voice itself (distortion, a voice that sounds processed or underwater)
  BAK   the background (noise, hum, music)
  OVRL  overall
The whole file is scored in 9 s windows a second apart (shorter sound is repeated to fill a window, as the reference
script does). With --segments ([{"id", "start", "end"}...], seconds) each stretch is scored on its own: one line of
speech at a time. A repair that lowers SIG or OVRL is turned down.
"""
import json
import os
import subprocess
import sys

import numpy as np

# onnxruntime has Microsoft telemetry built in (a collector at events.data.microsoft.com): off, before it loads.
os.environ['ORT_DISABLE_TELEMETRY'] = '1'
import onnxruntime as ort  # noqa: E402

ort.disable_telemetry_events()

import os as _os, sys as _sys
_sys.path.insert(0, _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '.'))
from _ff import FFMPEG, FFPROBE  # noqa: E402
RATE = 16000
WINDOW = 9.01
MODEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'models', 'dnsmos', 'sig_bak_ovr.onnx')
# Non-personalised polynomials from the reference script: raw model output to the 1-5 scale.
P_SIG = np.poly1d([-0.08397278, 1.22083953, 0.0052439])
P_BAK = np.poly1d([-0.13166888, 1.60915514, -0.39604546])
P_OVR = np.poly1d([-0.06766283, 1.11546468, 0.04602535])

_session = None


def session():
    global _session
    if _session is None:
        if not os.path.exists(MODEL):
            raise SystemExit('The speech-quality model is missing (tools/footage/models/dnsmos). Run: node setup/runtime/install.mjs --with footage-audio-python')
        opts = ort.SessionOptions()
        opts.log_severity_level = 3
        _session = ort.InferenceSession(MODEL, opts, providers=['CPUExecutionProvider'])
    return _session


def load(path):
    raw = subprocess.run([FFMPEG, '-v', 'error', '-i', path, '-ac', '1', '-ar', str(RATE), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def score(audio):
    """SIG, BAK, OVRL for a stretch of 16 kHz sound."""
    n = int(WINDOW * RATE)
    if len(audio) == 0:
        return None
    x = audio
    while len(x) < n:
        x = np.concatenate([x, audio])
    hops = int(np.floor(len(x) / RATE) - WINDOW) + 1
    sig, bak, ovr = [], [], []
    for i in range(max(1, hops)):
        seg = x[i * RATE: i * RATE + n]
        if len(seg) < n:
            continue
        s, b, o = session().run(None, {'input_1': seg.astype(np.float32)[np.newaxis, :]})[0][0]
        sig.append(P_SIG(s)); bak.append(P_BAK(b)); ovr.append(P_OVR(o))
    return {'SIG': round(float(np.mean(sig)), 3), 'BAK': round(float(np.mean(bak)), 3), 'OVRL': round(float(np.mean(ovr)), 3)}


def main():
    src = sys.argv[1]
    audio = load(src)
    out = {'file': src, 'whole': score(audio)}
    if '--segments' in sys.argv:
        segs = json.load(open(sys.argv[sys.argv.index('--segments') + 1]))
        out['segments'] = []
        for s in segs:
            a, b = int(s['start'] * RATE), int(s['end'] * RATE)
            if b - a < RATE // 4:
                continue
            out['segments'].append({'id': s.get('id'), 'start': s['start'], 'end': s['end'], **(score(audio[a:b]) or {})})
    if '--json' in sys.argv:
        json.dump(out, open(sys.argv[sys.argv.index('--json') + 1], 'w'), indent=1)
    print(json.dumps(out))


if __name__ == '__main__':
    main()
