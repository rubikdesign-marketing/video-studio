# Hook Library (LIBRARY-PLAN phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the studio a library of hook formulas, the rules for the first three seconds, a tool that proposes and measures hooks, a check that a render's hook text is readable, and a gated way to use a Viral Hooks clip.

**Architecture:** Data in `library/hooks/` (one JSON file, validated by a test), craft in one guide, two small Node tools with pure libraries beside them, wired into the stage guides. The judging of a hook is Claude's, from a written rubric; scripts only measure.

**Tech Stack:** Node 22 (ESM, `node --test`), ffmpeg and tesseract (already installed), `tools/checks/text_size.mjs` (its `wordsAt` and `emOf` read text from a frame).

**Spec:** `LIBRARY-PLAN.md` (sections 2, 4 phase 1, 5 "Calls already made", 7 decisions 1 and 2).

## Global Constraints

- Only sources with a licence file that allows copying (MIT, Apache 2.0). Every formula names its source; `library/hooks/CREDITS.md` carries each source's copyright line and licence.
- Every formula's `status` is `"untested"`. No view counts, percentages or "proven" claims are copied.
- Plain words, sentence case, no dots as separators, wording that sounds like a person (studio rules; `zero-slop` pass on every example line).
- No outside call from `hooks.mjs`. `clips.mjs` talks only to viralhooks.org, and only when told to.
- A Viral Hooks clip: never in the repository, never for a paid ad, never without the owner's words recorded.
- Hook text rule (from win4r/video-director, MIT): at least 84 px on a 1080 short side (7.8% of the short side), contrast at least 7:1, readable by 3.0 s.
- Speaking pace: 2.5 words a second (stage 2's rule).

## Review Focus

- A brand with an empty or missing ledger: `find` still returns formulas (nothing to exclude).
- A filter that matches fewer than `n` formulas: return what there is and say how many were asked for.
- A render shorter than 3 s is judged on what it has; one with no text at all fails with a clear reason, not a crash.
- Hook text that is large but appears at 3.5 s: fails as "late", naming the time it was first readable.
- `clips.mjs use` on a job whose `job.json` says it is for paid ads: refuses, exit 1, nothing downloaded.

---

### Task 1: The formula data and its validator

**Files:** Create `library/hooks/index.json`, `library/hooks/avoid.json`, `library/hooks/CREDITS.md`, `library/hooks/README.md`, `tools/hooks/lib/library.mjs`, `tools/hooks/tests/library.test.mjs`.

**Interfaces — Produces:**
- `index.json`: `{ about, families: [{id, name, what}], sources: [{id, name, url, licence, commit, taken}], formulas: [Formula] }`
- `Formula`: `{ id (kebab, unique), family (a families id), name, spoken (template with {slots}), example, on_screen (the written line, at most 7 words), first_frame (what is seen at frame 0), suits: { types: subset of [promo, demo, tutorial, edit, ad], platforms: subset of [reels, tiktok, shorts, youtube, linkedin, x], awareness: subset of [cold, problem-aware, solution-aware, product-aware] }, trap, source (a sources id), status: "untested" }`
- `avoid.json`: `[{ pattern (regex source, case-insensitive), why }]`
- `loadLibrary(dir?) -> { families, sources, formulas, avoid }`, `validate(lib) -> string[]` (problems; empty when valid).

- [ ] Test `validate`: unique ids; every `family` and `source` exists; `on_screen` at most 7 words; `status === "untested"`; every source licence in `[MIT, Apache-2.0]`; no two formulas with the same normalised `spoken`; every family has at least 3 formulas; no example contains a digit followed by `%` or the words "proven", "guaranteed", "viral".
- [ ] Test on the real file: `validate(loadLibrary())` is empty and there are at least 120 formulas in at least 8 families.
- [ ] Merge the sources into `index.json` (helpers extract, the lead curates and de-duplicates). Commit.

### Task 2: `hooks.mjs` find, measure, rubric

**Files:** Create `tools/hooks/lib/pick.mjs`, `tools/hooks/hooks.mjs`, `tools/hooks/tests/pick.test.mjs`. Uses Task 1's `loadLibrary`.

**Interfaces — Produces:**
- `find(lib, { type, platform, awareness, exclude = [], n = 5 }) -> { picks: Formula[], asked: n, matched: number }`: filters by `suits`, drops `exclude` ids, returns `n` formulas from `n` different families where possible (families in rotation, stable order by id for the same input).
- `usedByBrand(ledger, last = 5) -> string[]`: the `hook_formula` ids of the last five ledger records.
- `measure(spoken, { onScreen = '', avoid = [], wps = 2.5 }) -> { words, seconds, on_screen_words, first_claim_seconds, avoid_hits: [{pattern, why}], notes: string[] }`. `first_claim_seconds`: seconds at `wps` up to the end of the first clause of three words or more (clauses end at `,` `.` `?` `!` `:` or a dash); a note when over 3 s; a note when `on_screen_words` is over 7.
- CLI: `hooks.mjs find --type promo --platform reels --awareness cold [--brand tulvo] [--n 5]`, `hooks.mjs measure "<line>" [--on-screen "<line>"]`, `hooks.mjs rubric` (prints the four hook killers from `knowledge/craft/15-hooks.md` section "Scoring a hook"), `hooks.mjs check` (runs `validate`).

- [ ] Tests: five picks from five families; `exclude` honoured; fewer matches than `n` returns `matched < asked`; an empty ledger gives `[]`; `measure("Your invoices go out late, and clients notice")` reports 8 words, 3.2 s, first claim 2 s; a one-word address ("Founders,") is not counted as the claim; a 12-word first clause notes "the claim lands after 3 s"; an avoid-list opener is reported with its reason.
- [ ] Implement, run `node --test tools/hooks/tests/*.test.mjs`, commit.

### Task 3: The hooks craft guide

**Files:** Create `knowledge/craft/15-hooks.md`.

Sections, in this order: the three layers (seen, said, written) and that they must agree; first-frame rules (the 8-point checklist); deadlines by platform; hook families (one line each, matching `families` in the data); "Scoring a hook" (the four hook killers: delay, confusion, irrelevance, disinterest, each with the question to ask and the fix; score each 0 to 2, a hook under 6 of 8 is rewritten); anti-patterns; hooks for ads (ABCD cited with its link); how the library learns (the ledger's `hook_formula` and results; a formula is "worked for <brand>" only from the ledger). Every borrowed table credited inline. No statistics without a source.

- [ ] Write it; run `zero-slop` rules over it by hand; commit.

### Task 4: `hook_legible.mjs`

**Files:** Create `tools/checks/lib/hook_text.mjs`, `tools/checks/hook_legible.mjs`, `tools/checks/tests/hook_legible.test.mjs`.

**Interfaces — Produces:**
- `contrast(inkRgb, groundRgb) -> number` (WCAG relative-luminance ratio).
- `judgeHook(samples, { shortSide, minShare = 7.8, minContrast = 7, by = 3.0, expect = '' }) -> { pass, first_readable: seconds|null, problems: [{what: 'no text'|'too small'|'low contrast'|'late'|'not the hook', detail}], best: {t, text, share, contrast} }`, where `samples = [{ t, lines: [{ text, share (type size as % of the short side), contrast }] }]`. A line counts when `share >= minShare` and `contrast >= minContrast`. Without `expect`, pass when a counting line exists at some `t <= by`. With `expect`, its words are added up over time (a hook may arrive a word at a time): pass when at least half have been in counting lines by `by`; a failure is explained by the hook's own words.
- CLI: `hook_legible.mjs <render.mp4> [--by 3] [--min 7.8] [--contrast 7] [--expect "<on-screen line>"] [--json out.json]`; samples every 0.25 s from 0 to `by + 1`; reads frames with `wordsAt`/`emOf` from `text_size.mjs`; measures each line's ink and ground colour from the frame. Exit 0 pass, 1 fail, 2 could not run.

- [ ] Unit tests for `contrast` (white on black 21, #777 on #888 under 1.5) and `judgeHook` (pass; too small; low contrast; late with `first_readable: 3.5`; no text; render shorter than 3 s).
- [ ] Whole-tool test: four 4 s clips made with ffmpeg `drawtext` (big white on black from 0 s passes; 40 px fails "too small"; grey on grey fails "low contrast"; big text from 3.5 s fails "late").
- [ ] Implement, run, commit.

### Task 5: Viral Hooks as a gated source

**Files:** Create `tools/hooks/lib/clips.mjs`, `tools/hooks/clips.mjs`, `tools/hooks/tests/clips.test.mjs`; modify `.mcp.json` (create if absent) to declare the `viralhooks` server at `https://viralhooks.org/api/mcp/`.

**Interfaces — Produces:**
- `mayUse(job, { post }) -> { ok, why }`: refuses when `post !== 'organic'`, or `job.type` or `job.channel` mentions "ad" or "paid".
- `rightsRecord({ page, slug, approvedBy, words, post, date }) -> object` and `checkJob(dir) -> string[]` (every `media/viralhooks/*.mp4` has a `<slug>.rights.json` with `approved_by`, `owner_words`, `post: "organic"`).
- CLI: `clips.mjs use <page url> --job jobs/<job> --approved-by "<name>" --words "<the owner's words>" --post organic` (downloads to `jobs/<job>/media/viralhooks/`, writes the rights record, adds a line to `media/CREDITS.md` saying no licence is stated and the owner decided); `clips.mjs check jobs/<job>`. Searching is done in the session through the connector, for reference.

- [ ] Tests: paid job refused; `--post ads` refused; missing `--words` refused; `checkJob` names a clip with no record; a record round-trips.
- [ ] Implement, run, commit.

### Task 6: Wiring

**Files:** Modify `.claude/skills/video-studio/stages/01-intake-and-idea.md`, `02-script-and-voice.md`, `05-animation.md`, `06-delivery-and-learning.md`, `.claude/skills/video-studio/skill-map.md`, `knowledge/playbooks/promo.md` (the hook lab), `.claude/skills/THIRD-PARTY.md`, `setup/update-skills.sh` (bundle `vyralcontent/content-skills` `skills/viral-hooks`), `setup/doctor.sh` (the hook tests), `DESIGN.md`, `LIBRARY-PLAN.md` (phase 1 status).

- [ ] Stage 2: three hooks from three families via `hooks.mjs find`, each measured and scored with the rubric; the pick and the two kept variants recorded in `job.json`. Stage 5: `hook_legible.mjs` on the hook-lab renders and the final. Stage 6: the ledger record gains `hook_formula`.
- [ ] Skill map: a "Hooks" row (leads: `knowledge/craft/15-hooks.md` and `tools/hooks/hooks.mjs`; supports: `viral-hooks`; not for this: Viral Hooks clips in paid ads).
- [ ] Run every test suite and `bash -n` on the setup scripts; commit.

### Task 7: Proof on a real brief

- [ ] For Tulvo's last promo brief: `find` returns five formulas from five families, none used in the last five ledger records; write the five hooks, measure and score them; run `hook_legible.mjs` on one existing Tulvo render and on a deliberately late version. Record results in `LIBRARY-PLAN.md`.
