#!/usr/bin/env python3
"""Read the words on screen and check them against the approved wording.

Usage: onscreen_text.py <video> [--every 1.0] [--must "Half price on every plan" ...]
                                [--never "first payment" ...] [--json out.json]

  --must   a phrase that has to appear on screen at least once (offer wording, the call to action)
  --never  a phrase that must not appear anywhere (retired wording, a competitor name)
  --every  seconds between sampled frames (default 1.0)

It prints which --must phrases were found and when, any --never phrase that was seen, and saves
everything it read per frame to the JSON file so a person or agent can check spelling.
Reading text from frames is imperfect: small or stylised type can be misread, so a missing --must
phrase means "look at the frames", and the times it gives are where to look.
Needs ffmpeg and tesseract; no Python packages.
"""
import argparse, json, os, re, subprocess, sys, tempfile

FFMPEG = os.environ.get("FFMPEG", "ffmpeg")


def duration(path):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                                capture_output=True, text=True).stdout.strip())


def norm(s):
    s = s.lower().replace("%", " percent ").replace("$", " dollars ")
    return " ".join(re.findall(r"[a-z0-9']+", s))


def contains(text, phrase):
    """True if the phrase's words appear in order, allowing one stray token between words
    (text read from frames often gains a stray character)."""
    words = [re.escape(w) for w in phrase.split()]
    if not words:
        return False
    return re.search(r"(?<![a-z0-9'])" + r"(?: [a-z0-9']+)? ".join(words) + r"(?![a-z0-9'])", text) is not None


def read_frame(video, t, tmp):
    # Enlarge and grey the frame: tesseract reads large type best. The image is piped straight in,
    # because tesseract's image library cannot open files under /tmp on a Mac.
    png = subprocess.run([FFMPEG, "-v", "error", "-ss", f"{t:.2f}", "-i", video, "-frames:v", "1",
                          "-vf", "scale=1920:-2:flags=lanczos,format=gray", "-f", "image2pipe", "-c:v", "png", "-"],
                         capture_output=True).stdout
    if not png:
        return ""
    out = subprocess.run(["tesseract", "stdin", "stdout", "--psm", "11", "-l", "eng"],
                         input=png, capture_output=True).stdout.decode("utf-8", errors="replace")
    return " ".join(out.split())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video"); ap.add_argument("--every", type=float, default=1.0)
    ap.add_argument("--must", action="append", default=[]); ap.add_argument("--never", action="append", default=[])
    ap.add_argument("--json")
    a = ap.parse_args()
    dur = duration(a.video)
    frames = []
    with tempfile.TemporaryDirectory() as tmp:
        t = 0.25
        while t < dur:
            frames.append(dict(at=round(t, 2), text=read_frame(a.video, t, tmp)))
            t += a.every
    for f in frames:
        f["norm"] = norm(f["text"])

    bad = False
    print(os.path.basename(a.video), f"({len(frames)} frames read)")
    found = {}
    for phrase in a.must:
        n = norm(phrase)
        hits = [f["at"] for f in frames if contains(f["norm"], n)]
        found[phrase] = hits
        if hits:
            print(f'  found     "{phrase}"  first at {hits[0]}s, on {len(hits)} frames')
        else:
            bad = True
            # show where most of its words appear, to point the reviewer at the right frames
            words = n.split()
            best = max(frames, key=lambda f: sum(w in f["norm"].split() for w in words), default=None)
            near = f' closest frame {best["at"]}s reads: "{best["text"][:90]}"' if best and best["text"] else ""
            print(f'  NOT FOUND "{phrase}"{near}')
    seen = {}
    for phrase in a.never:
        n = norm(phrase)
        hits = [f["at"] for f in frames if contains(f["norm"], n)]
        seen[phrase] = hits
        if hits:
            bad = True
            print(f'  SEEN      "{phrase}"  at {", ".join(str(h) + "s" for h in hits[:8])}')
        else:
            print(f'  absent    "{phrase}"')
    if a.json:
        json.dump(dict(file=os.path.basename(a.video), must=found, never=seen,
                       frames=[dict(at=f["at"], text=f["text"]) for f in frames]), open(a.json, "w"), indent=1)
        print("  everything read is in", a.json)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
