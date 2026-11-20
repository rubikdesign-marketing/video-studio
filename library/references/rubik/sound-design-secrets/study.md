# Study card: "3 Sound Design Secrets That Feel Like CHEATING"

- File: library/references/rubik/sound-design-secrets/video.mp4 (not synced), 7 min 22 s, 16:9. Supplied by the Rubik
  owner on 18 Nov 2026 as the sound brief for Rubik episode 1 (review note b001-n40).
- Studied from: the transcript (whisper large-v3-turbo, transcript.txt) and the motion profile (video.profile.json).
- Not checked: how any of the examples sound. Claude cannot hear; every rule below is written so it can be measured
  with tools/audio/listen.mjs or mix.py instead of judged by ear.
- Nothing from this video is placed in a film. The pack it advertises is not used.

## The three techniques, as rules

1. **Layer by frequency.** A small move gets one light sound. A big move (a chapter, a reveal, a lesson landing) gets
   two or three layers that sit in different bands: a low body under about 250 Hz, a mid layer around 500 Hz to 2 kHz,
   and a little air above about 4 kHz, starting within 20 ms of each other so they read as one sound.
   *Cheat code:* carve a pocket for the voice in the music. While he speaks, the music is cut by 4 to 6 dB between
   about 1 and 4 kHz (a dynamic EQ, the way a de-esser works); the voice itself is cleaned below about 90 Hz.
2. **Commit to one style per video.** Every whoosh, hit and riser comes from one family that fits the film: for a
   calm design-studio teardown, clean and soft (airy whooshes, soft clicks, bright bells), never gritty bass hits.
   *Cheat code:* sounds that deliberately do not match the picture (emotional realism). Not used here: this film
   explains real websites, so its sounds must match what is on screen.
3. **Ease music in and out.** Never stop a track dead. Into a track: its first beat reversed as a riser, or a swell
   or suck-back under the join. Out of a track: the last beat rings out on a long reverb (a 1.5 s tail or more) while
   the track fades; a soft impact can close it.

## What this changes for Rubik episode 1

- Whooshes are softer and fewer, from one clean family; reveals are layered instead of loud (notes n3, n21, n36).
- The music sits under the voice through a mid-frequency pocket, not only by ducking.
- The join between the two music pieces at the Slite chapter, and the end of the film, use a riser in and a reverb
  tail out, not a cut.
