#!/usr/bin/env python3
"""Compare a film's measured movement with the energy the shot list planned (DESIGN.md section 14 item 12).

Usage: energy_map.py <video> --job jobs/<job> [--film film.json] [--bands 0.3,0.8,1.8,3.5] [--json out.json]

Each scene's planned energy (1 to 5) comes from shots.json; its times from film.json (the preview's copy in
jobs/<job>/out/, or the engine's). The movement is measured as tools/study/profile.py measures it (how much the
picture changes, per quarter second, hard cuts left out), averaged over each scene with a quarter second left off
each end so the transitions between scenes do not count for either.

Measured movement becomes a level from 1 to 5 by --bands, the movement at which each level starts (2 to 5). The
default bands come from the studio's reference films and the Tulvo Black Friday film (library/references/_profiles,
library/own-films): their still parts sit under 0.3, their calm stretches 0.3 to 0.8, typical movement 0.8 to 1.8,
busy stretches 1.8 to 3.5, and their peaks above.

It flags:
  more / less  a scene whose measured level is two or more away from the planned energy (planned calm, rendered
               busy; planned as the peak, hardly moving)
  order        two scenes planned two or more levels apart whose movement runs the other way (the shape is upside
               down, even if each scene is inside its band)
Movement is one part of energy; music, cut rate, camera size and sound also carry it (craft file 01), so a flag
means "look at this scene against the map", with the numbers to look at.
Exit code 0 = the film follows the map, 1 = flagged, 2 = could not run. Needs only ffmpeg.
"""
import argparse, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
STUDIO = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(STUDIO, "tools", "study"))

BANDS = [0.3, 0.8, 1.8, 3.5]
FAR = 2
WORDS = {1: "still", 2: "calm", 3: "moving", 4: "busy", 5: "peak"}


def level_of(motion, bands=BANDS):
    return 1 + sum(1 for b in bands if motion >= b)


def scene_motion(motion, step, scenes):
    """Mean movement per scene, from the per-step movement, leaving a step off each end of scenes over 1 s long."""
    out = {}
    for s in scenes:
        trim = step if s["end"] - s["start"] > 1.0 else 0.0
        a, b = s["start"] + trim, s["end"] - trim
        vals = [m for i, m in enumerate(motion) if a <= (i + 0.5) * step <= b]
        out[s["id"]] = sum(vals) / len(vals) if vals else 0.0
    return out


def judge(rows, bands=BANDS):
    """rows: [{id, energy (planned, 1 to 5, or None), motion}]. Returns {pass, flags, rows}."""
    flags = []
    planned = [r for r in rows if r.get("energy")]
    for r in planned:
        r["level"] = level_of(r["motion"], bands)
        d = r["level"] - r["energy"]
        if abs(d) >= FAR:
            flags.append({"scene": r["id"], "kind": "more" if d > 0 else "less", "planned": r["energy"], "measured": r["level"], "motion": round(r["motion"], 2)})
    for i, a in enumerate(planned):
        for b in planned[i + 1:]:
            hi, lo = (a, b) if a["energy"] > b["energy"] else (b, a)
            if hi["energy"] - lo["energy"] >= FAR and hi["motion"] < lo["motion"]:
                flags.append({"scene": hi["id"], "kind": "order", "other": lo["id"], "planned": [hi["energy"], lo["energy"]], "motion": [round(hi["motion"], 2), round(lo["motion"], 2)]})
    return {"pass": not flags, "flags": flags, "rows": rows}


def load_scenes(job, film_file=None):
    name = os.path.basename(os.path.abspath(job))
    for f in [film_file, os.path.join(job, "out", "preview.film.json"), os.path.join(STUDIO, "engine", "src", "jobs", name.lstrip("_"), "film.json")]:
        if f and os.path.exists(f):
            film = json.load(open(f))
            break
    else:
        raise SystemExit(f"No film.json for {job}. Scaffold the film first: node tools/film/scaffold.mjs {job}")
    planned = {}
    shots = os.path.join(job, "shots.json")
    if os.path.exists(shots):
        planned = {s["id"]: s.get("energy") for s in json.load(open(shots)).get("scenes", [])}
    return [{"id": s["id"], "title": s.get("title", ""), "start": s["start"], "end": s["end"],
             "energy": planned.get(s["id"], s.get("energy"))} for s in film["scenes"]], f


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video"); ap.add_argument("--job", required=True); ap.add_argument("--film")
    ap.add_argument("--bands", default=",".join(str(b) for b in BANDS)); ap.add_argument("--json")
    a = ap.parse_args()
    bands = [float(x) for x in a.bands.split(",")]
    if len(bands) != 4:
        sys.exit("--bands needs four numbers: where levels 2, 3, 4 and 5 start")
    from profile import STEP, bucket, find_cuts, frame_motion, probe
    scenes, film_file = load_scenes(a.job, a.film)
    dur, fps, _, _ = probe(a.video)
    raw = frame_motion(a.video)
    cuts = find_cuts(raw)
    motion = bucket([(t, x * fps / 30.0) for t, x in raw], cuts, dur)
    per = scene_motion(motion, STEP, scenes)
    rows = [{**s, "motion": per[s["id"]]} for s in scenes]
    r = judge(rows, bands)
    print(f"Energy map: {a.video} against {os.path.relpath(film_file)} and the shot list's energy")
    for row in rows:
        lvl = level_of(row["motion"], bands)
        plan = f"planned {row['energy']} ({WORDS.get(row['energy'], '?')})" if row["energy"] else "no energy planned"
        print(f"  {row['id']} {row['start']:.2f} to {row['end']:.2f} s  {plan}; measured movement {row['motion']:.2f}, level {lvl} ({WORDS[lvl]})")
    for f in r["flags"]:
        if f["kind"] == "order":
            print(f"  ORDER: {f['scene']} was planned at {f['planned'][0]}, above {f['other']} at {f['planned'][1]}, but moves less ({f['motion'][0]} against {f['motion'][1]})")
        else:
            print(f"  {'MORE' if f['kind'] == 'more' else 'LESS'}: {f['scene']} was planned at {f['planned']} ({WORDS[f['planned']]}) and moves like a {f['measured']} ({WORDS[f['measured']]}), movement {f['motion']}")
    if a.json:
        json.dump({"video": a.video, "bands": bands, **r}, open(a.json, "w"), indent=1)
    print("Pass: the measured movement follows the planned energy." if r["pass"] else
          "Look: these scenes move far from the plan. Calm a busy scene (fewer, slower moves; hold the camera), or give a flat one its move, or change the plan.")
    sys.exit(0 if r["pass"] else 1)


if __name__ == "__main__":
    main()
