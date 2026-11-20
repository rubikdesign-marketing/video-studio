# Kinetic type, batch 1: what we learned

34 records from the "kinetic-type" group. Full per-record notes and measurements are in `study/kinetic-type-1.json`.

## What was checked

- All 34 videos were downloaded and measured with `profile.py` (cuts, shot lengths, stillness, motion peaks).
- Six were watched closely, with overview sheets and frame-by-frame windows on key transitions: pm:stephanlivera-df17a2, pm:shneural-2abdfa, pm:ajith-io-b5626e, revid:14, revid:24 and revid:25.
- The other 27 were skimmed from a 10-frame strip each, so their notes are lighter.
- Not checked: sound (nobody listened to it), so the 128 BPM figure comes from how far apart the cuts are and one on-screen readout. Stacks are as the records state them. 13 records have no like count.
- pm:roundtablespace-d3a1be is a repost: its video file is identical to pm:stephanlivera-df17a2.

## What kind of films these are

Despite the group name, most are showreels: 19 of 34 answer the same stock prompt, which asks for a 15 s "what a great motion designer you are" reel. The rest are kinetic type pieces (4), ads (2), launch films (2), and one each of a lyric film, a model comparison, a personal intro, a Swiss poster piece, a brand reel, a science explainer and a collage edit.

## What the best ones do

- **Have a thesis.** The most-liked reel (17.1k) teaches easing, then ends on a burst of words that turns the lesson into a joke. revid:14 is about timing and carries one red dot through every scene, with no hard cuts. Reels with no thesis show the same scenes in a different order and got single-digit likes.
- **Keep one palette and one type pairing.** Three to five flat colours plus one accent, and a heavy wide sans with an italic serif for the second line.
- **Cut on a musical grid.** The best reels cut on whole bars at 128 BPM (1.875 s each). They build to a burst of word cards at 0.233 s each, then hold a lockup for about 2.4 s.
- **Get their distinct looks from inputs, not adjectives.** A reference video plus explicit bans (pm:lexnlin-038035), supplied artwork, a persona with real work to show, or one visual idea each produced a look nobody else had.
- **Likes partly measure reach.** The top three were early posts of the same prompt. The best-written prompt in the batch (pm:gdgtify-287ddf, a spoken-word piece built as architecture) got 11 likes.

## Prompt moves

These seem to work:
- Name a subject or thesis.
- Attach a reference and say what to take from it (timing, shot lengths).
- Ban the defaults by name (corner labels, beige "artsy" looks, eyebrow labels).
- Ask for a hook in the first second and a clean final frame.
- For exact pacing, give a timed storyboard with a stillness rule and a quality gate.

These produce weak results:
- Asking only for "show your range" and maximum effort. Even a three-word prompt gave the same kit.
- Giving a list of techniques to include. The model ticks them off one scene at a time.
- Giving only a brand name. The model invents a theme from the name and says nothing about the product.

## Measured timing

- **15 s reels:** 0 to 11 hard cuts (the square type piece has 14). The top reel has 8 cuts, an average shot of 1.67 s and a median of 0.47 s, and it never stands still.
- **Bar grid:** cuts at 5.633, 7.5, 9.383 and 11.25 s recur across four reels. These are 3, 4, 5 and 6 bars at 128 BPM.
- **Word bursts:** cards last 0.233 s (half a beat at 128 BPM) or 0.42 s. Cutting exactly every 1.0 s reads as a slideshow.
- **Hook:** in the top reel something moves by 0.5 s, the mark resolves by 1.0 s and the wordmark lands at 2.0 s.
- **Transitions:**
  - Smeared type settles in about 5 frames at 60 fps.
  - revid:14's dot-to-toggle-to-pill morphs take 0.1 to 0.17 s each, with 0.4 s holds between.
  - The top reel's iris opener: a 0.30 s collapse, a 3-frame hold, a 0.15 s iris, then a 0.3 s wordmark wipe.
- **Vertical ad (pm:lexnlin-038035):** median shot 0.30 s, with 19 cuts in 14.5 s.
- **Lyric film (revid:25):** 35 cuts in 157 s, median shot 2.4 s.

## What looks cheap or "AI-made"

- **The convergent kit.** Most stock-prompt reels share it:
  - a red dot opener
  - "CLAUDE." in a heavy sans with an italic serif role line
  - corner labels and timecode
  - a voxel field, a particle sphere or galaxy, and Truchet or Bauhaus tiles
  - an "every frame" word sequence
  - a closing wordmark with a coloured full stop
- **Corner HUD chrome.** One creator named it an AI giveaway in their prompt.
- **Scenes without a thesis.**
- **Even 1.0 s cuts.**
- **Strobing tunnels and spirals.**
- **Long holds with nothing moving.**
- **Dead air.** One file ends with 11 s of black.
- **Ending on the model's own name.**

## Gaps in the engine

These are checked against `engine-moves.tsv`. None of them exists as a move:

- **Morphs and carriers**
  - shape morph between basic shapes (craft guide 09 describes it, but there is no move)
  - a carrier dot that persists across scenes
  - a full stop or ball that grows into the next scene's background
- **Diagrams and generated fields**
  - an easing comparison board or curve editor
  - generated fields: halftone waves, Truchet tiles, voxel heightfields, particle shapes that morph
- **Type devices**
  - rotating rings of text
  - echo stacks (outlined copies of a word)
  - one word per half beat, each on a new colour field
  - type on a warped 3D grid
  - words used as structural parts of a layout
  - stamp emphasis
- **Recaps, loops and 3D**
  - a recap grid of earlier scenes still playing (the existing grid moves only work on screen captures)
  - seamless loops for motion-graphics scenes
  - a squash-and-stretch ball
  - metaballs
  - chrome or glossy 3D objects

Before adding any of these, note that the house design styles ban dots, coding-style typefaces, mesh blobs and glitch effects, and the most-liked reels lean on all of them. Either add a scoped "showreel" family, or keep the ban and treat these devices as the kit to avoid.
