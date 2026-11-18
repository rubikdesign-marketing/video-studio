# Sound

Sound is half the film. Claude cannot hear it, so every rule here has a measurement, and a person listens at two approvals: the voice read and the full animation.

The measurements come from the studio's tools and from earshot (`node tools/audio/listen.mjs <file> --job jobs/<job>`): loudness over time, tone balance, events and how far each rises over the music, how well each sound lands on its picture moment, and a sheet to look at. Never describe how something sounds without its number. Sounds land by their attack or arrival, not their file start (`real-sfx`); real recorded sounds come from `tools/media/openverse.mjs` with their licence kept.

## Voice

- ElevenLabs. Each brand's named voices and its default are in `brands/<brand>/voices.json`. The voice is chosen at the idea stage.
- Generate line by line, not as one take. Three takes per line; keep the best by score, and let the maker pick when scores are close.
- Give each line a direction: who is speaking to whom, and how (excited, level, dry). No whispered lines.
- The voice is never stretched and never sliced inside a line. If a line is too long, rewrite it or regenerate it.
- Product words follow `brands/<brand>/pronunciation.md` (for example, Tulvo is written "Toolvo" so it is said TOOL-voh).
- The picture is fitted to the voice. Scene lengths come from the voice timings.

### Voice checks (`tools/audio/voice_check.py`)

| Check | Catches |
|---|---|
| Transcribe back and compare with the script | Dropped, wrong and mispronounced words |
| Clipping count | Distortion |
| Click scan at every join | Cracks where two pieces meet |
| Dropout scan | Sudden silences inside a line |
| Level jump between lines | A take that is louder or duller than its neighbours |
| Spectrogram image of each join | Anything the numbers miss |

A line that fails is regenerated, not repaired.

## Music

- Composed for the film, after the voice is locked, with sections sized to the scenes so changes in the music land on changes in the picture.
- Tempo follows the energy preset: calm 80–100, confident 100–120, hype 120–130 beats per minute.
- The music follows the energy map: it thins before the peak and opens on it.
- Consider cutting the music entirely for the line that matters most. Half a second of quiet is the loudest thing in a film.
- Under the voice the music sits at 20–30% of the voice level. In gaps it rises, then ducks back within 0.5 s.
- A film may instead start from a track that already exists: one of the six public-domain beds in `library/sounds/music/`, or the brand's own music. Then the beat leads the cut: `tools/audio/beats.py` gives the track's beats, bars and drop, `beats.py snap` moves each planned cut to the nearest beat, and `beats.py check jobs/<job>` passes when every cut is within a frame of one. The biggest moment lands on the drop or on a bar start.

## Sound design

Four layers, each with a job:

| Layer | Examples | Rule |
|---|---|---|
| Interface | Clicks, key taps, toggles, a soft confirm | Every on-screen action has one. Quiet and dry |
| Movement | Whooshes, swishes, slides | One on every scene change, starting 150–200 ms early, peaking on the change |
| Impact | Hits, drops, a low thump | Only at energy 4–5. Lands on the exact frame |
| Lift | Risers, shimmers, a swell | Leads into the peak. Ends on the hit |

- Few and exact beats many and vague. Every sound has a cause on screen.
- No two sounds of the same kind within 0.3 s.
- Sound effects sit below the voice, between a third and two thirds of its level.
- Sounds come from the brand's own kit first (`brands/<brand>/sounds/`, made on the ElevenLabs plan with the owner's yes), then from the shared library (`library/sounds/`: about 250 public-domain or studio-made sounds; `node tools/audio/sounds.mjs find`). A library sound used in place of a brand's own is named in the hand-over. Nothing from free sites whose licence forbids sharing files (Pixabay, Mixkit, Zapsplat and the like), and nothing that needs a credit line on screen.
- Whooshes, risers and impacts a brand wants of its own are made from numbers with `tools/footage/.venv/bin/python tools/audio/synth.py` (no cost, no outside call), or designed with the bundled plinkfx skill.
- Each text move, transition and hook opener names the sound it wants in `library/motion/index.json` (group and feel); use that as the starting point.

## A sound signature

A one-to-two second sound that ends every one of a brand's videos on the logo, the same each time. Proposed, not yet decided: it would be made once, approved once, then fixed like the logo.

## Mix and master

- Order: voice chain (clean low rumble, gentle presence lift, light compression, de-ess), then duck music and effects under the voice, then mix.
- Master to −14 LUFS integrated, peaks at −1 dBTP.
- Check the mix summed to mono and through a narrow "phone speaker" filter: the voice must still be clear.
- Never drop leading silence when joining audio. It shifts everything after it.
- Always confirm the output file exists and has the expected length. A mix step can fail quietly.

## Sync

- A hit lands on the frame of contact. Not before, not a frame after.
- Words on screen appear with the spoken word or up to 100 ms before.
- No voice gap longer than 0.8 s, except the planned proof holds (at most two, about 1.3 s).
- The first word is spoken within 0.8 s of the first frame unless the hook is silent on purpose.

## What a person must listen for

Performance, warmth, whether the music suits the brand, whether a sound is annoying. None of that can be measured. The voice-read approval and the full-animation approval both say so in plain words.

## From "3 Sound Design Secrets" (study card: library/references/rubik/sound-design-secrets/study.md), Nov 2026

Supplied by the Rubik owner as the sound brief for their episode 1. Each rule has its measurable form.

- **Layer big moves by frequency.** A small move: one light sound. A big move (chapter, reveal, lesson): two or three
  layers in different bands (body under ~250 Hz, mid 0.5–2 kHz, air above ~4 kHz; `local_pack.py` and the library
  indexes give each sound's `centroid_hz`), starting within 20 ms of each other.
- **A pocket for the voice.** While the voice speaks, the music is 4–6 dB lower between 1 and 4 kHz than outside
  that band, on top of the usual ducking; the voice is high-passed at ~90 Hz.
- **One sound family per film.** All whooshes, hits and risers come from one family that fits the film's energy; a
  calm film never uses gritty bass hits. Write the family into the sound plan.
- **Music never stops dead.** Into a track: a riser, swell or reversed first beat under the join. Out of a track: a
  reverb tail of at least 1.5 s on the last beat while the track fades.
