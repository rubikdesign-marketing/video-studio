# Stage 0–1: intake and idea

Ends with the **Idea** approval.

## Read first

- `knowledge/playbooks/<type>.md` once the type is known
- `knowledge/craft/00-principles.md`
- `knowledge/craft/01-direction.md` (soul sheet and energy map sections)
- `brands/<brand>/ledger.json` (the last five videos)

## 1. Intake: grill the maker

Ask in rounds, each question with a recommended answer, until these are settled. Do not ask for facts you can look up in `knowledge/`.

- What kind of video: promo, feature demo, tutorial or edit.
- The one thing the viewer should do or believe afterwards.
- Who it is for, and what they already know.
- Where it will run. Size is 16:9 unless they say otherwise.
- The facts that must be right: offer wording, prices, dates, claims, with sources.
- Whether a script exists already.
- The voice: Ray, or a named voice.
- Deadline, and anything that must or must not appear.

## 2. Product walk

Use the Tulvo connector and the signed-in browser pane to do the task the video is about, in the demo workspace, building new boards and pages for this video. Capture every screen and state at double resolution into `jobs/<job>/captures/`. Compare with `brands/<brand>/product/` and note anything that has changed.

Write the task as a flow table in `jobs/<job>/flow.md` (format in `knowledge/craft/10-flows.md`), marking each step show, shorten or cut. Check `brands/<brand>/product/flows/` first: reuse a saved flow if the product has not changed since it was walked. Build believable, consistent data for the customer story through the connector.

If the product cannot honestly do something the brief assumes, say so now.

## 3. Three concepts

Each concept is a filled `templates/soul-sheet.md`, plus:

- A recommended length cap, energy preset and design style (one of the six in `knowledge/craft/13-design-styles.md`), with one line of reasoning each.
- The flow pattern it uses (`knowledge/craft/10-flows.md`).
- Up to three study cards it learns from, and the one technique taken from each.
- How its hook, look and signature move differ from the last five videos.

The three must differ from each other in idea, not only in styling. Recommend one.

## 4. Hand-over

Create `jobs/<date>-<name>/job.json` from `templates/job.json`. Present the three soul sheets and the recommendation. Stop for the Idea approval. Record the chosen concept and the length cap in `job.json`.
