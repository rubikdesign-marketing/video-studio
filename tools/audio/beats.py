#!/usr/bin/env python3
"""Find the beat of a music track, and check that a film's cuts land on it.

Run it with the studio's own Python (it has librosa; the system python3 does not):
  tools/footage/.venv/bin/python tools/audio/beats.py <command> ...

Commands:
  grid  <track> [--out <track>.beats.json] [--fps 30] [--first-downbeat <seconds>]
        Listen to the track and write its beat grid: the tempo, every beat, the bar starts (downbeats),
        the sections with how loud each one is (1 quiet .. 5 full), and the drop. Defaults to the track's
        name with .beats.json. --first-downbeat sets the bar start by hand (the beat nearest that time) when you know
        it, as for a bed cut on a bar start. Takes a few seconds for a 60 s track. Needs no network and no model.
  snap  <beats.json> --cuts 0,3.2,6.5 [--to beats|downbeats] [--within 0.25] [--fps 30]
        For each cut time you plan, says which beat is nearest, how far it is, and whether it is
        within --within seconds. Exit 0 when every cut is within, 1 when one is not.
  check <beats.json> <job_dir> [--offset 0] [--on beats|downbeats] [--fps 30]
        Reads jobs/<job>/shots.json: the cuts are the starts of every scene after the first, found by adding
        up the scenes' "seconds". Says for each cut how many frames it is from the nearest beat, and passes
        only when every cut is within ONE frame. --offset is where the music starts in the film, in
        seconds (music that starts 1 s into the film: --offset 1). Exit 0 pass, 1 a cut is off the beat,
        2 could not check (file missing, no cuts, a scene with no length).

What the grid is, and what it is not:
  - Beats start from librosa's beat tracker; the exact spacing is then measured from the track itself and each
    beat is walked forward and moved onto the real hit heard beside it (within about 40 ms). Where no hit is heard
    the grid keeps its spacing. It is a good grid for music with a steady pulse and a poor one for ambient music or
    music that speeds up and slows down. tempo_confidence says which: 1 is a machine-steady pulse,
    below about 0.5 treat the grid as a guess and listen before cutting to it.
  - The tempo is taken as the tracker finds it. It can land on half or double the tempo you would tap
    (60 or 120 for the same song); the notes in the file say when it looks that way.
  - Downbeats are ESTIMATED, not read from a score. The meter is ASSUMED to be 4 beats to a bar. Of the four
    places the first bar could start, the grid picks the one whose beats are on average the strongest
    and the lowest in pitch (kick and bass on the one). If the best two are close, the notes say the
    guess is weak. A 3/4 waltz will come out wrong.
  - Sections are found by comparing bars (loudness, hit density, brightness) and joining similar bars that sit
    next to each other. Section edges are bar starts. Energy 1..5 is relative to this track's own range.
  - The drop is the bar where the energy rises the most after a quieter stretch (at least 3 dB louder), or null when no bar
    rises by enough (a flat bed has no drop). It is a bar start, in seconds.
Needs: numpy, librosa, soundfile (tools/footage/.venv has them). No network.
"""
import argparse, json, math, os, sys

METER = 4
SR = 22050
HOP = 32                  # 1.45 ms per frame: fine enough that the tempo is not rounded to whole frames
N_FFT = 1024
REFINE_S = 0.017          # seconds either side a beat may move onto the nearest hit


# ---------------------------------------------------------------- small helpers

def r3(x):
    return round(float(x), 3)


def clamp(x, lo, hi):
    return max(lo, min(hi, x))


def nearest(sorted_times, t):
    """The value in sorted_times nearest to t (None when the list is empty)."""
    best = None
    for v in sorted_times:
        if best is None or abs(v - t) < abs(best - t):
            best = v
        elif v > t:
            break
    return best


def norm01(a, lo_pct=5, hi_pct=95):
    import numpy as np
    a = np.asarray(a, dtype=float)
    if a.size == 0:
        return a
    lo, hi = np.percentile(a, lo_pct), np.percentile(a, hi_pct)
    if hi - lo < 1e-9:
        return np.zeros_like(a)
    return np.clip((a - lo) / (hi - lo), 0, 1)


