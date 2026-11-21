# Style library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the brief page as a director's desk. Its style library has five tabs of 100+ styles each, with moving previews and expert prompts. Picks, a "Sharpen with the director" brief and suggestions go through the one brief logic to Stage 1.

**Architecture:**
- **Library files:** one JSON file per tab in `library/styles/`, read by a small loader and check (`tools/styles/lib/library.mjs`) that the chat command, the brief logic, the connector and the publish builder all share.
- **Brief logic:** picks, what a pick settles, an energy and length reading, and the director's brief live in `tools/plan/lib/brief.mjs`, which stays pure.
- **Connector:** gains `brief_pick`, `brief_direct` and the read-only `styles_suggest`.
- **Previews:** the engine renders one short clip per ready entry, and sound previews are packed into one audio sprite.
- **Publishing:** `tools/styles/build-page.mjs` writes the published set (page, data, shared modules, clips) to `studio/brief-desk/dist/`. The studio skill publishes it as one artifact with supporting files, in batches.
- **The page:** rebuilt on the approved comp.

**Tech Stack:**
- Node 22.13+ ES modules and `node:test`; the connector stays zero-dependency.
- Remotion 4 in `engine/` for preview clips, and ffmpeg for compressing clips and building the sprite.
- The page is plain HTML, CSS and JS with ES modules loaded by relative path, and fonts from Google Fonts (Chakra Petch, Onest, My Soul).

**Spec:** `docs/superpowers/specs/2026-11-21-style-library-design.md`. Section 10 wins where it differs from the earlier sections. Visual reference: `docs/design/brief-desk-comp/index.html` and `DIRECTION.md`.

## Global Constraints

- **Node:** 22.13 or newer, not 23, on Mac, Windows and Linux. The connector, `tools/styles/` and `tools/plan/lib/` import only `node:` modules. `tools/plan/lib/brief.mjs` and `tools/styles/lib/suggest.mjs` import nothing at all, because the page loads them as they are.
- **One logic:**
  - Questions, checklist, picks validation and director's brief validation live only in `tools/plan/lib/brief.mjs`.
  - Suggestion scoring lives only in `tools/styles/lib/suggest.mjs`.
  - The page loads both modules. It never re-creates them.
- **Library facts:**
  - Five tabs, in this order with these ids: `filming`, `motion`, `animation`, `product-ui`, `sound`. At least 100 entries per tab, and ids unique across tabs.
  - Energies are `calm`, `confident` and `hype`. Kinds are `KINDS` and sizes are `SIZES` from `brief.mjs`.
- **Timing targets** (spec section 3): typical motion calm 0.5 to 0.9, confident 1.2 to 1.7, hype 4.4 to 6.5. Still time 13 to 15% for calm, under 10% otherwise.
- **Pick rules:**
  - At most one pick per family within a tab, and at most three per tab.
  - A pick is refused when it is in another pick's `avoid_with` (either direction), or when its energies share none with the picks already made.
  - Precedence: the customer's typed answer, then a saved style, then a pick.
- **Ready now:** every `engine` name exists (moves in `library/motion/index.json`, components and other items in `library/registry.json`, backgrounds, sound files), and a clip exists.
- **Made on request:** the entry names a `nearest` ready entry in the same tab.
- **Previews:** clips at most 3 s, 480 px on the long side, looping, silent, about 100 KB and never over 200 KB each, under 40 MB in all, at most 500 files. Rendered with the `demo` brand only. Sound snippets at most 4 s. No voice samples.
- **Plain words:**
  - The director's brief, the cards and every reason are plain sentence case. Engine move and component names appear only in "What the engine will use" and the card drawer's "engine details" fold.
  - Display headlines use Chakra Petch capitals. Everything people read or click uses Onest, sentence case.
  - No dots as separators, no coding-style typeface.
- **Page tokens** (`DIRECTION.md`):
  - Colours: page `#010B24`, ink `#FFFFFF`, second ink white 62%, line white 16%, soft white 6%, accent `#BBFC9E` with on-accent `#050B14`.
  - Amber `#FFA724`: only clashes and "made on request".
  - Blues: night deep `#061A4D`, night mid `#0A2A7A`, azure `#2E6BFF` (used sparingly).
  - Widths: works from 320 px up with no sideways scroll.
  - Motion: transform and opacity only, with named easings. Reduced motion shows still frames.
- **Never copy the motion study:** no prompt text and no video from `.damex/motion-study/corpus.json`, which never ships. On this machine the corpus is at `/Users/wedevs/Desktop/Marketer/projects/tulvo/video-studio-motion-06/.damex/motion-study/corpus.json`. Pass it with `--corpus`.
- **House rules** (`knowledge/craft/13-design-styles.md`): no dots, mesh blobs, glitch or RGB split in pictures.
- **Release:**
  - No Tulvo or client content. New code and tests use only the brand names `demo` and `acme`.
  - The banned-word scan in `release/manifest.json` must pass.
  - `library/styles/` ships; `studio/brief-desk/dist/` is git-ignored and built on the customer's machine.
