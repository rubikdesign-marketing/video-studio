#!/usr/bin/env python3
"""Check a voice track by measurement, because Claude cannot hear it.

Usage: voice_check.py <audio> [--script script.txt] [--out report_dir] [--model ggml.bin] [--heard-as heard-as.json]

Checks
  clipping     runs of samples at full scale (distortion)
  hard stops   speech that ends in under 10 ms (a word tail cut off)
  hard starts  speech that begins from digital silence in under 10 ms
  dropouts     speech cut to digital silence and back within 150 ms
  level jumps  neighbouring phrases more than 6 dB apart
  words        transcript compared with the script (needs whisper-cli and a model)
               --heard-as names a brand's list of confirmed mishearings (brands/<brand>/heard-as.json);
               without it, the studio's default brand's list is used

Click detection was tried and removed: on clean speech, consonants trip it more often than
real faults do. Joins are covered by hard stops, hard starts and level jumps instead.

Writes report.json and one spectrogram image per flagged moment into the report folder.
Exit code 0 = clean, 1 = something flagged. Needs ffmpeg; no Python packages.
"""
import argparse, array, difflib, json, math, os, re, subprocess, sys

SR = 16000
FRAME = 160                      # 10 ms
FFMPEG = os.environ.get("FFMPEG", "ffmpeg")
MODEL = os.environ.get("WHISPER_MODEL", os.path.expanduser("~/.cache/hyperframes/whisper/models/ggml-small.en.bin"))


