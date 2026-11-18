#!/usr/bin/env python3
"""Mix a film's voice, music and sound effects into one track, and measure the result.

Usage: mix.py <job_dir> [--tail 1.5]

The music runs --tail seconds past the voice, or longer when shots.json ends on silent end cards: then it runs on
under them (they start END_CARD_GAP after the voice, as in tools/film/scaffold.mjs) to the film's last frame.

Reads from <job_dir>/audio:
  voice.wav     required. The joined voice from voice.mjs (never stretched).
  lines.json    required. When each line is spoken; decides where the music sits lower.
  music.mp3     optional (or music.wav).
  sfx.json      optional. [{ "id": "whoosh-1", "at": 3.25, "gain": 0.5 }, ...] with files in audio/sfx/<id>.mp3;
                an entry with "library": "whoosh/air-soft-01" is read from library/sounds/ when the job has no copy
Writes:
  mix.wav             the film's sound, 48 kHz stereo
  stems/voice.wav, stems/music.wav, stems/sfx.wav   each part alone, as mixed
  mix-report.json     what was measured

The rule it enforces: voice at 100%, music at 20-30% of the voice while someone is speaking
(a little higher in the gaps), effects between a third and two thirds of the voice.
It measures the finished stems and corrects the music level once if it missed.
Needs ffmpeg (full build); no Python packages.
"""
import argparse, array, json, math, os, subprocess, sys

FF = os.environ.get("FFMPEG", "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg")
if not os.path.exists(FF):
    FF = "ffmpeg"
UNDER_VOICE = (0.20, 0.30)      # music as a share of the voice while a line is spoken
GAP_LIFT_DB = 3.0               # how much higher the music sits between lines
SR = 8000                       # measuring rate
END_CARD_GAP = 0.5              # silent end cards start this long after the voice (scaffold.mjs TAIL)


def library_file(sound_id):
    """The file of a shared library sound (library/sounds/<group>/index.json), or None."""
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "library", "sounds")
    group = sound_id.split("/")[0]
    for name in sorted(os.listdir(os.path.join(root, group))) if os.path.isdir(os.path.join(root, group)) else []:
        if not name.endswith(".json") or name.endswith(".beats.json"): continue
        try: sounds = json.load(open(os.path.join(root, group, name))).get("sounds", [])
        except (OSError, ValueError): continue
        for snd in sounds:
            if snd.get("id") == sound_id: return os.path.join(root, snd["file"])
    return None


def end_card_seconds(job):
    """Seconds of silent end cards at the end of the job's shot list (0 when there are none)."""
    try: scenes = json.load(open(os.path.join(job, "shots.json"))).get("scenes", [])
    except (OSError, ValueError): return 0.0
    total = 0.0
    for scene in reversed(scenes):
        if scene.get("silent") is not True: break
        total += float(scene.get("seconds") or 0)
    return total


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit("ffmpeg failed:\n" + r.stderr[-1500:])
    return r


def duration(path):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                                capture_output=True, text=True).stdout.strip())


