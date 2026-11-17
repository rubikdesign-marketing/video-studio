# Stage 7: delivery and learning

Runs after the full-animation approval. No approval of its own, except for lessons.

## Deliver

Before anything is copied, for a film with product shots:

1. **Still current.** `node tools/capture/capture.mjs check jobs/<job> <id>` for every capture the film plays. Each mark is compared three ways: the picture, the words on screen and where things sit. Any change ("New lead" became "Add lead", a button moved 40 px) stops delivery until that part is recorded again and the scene re-rendered, or the owner accepts the change in writing.
2. **Proof of source.** `node tools/film/sources.mjs jobs/<job>`. It lists every product shot with its capture, take, date captured, product address and browser, and writes `deliver/sources.txt` and `sources.json`. A product shot with no source fails delivery: record it, or take the shot out.

Into `jobs/<job>/deliver/`:

- The master, with captions and without.
- A captions file.
- A poster frame (the signature moment).
- A two-line description and the approved offer wording.
- A note of every licence or permission the video relies on. Media from Openverse: run `node tools/media/openverse.mjs credits jobs/<job>`, copy `media/CREDITS.md` here, and put every line marked "credit needed" in the description or on the end card.
- The proof of source (`sources.txt`, `sources.json`), when the film shows the product.

## Record

When the film has been published on YouTube for a day or two, export its audience retention (YouTube Studio: Analytics, the video, Engagement, the retention chart, the download icon) into the job folder and run `node tools/plan/retention.mjs <export.csv> --job jobs/<job>`. It names where viewers left and where they rewatched, with the beat and line playing at each, and writes `learn/retention.json`. Put what it found in the ledger record and the lessons (`knowledge/craft/16-structure-and-retention.md` section 7). It has not yet been checked on a real export: look at the export's two columns the first time.

1. **Ledger.** Add a record to `brands/<brand>/ledger.json`: type, date, length, hook, `hook_formula` (the hook library's id for the opening that shipped, from `job.json`), look, signature move, stage, voice, references used, and the measured profile summary. When results come in they go in the same record: the ledger is the only place a hook formula earns "worked for this brand" (`knowledge/craft/15-hooks.md` section 9).
2. **Library.** Add the new move, effect or background to `library/` with its code, a preview clip, and the video types it suits.
3. **Product knowledge.** Write anything learned about the product to `brands/<brand>/product/` with the date and a screenshot.
4. **Usage.** Add the credits used per stage to the job record.

## Learn

1. Read this video's entries in `knowledge/feedback-log/`.
2. Draft lessons into `brands/<brand>/lessons/`: what was said, how often, what rule it suggests, and what check would catch it. Mark any note that repeats an earlier video's note.
3. Ask the owner to approve, edit or reject each lesson. Only approved lessons move to `knowledge/rules/`.
4. **Skills.** Check `skills_used` in `job.json` is filled in for every stage (which skill, what for, helped or not, and why). Apply "Keeping the skills sharp" in `skill-map.md`: propose a map change for any skill that got in the way, and any lesson for `video-studio` itself, for the owner to approve.
5. When results arrive later, the owner reads them off Meta Ads Manager or YouTube Studio and says them in plain words ("the Black Friday film held 38% to the end and got a 1.4% click rate on Meta"). Add them to that video's ledger record under `results`, as a list so a video can have one entry per channel and per check-in:

   ```json
   "results": [
     { "channel": "Meta ads", "entered_on": "2026-12-01", "period": "2026-11-20 to 2026-11-30",
       "hold_rate": 0.38, "hold_rate_means": "watched to the end", "click_rate": 0.014,
       "views": 52000, "spend": null, "source": "Meta Ads Manager, typed in by the owner", "note": "" }
   ]
   ```

   Rates are shares from 0 to 1. Say what the hold rate means for that channel (to the end, past 3 seconds, past 15 seconds), because each channel counts it differently. Leave anything not given as `null`; never estimate a number. Read back what was written. (Typed in by hand for now; owner's decision, 11 Nov 2026.)

## Sync

Pull, then push rules, lessons, library entries, product knowledge and the ledger to GitHub. Renders and `.env` are never pushed.