- **Branch and permissions:**
  - Work on the `brief-desk` worktree at `/Users/wedevs/Desktop/Marketer/projects/tulvo/video-studio-brief-desk`, on top of the finished brief desk.
  - Commit only on `brief-desk`. Never push without the owner's yes.
  - Tests that bind local ports need the sandbox off.

## Review Focus

1. **A library file hand-edited into invalid JSON, or an entry missing fields.** `check.mjs` names the file and the entry. The loader returns the other tabs plus a plain note, and the connector, chat command and page show the rest instead of failing. Tests in Task 1 and Task 4.
2. **A pick from a page published before the library changed** (the id is gone, or it moved tab). `brief_pick` refuses it in plain words. A stale pick already in `brief.json` is shown as "no longer in the library" and left out of the plan, with no crash. Tests in Task 3.
3. **A director's brief from `sample` that is malformed, has a missing part, names engine moves in its text, or states timing outside the energy targets.** `checkDirectorBrief` refuses it and names the part. The page keeps the customer's words and offers to try again. Tests in Task 3, and the page check in Task 14.
4. **Picks saved without the connector** (the page's `db` fallback) and picked up later in chat. They go through the same validation (`brief.mjs pick`), and clashes are reported, not dropped. Tests in Task 3.
5. **A publish set over the limits** (more than 500 clips, more than 40 MB, or one batch over 250 files). `build-page.mjs` splits the batches and fails with a plain message over the totals. Test in Task 12.

---

### Task 0: Commit the approved spec and comp

**Files:**
- Add: `docs/superpowers/specs/2026-11-21-style-library-design.md`, `docs/design/brief-desk-comp/` (index.html, tokens.css, wordmark-on-dark.svg, DIRECTION.md, `.hallmark/log.json`), this plan

- [ ] **Step 1:** Confirm `git status --short` shows only these docs as new.
- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-11-21-style-library-design.md docs/design/brief-desk-comp docs/superpowers/plans/2026-11-21-style-library.md
git commit -m "docs: style library design, approved comp and build plan"
```

---

### Task 1: Library shape, loader and check

**Files:**
- Create: `tools/styles/lib/library.mjs`, `tools/styles/check.mjs`, `library/styles/README.md`, `library/styles/sketches.json`
- Test: `tools/styles/tests/library.test.mjs`, `tools/styles/tests/fixtures/` (a small library with 2 to 3 entries per tab, and fixture move, registry and sound name sets)

**Interfaces:**
- Produces:
  - `TABS = ['filming','motion','animation','product-ui','sound']`
  - `TAB_LABELS` (`{ filming: 'Filming', motion: 'Motion', animation: 'Animation', 'product-ui': 'Product UI', sound: 'Sound' }`)
  - `ENERGY_TARGETS = { calm: { motion: [0.5, 0.9], still: [13, 15] }, confident: { motion: [1.2, 1.7], still: [0, 10] }, hype: { motion: [4.4, 6.5], still: [0, 10] } }`. Still values are percent and the upper bound is exclusive for confident and hype.
  - `loadLibrary(root) -> { tabs: { [tab]: Entry[] }, byId: Map<string, Entry>, notes: string[] }`. A file that is missing or not valid JSON adds a note, `"The <Tab> styles could not be read: <reason>"`, and that tab is empty.
  - `engineNames(root) -> { moves: Set, registry: Set, backgrounds: Set, sounds: Set }`
  - `promptText(entry) -> string`, the expert prompt as a customer copies it: what, when, one energy line per supported energy, avoid.
  - `checkLibrary(lib, { names, root, clips = true, corpus = null, banned = [], tab = null }) -> { problems: string[] }`
  - `SKETCHES`, the ids from `library/styles/sketches.json`.

Entry shape (spec section 2 plus these fields, all required unless marked):
- `id`, `tab`, `name`, `line`, `family`
- `filters: { energy: string[], kinds: string[], sizes: string[], ready: boolean }`
- `prompt: { what, when, avoid }`, all plain sentences
- `timing: { [energy]: { beat_s, ease, overshoot, hold_s, motion, still_pct } }`, one per energy in `filters.energy`. Sound entries use `{ bpm, hit_s, duck_db, still_pct }` and are exempt from the motion range.
- `engine: string[]`
- `preview`: `{ clip }`, `{ sketch, params }` or `{ sound, from_s }`
- `nearest` (required when `ready` is false)
- `settles` (optional): a map from a brief field in `['look','voice','kind','size']` to an allowed value
- `pairs_with`, `avoid_with` (optional id lists)

- [ ] **Step 1: Write the failing tests**
  - `check: a clean fixture library has no problems (clips off)`
  - `check: names each fixture defect`, one test per rule, each asserting the problem text names the entry id:
    - fewer than 100 entries in a tab, when run with `min: 100` against the fixture
    - a repeated id
    - a ready entry with an unknown move
    - a ready entry with no clip (clips on)
    - a made-on-request entry with no `nearest`, or a `nearest` that is not ready
    - a missing timing for a listed energy
    - confident motion 2.0
    - calm still_pct 20
    - "mesh blob" in `prompt.what` (the same words in `prompt.avoid` are allowed)
    - an engine name matching `/glitch|rgb-split/`
    - a banned word
    - a `settles` value not allowed by `brief.mjs` (for example `look: 'neon'`)
    - a sketch id not in `sketches.json`
    - a `pairs_with` id that does not exist
  - `check: an eight-word run shared with a corpus record fails, seven does not`, using a fixture corpus with records `{ prompt: "..." }`. Match on lower-cased word runs, ignoring punctuation.
  - `load: a tab file that is not JSON gives a note and the other tabs load`
  - `promptText: includes one line per energy with its numbers, and the avoid line last`
- [ ] **Step 2:** Run `node --test tools/styles/tests/library.test.mjs`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `library.mjs`.** `checkLibrary` takes `min` (default 100) so fixtures can test the count rule. Allowed `settles` values come from `LOOKS`, `VOICES`, `KINDS` and `SIZES` imported from `../../plan/lib/brief.mjs`. The corpus field holding prompt text: read the corpus's shape, and use every string field longer than 40 characters if there is no single prompt field.
- [ ] **Step 4: Implement `check.mjs`.** Usage: `node tools/styles/check.mjs [--tab <id>] [--skip-clips] [--corpus <path>] [--min <n>]`. The default corpus is `.damex/motion-study/corpus.json` when it exists. Print the problems one per line, or `Style library: <n> entries in 5 tabs, all checks pass`. Exit 1 on any problem.
- [ ] **Step 5: Write `sketches.json` and the README.**
  - `sketches.json`: eight entries `{ id, name, what }` with ids `character-bounce`, `paper-cutout`, `card-tilt-3d`, `hand-drawn-line`, `liquid-morph`, `stop-motion`, `clay-squash`, `collage-layers`.
  - `README.md`: the entry shape and the rules, in plain words.
- [ ] **Step 6:** Run the tests. Expected: PASS.
- [ ] **Step 7: Commit** with `feat(styles): library shape, loader and check`.

---

### Task 2: Suggestions and the chat command

**Files:**
- Create: `tools/styles/lib/suggest.mjs` (no imports at all), `tools/styles/styles.mjs`
- Test: `tools/styles/tests/suggest.test.mjs`

**Interfaces:**
- Consumes: `loadLibrary`, `promptText` (Task 1).
- Produces: `suggest(entries, { text = '', understood = {}, memory = [], picked = [], n = 6 }) -> [{ id, tab, name, reason }]`.
  - `understood` is `{ size?, kind?, energy?, length?, audience? }`.
  - `memory` is `[{ id, job }]`: the customer's picks from past jobs and saved styles.
  - Already-picked ids are left out.

Scoring: +3 for a matching energy, +2 for a matching kind, +1 for a matching size, +1 for each content word of `text` found in the entry's name, line or family, +4 when the id is in `memory`. Never more than two entries from one tab in the top six, and at least three tabs when the library allows it. Ties break by id.

Reasons are plain text built from what matched: "because you said vertical and punchy", "because it suits a product demo", or "you used this on <job>". The words quoted are the customer's own when a text word matched.

- [ ] **Step 1: Write the failing tests**, each on the fixture library:
  - `suggest: energy and kind lead`
  - `suggest: at most two per tab and at least three tabs`
  - `suggest: memory ranks first with its job in the reason`
  - `suggest: picked ids are left out`
  - `suggest: a 5,000-character text returns in under 50 ms`
  - `suggest: empty input returns six varied ready entries`
  - `styles.mjs show prints the prompt text and the timing per energy`, run with `spawnSync` against a fixture root passed as `--root`
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3: Implement `suggest.mjs`.** It defines its own small word splitter and stop list, because it imports nothing.
- [ ] **Step 4: Implement `styles.mjs`.** Usage:
  - `list [--tab] [--family] [--energy] [--kind] [--ready]` prints one line per entry: id, name, the line, and "ready now" or "made on request".
  - `find <words>` prints the top 10 by the same word scoring.
  - `show <id>` prints the name, the line, `promptText`, and "made on request: closest ready style <name>" when it applies.
  - `suggest "<words>" [--energy] [--kind] [--size]`
  - `--root` defaults to the studio.
- [ ] **Step 5:** Run the tests. Expected: PASS.
- [ ] **Step 6: Commit** with `feat(styles): suggestions and the chat command`.

---

### Task 3: Brief logic: picks, settles, energy and length, director's brief

**Files:**
- Modify: `tools/plan/lib/brief.mjs`, `tools/plan/lib/brief-store.mjs` (`studioContext` adds `styles`), `tools/plan/brief.mjs` (CLI: `pick`, `direct`)
- Create: `library/styles/director.md`
- Test: `tools/plan/tests/picks.test.mjs`, plus additions to `tools/plan/tests/answers.test.mjs`

**Interfaces:**
- Consumes: the entry shape and `byId` (Task 1). `brief.mjs` receives library entries through `ctx.styles` (a `Map`) and imports nothing.
- Produces, in `brief.mjs`:
  - `ENERGIES = ['calm','confident','hype']`
  - `DIRECTOR_PARTS = ['logline','first_three_seconds','beats','camera','motion','type','sound','ending']`, with labels in `LABELS`: "Logline", "First three seconds", "Timed beats", "Camera", "Motion", "Type", "Sound", "Ending"
  - `CHECKLIST_LABELS`: the eight checklist labels exactly as the page shows them: Brand, Product, Audience, Message angle, Style and look, Hook, Video type and references, Size, length and voice. Use it for `preflight` item labels if they differ today.
  - `setPick(brief, entry, on, styles) -> brief`. It throws a plain Error with the reason: "You already picked <name> from <family>: one per family", "Three Motion picks already: remove one first", "<name> does not go with <other>", "<name> is for hype films and your picks are calm". Removing always works.
  - `picksOf(brief, styles) -> [{ tab, id, name, stale }]`
  - `understood(text) -> { size?, kind?, voice?, length?, energy?, audience? }`. It reuses the size, kind and voice reading in `assumptions`, and adds:
    - `length` from `\b(\d{1,3})\s?(s|sec|secs|seconds)\b`, kept only within 5 to 180;
    - `energy`: calm from `calm|gentle|soft|quiet`, hype from `punchy|hype|energetic|fast|bold`, confident from `confident|clear|steady`;
    - `audience` from `for ([a-z][a-z -]{2,40}?)(?=[,.]|$| who| that| to)`.
  - `checkDirectorBrief(parts, { energy, names }) -> { ok, reason, part }`. All eight parts are required. Each is a string of 1 to 600 characters, except `beats`, which is a list of `{ at_s, what }`. No word in `names` (the engine names) may appear. Beat spacing must agree with the energy: the smallest gap at least 0.3 s for hype, 0.8 s for confident and 1.2 s for calm.
  - `assumptions(brief, ctx)` adds:
    - `length_cap_seconds` from `understood().length`, when it is empty;
    - `energy` from `understood().energy`, when it is empty;
    - one assumption per pick `settles` entry whose field is empty and not already assumed from the words, with `because: 'picked <name>'`. Precedence is typed, then saved style, then pick.
  - `SETTABLE` gains `energy`.
  - `summary()` adds "Picked: <tab label> <name>; …" and "Director's brief: <logline>".
  - `plan()` adds the line "Picked styles, as strong preferences: …". It also returns `engine: { ui: [], motion: [], sound: [], skills: [] }`:
    - `ui`: registry components named by the picks;
    - `motion`: moves named by the picks;
    - `sound`: sound files named by the picks;
    - `skills`: the stage skills already listed in `uses`.
    Stale picks are left out of all of these.
- Produces, in `brief-store.mjs`: `studioContext(root)` adds `styles: loadLibrary(root).byId`, and `styleNotes`.
- The CLI adds `node tools/plan/brief.mjs pick <job> <tab> <id> [--off]` and `node tools/plan/brief.mjs direct <job> <parts.json>`. Both print the plain reason on refusal and exit 1.

`library/styles/director.md` is the instruction the page and the chat send to Claude. It asks for the eight parts in that exact JSON shape, in plain words, timed to the chosen energy's targets (and to the track's beats when a sound pick has a `bpm`), using only the customer's words and the picks' prompts. It also asks for `engine: string[]` beside the parts, listing names chosen from the picks' `engine` lists only. Write it fresh.

- [ ] **Step 1: Write the failing tests** in `picks.test.mjs`, on fixture entries:
  - `setPick: second pick in one family refused with its reason`
  - `setPick: fourth pick in a tab refused`
  - `setPick: avoid_with refused in both directions`
  - `setPick: no shared energy refused`
  - `setPick: removing always works`
  - `picksOf: an id no longer in the library is stale`
  - `assumptions: a pick that settles look is assumed with "picked <name>"`
  - `assumptions: a typed look wins over a pick`
  - `understood: "a punchy 20 s vertical demo for agency owners"` gives size `9:16`, kind `product-demo`, length 20, energy hype, audience "agency owners"
  - `understood: "the demo brand"` is not read as a demo
  - `checkDirectorBrief: names the missing part`
  - `checkDirectorBrief: refuses an engine name in the text`
  - `checkDirectorBrief: refuses beats too tight for calm`
  - `plan: lists picks and returns engine groups without stale picks`
  - `summary: shows picks and the logline`
  - `CLI pick: a clash exits 1 with the reason` (`spawnSync`, scratch studio from `helpers.mjs`)
- [ ] **Step 2:** Run `node --test tools/plan/tests/*.test.mjs`. Expected: the new tests FAIL and the old ones pass.
- [ ] **Step 3:** Implement in `brief.mjs`, keeping it free of imports. Add `style_picks: []` and `director_brief: null` to `templates/brief.json` if a template lists the fields.
- [ ] **Step 4:** Implement the `brief-store.mjs` and CLI changes, and write `director.md`.
- [ ] **Step 5:** Run the full plan suite. Expected: PASS. Every existing test still passes.
- [ ] **Step 6: Commit** with `feat(brief): style picks, what they settle, the director's brief`.

---

### Task 4: Connector: three new tools

**Files:**
- Modify: `tools/connector/lib/tools.mjs`, `tools/connector/lib/memory.mjs` (allow `library/styles/*.json` and `library/styles/director.md` for reading), `studio/brief-desk/capabilities.json`
- Test: `tools/connector/tests/tools.test.mjs`

**Interfaces:**
- Consumes: `setPick`, `picksOf`, `checkDirectorBrief`, `understood` (Task 3); `suggest` (Task 2); `loadLibrary`, `engineNames` (Task 1).
- Produces three tools:
  - `brief_pick { job, tab, id, on }`, read-write. The reply is `checkReply` plus `{ picked: boolean, reason }`. A confirmed brief is refused with `CONFIRMED`.
  - `brief_direct { job, parts, engine? }`, read-write. It validates with `checkDirectorBrief` (names come from `engineNames`) and drops `engine` names that are not in the picks' `engine` lists. It stores `{ parts, engine, energy, at }` as `director_brief`, and `parts: {}` clears it. It writes a decision line "director's brief kept" or "director's brief cleared".
  - `styles_suggest { job?, text, understood? }`, read-only (`ro` annotations). It returns `{ suggestions: suggest(...), notes }`. `memory` comes from `style_picks` in other jobs' `brief.json` and from saved styles. It reads through `safePath` only.
- `checkReply` adds `picks: picksOf(...)`, `director_brief` (parts only, logline cut to 120 characters), `understood` and `library_notes`.
- `capabilities.json` lists ten tools.

- [ ] **Step 1: Write the failing tests:**
  - `brief_pick records and removes a pick`
  - `brief_pick refuses a clash with the plain reason and records nothing`
  - `brief_pick refuses an unknown id: "That style is no longer in the library"`
  - `brief_pick refuses on a confirmed brief`
  - `brief_direct stores valid parts and refuses an engine name with the part named`
  - `brief_direct with empty parts clears`
  - `styles_suggest is read-only and ranks a past job's pick first`
  - `styles_suggest with a broken tab file returns the other tabs and a note`
  - `styles_suggest refuses a job name that leaves jobs/`
  - `tool list has ten tools; styles_suggest readOnlyHint true`
  - `capabilities.json lists exactly the server's tools`
- [ ] **Step 2:** Run `node --test tools/connector/tests/*.test.mjs`. Expected: FAIL.
- [ ] **Step 3:** Implement the tools.
- [ ] **Step 4:** Run the connector, plan and setup suites (the sandbox is off for port tests). Expected: PASS.
- [ ] **Step 5: Commit** with `feat(connector): pick styles, keep the director's brief, suggest styles`.

---

### Task 5: Preview renderer and sound sprite

**Files:**
- Create: `engine/src/library/styles/StylePreview.tsx`, `engine/src/library/styles/entry.tsx` (registers only the `style-preview` composition, like `engine/src/library/motion/entry.tsx`), `tools/styles/render-previews.mjs`, `tools/styles/lib/sprite.mjs`
- Test: `tools/styles/tests/render.test.mjs` (plan and sprite logic only; real rendering is checked by hand in Step 5)

**Interfaces:**
- Consumes: entries (Task 1); `library/motion/index.json` (each move's `component` and `props`); the `demo` brand.
- Produces:
  - **The `style-preview` composition:** 30 fps, 90 frames. The size comes from the entry's first size (9:16 renders 270×480, 16:9 renders 480×270, 1:1 renders 480×480, 4:5 renders 384×480). Props are `{ entry }`.
  - **What it plays:** it composes the entry's `engine` moves in order on the entry's background (or the demo brand's default), timed from `timing.confident`, or the entry's only energy. Text in the clip is the demo brand's short sample line.
  - **`render-previews.mjs [--tab] [--only <id>] [--force] [--dry-run] [--sprite] [--root <dir>]`:**
    - renders each ready entry that has no clip to `library/styles/previews/<id>.mp4`;
    - compresses with ffmpeg (H.264, no audio, CRF raised until ≤200 KB);
    - prints a final line with counts and the total size;
    - `--dry-run` prints the plan only.
    - `--sprite` builds only the sound sprite (below).
    - `--root` points at another studio folder, for tests and the smoke run.
  - **`buildSprite(entries, root) -> { file, map }`:** takes up to 4 s from each sound entry's `preview.sound` at `from_s` into `library/styles/previews/sound-sprite.mp3`, with `sound-sprite.json` as `{ [id]: [start_s, length_s] }`.

- [ ] **Step 1: Write the failing tests:**
  - `render plan: skips entries that have a clip, made-on-request entries and sound entries`
  - `render plan: --force includes all ready ones`
  - `sprite map: offsets are contiguous and lengths at most 4`, with ffmpeg stubbed through an injected runner
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement the composition and scripts. A move whose component cannot render alone is skipped with a printed note, and the entry is then reported as needing attention, not given a broken clip.
- [ ] **Step 4:** Run the tests. Expected: PASS. Run `cd engine && npx tsc --noEmit`. Expected: no new errors.
- [ ] **Step 5: Smoke test.** Write two fixture entries to a scratch library root and run `node tools/styles/render-previews.mjs --root <scratch> --only <id>`. Expected: an mp4 of at most 3 s, at most 200 KB, 480 px on the long side. Look at a frame with `ffmpeg -ss 1.5 -frames:v 1`.
- [ ] **Step 6: Commit** with `feat(styles): preview clips and the sound sprite`.

---

### Tasks 6–10: The entries, one tab per task

Each task writes one file. It runs the check for its tab and commits, before the next tab starts. The writer reads, in this order:
- the spec, sections 1 to 3, 9 and 10;
- `library/recipes/index.json` (the starter prompts and energy timings set the standard);
- `knowledge/craft/` (the motion, transitions, direction and sound notes, plus `13-design-styles.md`);
- the motion index and the registry, for the real `engine` names;
- the corpus at the path in Global Constraints, read only for lessons, never for wording.

| Task | File | Families (filter groups) | Main sources |
|---|---|---|---|
| 6 | `library/styles/filming.json` | Shot size and framing; Camera move; Depth and focus; Point of view; Staging and blocking; Lens feel; One continuous camera | camera, capture-camera, capture-staging moves; recipes' structures |
| 7 | `library/styles/motion.json` | Easing and overshoot; Rhythm and pace; Transitions; Emphasis; Openers; Holds and stillness; Energy curves | transition, capture-transition, emphasis, opener moves; recipe energy targets |
| 8 | `library/styles/animation.json` | Kinetic type; Flat shapes and graphics; Illustration; 3D panels and depth; Characters; Mixed media; Backgrounds and texture | type, shader, particle moves; the six looks; backgrounds; illustrated-short recipe |
| 9 | `library/styles/product-ui.json` | Cursor walk-through; Dashboard and data build; Click and hover beats; Layout changes; Screen staging; Mobile app; Before and after | registry components; ui, data, capture-product, capture-pointer, capture-relayout, capture-staging moves |
| 10 | `library/styles/sound.json` | Music mood and tempo; Sound effect kits; Mix shape; Sound transitions; Signature stings; Voice style (made on request, words only) | `library/sounds/` kinds, music tracks with `.beats.json` tempo, `kit.json` slots |

Rules for every tab:
- At least 100 entries.
- Every entry leads to a visibly or audibly different film.
- Variants with clearly different timing, framing or pacing count, each with its own clip.
- Made-on-request entries only where new work is genuinely needed, each with `nearest`. Sound music moods with no track use a written description and no `preview.sound`.
- `settles` only where the pick clearly decides a checklist field.
- Sound entries' `timing` uses `bpm` from the track's `.beats.json`.

- [ ] **Step 1:** Write the tab's file.
- [ ] **Step 2:** Run `node tools/styles/check.mjs --tab <id> --skip-clips --corpus /Users/wedevs/Desktop/Marketer/projects/tulvo/video-studio-motion-06/.damex/motion-study/corpus.json`. Expected: pass, with at least 100 entries.
- [ ] **Step 3:** Run `node tools/styles/styles.mjs list --tab <id> --ready`, and read ten entries at random with `show`. Each must read like a senior motion director's brief: one job per beat, timing in numbers, easing and overshoot stated, still time bounded, what to avoid.
- [ ] **Step 4: Commit** with `feat(styles): <tab> styles (<n> entries)`.

---

### Task 11: Render every preview

**Files:**
- Create: `library/styles/previews/*.mp4`, `library/styles/previews/sound-sprite.mp3`, `library/styles/previews/sound-sprite.json`

- [ ] **Step 1:** Run `node tools/styles/render-previews.mjs` in the background, sandbox off, and wait for it to finish. Then build the sound sprite with `node tools/styles/render-previews.mjs --sprite`.
- [ ] **Step 2:** For any entry the renderer reported as needing attention: fix its `engine` list in the tab file, or mark it made on request with a `nearest`, then render it again.
- [ ] **Step 3:** Run `node tools/styles/check.mjs --corpus <path>`. Expected: all checks pass, with clips on. The total clip size printed must be under 40 MB, at most 500 files.
- [ ] **Step 4:** Look at 15 clips at random, three per tab, and check each shows its style's difference from its neighbours in the same family.
- [ ] **Step 5: Commit** with `feat(styles): preview clips and sound sprite`.

---

### Task 12: The publish set builder

**Files:**
- Create: `tools/styles/build-page.mjs`
- Modify: `.gitignore` (add `studio/brief-desk/dist/`)
- Test: `tools/styles/tests/build-page.test.mjs`

**Interfaces:**
- Consumes: `loadLibrary`, `checkLibrary` (Task 1); `studio/brief-desk/index.html`; `tools/plan/lib/brief.mjs`; `tools/styles/lib/suggest.mjs`; `library/styles/director.md`; previews.
- Produces `buildPage(root, { out = 'studio/brief-desk/dist' }) -> { out, files: string[], batches: string[][], bytes, version }`, plus a CLI that writes `dist/` and `dist/publish.json`. The output contains:
  - `index.html`, copied as it is;
  - `lib/brief.mjs` and `lib/suggest.mjs`, copied byte for byte;
  - `styles/<tab>.json`, the page fields only: everything except `engine` is kept, and `engine` is renamed `engine_names`, shown only in the fold;
  - `styles/meta.json`, with `{ counts per tab and family, sketches, notes, built_at }`;
  - `styles/director.md`;
  - `previews/*.mp4`, `previews/sound-sprite.mp3` and `previews/sound-sprite.json`.
- `publish.json` is `{ version, batches: [[paths…], …] }`. The first batch holds `index.html` and every file except clips, and each batch has at most 250 files. The builder refuses (plain message, exit 1) when the library check fails with clips on, when there are more than 500 clips, or when the total is over 40 MB.

- [ ] **Step 1: Write the failing tests:**
  - `build: copies the modules byte for byte`
  - `build: page data keeps every page field and carries engine names only as engine_names`
  - `build: batches are at most 250 files with index.html in the first`
  - `build: 501 clips refused with a plain message`, using a fixture with stub files
  - `build: version comes from the page's brief-page-version tag`
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement the builder.
- [ ] **Step 4:** Run the tests. Expected: PASS. Then run `node tools/styles/build-page.mjs` on the real studio, and check the printed file count and size.
- [ ] **Step 5: Commit** with `feat(styles): build the brief page's publish set`.

---

### Task 13: The page, part 1: director's desk and library

**Files:**
- Modify: `studio/brief-desk/index.html` (rebuilt on the comp's layout; the brief-desk logic is kept and moved into the new layout in Task 14)
- Test: `studio/tests/brief-desk.test.mjs`

**Interfaces:**
- Consumes: `dist/styles/*.json`, `meta.json`, `previews/*`, `sound-sprite.*` by relative path; `lib/brief.mjs` by `import`; connector tools `brief_pick`; the `db` fallback from the brief desk.
- Produces the page structure Task 14 fills:
  - `#brief` (left pane), `#library` (right pane), `#reel` (bottom tray), `#engine-uses` (plan view block);
  - the state fields `state.lib`, `state.picks`, `state.understood`;
  - `pickToggle(entry)`, which saves through `brief_pick` when connected and otherwise through `db` with the brief.

What it holds (comp and spec section 10.2):
- **Brand bar:** the wordmark, inlined from `docs/design/brief-desk-comp/wordmark-on-dark.svg`, and a ⌘K (Ctrl K on Windows) search across all tabs.
- **Tabs:** Filming, Motion, Animation, Product UI and Sound, with counts from `meta.json`.
- **Filters:** energy, kind, size, family, and ready now or made on request.
- **Cards:**
  - **Previews:**
    - A card has a muted clip that plays on hover or focus, with its poster as the first frame.
    - A sketch card animates from the `sketches.json` ids, with an amber "Made on request" label and the line "We use the closest style we make today, <nearest name>".
    - A sound card plays its sprite slice on click.
  - **Reduced motion:** still frames, and nothing autoplays.
- **Drawer:** "When it fits", "Avoid", a timing table for the supported energies only, the expert prompt with a copy button (`promptText` shape), "Pairs well with" as small cards, and an "Engine details" fold listing `engine_names`.
- **Family as a single choice:** picking a second card in one family swaps the pick, after the connector accepts it.
- **Reel tray:** the picks as filmstrip frames, each removable. A clash refused by the connector shows its reason in amber and leaves the pick unmade.
- **Look and motion:** the tokens and fonts from Global Constraints, card fade on filter change, transform and opacity only.
- Bump `brief-page-version` to `3`.

- [ ] **Step 1: Write the failing page tests** (static checks on the HTML, plus a DOM run under the existing test harness if it has one):
  - `page: five tabs in order`
  - `page: every sketch id in sketches.json has an implementation`
  - `page: no engine name pattern in visible copy outside the engine fold and #engine-uses`
  - `page: prefers-reduced-motion stops previews`
  - `page: version 3`
  - `page: no font-family outside the three tokens`
  - `page: no hex colour outside the token block`
- [ ] **Step 2:** Run `node --test studio/tests/brief-desk.test.mjs`. Expected: the new tests FAIL.
- [ ] **Step 3:** Build the shell and the library.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Browser check.** Run `node tools/styles/build-page.mjs`, then the `brief-desk-preview` launch config pointed at `dist/`. Check at 320, 768 and 1280 px that there is no sideways scroll, that tab, filter, search, drawer, pick and reel all work, and that the console is clean.
- [ ] **Step 6: Commit** with `feat(page): director's desk and the style library`.

---

### Task 14: The page, part 2: brief, director, suggestions, plan

**Files:**
- Modify: `studio/brief-desk/index.html`, `studio/brief-desk/capabilities.json` (if not already ten tools)
- Test: `studio/tests/brief-desk.test.mjs`

**Interfaces:**
- Consumes: `understood`, `checkDirectorBrief`, `DIRECTOR_PARTS`, `CHECKLIST_LABELS` from `lib/brief.mjs`; `suggest` from `lib/suggest.mjs`; tools `brief_start`, `brief_check`, `brief_answer`, `brief_reopen`, `brief_plan`, `brief_confirm`, `brief_direct`, `styles_suggest`, `studio_context`; `sample`; `styles/director.md`.

What it holds (spec sections 10.3 to 10.6):
- **The opening:** the Chakra Petch headline with the one My Soul swash S, "Start with a sentence", and one box.
- **Understood as you type:** "What the studio understood" chips come from `understood(text)` as the customer types (debounced at 250 ms). Each chip can be changed.
- **The checklist strip:** the eight `CHECKLIST_LABELS`, filled from `brief_check` once a brief exists.
- **Questions:** at most three, as in the brief desk today. All the brief desk's behaviour stays: R12 reopen, confirmed brief locked, parked brief, `db` fallback, pick-up in chat.
- **Sharpen with the director**, shown only when `sample` resolves:
  - It sends `director.md`, the words, the understood chips, the picks' `promptText` and `studio_context`.
  - It checks the reply with `checkDirectorBrief`, and shows the eight parts beside the customer's words. Each part can be kept, changed or swapped for another take (a new sample call for that part only).
  - "Keep this brief" saves through `brief_direct`.
  - A malformed reply shows "That take did not come out right. Try again" and keeps the words.
- **Suggested for this brief:** six cards with their reasons. They come from `styles_suggest` when connected, otherwise from `suggest` on the built-in library, and refresh when the chips change.
- **Plan view:** shows `brief_plan`'s lines and the "What the engine will use" block from `engine` (UI library, motion library, sound kit, built-in skills), in the quiet engine-details style.

- [ ] **Step 1: Write the failing tests:**
  - `page: imports understood and suggest from ./lib/ and defines no copy of them`
  - `page: the checklist strip uses CHECKLIST_LABELS`
  - `page: sharpen is hidden without sample`
  - `page: director reply is checked with checkDirectorBrief before showing`
  - `page: every brief-desk test from before still passes`
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Build the flow.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Browser check.** Use the preview with `--scratch` and a stubbed `sample`, then walk through: type a sentence, watch the chips, sharpen, keep a part, swap a part, keep the brief, follow a suggestion, pick, see a clash, answer the questions, plan, see "What the engine will use", confirm. Check at 320 and 1280 px. The console stays clean.
- [ ] **Step 6: Commit** with `feat(page): brief, director's brief, suggestions and the engine block`.

---

### Task 15: Publishing, Stage 1 and the release

**Files:**
- Modify:
  - `.claude/skills/video-studio/SKILL.md`: the publish and update rules
  - `.claude/skills/video-studio/stages/01-intake-and-idea.md`: read picks and the director's brief
  - `release/overrides/CLAUDE.md`, `README.md`, `ONBOARDING.md`: one line each on the style library
  - `release/manifest.json`, only if the export needs it
- Test: `tools/release/tests/overrides.test.mjs`, plus the export check

What changes:
- **Publishing:** build first with `node tools/styles/build-page.mjs`. Publish `dist/index.html` with `root: studio/brief-desk/dist` and `files` from `publish.json` batch 1, and capabilities from `capabilities.json`. Then publish each further batch to the same `url`.
  - **Updating** (the version differs): read the published page, then publish all batches again to the same `url`.
  - **Pick-up rules:** the page's `db`-saved picks and director's brief are applied in chat with `brief.mjs pick` and `brief.mjs direct`, and every refusal is reported in plain words.
- **Stage 1** reads `style_picks` and `director_brief`:
  - at least one of the three concepts uses each pick as picked, with its `promptText` in that concept's direction;
  - a made-on-request pick uses its `nearest`, said in one line;
  - where the studio recommends something else, it says why in one line;
  - the director's brief is the customer's direction, under the same strong-preference rule.
- **Release:** the export includes `library/styles/` with its previews, and excludes `studio/brief-desk/dist/`. The scan must pass.

- [ ] **Step 1: Write the failing tests:**
  - `overrides: CLAUDE.md mentions the style library in plain words`
  - `export: library/styles/previews ships and dist does not`, using the existing export test pattern with a scratch out folder
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Make the edits.
- [ ] **Step 4:** Run `node tools/release/export.mjs --out <scratchpad>/rc2`, then the connector probe on the export. Expected: the scan is clean and the probe lists ten tools. Run every test suite. Expected: PASS (sandbox off for port tests).
- [ ] **Step 5: Commit** with `feat(studio): publish the style library with the brief page; Stage 1 honours picks`.

---

### Task 16: Whole-branch check

- [ ] **Step 1:** Run every suite (plan, connector, setup, styles, studio, release) and `node tools/styles/check.mjs --corpus <path>`. Expected: all pass.
- [ ] **Step 2: Walk through a fresh install.** On the export at `<scratchpad>/rc2`, run start, then doctor, then `build-page`. Open `dist/` in the preview: browse all five tabs, run a full brief with picks and a director's brief to confirm, and check Stage 1's three concepts in chat honour the picks.
- [ ] **Step 3:** Record the results in the spec under a "Build check" heading: what was checked, what was not (the owner's connector test on Windows, and a real claude.ai publish of 400+ files).
- [ ] **Step 4: Commit** with `docs: style library build check`.