def samples(path):
    """Stereo samples, interleaved. Levels are taken over both channels, because turning a wide
    stereo effect into mono cancels part of it and makes it look quieter than it sounds."""
    raw = subprocess.run([FF, "-v", "error", "-i", path, "-ac", "2", "-ar", str(SR), "-f", "s16le", "-"], capture_output=True).stdout
    a = array.array("h"); a.frombytes(raw[: len(raw) // 4 * 4]); return a


def level(s, spans):
    """RMS in dB over the given (start, end) spans."""
    acc = n = 0
    for a, b in spans:
        for v in s[int(a * SR) * 2:int(b * SR) * 2]:
            acc += v * v; n += 1
    return 20 * math.log10(math.sqrt(acc / n) / 32768) if n and acc else -120.0


def loudest(s, start=0.0, end=None, win=0.3):
    """Level of the loudest 0.3 s window: how loud a sound effect is at its strongest moment."""
    end = len(s) / (2 * SR) if end is None else end
    step, best, t = win / 10, -120.0, start
    while t < max(start + step, end - win + step):
        best = max(best, level(s, [(t, min(end, t + win))])); t += step
    return best


def gaps(spans, total):
    out, t = [], 0.0
    for a, b in spans:
        if a - t > 0.25: out.append((t, a))
        t = b
    if total - t > 0.25: out.append((t, total))
    return out


def share(db):
    return round(10 ** (db / 20), 3)


def build(job, total, music, music_gain_db, cues, speech):
    A = os.path.join(job, "audio"); stems = os.path.join(A, "stems"); os.makedirs(stems, exist_ok=True)
    inputs = ["-i", os.path.join(A, "voice.wav")]
    f = ["[0:a]aresample=48000,aformat=channel_layouts=mono,highpass=f=80,equalizer=f=3200:t=q:w=1:g=2,"
         "acompressor=threshold=-22dB:ratio=3:attack=8:release=120,deesser=i=0.3,pan=stereo|c0=c0|c1=c0,"
         f"apad=whole_dur={total:.3f},asplit=2[v][vstem]"]
    parts = ["[v]"]
    maps = ["-map", "[vstem]", "-c:a", "pcm_s16le", os.path.join(stems, "voice.wav")]
    if music:
        inputs += ["-i", music]
        i = len(inputs) // 2 - 1
        fade = max(0.0, total - 1.6)
        f.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=0:{total:.3f},volume={music_gain_db:.2f}dB,"
                 f"afade=t=out:st={fade:.3f}:d=1.6,apad=whole_dur={total:.3f}[m0]")
        # The music sits lower while a line is spoken and rises a little in the gaps. The dip follows the
        # known line times with smooth ramps (0.25 s down before a line, 0.45 s up after), so its depth is
        # exact and it never pumps.
        ramps = "+".join(f"max(0,min(1,min((t-{a - 0.25:.3f})/0.25,({b + 0.45:.3f}-t)/0.45)))" for a, b in speech) or "0"
        dip = 1 - 10 ** (-GAP_LIFT_DB / 20)
        expr = f"1-{dip:.4f}*min(1,{ramps})".replace(",", "\\,")
        f.append(f"[m0]volume=eval=frame:volume='{expr}',asplit=2[m][mstem]")
        parts.append("[m]")
        maps += ["-map", "[mstem]", "-c:a", "pcm_s16le", os.path.join(stems, "music.wav")]
    if cues:
        labels = []
        for cue in cues:
            inputs += ["-i", cue["file"]]
            i = len(inputs) // 2 - 1
            f.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo,volume={cue['gain_db']:.2f}dB,"
                     f"adelay={int(cue['at'] * 1000)}:all=1[c{i}]")
            labels.append(f"[c{i}]")
        f.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0:duration=longest,apad=whole_dur={total:.3f},"
                 f"atrim=0:{total:.3f},asplit=2[s][sstem]")
        parts.append("[s]")
        maps += ["-map", "[sstem]", "-c:a", "pcm_s16le", os.path.join(stems, "sfx.wav")]
    f.append(f"{''.join(parts)}amix=inputs={len(parts)}:normalize=0:duration=longest,atrim=0:{total:.3f},"
             "alimiter=limit=0.89:attack=2:release=60:level=false,aformat=channel_layouts=stereo[out]")
    out = os.path.join(A, "mix.wav")
    run([FF, "-v", "error", "-y", *inputs, "-filter_complex", ";".join(f),
         "-map", "[out]", "-c:a", "pcm_s16le", out, *maps])
    return out, stems


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("job"); ap.add_argument("--tail", type=float, default=1.5)
    a = ap.parse_args()
    A = os.path.join(a.job, "audio")
    voice = os.path.join(A, "voice.wav")
    if not os.path.exists(voice): sys.exit(f"Missing {voice}. Run voice.mjs join first.")
    lines_file = os.path.join(A, "lines.json")
    if not os.path.exists(lines_file): sys.exit(f"Missing {lines_file}.")
    speech = [(l["start"], l["end"]) for l in json.load(open(lines_file))]
    cards = end_card_seconds(a.job)
    total = round(duration(voice) + max(a.tail, END_CARD_GAP + cards if cards else 0), 3)
    if cards: print(f"The film ends on {cards:.1f} s of silent end card; the music runs on under it.")
    quiet = gaps(speech, total)

    # Levels are set against the voice as it will sound in the mix (after its clean-up chain),
    # not the raw file: the chain lowers it by several dB.
    os.makedirs(os.path.join(A, "stems"), exist_ok=True)
    build(a.job, total, None, 0.0, [], speech)
    voice_db = level(samples(os.path.join(A, "stems", "voice.wav")), speech)

    music = next((p for p in (os.path.join(A, "music.mp3"), os.path.join(A, "music.wav")) if os.path.exists(p)), None)
    music_gain = 0.0
    if music:
        if duration(music) < total - 0.5:
            sys.exit(f"The music ({duration(music):.1f} s) is shorter than the film ({total:.1f} s). Compose it to length.")
        m = samples(music)
        target_under = 20 * math.log10(sum(UNDER_VOICE) / 2)            # middle of the allowed range, in dB below the voice
        music_gain = (voice_db + target_under + GAP_LIFT_DB) - level(m, [(0, total)])

    cues = []
    sfx_file = os.path.join(A, "sfx.json")
    if os.path.exists(sfx_file):
        for c in json.load(open(sfx_file)):
            path = os.path.join(A, "sfx", c["id"] + ".mp3")
            if not os.path.exists(path) and c.get("library"):
                # A shared library sound (tools/audio/sounds.mjs use) is read from the library when the job has no copy.
                path = library_file(c["library"])
            if not path or not os.path.exists(path):
                sys.exit(f"Sound effect file missing: {os.path.join(A, 'sfx', c['id'] + '.mp3')}. "
                         "Run sound.mjs sfx, or sounds.mjs use for a library sound.")
            g = c.get("gain", 0.5)
            if not 0.2 <= g <= 0.8: sys.exit(f"Effect {c['id']}: gain {g} is outside 0.2-0.8 of the voice.")
            if c["at"] > total: sys.exit(f"Effect {c['id']} is placed at {c['at']} s, after the film ends ({total} s).")
            loud = loudest(samples(path))                       # judged at its strongest moment, not its average
            cues.append(dict(id=c["id"], file=path, at=float(c["at"]), gain=g, gain_db=(voice_db + 20 * math.log10(g)) - loud))

    report = {}
    for attempt in (1, 2):
        out, stems = build(a.job, total, music, music_gain, cues, speech)
        if not os.path.exists(out) or os.path.getsize(out) < 1000: sys.exit("The mix was not written.")
        got = duration(out)
        if abs(got - total) > 0.1: sys.exit(f"The mix is {got:.2f} s but the film is {total:.2f} s. Not usable.")
        vs = level(samples(os.path.join(stems, "voice.wav")), speech)
        report = dict(seconds=round(got, 2), voice_db=round(vs, 1), lines=len(speech), effects=len(cues), attempts=attempt)
        if not music:
            break
        ms = samples(os.path.join(stems, "music.wav"))
        under = share(level(ms, speech) - vs)
        between = share(level(ms, quiet) - vs) if quiet else None
        report.update(music_share_under_voice=under, music_share_in_gaps=between)
        if UNDER_VOICE[0] <= under <= UNDER_VOICE[1] or attempt == 2:
            break
        music_gain += 20 * math.log10((sum(UNDER_VOICE) / 2) / under)     # correct once and mix again
    if cues:
        ss = samples(os.path.join(stems, "sfx.wav"))
        report["loudest_effect_share_of_voice"] = share(loudest(ss, 0.0, total) - report["voice_db"])
    peak = max(abs(x) for x in samples(out)) / 32768
    report["peak"] = round(peak, 3)
    json.dump(report, open(os.path.join(A, "mix-report.json"), "w"), indent=1)

    print(f"mix.wav  {report['seconds']} s, {report['lines']} lines, {report['effects']} effects")
    ok = True
    if music:
        u = report["music_share_under_voice"]
        good = UNDER_VOICE[0] <= u <= UNDER_VOICE[1]; ok = ok and good
        print(f"  music while someone speaks: {u * 100:.0f}% of the voice  (rule: 20-30%)  {'ok' if good else 'OUT OF RANGE'}")
        if report["music_share_in_gaps"] is not None:
            print(f"  music in the gaps:          {report['music_share_in_gaps'] * 100:.0f}% of the voice")
    if cues:
        e = report["loudest_effect_share_of_voice"]
        note = "ok" if e <= 0.75 else "LOUD: two effects may overlap, or one gain is too high"
        print(f"  loudest effect:             {e * 100:.0f}% of the voice  (rule: a third to two thirds)  {note}")
    print(f"  peak: {report['peak']}  (limit 0.89)")
    print("  nobody has listened to this mix; a person must, at the full-animation approval")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
