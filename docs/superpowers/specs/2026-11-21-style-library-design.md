# Style library: pick the look of the film by eye

Date: 21 Nov 2026. Status: approved by the owner on 21 Nov 2026 (design, then the comp in section 10). Builds on the brief desk (`2026-11-21-brief-desk-design.md`), on the same branch.

## Why

A customer writing a brief today describes the film in words, and the studio guesses the rest. The engine can do far more than most customers know to ask for. The style library shows that range inside the brief page: five tabs of styles, each with a moving preview and an expert prompt, so a customer can point at what they want. Their picks become exact direction for the engine, so the film comes out closer to what they pictured, faster.

The prompts carry the studio's craft: precise timing, easing, hold lengths and pacing for calm, confident and hype films, the way a motion designer with twenty years behind them would brief it. They are adapted from what the studio learned in its motion study of 292 Claude motion films, and written fresh.

## Goals

1. The brief page has a style library with five tabs: filming style, motion style, animation, product UI and sound presets (section 10.1). Each tab holds at least 100 entries.
2. Each tab has filters (energy, kind of film, size, family, and "ready now" or "made on request") and a search box, so a customer finds a style in a few clicks.
3. Every card shows what the style looks or sounds like: a real clip rendered by the engine when the engine already makes it, a sketch drawn live in the page when it is made on request, and a short sound for sound presets.
4. Every entry carries an expert prompt: what the style is, when it fits, exact timing for each energy, and what to avoid.
5. A customer can pick styles while writing a brief. Picks are saved in the brief through the one brief logic, and they act as a strong preference: at least one of the three concepts uses each pick as picked, and if the studio thinks another choice fits better it says why in one line.
6. The chat can list and search the same library, so a customer working in chat gets the same choices.

## Non-goals

- New engine abilities. The library shows what the engine does today and labels the rest "made on request".
- Customers editing or adding library entries.
- Replacing the six looks, the hook families or the recipes. The library sits beside them and points at them.
- Picks for colours, fonts or logo. Those stay fixed by the brand.

## Anti-goals (a failure even if it works)

- A "ready now" label on a style the engine cannot make. Ready now means every move, component and sound the entry names exists in the studio's libraries, and it has a real clip.
- Any prompt text or video taken from the motion study's films. The prompts and videos belong to their creators. Every prompt is written fresh, every clip is rendered by the engine, every sketch is drawn by the page.
- The page asking a customer to pick. Picking is optional; with no picks the studio decides as it does now. The intake rule "never ask about music, transitions, colours, fonts, logo or captions" still holds for questions.
- Filler: entries that differ only in name. Each entry must lead to a visibly or audibly different film.
- A second copy of the library: the page and the chat read the same files.
- Styles that break the studio's house rules (`knowledge/craft/13-design-styles.md`: no dots, mesh blobs, glitch or RGB split in pictures).

## Constraints

- The page is a claude.ai artifact; it cannot read the customer's files on its own. Whatever it shows must be built into the page when it is published, or reach it through the connector.
- Artifact size: the page up to 16 MB; uploaded assets up to 20 MiB each through the page's `assets` store; one publish up to 64 MB and 255 files, a version up to 256 MB.
- The release is built from a commit by `tools/release/export.mjs` and passes the banned-word scan. The motion previews in `library/motion/*.mp4` (244 clips, 73 MB) are excluded from the release today to keep it small.
- What the studio has to build on: 254 engine moves in `library/motion/index.json` (43 type, 41 transition, 3 camera, 11 capture camera, 20 capture staging, and others), 155 hooks, 32 recipes with expert starter prompts and energy timings, 6 looks, 12 backgrounds, about 280 sound effects in 13 kinds plus 6 music tracks in `library/sounds/`, and voices per brand.
- The motion study corpus (`.damex/motion-study/corpus.json`, 292 records) lives only on the owner's machine and never ships.
- Studio writing rules apply on the page: plain words, sentence case, no dots as separators, no coding-style typeface.

## Approaches considered