def decode(path):
    raw = subprocess.run([FFMPEG, "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
                         capture_output=True).stdout
    a = array.array("h"); a.frombytes(raw[: len(raw) // 2 * 2])
    return a


def db(x):
    return 20 * math.log10(x) if x > 0 else -120.0


def frame_levels(s):
    out = []
    for i in range(0, len(s) - FRAME + 1, FRAME):
        acc = 0
        for v in s[i:i + FRAME]:
            acc += v * v
        out.append(db(math.sqrt(acc / FRAME) / 32768))
    return out


def clipping(s):
    hits, run, start = [], 0, 0
    for i, v in enumerate(s):
        if abs(v) >= 32700:
            if run == 0: start = i
            run += 1
        else:
            if run >= 3: hits.append(round(start / SR, 3))
            run = 0
    return hits


def edges(lv):
    """Speech that stops or starts within one 10 ms frame, against digital silence."""
    stops, starts = [], []
    for i in range(3, len(lv) - 3):
        loud_before = min(lv[i - 2], lv[i - 1]) > -32
        if loud_before and lv[i] < -75 and lv[i + 1] < -75:
            stops.append(round(i * FRAME / SR, 3))
        loud_after = min(lv[i + 1], lv[i + 2]) > -28
        if loud_after and lv[i] < -75 and lv[i - 1] < -75:
            starts.append(round((i + 1) * FRAME / SR, 3))
    return stops, starts


def phrases(lv, gap=0.3):
    out, start, quiet = [], None, 0
    for i, v in enumerate(lv + [-120] * int(gap * 100 + 2)):
        if v > -45:
            if start is None: start = i
            quiet = 0
        elif start is not None:
            quiet += 1
            if quiet >= gap * 100:
                out.append((start, i - quiet + 1)); start = None
    return out


def dropouts(stops, starts):
    """Speech cut to digital silence and back again within 150 ms."""
    return [a for a in stops if any(0 < b - a <= 0.15 for b in starts)]


def level_jumps(lv, ph):
    def loud(a, b):
        v = sorted(x for x in lv[a:b] if x > -45)
        return v[len(v) // 2] if v else -120
    lev = [(a, loud(a, b)) for a, b in ph if b - a > 30]
    return [dict(at=round(a2 * FRAME / SR, 2), change_db=round(l2 - l1, 1))
            for (a1, l1), (a2, l2) in zip(lev, lev[1:]) if abs(l2 - l1) > 6]


NUM = dict(zero=0, one=1, two=2, three=3, four=4, five=5, six=6, seven=7, eight=8, nine=9, ten=10, eleven=11,
           twelve=12, thirteen=13, fourteen=14, fifteen=15, sixteen=16, seventeen=17, eighteen=18, nineteen=19,
           twenty=20, thirty=30, forty=40, fifty=50, sixty=60, seventy=70, eighty=80, ninety=90, hundred=100,
           first=1, second=2, third=3, fourth=4, fifth=5, sixth=6, seventh=7, eighth=8, ninth=9, tenth=10)
SAME = {"enquiries": "inquiries", "enquiry": "inquiry", "ok": "okay"}


def norm(text):
    """Reduce script and transcript to the same plain words so only real differences remain."""
    text = re.sub(r"\[[^\]]*\]", " ", text.lower())             # [excited] style directions
    text = re.sub(r"\btool\s?vo\b", "tulvo", text)
    text = re.sub(r"\bchat\s+gpt\b", "chatgpt", text)
    text = re.sub(r"\$\s?(\d+)", r"\1 dollars", text)
    text = text.replace("%", " percent ")
    text = re.sub(r"(\d+)(st|nd|rd|th)\b", r"\1", text)
    out = []
    for w in re.findall(r"[a-z0-9']+", text):
        w = SAME.get(w, w)
        out.append(str(NUM[w]) if w in NUM else w)
    return out


def default_heard_as():
    """heard-as.json of the studio's default brand (studio.json, "default_brand"), or None."""
    studio = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
    try:
        brand = json.load(open(os.path.join(studio, "studio.json")))["default_brand"]
    except (OSError, ValueError, KeyError):
        return None
    return os.path.join(studio, "brands", brand, "heard-as.json")


def words_check(path, script_path, model, heard_as=None):
    if not os.path.exists(model):
        return dict(skipped=f"no transcription model at {model}")
    tmp = os.path.join(os.environ.get("TMPDIR", "/tmp"), "voice_check_16k.wav")
    subprocess.run([FFMPEG, "-v", "error", "-y", "-i", path, "-ac", "1", "-ar", "16000", tmp])
    out = subprocess.run(["whisper-cli", "-m", model, "-f", tmp, "-np", "-nt", "-ng"], capture_output=True, text=True).stdout
    if not out.strip():
        return dict(skipped="the transcriber returned nothing")
    heard, wanted = norm(out), norm(open(script_path).read())
    # known mishearings of product words (brands/<brand>/heard-as.json), confirmed by a person
    alias_file = heard_as or default_heard_as()
    if alias_file and os.path.exists(alias_file):
        text = " " + " ".join(heard) + " "
        for wrong, right in json.load(open(alias_file)).items():
            if not wrong.startswith("_"):
                text = text.replace(" " + wrong + " ", " " + right + " ")
        heard = text.split()
    sm = difflib.SequenceMatcher(a=wanted, b=heard, autojunk=False)
    diffs = [dict(kind=tag, script=" ".join(wanted[i1:i2]), heard=" ".join(heard[j1:j2]))
             for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag != "equal"]
    return dict(script_words=len(wanted), heard_words=len(heard), match=round(sm.ratio(), 3), differences=diffs)


def spectrogram(path, t, out):
    a = max(0, t - 0.4)
    subprocess.run([FFMPEG, "-v", "error", "-y", "-ss", f"{a:.3f}", "-t", "0.8", "-i", path, "-lavfi",
                    "showspectrumpic=s=800x300:legend=0:scale=log:fscale=lin:stop=8000", out])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio"); ap.add_argument("--script"); ap.add_argument("--out"); ap.add_argument("--model", default=MODEL)
    ap.add_argument("--heard-as", help="a brand's heard-as.json; default: the one of the studio's default brand")
    a = ap.parse_args()
    out = a.out or os.path.splitext(a.audio)[0] + ".voicecheck"
    os.makedirs(out, exist_ok=True)

    s = decode(a.audio)
    lv = frame_levels(s)
    ph = phrases(lv)
    stops, starts = edges(lv)
    rep = dict(file=os.path.basename(a.audio), seconds=round(len(s) / SR, 2), phrases=len(ph),
               clipping=clipping(s), hard_stops=stops, hard_starts=starts,
               dropouts=dropouts(stops, starts), level_jumps=level_jumps(lv, ph))
    if a.script:
        rep["words"] = words_check(a.audio, a.script, a.model, a.heard_as)

    flagged = sorted(set(rep["hard_stops"] + rep["hard_starts"] + rep["clipping"] + [j["at"] for j in rep["level_jumps"]]))[:24]
    for t in flagged:
        spectrogram(a.audio, t, os.path.join(out, f"at_{t:07.3f}s.png"))
    json.dump(rep, open(os.path.join(out, "report.json"), "w"), indent=1)

    bad = False
    print(rep["file"], f"({rep['seconds']} s, {rep['phrases']} phrases)")
    for key, label in [("clipping", "clipping"), ("hard_stops", "word tails cut off"),
                       ("hard_starts", "abrupt starts"), ("dropouts", "dropouts"), ("level_jumps", "level jumps")]:
        v = rep[key]; bad = bad or bool(v)
        shown = v[:8] if key != "level_jumps" else [f"{x['at']}s {x['change_db']:+} dB" for x in v[:8]]
        print(f"  {label}: {len(v)}" + (f"  at {shown}" if v else ""))
    w = rep.get("words")
    if w and "match" in w:
        bad = bad or w["match"] < 0.97
        print(f"  words: {w['match'] * 100:.1f}% match, {len(w['differences'])} differences")
        for d in w["differences"][:10]:
            print(f"     {d['kind']}: script \"{d['script']}\" / heard \"{d['heard']}\"")
    elif w:
        print("  words: skipped,", w["skipped"])
    print("  report:", out)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
