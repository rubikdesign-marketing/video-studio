# The style library

Five tabs of styles a customer can pick on the brief page: Filming, Motion, Animation, Product UI and Sound. Each tab is one file in this folder (`filming.json`, `motion.json`, `animation.json`, `product-ui.json`, `sound.json`). Every file is a list of entries. Each tab needs at least 100.

Check the library with `node tools/styles/check.mjs`. It lists every problem, one per line, and stops with an error if there is one. Options: `--tab <id>` checks one tab, `--skip-clips` skips the preview clip check, `--corpus <path>` points at the motion study records, `--min <n>` changes the entry count.

## What an entry holds

- `id`: unique across all tabs. `tab`: which tab it lives in. `name`: plain, sentence case. `line`: one sentence a marketer understands. `family`: the filter group inside the tab.
- `filters`: `energy` (any of calm, confident, hype), `kinds` and `sizes` (the brief's own values), and `ready` (true when the engine can make it today, false when it is made on request).
- `prompt`: the expert direction in three plain sentences. `what` says what the style is, `when` says when it fits, `avoid` says what not to do.
- `timing`: one block for each energy in `filters.energy`. A picture style gives `beat_s`, `ease`, `overshoot`, `hold_s`, `motion` and `still_pct`. A sound style gives `bpm`, `hit_s`, `duck_db` and `still_pct`.
- `engine`: the moves, components, backgrounds and sound files it uses.
- `preview`: a ready picture style has `{ "clip": "library/styles/previews/<id>.mp4" }`. A made-on-request style has `{ "sketch": "<sketch id>", "params": {} }`. A sound style has `{ "sound": "<file>", "from_s": 0 }`.
- `nearest`: required when `ready` is false. It is the id of the closest style we make today.
- `settles` (optional): a pick can answer a brief question. For example `{ "look": "paper" }`. Fields allowed: look, voice, kind, size, each with a value the brief already knows.
- `pairs_with` and `avoid_with` (optional): ids that go well or badly together.

## The rules the check enforces

- Every tab has at least 100 entries, and no id repeats.
- A ready entry only names engine items that exist: moves in `library/motion/index.json`, components in `library/registry.json`, backgrounds in `library/backgrounds/`, sounds in `library/sounds/`.
- A ready picture entry has its clip in `library/styles/previews/`. A ready sound entry has its sound file instead of a clip.
- A made-on-request entry names a `nearest` entry that is ready.
- Every energy listed has its timing, and the numbers stay inside the studio's targets. Typical motion: calm 0.5 to 0.9, confident 1.2 to 1.7, hype 4.4 to 6.5. Still time: calm 13 to 15 percent, confident and hype under 10 percent. Sound entries are exempt from the motion range.
- No mesh blobs in what a style does (the avoid line may name them). No glitch or RGB split in engine names.
- No banned word from `release/manifest.json`.
- A sketch id must be one of the eight in `sketches.json`. Every id in `pairs_with` and `avoid_with` must exist. A `settles` value must be one the brief allows.
- On the owner's machine, where `.damex/motion-study/corpus.json` exists, no prompt shares a run of eight words with a study record. Write every prompt fresh.

## Sketches

`sketches.json` lists the eight animated drawings the page shows for styles made on request. An entry points at one by id.
