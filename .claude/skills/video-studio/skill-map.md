# Skill map: which skill for which task

The studio bundles 76 open-source skills in `.claude/skills/` (Remotion's and Clipwing's are fetched on each Mac by the installer rather than kept in the repository) (sources, versions and licences: `.claude/skills/THIRD-PARTY.md`) and declares five plugins in `.claude/settings.json` (Superpowers, claude-mem, Matt Pocock's skills and Ponytail on; ECC off). Many overlap. This page says, for each task, which skill **leads**, which **supports**, and which **not to use**, so the same task always goes the same way.

Load a skill with the Skill tool at the moment its task starts. Never read them all up front: one or two per task.

## Who wins when skills disagree

1. The owner's words in the conversation.
2. The brand's rules (`brands/<brand>/rules.md`, `brand.json`) and the studio's rules (`knowledge/rules/`): for example no coding-style typeface, no dots as separators, sentence case, wording that sounds like a person, real product screens only, ask before any paid call.
3. The video-studio stage guide for the current stage.
4. The leading skill for the task, below.
5. Supporting skills.

A bundled skill that tells you to skip an approval, change the production line, publish, spend money, or call a paid service on its own is overruled by 1 to 3. Say so in the hand-over when it happens. The same goes for a skill that would send footage or sound to an outside service (earshot's `llm` command uploads audio to Gemini), install a large model (real-sfx's `hear.py install`, about 3 GB with remote code), or drive a paid program (After Effects): ask the owner first.

## The production line

| Task | Leads | Supports | Not for this |
|---|---|---|---|
| Any video request in this folder | `video-studio` | the rows below, by stage | `motionmaxxing` and `video` as a whole pipeline (they would replace the studio's line) |
| Setting up a brand (stage 0) | `video-studio` stage 0 | `style-sampling` for a brand's existing videos | |
| Product discovery (stage 0B) | `video-studio` stage 0B | `advertising-kickoff` when the videos are for paid ads; `grill-me` for the owner round | |
| Stress-testing an idea or a plan with the owner | `grill-me` (Matt Pocock) | `grilling`, `superpowers:brainstorming` | The studio's way still applies: numbered questions, a recommended answer each, "yes" accepts |
| Idea for an ad (stage 1) | `video-studio` stage 1 | `advertising-kickoff` routes to `ad-format-fit`, `ad-platform-selection`, `thought-leadership-ads`, `ad-creative-test-plan` | |
| Script for a creator or UGC-style ad | `ugc-ad-scripts` | `conversational-ad-copy` | |
| The hook: the first three seconds, spoken, written and seen (stages 1, 2 and 5) | `knowledge/craft/15-hooks.md` and `node tools/hooks/hooks.mjs` (find, measure, rubric) over `library/hooks/`; `tools/checks/hook_legible.mjs` on the render | `viral-hooks` (its archetypes and three-layer references) for a second read; `ugc-ad-scripts` and `ad-creative-test-plan` for ad variants; the `viralhooks` connector to study strong openings | `viral-hooks`' retention figures and creator-attributed frameworks (unsourced: `15-hooks.md` leaves them out); a viralhooks.org clip in a paid ad, in the repository, or without the owner's decision (`tools/hooks/clips.mjs`) |
| The film's structure: beats, timing, shot length, text time (stages 2 and 4), and the retention graph (stage 6) | `knowledge/craft/16-structure-and-retention.md`; `node tools/plan/beats.mjs` over `library/structure/frameworks.json`; `node tools/plan/retention.mjs` | the playbook's own shape first; `bang-motion` (`references/anti-ppt.md`) for rhythm | the sources' retention percentages and platform-algorithm claims (unsourced; the guide leaves them out) |
| Any script, caption or on-screen wording (stage 2 and every cut) | `video-studio` stage 2 and `knowledge/craft/04-type-and-captions.md` | `zero-slop` as the last pass on every line a viewer reads or hears | `caveman` (never for anything a person reads) |
| Moodboard and the look (stage 3) | `video-studio` stage 3 | `impeccable` (typeset, colorize, layout), `style-sampling`, `motionmaxxing` studies for the feel of motion | `design-taste-frontend` (it is for web pages) |
| Storyboard and motion notes (stage 4) | `video-studio` stage 4 and `knowledge/craft/14-motion-systems.md` (a shot size, a choreography and a transition for every shot; the restraint budget; the music grid) | `bang-motion` (`references/techniques.md`: shot sizes, the camera going to what is speaking, the transition menu; `references/anti-ppt.md`: rhythm), `motion-design` (timing, choreography), `motionmaxxing` measured curves for a move's feel, `motion-foundations` | `bang-motion`'s house rules (14-motion-systems.md section 8): the brand's typeface, look and references win |
| The motion system of a whole film (shot sizes, choreography, how much moves at once, rhythm, the anti-slide checks) | `knowledge/craft/14-motion-systems.md` | `bang-motion` (its anti-slide tests and rundown), `motion-design` | Its single `index.html` deliverable and its own export scripts: the studio renders through its engines |
| Product capture (stage 4 scripts, stage 5 takes) | `tools/capture/README.md` and `CAPTURE-PLAN.md` | `playwright-cli` only to explore a page by hand | |
| Pointer-led product moments (how the pointer enters, aims, clicks and hands over to the next beat) | the engine's pointer (`CaptureClip`, looks in `CAPTURE-PLAN.md` 7.9) | `oversized-cursor` for the technique only (entry, tip targeting, click ignites the next beat, exit) | its macOS-style arrow artwork: the studio draws its own pointer |
| A weekly "what's new" or changelog video | `video-studio` (the production line and approvals) | `changelog-video` for the shape: one beat per change, mock-free product shots from captures | its sample brand, voice and invented UI: use the brand's own and real captures |
| Writing or changing scene code in the Remotion engine (stage 5) | `remotion-best-practices` (it routes to the other `remotion-*` skills) | `motion-foundations`, `motion-advanced`, `motion-patterns` for springs and complex moves; `bang-motion`'s techniques (shot sizes, camera to the element, type entrances and exits, directional blur) rebuilt with Remotion's `interpolate` and `spring` | `motion-patterns`' React and Framer Motion code and `bang-motion`'s GSAP code: the engine uses Remotion's own timing, never CSS transitions, Framer Motion or GSAP |
| Any HyperFrames clip | `motion-doctrine` first (the gateway: the whole film reads as one continuous camera move), then `hyperframes`, `hyperframes-cli` | `cut-the-curve` (velocity-matched seams), `seam-craft` (seams that composite correctly), `captions-overlay` (captions as an overlay, never a reserved band); `bang-motion`'s GSAP recipes (its camera rig, shot sizes, directional blur, the transition menu), which fit HyperFrames' seekable timeline | `bang-motion`'s `window.OPENER` contract, CDN script tags and its own export: HyperFrames renders the clip |
| An editable After Effects project for a motion designer (HyperFrames clips only) | `hyperframes-to-after-effects` (Clipwing; fetched at setup) | | Using it without the owner's yes (After Effects is paid; upstream has tested it on Windows only, not on a Mac) |
| A move Remotion handles poorly, or an HTML-native effect | `hyperframes`, `hyperframes-cli` | `hyperframes-registry`, `motionmaxxing` (its seek-safe GSAP runtime, for one hero moment), `remotion-to-hyperframes` to move a scene across | |
| Captions | the studio's `tools/film/captions.mjs` (the caption style is fixed per brand) | `remotion-captions` for technical questions | |
| Sound, voice and music | `video-studio` and `knowledge/craft/07-sound.md` (ElevenLabs through the studio's tools; ask before the session's first paid call) | `remotion-multimedia` for technical questions; the rows below for hearing, placing and finding sounds | `motionmaxxing`'s own voice and music steps |
| Hearing anything: a voice take, a mix, a placed sound, a music edit, a footage clip, a finished film (Claude cannot hear) | `earshot` through `tools/audio/listen.mjs` (measure, timeline with cue sync, the annotated sheet, the launch-film critique); any other earshot command through `node tools/audio/earshot.mjs <command>` (never bare `earshot`: the wrapper finds the studio's models and works inside the sandbox) | `earshot`'s loops (choose an asset, review a mix, A/B a change); `real-sfx`'s `levels.py` and `critique.py` for a sound-effects pass; the studio's voice checks | Saying how something sounds without an earshot number; `earshot llm` (uploads audio); its `forge` sounds in place of the brand's sound kit |
| Placing sound effects on picture | the studio's sound tools (`tools/audio/sound.mjs`, `mix.py`) with the event log (captures' clicks, scene starts) and the brand's sound kit | `real-sfx` (`references/typed-cues.md`, `event-map.md`: placing a sound by its attack or arrival, not its file start; `from_hyperframes.py` for HyperFrames clips; `find_moments.py` for footage; mono check; ducking by the voice) | Its uisfx packs in place of the brand's kit; `hear.py install` without the owner's yes |
| Real recorded sounds, or openly licensed photos | `tools/media/openverse.mjs` (Openverse: CC0, public domain or CC BY only; licence and credit kept) | `real-sound` (`references/licences.md`, `references/sound-design.md`; its `qa.py` measures each sound against the music and room, its `credits.py` for the credit list) | NC, ND or SA licences; any file whose licence is not recorded; `real-sound`'s own mixer and master in place of the studio's (`mix.py`, `master.sh`) |
| Rendering | the studio's `node tools/film/render.mjs` (lock, splice, master) | `remotion-render` for technical questions | |
| A jump, judder or slow preview | `fixing-motion-performance` | `remotion-best-practices` | |
| Critique before anything goes to a person | `knowledge/craft/08-directors-checks.md` and the studio's checks | `hallmark` (audit for the generic, machine-made look) and `impeccable` critique; `motionmaxxing`'s review gates for HyperFrames clips; the anti-slide and restraint checks (`14-motion-systems.md` sections 3 and 7); `tools/audio/listen.mjs --critique` for the sound | Self-certifying: list what each found and what was changed |
| Studying a reference video | `video-studio` ("Study this video") with `tools/study/` | `reverse-any-video`, `style-sampling` | Nothing from a reference is placed in a finished video |
| Slides or stills from a video | `slideshow` | `media-use` | |
| A Figma frame brought into a HyperFrames clip | `figma` (HyperFrames' own) | | Work on a Figma file itself: the Figma connector's skills (`figma:figma-use` and the rest) |

## By video type: the sub-guides to read

Each bundled skill holds guides inside it. Read the one for the video in hand, not the whole skill. Paths are inside `.claude/skills/`.

| Video | Read (the studio's playbook first) |
|---|---|
| Promo or launch film | `knowledge/playbooks/promo.md`; `hyperframes/references/types/launch.md`; `motionmaxxing/references/idea.md`, `motionmaxxing/references/world.md`, `motionmaxxing/references/close.md`; `cut-the-curve` for seams |
| Feature demo | `knowledge/playbooks/demo.md`; `motionmaxxing/references/ui-demo.md`; `oversized-cursor` (technique); `CAPTURE-PLAN.md` 7.9 looks |
| Tutorial | `knowledge/playbooks/tutorial.md`; `CAPTURE-PLAN.md` 7.9 (Tutorial look, key caps, step badges); `remotion-markup/text-highlights.md` |
| Explainer | `hyperframes/references/types/explainer.md`; `hyperframes/references/story.md` |
| Charts and numbers | `knowledge/craft/11-data-visualisation.md`; `hyperframes/references/types/data.md`; `remotion-maps` for maps |
| Vertical (9:16) social | `hyperframes/references/types/vertical.md`; `CAPTURE-PLAN.md` 7.7 |
| Music-led or brand sting | `hyperframes/references/types/music.md`; `motionmaxxing/references/sound-sync.md` |
| 3D moments | `hyperframes/references/types/3d.md`; `remotion-markup/3d.md` |
| Edit of raw footage | `knowledge/playbooks/edit.md`; `remotion-markup/video-editing.md`, `remotion-markup/silence-detection.md`, `remotion-markup/cropping.md`, `remotion-markup/color-correction.md`; `media-use` |
| Changelog or "what's new" | `changelog-video` |

## By craft topic: the sub-guides to read

| Topic | Read |
|---|---|
| The idea and the world | `motionmaxxing/references/idea.md`, `motionmaxxing/references/world.md`, `brand.md`; `hyperframes/references/look.md` and its `assets/frame-presets/` |
| Direction and story | `knowledge/craft/01-direction.md`; `hyperframes/references/film.md`, `hyperframes/references/story.md`, `hyperframes/references/storyboard.md` |
| Motion and timing | `knowledge/craft/02-motion.md`; `knowledge/craft/14-motion-systems.md`; `bang-motion/references/techniques.md` (shot sizes, camera to the element); `motion-design`; `motionmaxxing/references/motion.md`; `hyperframes/references/motion.md`; `motion-doctrine` |
| Transitions | `knowledge/craft/03-transitions.md`; `14-motion-systems.md` section 5; `bang-motion/references/techniques.md` (its transition menu); `cut-the-curve`; `seam-craft`; `motionmaxxing/references/transitions.md`; `remotion-markup/transitions.md` |
| Type on screen | `knowledge/craft/04-type-and-captions.md`; `14-motion-systems.md` section 6; `bang-motion/references/anti-ppt.md` (type rhythm); `motionmaxxing/references/type.md`; `remotion-markup/measuring-text.md`, `remotion-markup/text-highlights.md`; `impeccable` (typeset) |
| Captions | the studio's `tools/film/captions.mjs` first; `captions-overlay`; `remotion-captions`; `hyperframes/references/captions.md` |
| Layout and frame quality | `knowledge/craft/12-frame-quality.md`; `motionmaxxing/references/layout.md`; `impeccable` (layout) |
| Light, finish, effects | `knowledge/craft/06-light-and-finish.md`; `remotion-markup/light-leaks.md`, `remotion-markup/motion-blur.md`, `remotion-markup/effects.md`, `remotion-markup/color-correction.md` |
| Sound | `knowledge/craft/07-sound.md`; `earshot` (how to listen with numbers); `real-sound/references/sound-design.md`; `real-sfx/references/event-map.md` and `typed-cues.md` (where a sound goes); `hyperframes/references/sound.md`; `motionmaxxing/references/sound-sync.md`; `remotion-markup/sfx.md`, `remotion-markup/voiceover.md`; `media-use/audio/references/` |
| Sound library | `library/sounds/README.md` (`tools/audio/sounds.mjs`: find, sheet, kit, use, check); `library/sounds/kit.json` (the kit's 30 slots and their library fallbacks); `tools/audio/synth.py` (whooshes, risers, impacts from numbers); `tools/audio/beats.py` (a track's beats, bars and drop); `plinkfx` (sound effects designed as code) |
| Text moves, transitions, hook openers, shader backgrounds | `library/motion/index.json` (families type, emphasis, caption, transition, opener, shader: each with what it does, when to use it, its sound, its sizes and credit; moves marked `house_rule` need the owner's yes for the film); code in `engine/src/kit/{type,transitions,openers,shaders}/`; every move is `move-<name>` in the gallery, in all four sizes (`--props '{"format":"9:16"}'`); `knowledge/craft/03-transitions.md`, `04-type-and-captions.md`, `15-hooks.md`; for HyperFrames clips `title-kinetic-typography` and `gsap-core`, `gsap-timeline`, `gsap-plugins` |
| Storyboard, a second view | `storyboard-architect` (shotkit) and `viral-short-form` beside the studio's beat sheet; the studio's rules win |
| Structure and retention | `knowledge/craft/16-structure-and-retention.md`; `library/structure/README.md` |
| Hooks | `knowledge/craft/15-hooks.md`; `library/hooks/README.md`; `viral-hooks/references/` (three-layer-hook, hook-by-platform, hook-anti-patterns) |
| Judging a cut | `knowledge/craft/08-directors-checks.md`; `14-motion-systems.md` sections 3 and 7 (restraint, anti-slide); `bang-motion/SKILL.md` checklist; `motionmaxxing/references/judgment.md`, `motionmaxxing/references/slop.md`, `motionmaxxing/taste/verdicts.md`; `hyperframes/references/review.md`; `hallmark` |

## Around the videos

| Task | Leads | Supports |
|---|---|---|
| Running the finished video as a paid ad | `advertising-kickoff`, which routes to `ad-audience-targeting`, `ad-bidding-strategy`, `ad-spend-guardrails`, `paid-landing-page-audit` and the rest | `ad-creative-test-plan` for variants of the video |
| A video ad getting tired | `ad-creative-fatigue` | `ad-creative-test-plan` |
| Reading results | `ad-attribution-gap`, `cac-roas-benchmark`, `ad-account-diagnostic` | the brand's ledger (`brands/<brand>/ledger.json`) |
| A web page the studio builds (review page, control room, a landing page for a video) | `design-taste-frontend` | `impeccable` |

## Changing the studio itself

| Task | Leads | Supports | Not for this |
|---|---|---|---|
| Planning a change to a tool, the engine or a skill | `superpowers:brainstorming`, then `superpowers:writing-plans` | `grill-me`, `to-spec` (Matt Pocock) | |
| A bug in a tool or the engine | `superpowers:systematic-debugging` | `diagnosing-bugs` (Matt Pocock) as a second opinion | |
| Saying something is done | `superpowers:verification-before-completion` | | |
| Reviewing a change | `superpowers:requesting-code-review` | `code-review` (Matt Pocock) | |
| Improving a skill, including video-studio | `skill-creator` (Anthropic) | `superpowers:writing-skills` | Editing a bundled skill in place (lost at the next refresh) |
| Remembering across sessions | `claude-mem` (automatic) | | It is a memory aid only: `job.json`, `DESIGN.md`, the ledger and the lessons are the record |
| Saving tokens | the token plan below | `ponytail` (on for everyone), `caveman` for helper agents' notes only | `caveman` in any reply, report or file a person reads |
| ECC (Everything Claude Code) | Off by default in `.claude/settings.json`: 314 skills and 71 agents, mostly for software engineering, and every listed skill costs tokens in every session. Switch it on only for a job that needs it | | Its motion skills duplicate the bundled `motion-foundations`, `motion-advanced`, `motion-patterns`: use the bundled ones |

## The token plan, for every video

Every video is made the same lean way. The aim is the same quality for fewer tokens, measured, not guessed.

1. **One stage per session.** Start each stage fresh from `job.json`; never carry a long conversation into the next stage.
2. **Helpers do the heavy lifting, on the right model.** Use the roles in `.claude/agents/`: `checker` on the cheapest model (it runs checks and reads summaries), `scene-builder`, `capture-runner`, `frame-critic`, `reference-studier` and `researcher` on the middle one. The lead keeps direction, decisions and anything the owner reads. One helper per self-contained piece; give it only the files it needs.
3. **Ponytail is on** for everyone (`/ponytail` to change its level; `full` by default). It keeps code to what the task needs. `/ponytail-gain` shows sessions with their cost.
4. **Load skills narrowly.** Read the one sub-guide a task needs (the tables above), not a whole skill; load a skill when its task starts, not up front.
5. **Measure with tools, read summaries.** The studio's scripts measure; read their one-screen summaries, contact sheets and the frames a check flagged, never whole logs or frame by frame.
6. **Short internal reports.** Helpers report to the lead in the `caveman` style; anything a person reads stays in plain, human sentences.
7. **Half size until the final.** Previews and tests render at half size; full quality only for the master (starting rule 17). Splice one scene instead of re-rendering a film.
8. **Log usage per stage.** At the end of each stage, record the session's cost (from `/cost`, or `/ponytail-gain`) in `job.json` under `usage`, with the stage and helpers used. Stage 6 compares it with the brand's last videos; a stage that costs much more than usual gets a note on why.

## Keeping the skills sharp

After every video (stage 6, "Learn"), and on the first working day of each month:

1. **Log what was used.** Each job's `job.json` keeps `skills_used` (and `usage`, the token plan's step 8): for each skill, the stage, what it was asked for, and whether it helped (`helped`, `no difference`, `got in the way`), with one line on why.
2. **Monthly refresh.** `bash setup/update-skills.sh`, then read `git diff --stat .claude/skills` and the changelogs of skills that changed. Run the health check. Note anything that changed how a stage should work.
3. **Monthly review.** Read the month's `skills_used` lines. A skill that got in the way twice gets a "Not for this" row here. A skill that helped every time gets named in its stage guide. A gap that kept coming up becomes a lesson for `video-studio` (drafted with `skill-creator`, approved by the owner like any lesson).
4. **New skills.** A teammate who finds a promising skill adds it to `setup/update-skills.sh` and to this map in one change, with the task it leads or supports, and tries it on one real stage before it is named in a stage guide.
5. **Commit** each refresh and each map change with a plain summary, so the team can see when a skill changed and roll back if a video got worse.