# ---------------------------------------------------------------- grid

def beat_times(y, sr, env):
    """Beat times in seconds, tempo (bpm), and notes, from the onset envelope."""
    import numpy as np, librosa
    notes = []
    # 1. A rough tempo and rough beats from librosa's tracker, run on a coarse envelope (fast; it can only
    #    count whole frames, so its tempo is off by up to half a percent, which drifts over a minute).
    hop_c = 128
    env_c = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_c, n_fft=N_FFT, aggregate=np.median)
    tempo_c, frames = librosa.beat.beat_track(onset_envelope=env_c, sr=sr, hop_length=hop_c, tightness=100, units="frames")
    frames = np.asarray(frames, dtype=int)
    if len(frames) < 4:
        return np.array([]), 0.0, ["Fewer than four beats were found: this track has no clear pulse."]
    fr = HOP / sr
    period_c = float(np.median(np.diff(frames))) * hop_c / sr
    # 2. The real spacing: the strongest repeat of the fine envelope within 4% of the rough one, to a fraction of a frame.
    e = env - env.mean()
    ac = librosa.autocorrelate(e)
    lo, hi = int(period_c * 0.96 / fr), int(period_c * 1.04 / fr) + 1
    k = lo + int(np.argmax(ac[lo:hi]))
    d = ac[k - 1] - 2 * ac[k] + ac[k + 1]
    k_f = k + (0.5 * (ac[k - 1] - ac[k + 1]) / d if abs(d) > 1e-12 else 0.0)
    period0 = k_f * fr
    # 3. Walk the beats: from the first beat the tracker found, step one spacing at a time and move onto the hit
    #    heard nearby (a phase-locked loop). Where no hit is heard the grid keeps its spacing. This follows a
    #    track that drifts a little and stays regular through quiet stretches.
    thr = 0.25 * np.percentile(env, 90)
    win = int(0.04 / fr)
    t = float(frames[0] * hop_c / sr)
    f0 = int(round(t / fr)); lo_, hi_ = max(0, f0 - win), min(len(env), f0 + win + 1)
    t = (lo_ + int(np.argmax(env[lo_:hi_]))) * fr
    period = period0
    tl = [t]
    dur_s = len(y) / sr
    while t + period < dur_s - 0.02:
        pred = t + period
        f = int(round(pred / fr)); lo_, hi_ = max(0, f - win), min(len(env), f + win + 1)
        seg = env[lo_:hi_]
        if len(seg) and seg.max() >= thr:
            peak = (lo_ + int(np.argmax(seg))) * fr
            err = peak - pred
            t = pred + 0.6 * err
            period = float(np.clip(period + 0.1 * err, period0 * 0.97, period0 * 1.03))
        else:
            t = pred
        tl.append(t)
    times = np.array(tl)
    tempo = 60.0 * (len(times) - 1) / (times[-1] - times[0])      # the average over the whole run
    period = 60.0 / tempo
    # Add the beats before the first one found, while a hit is heard there.
    dur = len(y) / sr
    thr = 0.3 * np.percentile(env, 90)
    def has_hit(t):
        f = int(round(t / (HOP / sr)))
        w = int(0.04 / (HOP / sr))
        return 0 <= f < len(env) and env[max(0, f - w):f + w + 1].max() >= thr
    extra_before = []
    t = times[0] - period
    while t >= 0.05 and has_hit(t):
        extra_before.append(max(t, 0.0)); t -= period
    n_trim = 0
    while len(times) > 4 and not has_hit(times[-1]):          # a silent tail has no beats
        times = times[:-1]; n_trim += 1
    if n_trim:
        notes.append(f"{n_trim} beat(s) at the very end were left out because no hit is heard there.")
    times = np.concatenate([np.array(sorted(extra_before)), times])
    return times, tempo, notes


