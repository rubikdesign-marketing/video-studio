# Library plan: hooks, planning, sound, text and motion

Written 18 Nov 2026. **Approved by the owner 18 Nov 2026, with every recommended answer in section 7 ("Yes to all"). Phase 1 built 18 Nov; phase 2 built 18 Nov.**

The studio can already make a film from an idea, a product capture or raw footage. What it lacks is depth to choose from. This plan adds five libraries and wires each into the stage where it is used, so every film starts from more options and still goes through the same approvals and checks.

## Status

| Phase | State |
|---|---|
| 1. Hook library | **Built 18 Nov 2026.** 155 formulas in 15 families (`library/hooks/`), the craft guide (`knowledge/craft/15-hooks.md`), `tools/hooks/hooks.mjs` (find, measure, rubric), `tools/checks/hook_legible.mjs`, the gate on Viral Hooks clips (`tools/hooks/clips.mjs`, `.mcp.json`), the `viral-hooks` skill bundled, stages 1, 2, 5 and 6 and the promo playbook wired. 28 tests pass, and an independent review of the code found ten defects, all fixed (paid jobs written as "reels_ad" or "paid_social" got past the clip gate; the delivery check did not re-test for paid use; curly apostrophes dodged the avoid list; some avoid patterns flagged innocent words). For a Tulvo promo brief the tool proposed five formulas from five families (63 suited the brief); five hooks written from them were measured, and the measure caught the two that take too long and a greeting opener. On four real Tulvo films the readability check, given each hook's own line, found two real problems under the new rule (a hook line at 6.0% of the short side where 7.8% is needed; two words of a three-word hook at 5.1:1 contrast where 7:1 is needed) and refused two false passes (a calendar's month, a word handwritten on a whiteboard). Found on the way and fixed: a hook that arrives one word at a time was failed as "not the hook" (its words are now added up over time); a one-word address ("Founders,") was counted as the claim. Not checked: the formulas on a real film (every one is marked untested); the readability check on display faces, text over busy footage, and languages other than English; `clips.mjs use` against the live site (its refusals are tested, the download is not) |
| 2. Planning | **Built 18 Nov 2026.** `library/structure/`: the four playbook shapes as frameworks (the default for each film type) and nine borrowed ones (six from shotkit, Apache 2.0; three MIT), credited. `knowledge/craft/16-structure-and-retention.md`: the shapes, shot lengths, text time, the retention arc, reading a retention graph. `tools/plan/beats.mjs`: the timed beat sheet, from the voice's own timings or estimated before it; it names a late hook, beats too long, short, missing, split or out of order, lines over 6 s, a film over its cap, breaks in the energy map (`01-direction.md`'s five rules), and with a shot list, a scene marked with the wrong beat and on-screen text up too briefly to read. The script's lines and the shot list's scenes now carry an optional `beat` (and lines an `energy`); the templates and stages 2, 4 and 6 are wired. `tools/plan/retention.mjs`: reads a YouTube Studio retention export against the beats and lines and names the early drop, cliffs, dips and spikes. On the real Tulvo Black Friday film (measured voice timings, its shot list) the sheet named six things: the offer a second short of its share, one 6.3 s line, three price and date lines on screen too briefly to read (1.3 to 1.6 s where 2.1 s is needed), and an energy map that opens at 3. A 30 s promo written from the hook library came back with its hook 0.1 s late for Reels, the peak long and the close short. Found on the way and fixed: equal shot times flagged text the voice was saying or that was held over several shots (23 findings on the real film, 5 after); a guessed first line could miss the hook; beats from another framework gave a finding per line. An independent review of the code found ten defects, all fixed and tested: the retention reader was blind to cliffs and spikes in a long film's first 30 s, read a percent export as seconds for films of 91 to 111 s, split quoted decimal commas, took a relative-retention column as the curve, and over-reported spikes and dips; the beat sheet judged energy per line instead of per beat, let an absent beat inflate the one before it, missed a peak at the very end, and added silent scenes to the length wherever they sat. 26 tests. Not checked: the retention reader on a real export (none read yet; it takes every plausible layout and refuses the rest with the reason); beat sheets for tutorials and edits on real jobs |
| 3. Sound library | Not started |
| 4. Text moves | Not started |
| 5. Transitions, backgrounds, hook openers | Not started |
| 6. Wiring and proof | Not started |

## 1. Where we are