1. **One library in the studio, built into the page when it is published (chosen).** Library files in the studio, one per tab; the page gets them built in at publish time; picks go through the connector; real clips are rendered once by Damex, ship with the engine and are uploaded to the page at publish; sketches are drawn by the page. Gains: one source for page and chat, works where the connector cannot be reached. Costs: the download grows by the clips, and the first publish takes longer.
2. **Served live by the connector.** Light page, always current, but the tabs are empty when the connector cannot be reached.
3. **A separate style library page.** Browsable without a brief, but two pages to keep in step and picks cross between them.

The owner chose approach 1 on 21 Nov 2026.

## Decided by the owner

- Previews are a mix: real engine clips for what the engine makes today, page-drawn sketches labelled "made on request" for the rest.
- A pick is a strong preference, not binding.
- A made-on-request pick is honoured with the nearest ready style, said in one line.
- Approach 1.
- At least 100 entries per tab, each with a proper prompt adapted from the motion study's lessons.

## The design

### 1. What each tab holds

| Tab | It answers | Built from |
|---|---|---|
| Filming style | How the virtual camera sees: shot size, camera move, framing, depth, focus, point of view | the camera, capture-camera and capture-staging moves; the craft notes on direction and UI choreography; recipe structures |
| Motion style | How things move and hand over: timing, easing, energy, rhythm, transitions | the transition, emphasis and opener moves; the energy targets from the recipes; the craft notes on motion and transitions |
| Animation | What is animated, in what medium: kinetic type, flat shapes, product UI, data, 3D panels and depth, illustration, characters, mixed | the type, data, ui, shader, particle and capture moves; the six looks; the backgrounds; recipes such as illustrated-short |
| Sound presets | What it sounds like: music mood and tempo, sound effect kits, voice style, mix shape | `library/sounds/` kinds and files, the music tracks, brand voices, the sound craft notes |

Entries that need what the engine cannot make today (for example character animation from drawn or generated footage, or a music mood with no track yet) are "made on request".

### 2. One entry

Each tab is one file, `library/styles/<tab>.json`, a list of entries:

- `id` (unique across tabs), `tab`, `name` (plain, sentence case), `line` (one sentence a marketer understands), `family` (the filter group within the tab)
- `filters`: `energy` (calm, confident, hype; any of them), `kinds` (the brief's kinds it suits), `sizes`, `ready` (true or false)
- `prompt`: the expert direction, written fresh. It says what the style is and when it fits, then an energy line with exact timing for each energy it supports (seconds or frames per beat, easing and overshoot, hold and still time, motion targets in the studio's own units), then what to avoid. It follows the standard of the recipes' starter prompts and the house rules.
- `engine`: the move names, components, background names and sound files it uses, each of which must exist in the studio's libraries when `ready` is true
- `preview`: `{ "clip": "library/styles/previews/<id>.mp4" }` for a ready entry, `{ "sketch": "<sketch id>", "params": {...} }` for a made-on-request one, `{ "sound": "<file>" }` for a sound preset
- `pairs_with` and `avoid_with`: ids that go well or badly together (optional)

### 3. How the prompts are made

- Read the motion study's records and the recipes for what makes a prompt produce good motion: one job per beat, timing stated in numbers, easing and overshoot stated, still time bounded, the first readable frame early, what not to do.
- Write every entry's prompt from scratch in the studio's words. Never copy a phrase of a study record. Nothing from the study's videos is placed anywhere.
- Every prompt names its timings per energy and stays inside the studio's measured targets (typical motion calm 0.5 to 0.9, confident 1.2 to 1.7, hype 4.4 to 6.5; still time 13 to 15% calm, under 10% otherwise).
- A check keeps it honest (section 7).

### 4. Previews

- **Clips:** the engine renders each ready entry once, short (at most 3 s), small (480 px on the long side), looping, silent, about 100 KB each, into `library/styles/previews/`. These ship with the engine; total kept under 40 MB.
- **Sketches:** a small set of animated drawing templates in the page (for example "character bounce", "paper cut-out", "3D card tilt", "hand-drawn line"), each tuned by the entry's `params`, with a clear "made on request" label.
- **Sound:** a short snippet from the entry's own file (at most 4 s); music presets with no track yet are made on request with a written description instead of a sound.

### 5. In the brief

- The brief gains `style_picks`: a list of `{ tab, id }`. `tools/plan/lib/brief.mjs` validates picks against the library and adds them to the summary and the plan ("Picked: motion style Snappy overshoot; animation Kinetic type").
- Picks are never asked as questions and never block the checklist.
- The connector gains `brief_pick { job, tab, id, on }` (an eighth tool), so the page saves and removes picks like any other answer.
- Stage 1 reads the picks: at least one of the three concepts uses each pick as picked, and where the studio recommends something else it says why in one line. The concept's direction includes each pick's prompt.
- The chat gets `node tools/styles/styles.mjs list|find|show` over the same files, and can record picks with the brief tools.

### 6. On the page

- A "Style library" area in the questions view (and reachable from the start screen), with the five tabs, the filters, a search box and a grid of cards (laid out as in section 10.2).
- Each card: the preview, the name, the one line, the labels (energy, ready now or made on request), a pick toggle, and an "expert direction" fold that shows the prompt.
- Picked styles show as chips above the questions, each removable.
- The library is built into the page at publish. `tools/styles/build-page.mjs` writes the published set: the page, the library data, the shared modules (the brief logic's reading of words and the suggestion scoring) and the clips. They are published with the page as its own supporting files, in batches of at most 250 per publish, and the page loads them by relative path. Supporting files keep one link, need no runtime capability, and allow up to 511 files per version, so the clips stay under 500 files. (Builder's call, replacing the earlier asset-upload idea.)
- Without the connector, the tabs still browse; picks are saved with the brief text in the page's data and picked up by the next chat, as the brief desk does for briefs.

### 7. Checks

`node tools/styles/check.mjs` fails when:
- a tab has fewer than 100 entries, or ids repeat;
- a ready entry names a move, component, background or sound file that does not exist, or has no clip;
- a prompt has no energy line, or states timing outside the studio's targets;
- an entry breaks a house rule (dots, mesh blobs, glitch or RGB split in pictures);
- a banned word from `release/manifest.json` appears;
- on the owner's machine, where `.damex/motion-study/corpus.json` exists, a prompt shares a run of eight or more words with any study record.

### 8. Release

The library files, the previews and the sketch templates ship; the motion study never does. `release/manifest.json` keeps excluding `library/motion/*.mp4` and includes `library/styles/`. The export's scan must pass.

### 9. Settled after the builder check

- **A pick can settle a brief question.** Entries that map to a checklist field say so (`settles`, for example `{ "look": "paper" }`, `{ "voice": "none" }`, `{ "kind": "launch-reel" }`). `brief.mjs` treats a pick's `settles` like an assumption: shown back under "What the studio understood", so the question is not asked, and it can be changed. Order of precedence: the customer's own typed answer, then a saved style, then a pick.
- **How many picks.** At most one pick per family within a tab, and at most three per tab. `brief_pick` refuses a pick that is in another pick's `avoid_with`, or whose energies share none with the picks already made, and says why in plain words. On the page a family behaves like a single choice.
- **Voice styles** are described in words and marked made on request: voices belong to each customer's own account, so the library ships no voice samples.
- **Preview clips** are rendered with the `demo` brand, the only brand that ships.
- **A made-on-request pick (decided by the owner, 21 Nov 2026):** the concept uses the nearest ready style and says in one line what it swapped and why. Every made-on-request entry names its `nearest` ready entry, and the check fails when one is missing. The card says so too: "made on request: we use the closest style we make today, <name>".
- **Reaching 100 per tab (my call, the owner can overrule):** an entry that uses the same moves with clearly different timing, framing or pacing counts as its own style, as long as its clip shows the difference. So most entries are ready now. Made-on-request entries are kept to what genuinely needs new work.

### 10. Added from the approved comp (21 Nov 2026)

The owner asked for a designer-led page and approved the clickable comp in `docs/design/brief-desk-comp/` ("Looks right", 21 Nov 2026). The comp and its `DIRECTION.md` are the visual reference for the build. Their answers:
- **Audience:** general marketers, not motion designers. They want a very good film without spending much time.
- **Use case:** describe the video. The page points at styles they may like, and they confirm the brief.
- **What to put forward:** the engine's UI library, motion library, sound designs and built-in skills.
- **Tone:** technical with a cinematic edge, and highly intelligent: it understands the request and suggests styles beside it. Motion must be highly polished. Prompt optimisation is built in: rough words become a studio director's brief focused on detail.

This section adds to sections 1 to 9 and wins where they differ.

**10.1 Five tabs, not four.** A fifth tab, **Product UI**, covers how the customer's product is shown on screen: cursor walk-throughs, dashboard builds, click and hover beats, layout changes, device-free screens, data reveals. Its sources are the 247 components in `library/registry.json` and the ui, data, capture-product, capture-pointer, capture-relayout, capture-staging and capture-transition moves. Product UI entries move out of Animation, which keeps kinetic type, flat shapes, illustration, 3D panels, characters and mixed media. Each of the five tabs still needs at least 100 entries. Tab order: Filming, Motion, Animation, Product UI, Sound.

**10.2 The page layout.**
- **Layout:** a two-pane director's desk, not a landing page.
  - **Top:** a brand bar with the wordmark and a ⌘K search over the library.
  - **Left pane:** write and direct.
  - **Right pane:** the library, with moving previews as the content.
  - **Bottom:** a "Your reel" tray where picks gather like a filmstrip.
- **Brand:** the Damex Video Engine tokens from `DIRECTION.md`.
  - **Colours:** page `#010B24`, ink white, second ink white 62%, accent lime `#BBFC9E`.
  - **Amber `#FFA724`:** only for clashes and "made on request".
  - **Blues:** night deep `#061A4D` and night mid `#0A2A7A` add depth; azure `#2E6BFF` is used sparingly.
- **Type:**
  - Chakra Petch in capitals, for big headlines only.
  - Onest in sentence case, for everything people read or click.
  - One My Soul swash S, in the opening headline.
- **Motion:**
  - Previews play on hover or focus and show a still frame under reduced motion.
  - Cards fade when filters change.
  - One short reveal when the director's brief arrives.
  - Only transform and opacity animate, with named easings.
- **Widths:** the page works from 320 px to 1280 px and beyond, with no sideways scroll.

**10.3 Understood as you type.** The left pane opens with "Start with a sentence" and one box. As the customer types, "What the studio understood" fills with chips (size, kind, length, energy, audience), using the brief logic's existing reading of a brief. Each chip can be changed. The checklist strip under it uses the engine's real eight items, in this order: Brand, Product, Audience, Message angle, Style and look, Hook, Video type and references, and Size, length and voice.

**10.4 Sharpen with the director (built-in prompt optimisation).** One button turns the customer's rough words into a director's brief. The customer's own words stay visible beside it.
- **The eight parts:** logline, the first three seconds, timed beats, camera, motion, type, sound and ending. Each part can be kept, changed or swapped for another take.
- **Plain words only.** It never shows engine move or component names (no "opener-strike-out"). Those appear only in "What the engine will use" (10.6).
- **Timing is real.** Beat timings follow the chosen energy's targets (section 3). When a sound preset or music track is picked or suggested, beats are timed to that track's real tempo from `library/sounds/`.
- **How it is made:**
  - The page asks Claude through the artifact's `sample` capability, which is already declared.
  - The page sends the customer's words, the understood chips, the picks with their expert prompts, and the studio context from the connector.
  - Answers come back as the eight parts in a fixed shape, which the page checks before showing.
  - A shared instruction file, `library/styles/director.md`, holds the prompt, and the chat uses the same file. That way the page and chat sharpen the same way.
- **How it is saved:**
  - The parts the customer keeps are saved in the brief as `director_brief`, through a new connector tool `brief_direct { job, parts }` (parts: the eight named parts, each a string; an empty object clears it).
  - `brief.mjs` validates the field: eight named parts, plain words, no engine names, timings inside the energy targets.
  - It never counts toward the checklist and never blocks it.
  - Stage 1 reads it as the customer's direction, with the same strong-preference rule as picks.
- **Without `sample`** (not granted, or unavailable): the button is hidden and the page works as before. The chat can still sharpen.

**10.5 Suggested for this brief.** Above the library grid, a strip of six suggested styles, each with a one-line reason in plain words ("because you said vertical and punchy").
- **One scoring source.** Suggestions are scored by one module, `tools/styles/lib/suggest.mjs`, from the understood chips, the brief's words and each entry's filters.
- **On the page:** the module is built into the page at publish, so suggestions work without the connector.
- **Through the connector:** a read-only tool, `styles_suggest { job?, text, understood }`, runs the same module plus the studio's memory: the customer's saved styles and picks from past jobs, which rank higher, with "you used this on <job>" as the reason. Being read-only, it does not prompt the viewer.
- **In chat:** `node tools/styles/styles.mjs suggest` uses the same module.
- **Updates:** suggestions refresh when the chips change, and never pick on the customer's behalf.

**10.6 What the engine will use.** The plan view shows a block naming what is behind the film, grouped as UI library, motion library, sound kit and built-in skills. It is built from the picks' and the director's brief's `engine` names, the recipe and the stage skills. This is the one place engine names appear, in a quiet "engine details" style.

**10.7 Card detail.** Opening a card shows a drawer with:
- when the style fits and when to avoid it;
- a timing table for calm, confident and hype (only the energies the entry supports);
- the expert prompt, with a copy button;
- "pairs well with" as small cards.

A pick that clashes (section 9 rules) shows an amber note in the reel tray saying why, in plain words.

**10.8 Counts.** Every count on the page (styles per tab, filter totals) comes from the built-in library at publish. The comp's numbers are placeholders.

**10.9 Tools after this change.** The connector goes from seven tools to ten: `brief_pick` (section 5), `brief_direct` (10.4) and the read-only `styles_suggest` (10.5). `studio/brief-desk/capabilities.json` lists both, and the page's version tag is bumped.

## My calls (the owner can overrule)

- Product UI takes those entries out of Animation, so the two tabs never overlap.
- Sharpening runs on the page's `sample` capability from one shared instruction file, rather than a connector tool. The connector cannot ask Claude, and the page already has `sample`.
- The director's brief is saved through its own tool, `brief_direct`. `brief_answer` takes question ids from the checklist, and the director's brief is not a question, so a separate tool keeps both contracts plain.
- Suggestions are scored on the page and in the connector by one module. The connector adds memory of past jobs.

- What each tab means (section 1), and reading "sound prefix" as sound presets.
- The entry shape and one file per tab.
- Ready now only with every engine name present and a real clip.
- Clip size and length (480 px, 3 s, about 100 KB, under 40 MB in all).
- `brief_pick` as an eighth connector tool, and `style_picks` in the brief.
- The style library also browsable from the start screen, before a brief exists.
- The eight-word overlap check against the study, run on the owner's machine.
- A chat command over the same library.
- A pick can settle a brief question; typed answer, then saved style, then pick.
- One pick per family, three per tab, clashes refused.
- Voice styles in words only, made on request.
- Variants with clearly different timing, framing or pacing count toward the 100, each with its own clip.

## Left to the builder

- The exact 100+ entries per tab, their families and the sketch templates, within the rules above.
- How clips are rendered in bulk, and the upload batching at publish.
- Card layout and filter controls, within the studio's writing rules and the brief page's look.
- Tests for the check, the brief logic and the connector tool; a browser walk-through of the library on the page.
