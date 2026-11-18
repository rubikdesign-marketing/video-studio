# Sound library (LIBRARY-PLAN phase 3) Implementation Plan

**Goal:** about 240 public-domain sounds in 12 groups, levelled and catalogued; a tool that makes whooshes, risers and impacts from numbers; a finder and audition sheet; a beat grid from a music track; six public-domain music beds; the brand kit grows from 11 slots to about 30, falling back to the library; the mixer plays library sounds.

**Spec:** `LIBRARY-PLAN.md` section 4 phase 3, "Calls already made" (files in the repository, music and the beat, a brand without its own sounds), decisions 4 and 5.

## Global constraints

- Licence: only CC0 / public domain, or made here (ours, given away as CC0). Every file has a manifest line with its source, author, licence, source URL, date fetched, checksum. No file whose licence was not read from its source. Nothing from Pixabay, Mixkit, Sonniss, Zapsplat, 99Sounds, BBC, Freesound non-CC0.
- `library/sounds/` stays under 30 MB in all (MP3 only, no uncompressed masters).
- Levelling: `tools/audio/level.py make <in> <out.mp3> --peak -3 [--mono] [--trim]`. Interface sounds, clicks, pops, foley, impacts, swishes, whooshes, risers, glitches, transitions: mono, trimmed. Ambience and chimes/stings may be stereo. 48 kHz.
- Python for the tools: `tools/footage/.venv/bin/python` (numpy, scipy, soundfile, librosa, pyloudnorm are installed there). The system `python3` has no working numpy.
- No paid call, no model download, no `earshot llm`.

## Layout

```
library/sounds/
  README.md                 what is here, the rule, how to find and use a sound
  CREDITS.md                every source with its licence text or link
  <group>/<name>.mp3        e.g. whoosh/air-soft-01.mp3
  <group>/index.json        the group's manifest (below); one owner per group, so builders never share a file
music/
  <bed>.mp3, index.json, <bed>.beats.json
```

Groups and target counts: click 20, interface 40, pop 15, swish 15, whoosh 25, riser 15, impact 25, glitch 15, transition 20, ambience 15, foley 20, chime 15 (chimes and stings).

### A group's `index.json`

```json
{
  "group": "whoosh",
  "about": "One sentence: what this group is for.",
  "sounds": [
    {
      "id": "whoosh/air-soft-01",
      "file": "whoosh/air-soft-01.mp3",
      "name": "Soft air whoosh",
      "feel": ["soft", "airy", "short"],
      "use_for": "A light element crossing the frame; small transitions in calm films.",
      "seconds": 0.62,
      "peak_db": -3.0,
      "loudest_lufs": -18.4,
      "channels": 1,
      "source": "studio",
      "author": "Video Studio (tools/audio/synth.py)",
      "licence": "CC0-1.0",
      "source_url": null,
      "recipe": { "kind": "whoosh", "seed": 3, "seconds": 0.6, "...": "the synth.py arguments that remake it" },
      "fetched": "2026-11-18",
      "sha256": "…of the MP3 in the library"
    }
  ]
}
```

`feel` words come from this list so the finder can match them: soft, hard, bright, dark, warm, cold, airy, heavy, light, short, long, tight, wide, deep, high, low, clean, gritty, digital, organic, metallic, glassy, wooden, paper, plastic, subtle, bold, playful, premium, calm, tense, fast, slow, rising, falling, rhythmic.

For a sourced file `source` is the project (e.g. `romainsimon/uisfx`), `source_url` the file's URL at a pinned commit or release, `author` the creator, and `original` the original file name.

## Tasks

1. **Sourced sounds** (click, interface, pop, foley, chime; ambience if a CC0 source is good): fetch from CC0 sources, choose, level, catalogue.
2. **synth.py** (whoosh, swish, riser, impact, glitch, transition; ambience and stings where no CC0 recording is good): a tool that makes them from numbers, each with its recipe, and the library's made sounds.
3. **Beat grid and music beds**: `tools/audio/beats.py` (tempo, beats, bars, the drop) and six public-domain beds, each checked track by track.
4. **Finder, check and kit** (conductor): `tools/audio/sounds.mjs` (find, list, check, sheet), the brand kit's slots with library fallback, `mix.py` reading library sounds, the craft guide, stages, the plinkfx skill, doctor, credits.