| Part | Today | The gap |
|---|---|---|
| Hooks | A "hook lab" in the promo playbook (three variants, pick one) and each brand's ledger of past hooks | No library of hook formulas, no first-frame rules, no way to score a hook, no hook visuals |
| Planning | The studio's own stage guides (idea, script, storyboard) | No beat frameworks with timings, no shot-length rules, no retention structure, nothing that reads a platform's retention graph |
| Sound effects | 11 effects per brand, made with ElevenLabs; a search over Openverse; tools that place, mix and master | No general library (whooshes, risers, impacts, swishes, glitches, ambience), no cutting to the beat |
| Music | None bundled | No licensed music to start from |
| Text animation | 7 text moves out of 143 in the motion library | The thinnest part of the library: no mask reveals, no per-letter work, no decode, no kinetic layouts |
| Transitions and backgrounds | 9 scene transitions, 23 backgrounds | Small vocabulary; no shader backgrounds |

## 2. What the research found (18 Nov 2026)

Three researchers opened and checked about 120 sources. Licence files of the sources this plan leans on were then read a second time. The useful ones:

**Hooks and planning** (all MIT unless said)
- `vyralcontent/content-skills`: hook archetypes, the three-layer hook (what is seen, said and written in the first frame), tactics by platform, anti-patterns, and a retention structure (hook, escalation, payoff, call to action).
- `Jakeschincariol/instagram-agent-skill` and `youtube-agent-skill`: 26 short-form and 21 long-form hook formulas as data (template, example, on-screen line, when to use, the trap), a timed beat-sheet script and a reader for YouTube Studio's retention export.
- `Ootto-AI/claude-virality-skill`: what the first three seconds of motion-graphics reels looked like when they won and when they flopped, and an 8-point first-frame checklist.
- `whystrohm/shotkit` (Apache 2.0): five beat frameworks with second-by-second timings for 15 to 90 s, shot-length baselines, the "read twice" rule for on-screen text, a shot-list format.
- `artemnovitckii/content-skills`: four "hook killers" (delay, confusion, irrelevance, disinterest) as a scoring rubric.
- `coreyhaines31/marketingskills`: a hook system for ads (segment to hook), 13 opening moves.
- `win4r/video-director`: a measurable rule for hook text (large enough, 7:1 contrast, readable with sound off by 3 s).
- Cited, not copied: Google's ABCD rules for video ads, YouTube's retention "key moments".

**Sound**
- Public domain (CC0) and allowed in a public repository: Kenney's audio packs (595 sounds), `romainsimon/uisfx` (936 interface sounds), `maximilianfeix/plinkfx` (274 sounds as recipes, with a skill), `sgossner/VCSL` (instrument samples), BigSoundBank (3,500 real recordings), OpenGameArt's CC0 packs, Freesound's CC0 sounds (found through Openverse, as today).
- Whooshes, risers and impacts are thin in every free library. Making them ourselves (filtered noise, pitch sweeps, layered hits) is the reliable route, and what we make is ours to give away.
- Cutting to the beat: `librosa` (ISC licence).
- Music is the weak spot. FreePD has closed. HoliznaCC0 (692 public-domain tracks) is the best living source. Almost every "free" stock site forbids putting its files in a repository.

**Text, transitions, backgrounds**
- `Leonxlnx/cinetic` (MIT): a book of about 190 named text and transition devices with recipes, written for the same two engines the studio uses. The best checklist found.
- `gl-transitions` (MIT): 291 transitions, each a small pure function of progress.
- `paper-design/shaders` (Apache 2.0): 30 shader backgrounds (mesh gradient, grain, god rays, liquid metal, fluted glass), which its readme allows in commercial videos.
- Magic UI, Fancy Components, motion-primitives (all MIT): about 50 text effects between them. They are built for web pages, so each is rebuilt for video, with credit.
- GSAP: free for commercial use since 2025, including its text tools (SplitText, ScrambleText). It is not open source and may not be copied into a repository, only installed. Its eight official skills are MIT.
- Remotion's own packages for transitions, effects and light leaks are not installed in the engine yet.
- `calesthio/generative-media-skills` (MIT): a kinetic typography skill (hierarchy, reveal, hold and exit, safe zones, flash safety).

**Rejected, and why**
- React Bits and Animate UI: their licences forbid sharing ported copies.
- Pixabay, Mixkit, Sonniss, Zapsplat, 99Sounds: free to use in a film, not allowed in a repository. BBC Sound Effects: non-commercial only.
- MusicGen, AudioGen, TangoFlux, madmom: non-commercial weights or models.
- lygia, typed.js, easings.net, aubio, essentia: non-commercial or copyleft licences.
- `av/remotion-bits`: no licence file. Inspiration only until its author adds one.
- Anything with no licence file at all.