def tempo_confidence(env, times, period_s):
    import librosa
    """0..1. Half is how clearly the track repeats at the beat spacing (autocorrelation of the hits),
    half is how many beats land on a real hit (the hit strength beside the beat against the strong hits)."""
    import numpy as np
    fr = HOP / SR
    e = env - env.mean()
    ac = librosa.autocorrelate(e)
    if ac[0] <= 0:
        return 0.0
    lag = int(round(period_s / fr))
    w = max(2, int(0.02 / fr))
    clarity = clamp(float(ac[max(1, lag - w):lag + w + 1].max() / ac[0]), 0.0, 1.0)
    # Autocorrelation of a finite clip is biased down by (1 - lag/len); undo that.
    clarity = clamp(clarity / max(0.2, 1.0 - lag / len(e)), 0.0, 1.0)
    thr = 0.3 * np.percentile(env, 90)
    hit = 0
    for t in times:
        f = int(round(t / fr))
        lo, hi = max(0, f - int(0.04 / fr)), min(len(env), f + int(0.04 / fr) + 1)
        if hi > lo and env[lo:hi].max() >= thr:
            hit += 1
    aligned = hit / max(1, len(times))
    return round(0.5 * clarity + 0.5 * aligned, 2)


def pick_downbeats(y, sr, env, times):
    """Index of the beat that starts the first bar, and a note. See the header for how."""
    import numpy as np, scipy.signal as sg
    fr = HOP / SR
    # Low-frequency energy envelope (under 200 Hz).
    sos = sg.butter(4, 200, btype="low", fs=sr, output="sos")
    low = sg.sosfilt(sos, y)
    low_env = np.sqrt(np.convolve(low ** 2, np.ones(512) / 512, mode="same"))[::HOP]
    n = min(len(env), len(low_env))
    a, b = env[:n] / (env[:n].max() + 1e-9), low_env[:n] / (low_env[:n].max() + 1e-9)   # not clipped: accents must stay taller
    acc = []
    for t in times:
        f = int(round(t / fr))
        w = int(round(0.02 / fr))
        lo, hi = max(0, f - w), min(n, f + w + 1)
        acc.append(0.5 * a[lo:hi].max() + 0.5 * b[lo:hi].max() if hi > lo else 0.0)
    acc = np.array(acc)
    scores = np.array([acc[p::METER].mean() if len(acc[p::METER]) else 0.0 for p in range(METER)])
    order = np.argsort(scores)[::-1]
    best, second = scores[order[0]], scores[order[1]]
    margin = (best - second) / max(best, 1e-9)
    note = None
    if margin < 0.08:
        note = ("The bar start is a weak guess: the four possible starting beats score within "
                f"{margin * 100:.0f}% of each other, so check by ear which beat is the one.")
    return int(order[0]), note


def bar_features(y, sr, env, bar_starts, end):
    """For each bar: loudness (dB), hits per second, brightness (spectral centroid)."""
    import numpy as np, librosa
    fr = HOP / SR
    rms = librosa.feature.rms(y=y, frame_length=N_FFT, hop_length=HOP)[0]
    cent = librosa.feature.spectral_centroid(y=y, sr=sr, n_fft=N_FFT, hop_length=HOP)[0]
    out = []
    bounds = list(bar_starts) + [end]
    for i in range(len(bar_starts)):
        a, b = int(bounds[i] / fr), max(int(bounds[i] / fr) + 1, int(bounds[i + 1] / fr))
        seg = slice(a, min(b, len(rms)))
        out.append([20 * math.log10(float(np.mean(rms[seg])) + 1e-6) if a < len(rms) else -120.0,
                    float(np.mean(env[seg])) if a < len(env) else 0.0,
                    float(np.mean(cent[seg])) if a < len(cent) else 0.0])
    return np.array(out)


