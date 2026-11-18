# Sound library

About 250 sound effects and six music beds that any brand's film can use. Every file is public domain (CC0) or was made by the studio from numbers (`tools/audio/synth.py`), so it may be used in any film, paid or not, with no credit line on screen. Where each file came from, with its licence quoted: `CREDITS.md`.

## What is here

| Group | Sounds | For |
|---|---|---|
| `click` | 20 | Mouse clicks, taps, presses |
| `interface` | 40 | Confirm, error, toggle, notification, send, delete, typing keys |
| `pop` | 15 | Things appearing: plucks, bubbles, soft pops |
| `swish` | 15 | Short, close movement: cloth, a hand, paper, whips |
| `whoosh` | 25 | Something crossing the frame, from airy to deep |
| `riser` | 15 | Builds into a reveal or the peak; a few fall instead |
| `impact` | 25 | Booms, punches, thuds, metal rings |
| `glitch` | 15 | Digital stutters, crushes, chirps |
| `transition` | 20 | Whoosh into a hit, reverse swells, tape stops, spins |
| `ambience` | 15 | Rain, wind, rooms, city, sea, forest: 16 s beds |
| `foley` | 20 | Cards, pages, cloth, keyboards, footsteps, a cup set down |
| `chime` | 20 | Bells, success sounds, and five short stings made here |
| `music` | 6 | Beds of 43 to 54 s, each with its beat grid (`<bed>.beats.json`) |

Each group has an `index.json` listing every sound with its feel words, what it is for, its length, its level, where it came from, its licence and its checksum. Whooshes, risers, impacts, glitches and transitions were made by `synth.py`; each lists the recipe that makes it again.

## Using a sound

```
node tools/audio/sounds.mjs find --group whoosh --feel soft,airy       # find one
node tools/audio/sounds.mjs sheet --group impact                       # hear a group in one file
node tools/audio/sounds.mjs use whoosh/air-soft-01 --job jobs/<job> --at 3.2 --gain 0.4   # put it in a film
node tools/audio/sounds.mjs kit <brand>                                # the brand's kit, slot by slot
node tools/audio/sounds.mjs check                                      # every file against its record
```

`use` adds the sound to the job's `audio/sfx.json`, where `tools/audio/mix.py` places it and sets its level against the voice. The craft rules hold as before (`knowledge/craft/07-sound.md`): every sound has a cause on screen, effects sit between a third and two thirds of the voice, no two of a kind within 0.3 s.

## The brand kit and the library

A brand's own sounds live in `brands/<brand>/sounds/<slot>.mp3` and always win. `kit.json` lists the kit's 30 slots and, for each, the library sound used when the brand has none. The tools never fall back silently: `capture_sounds.mjs` and `sounds.mjs kit` name every slot that came from the library, and the hand-over lists them. A library sound is used from here, never copied into the brand's folder.

## Music

Music is still made for the film by default (`07-sound.md`). A bundled bed is for a film that starts from a track: a quick social cut, a draft, or when the owner chooses one. Then the cut follows the music's beat grid:

```
tools/footage/.venv/bin/python tools/audio/beats.py grid library/sounds/music/minimal-pulse-01.mp3     # already done for the six beds
tools/footage/.venv/bin/python tools/audio/beats.py snap library/sounds/music/minimal-pulse-01.beats.json --cuts 3.2,6.4
tools/footage/.venv/bin/python tools/audio/beats.py check library/sounds/music/minimal-pulse-01.beats.json jobs/<job>
```

`check` reads the job's shot list and passes when every cut lands within one frame of a beat. When the film plays the bed from later than its start (from its first beat, say), write that in `job.json` as `"music_offset": -0.251` (seconds); `check` reads it, and `snap` takes the same `--offset`. The beds are from Komiku and Loyalty Freak Music (the same artist), each marked CC0 on its Internet Archive page; the evidence is in `music/index.json`.

## Adding a sound

Only public-domain (CC0) files, or files made here. Level it with `tools/audio/level.py make <in> <out.mp3> --peak -3 --trim` (`--mono` for short effects), add its line to the group's `index.json` with every field, credit its source in `CREDITS.md`, and run `sounds.mjs check`. The whole folder stays under 30 MB. Never add files from Pixabay, Mixkit, Sonniss, Zapsplat, 99Sounds, the BBC, or any Freesound file that is not CC0: they may be used in a film but not shared in a repository.

## Not checked

Nobody has listened to these sounds. They were chosen by name, length and level, and checked with earshot's listening model where noted in `CREDITS.md`; a person should listen to each group (`sounds.mjs sheet`) before the first film that uses it. Known doubts: the two concrete footsteps and the wood footstep are heard as ticks; `wind-trees-01` sounds more like rain; `room-house-01` has a fan hum; `city-street-01` may carry faint speech. The music beds' first bar starts were estimated, and `calm-lofi-01` has a loose beat.
