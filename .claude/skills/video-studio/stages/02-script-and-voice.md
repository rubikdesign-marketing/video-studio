# Stage 2: script and voice

Ends with the **Script and voice read** approval. A person listens to the voice here; Claude cannot.

## Read first

- `jobs/<job>/job.json` and the approved soul sheet
- `knowledge/playbooks/<type>.md`
- `knowledge/craft/07-sound.md` (voice section)
- `knowledge/rules/` entries tagged script

## 1. Script

- If a script was supplied, tighten it; do not rewrite its meaning. Otherwise write it.
- Follow the playbook's shape. Give every line its beat and an energy number from 1 to 5.
- Full sentences spoken to one person. Outcomes, not feature names. The hook or offer inside the first 3–5 seconds.
- Fix the offer wording once and use it identically everywhere.
- Estimate length at about 2.5 words a second and stay under the cap with room for holds.
- Offer two alternative hooks alongside the recommended one.

## 2. Voice

- Write `jobs/<job>/audio/script.json`: one entry per line with `id`, `text` (the direction in [brackets], product words as in `brands/<brand>/pronunciation.md`) and `gap_after` in seconds (0.6–0.8 between thoughts; up to 1.3 for a planned proof hold).
- The voice is the one named in `job.json`, looked up in `brands/<brand>/voices.json`. If the maker names a voice that is not there, find it with the ElevenLabs connector, let the maker hear the preview, then add a row.
- `node tools/audio/voice.mjs generate jobs/<job>` makes three takes per line. It never pays twice for a take that exists.
- `node tools/audio/voice.mjs choose jobs/<job>` checks every take and picks the best. A line with no clean take is regenerated (delete its takes, run generate again), never repaired. Never stretch or slice a line.
- `node tools/audio/voice.mjs join jobs/<job>` writes `audio/voice.wav`, `audio/words.json` and `audio/lines.json`, and checks the joined file.
- If the check reports a product word as different but the maker confirms by listening that it was said correctly, add the mishearing to `brands/<brand>/heard-as.json`.

## 3. Hand-over

Give the script as a table (line, beat, energy, seconds), the joined voice file to listen to, and the check results. State that nobody has listened yet. Stop for approval. After approval the voice is locked: scene lengths come from its timings.
