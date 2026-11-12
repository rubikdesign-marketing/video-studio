# Sound

Sound is half the film. Claude cannot hear it, so every rule here has a measurement, and a person listens at two approvals: the voice read and the full animation.

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
- All sound is generated on the ElevenLabs plan. Nothing from free libraries, so nothing needs a credit line.

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
