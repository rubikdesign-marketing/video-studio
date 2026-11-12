# Stage 0: set up a brand

Done once per brand, and again whenever the brand changes. Ends with the **Brand sheet** approval. After it, every video for that brand uses its logo, colours, fonts, voice and rules without anyone touching engine code.

## Read first

- `brands/_template/README.md` and `brands/_template/brand.json` (what a brand needs)
- `knowledge/craft/12-frame-quality.md` and `knowledge/craft/04-type-and-captions.md` (what good looks like)
- An existing brand, for example `brands/tulvo/`, as a worked example

## 1. Grill the team

Ask in rounds, each question with a recommended answer. Look up everything you can first; ask only for decisions and for things only they know.

- The brand's name as written, and how it is said aloud.
- Where the brand lives: website, design file, brand guide, social posts. Which of these wins when they disagree.
- Logo files: for a light page, for a dark page, and the mark alone.
- Typefaces: headline, an optional accent face, labels and numbers, and the product's own typeface if there is a product. Who holds the licences.
- Colours on a light page and on a dark page: page, ink, second, accent, a warm note, a soft fill, lines.
- What they never want to see: colours, patterns, type, words.
- The voice: listen to previews together and pick one or two named voices. Words that are often mispronounced.
- How they want to sound: three lines they like, three they hate.
- Videos they admire, three to five, and what they admire in each.
- The product, if there is one: where a demo account lives and how screens are captured.

## 2. Gather

1. `node tools/brand/new.mjs <name>` creates `brands/<name>/` from the template.
2. Read the brand's own sources and fill `brand.json` by role. Take colours and type from the real site or design file (the browser pane for a website, the Figma connector for a design file), not from memory. Record the source of every value in `brand.md`.
3. Copy logo files into `logo/` and font files into `fonts/`. Confirm each font's licence allows video use and note it in `brand.md`. If a licence is unclear, stop and ask.
4. Fill `voices.json`, `pronunciation.md` and `rules.md` from the grilling. The studio's rules in `knowledge/rules/` apply unless `rules.md` says otherwise, so only write down what is different or extra.
5. If there is a product, start `product/` with what is known and a dated first capture.

## 3. Check

1. `node tools/brand/check.mjs <name>`: every role filled, every file present, and readable contrast on both pages. Fix what it reports.
2. `node tools/brand/sync.mjs` makes the brand available to the engine.

## 4. Brand sheet

1. Render the `BrandSheet` still for the brand: palette on light and dark, logo on both, type specimen, a button, a pill and the caption bar.
2. Render the six-second `Smoke` clip in the brand.
3. Run `tools/checks/frame_quality.py` on the clip and look at the sheet yourself: is anything off-brand, hard to read, or crowded?

Hand over the sheet and the clip. Stop for approval. Changes at this point are edits to `brand.json` only.

If the brand has a product, the next step is stage 0B, product discovery (`stages/00b-product-discovery.md`), before any video.

## 5. Teach it the brand's taste

1. Study the admired videos (`templates/study-card.md`). Note in `brands/<name>/brand.md` which techniques and which design styles from `knowledge/craft/13-design-styles.md` suit this brand, and which do not.
2. The first real video is the proving run. Its review notes are logged, and the lessons drafted from them go to `brands/<name>/lessons/` for the brand's owner to approve.
3. Approved lessons become that brand's rules. A lesson that would help every brand is proposed for `knowledge/rules/` instead.

## What a brand cannot change

The production line, the checks, and the rule that only real product UI is shown. Everything about look, sound and wording is the brand's to set.
