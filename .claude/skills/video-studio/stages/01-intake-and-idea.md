# Stage 0–1: intake and idea

Ends with the **Idea** approval.

## Read first

- `knowledge/playbooks/<type>.md` once the type is known
- `knowledge/craft/00-principles.md`
- `knowledge/craft/01-direction.md` (soul sheet and energy map sections)
- `brands/<brand>/ledger.json` (the last five videos)

## 1. Intake: the brief, in their words

Start with what the creator said, word for word: `node tools/plan/brief.mjs new jobs/<date>-<name> "<their words>"`. Add any references or footage they gave to `brief.json` (`references`, `materials`), each with what they said about it. Then run `node tools/plan/brief.mjs check jobs/<job>`.

- It states back what their words already settle ("vertical" is 9:16): say it in one line so they can correct it; do not ask it.
- It lists only the questions whose answers change what gets made, most consequential first. Ask at most three at a time, each with the recommended answer, in plain words. The usual first ones: the master size; what kind of film (product demo, launch reel, edit of their footage, a person talking, an animated short); and, for every reference, **what they like about it**: the camera, the pacing, the presenter's delivery, the look, the type or the sound. That answer decides what gets copied. A reference liked for its delivery needs a short performance test before anything else is made; one liked for its camera needs a motion test, not a still.
- For every claim the film makes ("it connects", "it's fast"), ask what the viewer literally sees that proves it, and write it as `must_show[].evidence`.
- Record each answer once. An answer to a `check` question goes in with `node tools/plan/brief.mjs set jobs/<job> <field> "<value>"` (fields: kind, for, viewer_should, voice, length_cap_seconds, size), which stops `check` asking it. Anything else goes in with `brief.mjs decide`. Run `check` once more at the end, not after every answer. Every later stage reads `brief.mjs show` instead of re-asking.

Do not ask for facts you can look up in `knowledge/` or the brand folder.

## 2. The material

Choose each shot's source by what the film must prove: the real product (screen capture), the creator's footage, drawn motion and type, or generated footage. Defaults per kind are in `tools/plan/lib/brief.mjs` (`PATHS`); generated people and recurring characters always get a short test first.

If the film shows a web product: walk the task in the product in the browser pane (signed in to a demo account with no real customer data), using the product's Claude connector if it has one to set up believable demo data. Capture every screen and state at double resolution into `jobs/<job>/captures/`. Compare with `brands/<brand>/product/` and note what changed. Write the task as a flow table in `jobs/<job>/flow.md` (format in `knowledge/craft/10-flows.md`), marking each step show, shorten or cut. Reuse a saved flow from `brands/<brand>/product/flows/` if the product has not changed since.

If the product cannot honestly do something the brief assumes, say so now.

If the creator has made a film in this brand before and liked it, offer the short path first: `node tools/plan/style.mjs list <brand>`, then "Next episode in a saved style" in `SKILL.md`.

## 3. Three concepts

Each concept is a filled `templates/soul-sheet.md`, plus:

- A recommended length cap, energy preset and design style (one of the six in `knowledge/craft/13-design-styles.md`), with one line of reasoning each.
- The flow pattern it uses (`knowledge/craft/10-flows.md`).
- Up to three study cards it learns from, and the one technique taken from each.
- How its hook, look and signature move differ from the last five videos.
- The hook family each idea would open with (`knowledge/craft/15-hooks.md` section 4; `node tools/hooks/hooks.mjs find --type <type> --platform <platform> --awareness <level> --brand <brand>` gives formulas the brand has not used lately). The three ideas open in three different families.

The three must differ from each other in idea, not only in styling. Recommend one.

## 4. Hand-over

Create `jobs/<date>-<name>/job.json` from `templates/job.json`. Present the three soul sheets and the recommendation. Stop for the Idea approval. Record the chosen concept and the length cap in `job.json`. When the person says yes (or their brief already approves it), also run `node tools/conductor/gate.mjs approve jobs/<job> idea --inputs <soul sheets file name, e.g. soul-sheets.md>` (paths inside the job folder) (add `--mode grouped` if they chose grouped approvals) so a restart does not ask again.