### The Viral Hooks connector

It works: free, no key, about 920 clips searchable by scene through the connector (the site claims more), each a direct MP4 of 2.5 to 10 seconds, mostly vertical with sound.

What the clips are: real viral footage of real people, some with another creator's captions burned in, one cartoon character. The site names no owner, source or licence for any clip, has no takedown process, and its terms say only "Use them as the opening of a video you make"; they say nothing about ads or commercial use. Several clips show identifiable people, at least one of them a schoolgirl.

So a brand that puts one in an ad is relying on rights nobody has stated. The risks are a copyright complaint or a platform strike, and a claim from a person shown. The plan therefore treats the connector as a gated source (decision 1).

## 3. Three ways to build this

| Way | What it means | For | Against |
|---|---|---|---|
| A. Bundle everything | Add the 20 or so skills found as they are | Fast | They overlap, each has its own house rules and pipeline, and every listed skill costs tokens in every session |
| **B. Curate into the studio's own libraries (recommended)** | Take the best tables, data and recipes into the studio's libraries and craft guides, with credit; bundle only the few skills that lead a task; build moves in the studio's own engine, in the brand's type and colours | One voice, one production line, checked moves, works for any brand. It is how bang-motion and open-motion were added | More work per phase |
| C. Lean on live services | Use Viral Hooks, Freesound's API and sound generators at the moment of making | Biggest choice | Unclear rights, services that change or close (FreePD did), sends work outside |

## 4. What gets built (way B)

Six phases, each one session's worth, each ending with what was checked, what was not, a commit and a question before any push.

