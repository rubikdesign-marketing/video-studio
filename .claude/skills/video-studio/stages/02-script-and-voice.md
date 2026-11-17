# Stage 2: script and voice

Ends with the **Script and voice read** approval. A person listens to the voice here; Claude cannot.

## Read first

- `jobs/<job>/job.json` and the approved soul sheet
- `knowledge/playbooks/<type>.md`
- `knowledge/craft/07-sound.md` (voice section)
- `knowledge/rules/` entries tagged script

## 1. Script

- If a script was supplied, tighten it; do not rewrite its meaning. Otherwise write it.
- Follow the playbook's shape. Give every line its beat and an energy number from 1 to 5, and store them on the line in `audio/script.json` (`"beat": "proof", "energy": 3`; the beat names are the framework's, `node tools/plan/beats.mjs frameworks`).
- Run `node tools/plan/beats.mjs jobs/<job>` before handing over: it lays the script against the framework and names a late hook, beats too long or short or missing, lines too long to say, and breaks in the energy map (`knowledge/craft/16-structure-and-retention.md`). Fix each finding or say why it stays. Run it again once the voice is made: then it uses the voice's own timings.
- Full sentences spoken to one person. Outcomes, not feature names. The hook or offer inside the first 3–5 seconds.
- Fix the offer wording once and use it identically everywhere.
- Estimate length at about 2.5 words a second and stay under the cap with room for holds.
- Three hooks, from three different families of the hook library, written in the brand's own words: `node tools/hooks/hooks.mjs find --type <type> --platform <platform> --awareness <level> --brand <brand>`. A formula is a pattern to write from, never a line to copy.
- For each: the spoken line, the written line that goes on screen with it (seven words at most, never a repeat of the voice) and what the first frame shows (`knowledge/craft/15-hooks.md` sections 1, 2 and 5). Measure it (`hooks.mjs measure "<line>" --on-screen "<line>"`) and score it on the four hook killers (`hooks.mjs rubric`): under 6 of 8, or a 0 anywhere, is rewritten. The scores are your judgement; say so.
- Recommend one. Record all three in `job.json` under `hooks`: `formula` (the library id), `spoken`, `on_screen`, `first_frame`, `score`, and `picked`. The two not picked are kept as ad variants.
- Every line is the brand's and goes through `zero-slop` like the rest of the script.

## 2. Voice

- Write `jobs/<job>/audio/script.json`: one entry per line with `id`, `text` (the direction in [brackets], product words as in `brands/<brand>/pronunciation.md`) and `gap_after` in seconds (0.6–0.8 between thoughts; up to 1.3 for a planned proof hold).
- The voice is the one named in `job.json`, looked up in `brands/<brand>/voices.json`. If the maker names a voice that is not there, find it with the ElevenLabs connector, let the maker hear the preview, then add a row.
- `node tools/audio/voice.mjs generate jobs/<job>` makes three takes per line. It never pays twice for a take that exists.
- `node tools/audio/voice.mjs choose jobs/<job>` checks every take and picks the best. A line with no clean take is regenerated (delete its takes, run generate again), never repaired. Never stretch or slice a line.
- `node tools/audio/voice.mjs join jobs/<job>` writes `audio/voice.wav`, `audio/words.json` and `audio/lines.json`, and checks the joined file.
- If the check reports a product word as different but the maker confirms by listening that it was said correctly, add the mishearing to `brands/<brand>/heard-as.json`.
- Listen to the joined voice: `node tools/audio/listen.mjs jobs/<job>/audio/voice.wav --quick` (earshot). Read its loudness, loudness range, noise floor and tone balance. A line it measures as clipped, noisy or much duller or brighter than the others is regenerated, like any failed take.

## 3. Hand-over

Give the script as a table (line, beat, energy, seconds) with the beat sheet's findings, the joined voice file to listen to, the check results and earshot's numbers. State that nobody has listened yet. Stop for approval. After approval the voice is locked: scene lengths come from its timings.