def sections_and_drop(y, sr, env, downbeats, dur):
    import numpy as np, librosa
    notes = []
    prefixed = False
    starts = list(downbeats)
    if len(starts) < 4:                                   # too few bars to compare: use 2 s windows
        starts = list(np.arange(0.0, dur, 2.0))
        notes.append("Fewer than four bars: sections come from 2 s windows, not bars.")
    elif starts[0] > 0.05:
        prefixed = True
        starts = [0.0] + starts                           # the stretch before the first bar start is a section part too
    feats = bar_features(y, sr, env, starts, dur)
    energy = 0.7 * norm01(feats[:, 0]) + 0.3 * norm01(feats[:, 1])
    n = len(starts)
    k = int(clamp(round(dur / 15.0), 1, 8))
    k = min(k, max(1, n // 2))
    if k > 1 and n >= 4:
        x = (feats - feats.mean(0)) / (feats.std(0) + 1e-9)
        edges = librosa.segment.agglomerative(x.T, k)     # first bar index of each section
        edges = sorted(set(int(e) for e in edges) | {0})
    else:
        edges = [0]
    lo, hi = float(energy.min()), float(energy.max())
    secs = []
    for j, e in enumerate(edges):
        e_end = edges[j + 1] if j + 1 < len(edges) else n
        level = float(np.mean(energy[e:e_end]))
        score = 1 + int(min(4, math.floor(5 * (level - lo) / max(hi - lo, 1e-9)))) if hi - lo > 0.15 else 3
        secs.append({"start": r3(starts[e]), "end": r3(starts[e_end] if e_end < n else dur), "energy": score})
    # Join neighbours that came out with the same energy (a section is a change, not a count of bars).
    merged = []
    for s in secs:
        if merged and merged[-1]["energy"] == s["energy"]:
            merged[-1]["end"] = s["end"]
        else:
            merged.append(dict(s))
    # Drop: the biggest rise from the bars before to the bars after, when the bars before are the quieter side.
    drop, rise_best = None, 0.0
    sm = np.convolve(energy, np.ones(2) / 2, mode="valid") if n >= 2 else energy
    for i in range(3 if prefixed else 2, n - 1):   # the stretch before the first bar start is not a bar
        before = float(np.mean(energy[max(1 if prefixed else 0, i - 4):i]))
        after = float(np.mean(energy[i:i + 2]))
        rise = after - before
        db_rise = float(np.mean(feats[i:i + 2, 0]) - np.mean(feats[max(1 if prefixed else 0, i - 4):i, 0]))
        if rise > rise_best and db_rise >= 3.0 and before < float(np.mean(energy)) + 0.05:
            rise_best, drop = rise, i
    if drop is not None and rise_best >= 0.25:
        drop_t = r3(starts[drop])
        notes.append(f"Drop: the energy rises by {rise_best:.2f} (0..1) at {drop_t} s, after a quieter stretch.")
    else:
        drop_t = None
        notes.append("No drop: no bar lifts the energy by a clear margin over the bars before it.")
    return merged, drop_t, notes


def build_grid(path, fps=30, first_downbeat=None):
    import numpy as np, librosa
    y, sr = librosa.load(path, sr=SR, mono=True)
    dur = len(y) / sr
    if dur < 3:
        sys.exit(f"{path}: only {dur:.1f} s of audio, too short to find a beat in.")
    env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=HOP, n_fft=N_FFT, aggregate=np.median)
    times, tempo, notes = beat_times(y, sr, env)
    if len(times) < 4:
        sys.exit(f"{path}: {notes[0]}")
    period = 60.0 / tempo
    conf = tempo_confidence(env, times, period)
    first_bar, weak = pick_downbeats(y, sr, env, times)
    if first_downbeat is not None:
        # The caller knows where a bar starts (a bed cut on a bar start): the beat nearest that time starts the bars.
        j = int(np.argmin(np.abs(times - first_downbeat)))
        first_bar = j % METER
        notes.append(f"Bar starts were set by hand: the beat at {times[j]:.3f} s (nearest to {first_downbeat:g} s) is a bar start. "
                     + ("" if abs(times[j] - first_downbeat) < 0.3 * period else "That beat is far from the time given; check it. "))
    elif weak:
        notes.append(weak)
    downs = times[first_bar::METER]
    bars = int(sum(1 for i in range(first_bar, len(times), METER) if i + METER <= len(times)))
    secs, drop, snotes = sections_and_drop(y, sr, env, downs, dur)
    notes.extend(snotes)
    if tempo < 70:
        notes.append(f"The tempo came out at {tempo:.0f} bpm: slow, or the tracker may have found half the beat you would tap ({tempo * 2:.0f}).")
    elif tempo > 175:
        notes.append(f"The tempo came out at {tempo:.0f} bpm: fast, or the tracker may have found double the beat you would tap ({tempo / 2:.0f}).")
    if conf < 0.5:
        notes.append("Steadiness is low: the pulse is weak or uneven, so treat the grid as a guess and listen before cutting to it.")
    notes.append("Downbeats are estimated (strongest and lowest-pitched of four possible phases) and the meter is assumed to be 4.")
    return {
        "file": os.path.basename(path),
        "seconds": r3(dur),
        "tempo_bpm": round(tempo, 1),
        "tempo_confidence": conf,
        "beats": [r3(t) for t in times],
        "downbeats": [r3(t) for t in downs],
        "bars": bars,
        "meter": METER,
        "meter_note": "assumed 4 beats to a bar; not detected",
        "downbeat_method": "set by hand (first_downbeat given)" if first_downbeat is not None else "estimated: of the four possible bar starts, the one whose beats are on average strongest and lowest-pitched",
        "fps": fps,
        "beat_frames": [int(round(t * fps)) for t in times],
        "downbeat_frames": [int(round(t * fps)) for t in downs],
        "sections": secs,
        "drop": drop,
        "notes": notes,
    }


def cmd_grid(a):
    if not os.path.exists(a.track):
        print(f"No such file: {a.track}", file=sys.stderr); return 2
    out = a.out or os.path.splitext(a.track)[0] + ".beats.json"
    g = build_grid(a.track, a.fps, a.first_downbeat)
    with open(out, "w") as f:
        json.dump(g, f, indent=1)
        f.write("\n")
    print(f"{g['file']}: {g['seconds']} s, {g['tempo_bpm']} bpm (steadiness {g['tempo_confidence']}), "
          f"{len(g['beats'])} beats, {g['bars']} bars, {len(g['sections'])} sections, drop "
          f"{'at ' + str(g['drop']) + ' s' if g['drop'] is not None else 'none'}.")
    for n in g["notes"]:
        print("  - " + n)
    print(f"Wrote {out}")
    return 0


# ---------------------------------------------------------------- snap and check

def load_grid(path):
    try:
        g = json.load(open(path))
        assert isinstance(g.get("beats"), list) and g["beats"]
        return g
    except (OSError, ValueError, AssertionError):
        print(f"Cannot read a beat grid from {path} (make one with: beats.py grid <track>).", file=sys.stderr)
        return None


def grid_times(g, which, offset=0.0):
    key = "downbeats" if which == "downbeats" else "beats"
    return [float(t) + offset for t in g.get(key) or []]


def spacing(times):
    d = [b - a for a, b in zip(times, times[1:])]
    return sorted(d)[len(d) // 2] if d else 0.5


def cmd_snap(a):
    g = load_grid(a.grid)
    if g is None:
        return 2
    try:
        cuts = [float(x) for x in a.cuts.split(",") if x.strip() != ""]
    except ValueError:
        print("--cuts wants seconds separated by commas, like 0,3.2,6.5", file=sys.stderr); return 2
    times = grid_times(g, a.to)
    if not times:
        print(f"The grid has no {a.to}.", file=sys.stderr); return 2
    allin = True
    results = []
    for i, c in enumerate(cuts):
        b = nearest(times, c)
        shift = b - c
        within = abs(shift) <= a.within + 1e-9
        allin &= within
        results.append({"cut": c, "nearest": r3(b), "shift": r3(shift), "within": within})
        word = "later" if shift > 0 else "earlier"
        if abs(shift) < 0.0005:
            line = f"Cut {i + 1} at {c:.3f} s is already on a {a.to[:-1]} ({b:.3f} s)."
        else:
            line = (f"Cut {i + 1} at {c:.3f} s: the nearest {a.to[:-1]} is at {b:.3f} s, "
                    f"{abs(shift) * 1000:.0f} ms {word} ({abs(shift) * a.fps:.1f} frames at {a.fps} fps). ")
            line += ("Within the limit; move the cut there." if within
                     else f"More than {a.within * 1000:.0f} ms away: moving it would change the shot noticeably.")
        print(line)
    print("Snapped cut times: " + ",".join(str(r["nearest"] if r["within"] else r["cut"]) for r in results))
    print("All cuts are within the limit." if allin else "At least one cut is further than the limit from a beat.")
    if a.json:
        print(json.dumps(results))
    return 0 if allin else 1


def scene_cuts(job):
    """Cut times (s) in a job's shots.json: the start of every scene after the first. Raises ValueError with the reason."""
    p = os.path.join(job, "shots.json")
    try:
        scenes = json.load(open(p)).get("scenes")
    except (OSError, ValueError) as e:
        raise ValueError(f"Cannot read {p}: {e}")
    if not isinstance(scenes, list) or not scenes:
        raise ValueError(f"{p} has no scenes.")
    t, cuts = 0.0, []
    for i, s in enumerate(scenes):
        if i > 0:
            cuts.append(t)
        sec = s.get("seconds") if isinstance(s, dict) else None
        if not isinstance(sec, (int, float)) or sec <= 0:
            raise ValueError(f"Scene {i + 1} in {p} has no \"seconds\", so its length is not known "
                             "(scenes take their times from the voice: run the voice step first, or write the seconds).")
        t += float(sec)
    return cuts


def cmd_check(a):
    g = load_grid(a.grid)
    if g is None:
        return 2
    try:
        cuts = scene_cuts(a.job)
    except ValueError as e:
        print(str(e), file=sys.stderr); return 2
    if not cuts:
        print("The film has one scene, so there are no cuts to check.", file=sys.stderr); return 2
    times = grid_times(g, a.on, a.offset)
    if not times:
        print(f"The grid has no {a.on}.", file=sys.stderr); return 2
    last_ok = times[-1] + 1.5 * spacing(times)
    first_ok = times[0] - 1.5 * spacing(times)
    bad = 0
    for i, c in enumerate(cuts):
        b = nearest(times, c)
        frames = (c - b) * a.fps
        if c > last_ok or c < first_ok:
            bad += 1
            print(f"Cut {i + 1} at {c:.3f} s: OFF. The music has no beat there (the grid runs {times[0]:.2f} to {times[-1]:.2f} s).")
            continue
        ok = abs(frames) <= 1.0 + 1e-6
        bad += 0 if ok else 1
        side = "after" if frames > 0 else "before"
        if abs(frames) < 0.05:
            print(f"Cut {i + 1} at {c:.3f} s: on the beat.")
        else:
            print(f"Cut {i + 1} at {c:.3f} s: {abs(frames):.1f} frame(s) {side} the nearest {a.on[:-1]} ({b:.3f} s). "
                  + ("Within a frame." if ok else "OFF: more than one frame."))
    if bad:
        print(f"FAIL: {bad} of {len(cuts)} cuts are not within one frame of a {a.on[:-1]}.")
        return 1
    print(f"PASS: all {len(cuts)} cuts are within one frame of a {a.on[:-1]} (at {a.fps} fps"
          + (f", music starting {a.offset:g} s into the film" if a.offset else "") + ").")
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0], formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    g = sub.add_parser("grid", help="write a track's beat grid")
    g.add_argument("track"); g.add_argument("--out"); g.add_argument("--fps", type=float, default=30)
    g.add_argument("--first-downbeat", type=float, default=None, dest="first_downbeat")
    s = sub.add_parser("snap", help="nearest beat for each planned cut")
    s.add_argument("grid"); s.add_argument("--cuts", required=True)
    s.add_argument("--to", choices=["beats", "downbeats"], default="beats")
    s.add_argument("--within", type=float, default=0.25); s.add_argument("--fps", type=float, default=30)
    s.add_argument("--json", action="store_true")
    c = sub.add_parser("check", help="are a job's cuts on the beat")
    c.add_argument("grid"); c.add_argument("job")
    c.add_argument("--offset", type=float, default=0.0)
    c.add_argument("--on", choices=["beats", "downbeats"], default="beats")
    c.add_argument("--fps", type=float, default=30)
    a = ap.parse_args(argv)
    return {"grid": cmd_grid, "snap": cmd_snap, "check": cmd_check}[a.cmd](a)


if __name__ == "__main__":
    sys.exit(main())