| Phase | What is built | Done when |
|---|---|---|
| **1. Hook library** | `library/hooks/`: about 150 hook formulas merged from the sources above, de-duplicated, each with the spoken line's pattern, the on-screen line, the first-frame picture, what it suits (video type, platform, awareness), the trap, and its source. `knowledge/craft/15-hooks.md`: the three-layer hook, first-frame rules, platform deadlines, anti-patterns. `tools/hooks/hooks.mjs`: find formulas for a brief, and score a written hook against the four hook killers. `tools/checks/hook_legible.mjs`: on a render, is the hook text big enough, high-contrast and readable by 3 s with sound off. The hook lab in stages 1 and 2 uses them, and every finished film's hook goes into the ledger with its formula, so the library learns which formulas work for the brand. The Viral Hooks connector as decision 1 settles it | For a real brief the tool proposes five hooks from five different formulas, each scored; the check passes a good opening and fails a small, late or low-contrast one; the stage guides point to it |
| **2. Planning** | `knowledge/craft/16-structure-and-retention.md`: five beat frameworks with timings for 15, 30, 60 and 90 s, shot-length baselines, the "read twice" rule, the retention arc, ABCD for ads. `tools/plan/beats.mjs`: from a script and a framework, a timed beat sheet that says where the hook ends, where each proof lands and what is too long. A shot-list format the storyboard stage fills in and the checks read. `tools/plan/retention.mjs`: reads a YouTube Studio retention export and marks the drop-offs against the film's beats, for stage 6 | A 30 s script comes back as a timed beat sheet with its problems named; a storyboard made from the shot list passes the existing checks; a sample retention file is read and matched to beats |
| **3. Sound library** | `library/sounds/`: about 240 public-domain sounds in 12 groups (click, interface, pop, swish, whoosh, riser, impact, glitch, transition, ambience, foley, chime), every file levelled, with a manifest (source, author, licence, date, checksum, length, loudness). `tools/audio/synth.py`: makes whooshes, risers and impacts from numbers, so a brand can have its own. `tools/audio/sounds.mjs`: find a sound by group and feel, audition sheet. The brand kit grows from 11 slots to about 30, falling back to the library. `tools/audio/beats.py`: tempo, beats and the drop of a music track (librosa), written as a grid the storyboard and the engine cut to. Music: six short public-domain beds, each checked track by track (decision 4). `plinkfx` bundled as the sound-design skill | Every sound has a manifest line and passes a level check; a whoosh made by the tool is heard as one by earshot; a test film's cuts land within a frame of the beat grid; the mixer plays library sounds through the existing slots |
| **4. Text moves** | `engine/src/kit/type/`: one shared splitter (lines, words, letters, measured, in the brand's type) and about 40 text moves from the 56-move checklist in section 6: arrivals, typing and decode, emphasis, kinetic layouts, exits. Each is a pure function of the frame, works in all four sizes, uses the brand's type and colours, names the sound it wants, and has a preview in the motion library. Two caption styles for short-form if decision 6 says yes. GSAP's and the kinetic typography skills bundled for the HyperFrames side | Each move renders in the gallery in all four sizes, passes the smoothness and frame-quality checks, and is listed in `library/motion/index.json`; the text family goes from 7 to about 47 |
| **5. Transitions, backgrounds, hook openers** | Remotion's transitions, effects and light-leak packages installed. About 24 transitions from the 28 in section 6 (some ported from gl-transitions with per-file credit), each with its sound. Eight shader backgrounds (Paper Shaders, pinned) as brand-coloured presets. Twelve "hook openers": first-two-second moves made in the engine (a hard punch-in, text that fills the frame, a sudden stop, an object flying at the lens) that give the pattern interrupt without anyone else's footage | Each renders in the gallery, passes the flash-safety and smoothness checks; transitions go from 9 to about 33 |
| **6. Wiring and proof** | Skill map rows, stage guides, the installer and health check, credits (`THIRD-PARTY.md`, a credit line per ported move). Then one proof film for Tulvo, 15 s, 9:16: a library hook, a timed beat sheet, six new text moves, three new transitions, library sounds cut to a beat grid; made twice, once the old way and once the new, and the two compared | The proof film passes every existing check and the new hook check; the owner prefers it to the old-way version; its token cost is logged against the old way |

After phase 6 the motion library holds about 230 moves, and the studio has hooks, structure and sound libraries where it had none.

## 5. How the work is run

One conductor (the lead session) per phase, with helpers on the cheaper models for the parts that can run side by side, as the token plan already says:

- **Researchers** fetch each source at a pinned commit and extract the tables or recipes (never whole repositories).
- **Builders** each make a batch of moves or sounds. A move is one self-contained file, so batches of six to eight are built in parallel without touching each other.
- **A checker** runs the tests and checks and reads only their summaries.
- **A frame critic** looks at the contact sheets with fresh eyes and sends back what looks wrong.
- The lead keeps the choices, the wording a person reads, the review of every batch, and the hand-over.

Rules that hold throughout:
- Nothing is copied without a licence that allows it, and every borrowed table or move carries its credit.
- No file is added to the repository unless its licence allows sharing it. Anything else is fetched on each Mac or left out.
- A borrowed skill's house rules never beat the brand's rules or the studio's.
- Every claim a source makes about what "works" is the source's own. The library marks formulas as untested until the brand's ledger says otherwise.
- No paid call, no model download and no sound or footage sent outside without the owner's yes.

### Calls already made in this plan

A reviewer read the plan as the person who would build from it. These are the answers to what was unclear; say so if any is wrong.

- **Sizes.** The studio's rule stays: a film is made in its own size (16:9 unless the job says otherwise) and other sizes are re-laid after approval. Every new move must work in all four sizes. The hook check runs on each size that ships. The proof film is a 9:16 job from the start, which the engine's job size already allows; if that turns out not to work for scenes that are not captures, it is made 16:9 and re-laid, and the plan says so.
- **Files in the repository.** Sounds and music are kept in the repository as compressed files (no uncompressed masters), with a ceiling of 30 MB for all of `library/sounds/`. The library folder is already 228 MB, so this adds about an eighth. They ship in the clean starter.
- **Music and the beat.** The default does not change: music is made for the cut, and the beat is used to land the big moments on it. The beat grid leads the cut only when a film starts from a track that already exists (a bundled bed, or the brand's own music).
- **Scoring a hook.** The judging (is it confusing, is it relevant) is done by Claude in the session from a written rubric: no outside call. The script measures only what can be measured: length, how long before the first claim at speaking pace, openers on the avoid list. Its output says which part is measured and which is judgement.
- **Which engine.** The new text moves and transitions are built for Remotion only. The GSAP and kinetic typography skills are guidance for HyperFrames clips; nothing is built twice.
- **A brand without its own sounds.** A brand's own sounds always win. Where a slot is empty, the tool names the library sound it would use and lists it in the hand-over; it is used from the shared library, not copied into the brand's folder, and never silently.
- **The retention reader.** It is for YouTube only (Instagram and TikTok offer no export) and is built to YouTube's documented export. It stays marked "untested on real data" until it has read a real export (decision 9).

## 6. The checklists

**Text moves (56; about 40 to build first).** Arrivals: line, word and letter mask rise; fade-up words; blur-in words; focus pull; blur sweep; letter fade cascade; random-order letters; centre-out stagger; oversized slam; word pop; drop and bounce; flip-up; arc swing; scatter assemble; fly from the lens; smear arrival; block reveal; soft-edge write-on; handwriting; outline then fill; giant cropped rise. Typing and decode: human typing; delete and retype; hot-head typing; stream answer; scramble lock; decode from centre; split-flap; letter drum roll; pixel decode; anagram shuffle; glitch-in. Emphasis: highlighter sweep; underline draw; box, bracket and strike; shimmer sweep; colour front; gradient ink; payoff punch; weight shift; variable-font wave; letter wave; heat cooling; contrast-voice word. Layout and captions: karaoke box; active-word pop; one-word stack; re-centring build; make-room insert; ticker band; text on a path; text as a window; word morph; the exit set.

**Transitions (28; about 24 to build first).** Velocity handoff; match cut; blur-through; exposure bloom; invert flash; dip to brand colour; hard push wipe; feathered wipe; iris from a point; clock wipe; door split; blinds and slices; colour-panel wipe; title takeover; logo mask wipe; tile reveal; pixelate through; luma dissolve; whip pan; zoom-through; zoom blur; spin whip; parallax push; cover and reveal slide; cube turn; card flip; page turn; morph chain. A stylised set (light leak, film burn, glitch cut, ripple, ink bleed) is built last and marked "use sparingly".

**Sounds (about 240).** Click 20, interface 40, pop 15, swish 15, whoosh 25, riser 15, impact 25, glitch 15, transition 20, ambience 15, foley 20, chime and sting 15.

## 7. Decisions for the owner

Each has a recommended answer. "Yes to all" accepts the recommendations.

1. **Viral Hooks clips.** Recommended: wire the connector in as a search for reference (to study what a strong opening looks like) and allow a clip in a film only for an organic post, with your yes for that clip, logged with its page link. Never in a paid ad, never copied into the repository, never a clip with a child or a recognisable private person. The engine-made hook openers (phase 5) and licensed footage are the default.
2. **Curate, not bundle (way B).** Recommended: yes. Bundle only about eight skills that lead a task (hooks and short-form structure from vyralcontent, shotkit's storyboard skill, three GSAP skills, kinetic typography, plinkfx); everything else is taken in as credited tables and recipes.
3. **GSAP.** Recommended: yes, as an installed dependency for HyperFrames clips and optional in Remotion, never copied into the repository. The studio's own text moves stay pure frame functions so they work without it.
4. **Music.** Recommended: six public-domain beds bundled after a track-by-track check, plus the beat tools; credit-required music (CC BY) allowed per film when the film can carry a credit line; no AI-made music.
5. **Sound generators on the Mac.** Recommended: not now. Sounds made from numbers cover whooshes, risers and impacts. Stable Audio Open stays a later option (each user must accept its licence; free under 1 million US dollars of yearly revenue).
6. **Caption styles.** The studio's rule today is one fixed caption design for every film. Recommended: keep it as the default, and add two short-form styles (a highlight box that moves word to word; the spoken word enlarged) that a brand may choose for 9:16. This changes a studio rule, so it needs your yes.
7. **Order and size.** Recommended: the six phases in the order above (hooks and planning first: they cost least and help every film at once), at the sizes above.
8. **Proof film.** Recommended: Tulvo, 15 s, 9:16, made at the end of phase 6 and compared with an old-way version.

9. **A real retention export.** If you have a YouTube Studio audience-retention export from any video, put it in the job folder when phase 2 starts. Without one the reader is built to the documented format and marked untested. Recommended: provide one if it is easy; do not hold phase 2 for it.

## 8. Not in this plan

- New footage features (phases 5 to 8 of `FOOTAGE-PLAN.md` continue separately).
- A visual timeline editor. GSAP's free licence forbids building one that competes with Webflow.
- Posting to platforms, or reading their numbers automatically. The retention reader takes a file you export.
- 3D scenes. The three.js skills found are noted for later.

## 9. Not yet checked

- No code from any source has been run. How easily each move ports is judged from reading.
- Kenney's exact download links and file formats; the public-domain tag on each HoliznaCC0 track; whether BigSoundBank allows downloading in bulk.
- Whether the HyperFrames registry already has some of the gl-transitions.
- Shader transitions need a recent render browser; the engine's version (4.0.543) should have it, untested.
- The view counts and "tested on N videos" claims in the hook sources are the authors' own.
- Remotion needs a company licence for businesses with more than three people, as today.
