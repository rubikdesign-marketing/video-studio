# Tulvo Video Studio — system design

Status: sections 1–11 approved 11 Nov 2026. Section 12 added the same day. Built so far: the reference library with measurements, the craft files, playbooks, templates, and the study and voice-check tools. Not built: helper agents, control room and review page. A sample job runs end to end.

This folder becomes a private GitHub repository. A teammate clones it, opens it in the Claude desktop app (Code tab), says "set up the studio", and can then make Tulvo videos to the standard of the Black Friday film.

**Shared with other companies (owner, 11 Nov 2026, night).** The studio will also be given to other companies to adapt for their own business. So nothing in the studio itself may assume Tulvo: every company-specific thing (brand, product, voices, rules, ledger, lessons, feedback, jobs) lives in that company's `brands/<brand>/` folder, and a company starts at stage 0. Tulvo is the first brand, not the studio's owner. See section 14, "To make it shareable".

## 1. What was agreed

| Area | Decision |
|---|---|
| Who | Tulvo marketing team first, then other companies adapting it for their own business (11 Nov). Non-coders, Macs, Claude desktop app, Code tab |
| Video types | Promo, feature demo, tutorial, edit of raw footage |
| Scale | One video at a time, made the same way every time |
| Size | 16:9. Other sizes are re-laid-out only when asked, after the master is approved |
| Engine | Remotion + HyperFrames + ffmpeg. After Effects is dropped |
| Approvals | Six, in order, each a save point: idea, script and voice read, moodboard, storyboard, first animation, full animation. Moodboard and storyboard both live on a design canvas; Figma is optional per brand (changed 11 Nov) |
| Fixed across videos | Logo, typeface, caption style. Everything else is free per video |
| Voice | ElevenLabs. Ray by default; any voice by name on request |
| Product UI | Captured fresh for each video, from the real product, on the day: only the screens that video shows, built in the brand's demo account. A screen recording with a scripted cursor for most scenes; a snapshot of the page's code only when single rows or numbers must move on cue. Dated, and checked against the live product again before delivery. No standing copy of the app is kept up to date, because products change every week (owner, 11 Nov). Never invented |
| Storyboard | Key frames built and rendered by the engine, laid out on a design canvas with their notes. Figma stays an option for brands whose designers edit by hand (changed 11 Nov) |
| Design principles | Principles taken from the Claude videos apply to every video; the Claude look itself is one style family |
| Learning | Every note is logged. The owner approves which lessons become rules |
| Difference | Each video must differ from the last five and add at least one move to the motion library |

## 2. Folder layout

```
video-studio/
  CLAUDE.md                  short entry file: what this folder is, which skill to load
  .claude/skills/video-studio/   the skill: one short router plus one file per stage
  .claude/agents/            helper agents, each with its own model
  setup/                     one-step installer and health check
  .env.example               blank keys (the real .env is never synced)
  engine/                    Remotion project, HyperFrames clips, shared kit
  tools/                     scripts: voice, timing, captions, mix, master, checks
  studio/                    local control room and review page
  library/
    references/              40 reference videos, index.json, study cards
    motion/                  reusable moves, each with code, preview clip and usage note
    ui-effects/              cursor, click, zoom, highlight, type-on, glass
    backgrounds/             animated stages
    ledger.json              every finished video: hook, look, signature move, results
  knowledge/
    tulvo-product/           what the product does, dated, with screenshots
    brand/                   logo, typeface, colours, caption style
    rules/                   permanent rules, each with a check
    lessons/                 proposed lessons awaiting approval
    feedback-log/            every review note, by video, scene and version
  jobs/<date>-<name>/        one folder per video (renders are not synced)
```

## 3. One-step setup

The teammate says "set up the studio". `setup/install.sh` then:

1. Checks the Mac and installs what is missing: ffmpeg (full build), Node, Python, whisper.cpp, yt-dlp, tesseract.
2. Installs the engine at pinned versions: Remotion, HyperFrames, and the motion libraries in section 4.
3. Creates a Python environment with the audio and video checkers.
4. Creates `.env` from `.env.example` and says where to paste the ElevenLabs key.
5. Checks the Figma, Tulvo and ElevenLabs connectors and names any that are missing.
6. Proves it works: a five-second test render, a voice line, and every check run against them.
7. Prints a one-screen health report. `setup/doctor.sh` repeats steps 5–7 at any time.

Four steps stay with each person, because they involve their own credentials: paste the ElevenLabs key, connect the connectors, sign in to Tulvo in the browser pane, sign in to GitHub.

## 4. Tool stack

Status key: **have** = already used in the Black Friday build; **add** = new. Every new tool's current version and licence is confirmed when the installer is built; none is assumed.

### Picture and motion

| Tool | What it gives | Status |
|---|---|---|
| Remotion 4 with transitions, motion-blur, paths, shapes, noise, layout-utils, media, fonts | Scene-per-file films, per-scene re-render | have |
| Remotion Studio with typed controls | Sliders and pickers for each scene's settings, live preview | add |
| HyperFrames + GSAP | Canvas clips for moves Remotion handles poorly (rolling prices, macro typing) | have: HyperFrames 0.9.34 pinned in the engine (12 Nov) |
| GSAP text, morph and layout plugins | Per-letter type animation, shape morphs, layout-to-layout moves | add |
| Three.js via `@remotion/three` | Depth, light, glass and 3D camera moves | add |
| GLSL shaders | Animated gradient stages, grain, liquid-glass refraction for captions | add |
| `@remotion/lottie` | Animated icons | add |
| flubber, d3-interpolate, culori | Shape morphing, smooth value blends, colour blends without muddy midpoints | add |
| Lucide icons | A consistent icon set | add |

### Sound

| Tool | What it gives | Status |
|---|---|---|
| ElevenLabs API | Voice with word timings, music composed to scene lengths, sound effects | have |
| whisper.cpp | Transcribes the voice back to compare with the script | have |
| ffmpeg loudness, level and silence filters | −14 LUFS master, clipping, clicks, dropouts, gaps | have |
| Spectrogram images | A picture of every cut point that Claude can inspect | add |
| A speech-quality scorer (DNSMOS or NISQA) | A naturalness score per voice line | add |
| Beat and bar detection | Lands big moments on the music | have |
| A voice clean-up filter | Noise removal for raw footage | planned (`FOOTAGE-PLAN.md` 7) |

### Raw footage

The full plan is `FOOTAGE-PLAN.md` (12 Nov 2026), approved by the owner the same day (its section 13), with picture post-processing (section 6) and sound engineering (section 7) added at the owner's request.

| Tool | What it gives | Status |
|---|---|---|
| Footage tool (`tools/footage/`) | Ingest and log (phase 1); the paper edit with its proposals, the cut list with the meaning guard, the rough cut with listen-back (phase 2) | phases 1 and 2 built, tested on synthetic clips; the rest planned (`FOOTAGE-PLAN.md`) |
| Transcript page (`studio/paper.html`, /paper on the review server) | The paper edit: cut words, hear them, move sentences, keep pauses, approve flagged joins, play the edit, Send | built 17 Nov, tried in the browser pane on the test clip |
| whisper.cpp large-v3-turbo with exact word times, edges snapped to the sound | Word-level transcript including fillers, to cut on | have (phase 1); Parakeet kept for comparing |
| PySceneDetect | Finds every cut in supplied footage | have (phase 1) |
| MediaPipe face landmarker | Face tracking for framing, punch-ins, other sizes and who speaks; detection only, never recognition | planned |
| DeepFilterNet, or ElevenLabs voice isolator | Voice clean-up | planned |
| Sound repair and dialogue chain (ffmpeg, Demucs, DNSMOS) | Hum, clicks, clipping, pops, echo, music separation, mic and tone matching, levelling, a speech-quality score before and after | planned (`FOOTAGE-PLAN.md` 7) |
| Picture post-processing (ffmpeg) | Denoise, deflicker, lens, exposure, skin-based matching, grade with skin protected, sharpening, debanding, grain, scopes Claude can inspect | planned (`FOOTAGE-PLAN.md` 6) |
| HyperFrames `remove-background`, SAM 2 | Cutouts of the person | fast one have; clean one an owner decision |
| `FootageCut` and `framing.ts` in the engine | Plays a cut list with framing, split sound and picture cuts, inserts and titles | planned |

### Product capture

| Tool | What it gives | Status |
|---|---|---|
| The brand's own connector, if it has one (Tulvo has) | Builds boards, pages and sites in the demo account | have, for Tulvo |
| Browser pane | The teammate's own signed-in session in their product | have |
| Capture tool (`tools/capture/`) | For any web product: a person signs in once by hand, then plain steps in the job are played in Chrome and recorded at 3840 x 2160, 60 fps, with the pointer path and a sharp still per named moment, all dated in the job. `check` says which moments changed before delivery. `CaptureClip` plays it in a film with the brand's cursor | built, tested on a test page (section 14, item 22) |
| Cap (cap.so) | Hand recording of a flow, zoom and cursor effects off, dropped into `footage/` | person installs it |
| Pixel compare | Checks any rebuilt UI against the real screenshot | have |

### Reference study

| Tool | What it gives | Status |
|---|---|---|
| yt-dlp | Downloads reference links the owner supplies | add |
| PySceneDetect | Measured shot lengths per reference video | add |
| OpenCV motion tracking | How fast things move frame to frame, to recover easing and camera speed | add |
| ffmpeg frame export | Frame-by-frame sheets of every transition | have |

### Checks before a human sees a cut

| Check | Tool | Status |
|---|---|---|
| Frame jumps and judder | `tools/checks/smoothness.py` (rebuilt from last night's two scripts, no extra packages; flags moments to inspect) | built, tested |
| Voice gaps and dead holds | timing table against the limits in the rules | have |
| On-screen text matches the approved script and offer | tesseract reads frames | add |
| Text size after camera moves | `tools/checks/text_size.mjs` (tesseract reads the finished frame at each click, hover, mark, hold and on-screen text) | built, tested 12 Nov |
| Captions clear of product UI | `tools/checks/captions_clear.mjs` (caption pill against the capture's things through the engine's plan) | built, tested 12 Nov |
| Flashing and sudden brightness jumps | `tools/checks/flashes.py` | built, tested 12 Nov |
| Energy map against the measured film | `tools/checks/energy_map.py` | built, tested 12 Nov |
| Product still current; proof of source | `capture.mjs check` (picture, words, layout); `tools/film/sources.mjs` | built, tested 12 Nov |
| Caption contrast | measured from frames | add |
| Voice quality | the four audio checks above | add |
| Contact sheet review | two frames per second, viewed by the reviewing agent | have |

## 5. The production line

Each stage ends at an approval. The session then ends, and the next stage starts fresh from `job.json`.

| # | Stage | What happens | Approval |
|---|---|---|---|
| 0 | Intake | Claude grills the maker: goal, audience, one message, facts, where it runs | — |
| 1 | Idea | Product walk for the features involved. Three concepts, each with its soul (feeling, one idea, signature moment), size, length, pacing, and how it differs from the last five videos | Idea |
| 2 | Script and voice | Script written, or the supplied one tightened. Voice generated line by line and checked | Script and voice read |
| 3 | Moodboard | Look, type, colour, background and motion references, in the Figma file | Moodboard |
| 4 | Storyboard | One Figma frame per cut: shot number, length, voice line, on-screen text, motion note, transition, real capture | Storyboard |
| 5 | First animation | Per type. Promo: full-length rough cut plus one polished scene | First animation |
| 6 | Full animation | All scenes, music composed to the cut, sound design, mix, checks | Full animation |
| 7 | Delivery | Master, no-captions version, captions file, poster frame, description. Ledger and libraries updated | — |

Rules that hold at every stage:

- The picture is fitted to the voice. The voice is never stretched or sliced.
- The length cap is agreed at the idea stage and is binding.
- No cut reaches a human until every check in section 4 passes or the failure is listed.

## 6. Control room and review studio

One local page, opened in the desktop app's browser pane.

| Tab | What it does |
|---|---|
| Jobs | Every video, its stage, what is waiting for approval |
| Review | The film with a scene-marked timeline. Pause, type a note pinned to that moment, draw a box on the frame, collect notes, press Send |
| Controls | Sliders for the video's settings: pace, music level, caption size, grain, camera float, accent colour. Per scene: length, transition, emphasis |
| Motion library | Every move with a preview clip, where it has been used, which video types it suits |
| References | The 40 reference videos with their study cards |
| Rules | Permanent rules and lessons awaiting approval |
| Usage | Credits spent per stage, per video |

What Send does: the notes are saved to the feedback log, Claude wakes, maps each note to its scene, edits, re-renders only those scenes, rejoins the film, re-runs the checks and reloads the player with before and after.

Confirmed on this Mac on 11 Nov: pressing Send ended the waiting command and woke the session with the notes. Not yet confirmed on a teammate's setup. The fallback is notes typed in chat with a time.

## 7. Libraries

- **References.** 40 videos are packaged in `library/references/` with `index.json`. Each gets a study card: measured shot list, contact sheet, transitions frame by frame, type and caption treatment, backgrounds, sound, and how to rebuild each technique. The three Claude videos are studied first and in the most depth. Nothing from another company's video is ever placed in a Tulvo video.
- **Motion, UI effects, backgrounds.** Seeded from the Black Friday kit (captions, headline, cursor, click ring, stage, grain, confetti, the 42 named recipes in the motion kit) and from the reference study. Each entry has code, a preview clip, and the video types it suits.
- **Ledger.** One record per finished video: hook, look, signature move, length, and later its results. The idea stage reads it to keep each video different.

## 8. How it learns

1. **Log.** Every review note is stored with video, scene, version and what was changed.
2. **Propose.** After each video, Claude drafts lessons from the notes, marking any that repeat an earlier note.
3. **Approve.** The owner approves, edits or rejects each lesson. Approved lessons become rules with a check attached.
4. **Results.** When a video's numbers are known (hold rate, click rate), they go into the ledger and are weighed when lessons are proposed.
5. **Product knowledge.** Each job re-walks the features it covers, compares them with the stored notes and screenshots, and records any change with its date.
6. **Sync.** Rules, lessons, library entries and product knowledge are pushed to GitHub at the end of a job and pulled at the start of the next.

## 9. Starting rules

Taken from the 34 rounds of feedback on the Black Friday and UGC work.

| Rule | Check |
|---|---|
| No jumps, jitter or chatter | Both scans pass |
| Length cap agreed first and binding | Master length against the cap |
| No hold without a reason | Gaps between lines 0.6–0.8 s; at most two proof holds of about 1.3 s |
| One camera direction per shot; finish the zoom, then land the number | Storyboard review, contact sheet |
| Voice 100%, music 20–30% | Mix levels measured |
| Every background moves; no dots | Frame difference on background regions |
| Captions never cover UI | Caption box against capture regions |
| Offer wording is fixed once | On-screen text and transcript against the approved wording |
| Hook or offer in the first 3–5 seconds; sentences spoken to a buyer | Script review at the script approval |
| Real UI, accurate data, shows what the line says | Each capture traced to a real page |
| Logo opens and closes; it is not on every frame | Storyboard review |
| Highlight only what the beat is about | Storyboard review |
| "Tulvo" is said TOOL-voh; no whispered lines | Transcript check, level check |
| Third-party logos need a person's confirmation | Listed at the storyboard approval |

## 10. Credits

- Each stage runs in its own session and reads only `job.json`, its stage file and the rules it needs.
- Scripts do the mechanical work. Claude reads their one-line results, not their logs.
- Helper agents and their models:

| Agent | Work | Model tier |
|---|---|---|
| Director | Idea, creative direction, final review | strongest |
| Writer | Script | strongest |
| Product scout | Workspace build, captures | middle |
| Storyboarder | Figma file | middle |
| Scene builder | One scene per agent | middle |
| Reference analyst | Study cards | middle |
| Inspector | Runs checks, reads contact sheets | cheapest for scans, middle for sheets |
| Runner | Renders, mixes, joins | cheapest |

- Helper agents draw on the same allowance as the main conversation, so they are run in sequence unless a stage is waiting on them.
- Usage is logged per stage. The first video gives the real figure.

## 11. Build order

| # | Step | Status on 11 Nov |
|---|---|---|
| 1 | Study the three Claude videos frame by frame; write the principles | Done: three study cards, `knowledge/craft/00-principles.md` |
| 2 | Installer and health check | Built: `setup/install.sh`, `setup/doctor.sh`. The health check runs clean here; the installer has not been run on a fresh Mac |
| 3 | Engine: port the Black Friday kit, strip what is tied to that film, add the new motion libraries, motion tokens and energy presets | Mostly done: the kit renders, and a shot list becomes a film with one file per scene, a preview, single-scene renders and a master. To do: advanced motion examples, 3D and shader libraries, wiring the UI kit, a silent end card |
| 4 | Tools | Done: study profile, contact sheets, voice check, smoothness, frame quality, on-screen wording, voice line by line, captions, music and effects, the mix, sound mastering. The ElevenLabs calls for voice, music and effects were tested once and worked. Rejoining one re-rendered scene added 11 Nov (evening) |
| 5 | Skill files, rulebooks, brand and product knowledge, helper agents | Part done: skill and six stage files, 19 starting rules, craft files, playbooks, brand file. To do: helper agents, product knowledge |
| 6 | Control room and review studio | Review editor built and tested in the browser: pause, pin a note, say change or keep, pick a topic, flag a must-fix, point at an area, mark scenes as good, approve a version, phone-size and sound-off viewing, the line being spoken shown under the player; send; a waiting session is woken with the notes and the page shows the replies. Not built: the jobs, controls, motion library, references, rules and usage tabs |
| 7 | Study cards for the remaining 37 references; working examples for the motion library | Measured only; no study cards or examples yet |
| 8 | Proving run: a 60-second feature demo through all six approvals | Waiting on steps 2–6 |

The skill can run stages 0 to 4 today (intake, idea, script and voice, moodboard, storyboard). Animation needs steps 2, 3 and the rest of 4.

## 12. The studio craft layer (added 11 Nov, after approval of sections 1–11)

What a senior motion director would add on top of the production line. Built items are marked.

### New concepts in the production line

| Concept | What it is | Where it lives | Status |
|---|---|---|---|
| Soul sheet | One page per video: one sentence, feeling, one idea, signature moment, never-list, how it differs | `templates/soul-sheet.md` | built |
| Energy map | Every beat scored 1–5; music, cut rate, camera and sound all follow it | `knowledge/craft/01-direction.md`, shot list | built |
| Measured energy | After each render, movement and loudness are charted and compared with the map | `tools/study/profile.py` | built, tested |
| Colour script | One row of small frames showing only colour and light, per beat | moodboard step | written |
| Style frames | Opening, signature moment and ending at full polish before the storyboard | moodboard step | written |
| Animatic | Storyboard frames cut to the real voice and temporary music | first-animation step | written |
| Shot grammar | Wide, medium, macro, abstract, with shares per film | `craft/01-direction.md` | built |
| Eye trace and hand-off objects | The focal point is carried across every scene change | `craft/01`, `craft/03`, shot list | built |
| Motion tokens | Named lengths and easings instead of ad-hoc numbers | `craft/02-motion.md` | written; engine file to come |
| Energy presets | calm, confident, hype: one setting changes the feel of a whole film | `craft/02-motion.md` | written; engine file to come |
| Transition catalogue | Twelve named techniques, rules for mixing them, a banned list | `craft/03-transitions.md` | built |
| Type moves | Eight named text animations, a type scale, a text budget | `craft/04-type-and-captions.md` | built |
| Caption design | Bigger live captions on dark liquid glass, word-by-word | `craft/04` | written; component to come |
| UI choreography | Cursor, typing, ask–wait–result–proof, six emphasis tools | `craft/05-ui-choreography.md` | built |
| Stage families | Paper, night, glass, colour field; light, depth, glass, finishing pass | `craft/06-light-and-finish.md` | built |
| Sound layers | Interface, movement, impact, lift; music composed to the cut; mix order | `craft/07-sound.md` | built |
| Voice checks | Measured checks on every voice track | `tools/audio/voice_check.py` | built, tested |
| Director's checks | Twelve measured and twelve looked-at checks, the ten-percent pass, the hand-over note | `craft/08-directors-checks.md` | built |
| Playbooks | Shape, rules and first-animation definition per video type | `knowledge/playbooks/` | built (4) |
| Hook lab | Three alternative first-three-seconds for every promo | `playbooks/promo.md` | written |
| Cut-down plan | 30 s, 15 s and 6 s versions marked at the storyboard | `playbooks/promo.md`, shot list | written |
| Study cards | A fixed format for learning from any reference film | `templates/study-card.md` | built |
| Measured pacing | Cuts, shot length, movement and rest for every reference | `library/references/index.json`, `_profiles/` | built (40 films) |

### Second enhancement round (11 Nov): brand, precision and frame quality

| Addition | What it is | Where it lives | Status |
|---|---|---|---|
| Brand tokens | Tulvo's real colours and fonts, each with its source: marketing design system, social kit, live app, film feedback | `brands/<brand>/brand.json`, `brand.md` | built |
| Type system | Instrument Sans for film type, Instrument Serif italic for one emphasis word, Instrument Sans for labels and numbers (no coding-style typeface), Inter inside product UI only | `brands/<brand>/` | built; two font files arrive with the installer |
| Six design styles | Paper, Night, Glass, Colour field, Editorial, Blueprint, each built only from brand colours and fonts | `knowledge/craft/13-design-styles.md` | built |
| Advanced motion | 28 techniques across camera, shape, groups, type, light and physics, each with settings and how it goes wrong | `knowledge/craft/09-advanced-motion.md` | built; working examples to come |
| Flows | Nine flow patterns, a flow table, rules for believable data, a saved flow library | `knowledge/craft/10-flows.md` | built |
| Data in motion | Product charts shown truthfully; film graphics; how numbers, bars, lines and dashboards move | `knowledge/craft/11-data-visualisation.md` | built |
| Frame quality | Grid, spacing scale, composition, rendering rules, a frame audit | `knowledge/craft/12-frame-quality.md` | built |
| Frame quality check | Measures rest frames for crowded edges, focal areas, clutter, off-brand colour | `tools/checks/frame_quality.py` | built, tested |
| Precise UI kit | The faithful rebuild of Tulvo screens (shell, boards, home dashboard and charts, onboarding, deploy, people, templates), 54 `TulvoUi-<id>` compositions, placed in a scene with `<AppStage>` | `engine/src/products/tulvo/` | wired into the engine 11 Nov, type-checked, font from a local file; built from a 20 Oct capture, re-capture before use |

Frame check on real films, same settings: the Dokan promo had 1 of 8 frames flagged, with one or two focal areas in most frames. The Tulvo After Effects film had 7 of 11 flagged, with three to seven focal areas. Full-screen product UI flags in any film, including the Claude ones, so a flag is a prompt to look.

### Third round (11 Nov): any brand, more backgrounds, working animations

| Addition | What it is | Status |
|---|---|---|
| Brands | Everything that belongs to a brand lives in `brands/<brand>/`. The engine takes colours, fonts and logos from the brand a job names. A template, a checker and a one-page brand sheet for approval | built; rendered for Tulvo and an invented test brand |
| Brand setup stage | Stage 0 in the skill: grill the team, fill the brand from their real sources, check, approve the sheet, then teach it their taste | written; not yet run with a real second team |
| Backgrounds | Twelve animated backgrounds built from brand roles, ten on both pages plus Paper (light) and Night (dark), at three energy levels | built, reviewed and measured on 11 Nov; checked in the test brand; not watched at speed |
| Animations | Twenty-six working moves (type, emphasis, data, camera, transitions), each with its own preview clip and a catalogue entry | built; every move reviewed frame by frame and fixed on 11 Nov; the five newest were viewed on the light page only |
| Review editor | Change or keep notes, topics, must-fix, good scenes, approval, phone size, the spoken line | built and tested in the browser |
| No coding font, no dots, human wording | Studio rules 20 to 22 | applied to the engine, the guides and the review page |

### Proposed, needing a decision

| Proposal | Why | Decision needed |
|---|---|---|
| A sound signature | One or two seconds of sound on the closing logo, the same in every video | Whether to make one, and approve it once |
| A rest budget | The Claude films rest about a third of the time; last night's Tulvo films never rest | Whether "every background moves" may be slow enough to read as rest |
| A live-action lane | The reference set includes filmed ads; the studio only makes animation | Whether generated or filmed people are wanted, and with which tool |
| Results in the ledger | Hold rate and click rate per video, to promote rules by performance | Where those numbers come from |

### What the first measurements showed

Movement is scaled so films at different frame rates compare fairly. "Still" means nothing in the frame moves.

| Films | Hard cuts per minute | Share of time moving | Still seconds per minute | Typical movement | Peak movement |
|---|---|---|---|---|---|
| Claude launch films (3) | 2.0 | 64% | 17.4 | 0.97 | 13.7 |
| Dokan Black Friday promo | 0 | 70% | 14.3 | 0.68 | 40.3 |
| Google Vids launch | 15.2 | 93% | 1.6 | 2.02 | 41.8 |
| Social clips: Cursor, ElevenLabs, Grok (31) | 17–26 | 95–97% | 0–2.2 | 1.2–2.5 | 9–31 |
| Tulvo Black Friday, Remotion v4 | 2.6 | 97% | 0 | 2.06 | 66.5 |
| Tulvo Black Friday, After Effects v8 | 1.0 | 99% | 0 | 2.01 | 41.8 |

Reading: the two Tulvo films cut as rarely as the Claude films, but they never rest and they move about twice as much. The Claude films and the Dokan promo are still for a quarter to a third of their length. (Re-measured 11 Nov after a fault in the measuring tool was fixed: it had misread very small values. Twelve of the forty references changed slightly; the conclusion did not.)

### Voice check, tested on last night's files

| File | Result |
|---|---|
| The original Ray take | Clean: no flags, 100% of script words heard |
| The processed voice used in Remotion v4 | Flagged: three words starting abruptly from silence, four level jumps of 6–9 dB between phrases, and "Pro, from" not heard by the transcriber |

A click detector was tried and removed: on clean speech it fired more often than on the faulty file.

## 13. Needed from the owner

- An empty private GitHub repository, and a fresh GitHub sign-in on this Mac.
- A Remotion company licence (needed above three people).
- Confirmation that the shared Figma account has edit access for the team.
- The ElevenLabs team key, handed to each teammate privately.
- The feature for the proving run.
- Reference links to add, three to five per video type.

## 14. What remains (written 11 Nov 2026, evening)

The canonical to-do list. Tick items off here as they are done.

**Owner's call, 11 Nov (evening): build the system first; no test runs yet.** The proving run (item 1) and the other items under "To prove the system works" wait until the build items below are done. Work goes down from item 6.

### Bundled skills and versions (12 Nov 2026)
Remotion is 4.0.543 (the latest), HyperFrames 0.9.34 is pinned in the engine, and 29 open-source skills (Remotion, HyperFrames, motion, hallmark, impeccable, taste) are bundled in `.claude/skills/` at their latest versions, with sources and licences in `.claude/skills/THIRD-PARTY.md` and a one-command refresh, `bash setup/update-skills.sh`. The video-studio skill says which one to load at which stage, and stages 3, 4 and 5 name them. Checked: a fresh Claude session in this folder lists all 30 skills; the Smoke clip renders on Remotion 4.0.543; the health check covers HyperFrames and the bundled skills. Not checked: each skill used in a real stage (that happens in the proving run).

### Ready to hand over: what is left (11 Nov 2026, night)

The order to finish in, so the Tulvo team can be given the studio, then other companies. Item numbers point to the list below.

**A. Before the Tulvo team gets it**

| # | What | Who | Item |
|---|---|---|---|
| A1 | Capture tool phases 2, 3 and 4 (reliable takes, your own Chrome, motion catalogue) | Studio | 22, `CAPTURE-PLAN.md` |
| A2 | Done 11 Nov: the capture tool tried on Tulvo (look-only take, freshness check exact) | Done | 22 |
| A3 | Tulvo product discovery, starter capture scripts for the top flows, packaged for the team | Studio, owner approves | 29 |
| A4 | The proving run: one real 60-second video through all six approvals, fixing the studio as it goes. It also tests the moodboard canvas for the first time | Owner names the feature and approves each step | 1, 2 |
| A5 | Helper-agent files with a cheaper model per role, and credits logged per stage, so the team's usage stays low | Studio | 18 |
| A6 | The checks still only written: text size after zooms, captions over UI, flashes, energy map | Studio | 12 |
| A7 | Tune the newest moves on the dark page and the energy presets on a real scene | Studio | 10 |
| A8 | The closing logo sound for Tulvo | Owner says yes to the paid call | decisions |
| A9 | Done: the private repository. Still to do: the pull-at-start, push-at-end step | Studio | 14 |
| A10 | Remotion company licence (above three people) and the ElevenLabs team key for each teammate | Owner buys and hands out | 14 |
| A11 | A fresh session in the folder loads the skill and routes to the right stage | Studio | 3 |
| A12 | The installer on a teammate's Mac that has never had the studio | A teammate's Mac | 5 |
| A13 | Housekeeping: clear test renders and helper leftovers | Studio | housekeeping |

**B. Soon after, while the team makes its first videos**

| # | What | Item |
|---|---|---|
| B1 | The lesson step as a tool (feedback becomes rules after approval) | 15 |
| B2 | Study cards for the launch films, ads and the promo | 17 |
| B3 | The review page opened by people without the folder (managers, clients) | 20 |
| B4 | Capture tool phases 5 to 8 (transitions, product kinds, delivery checks, other sizes) | 22 |
| B5 | The other control-room tabs | 19 |

**C. Before other companies get it**

| # | What | Item |
|---|---|---|
| C1 | Studio free of Tulvo; a health check that finds any brand's name outside its folder | 23 |
| C2 | Links-only reference list and a download step on first setup | 24 |
| C3 | The clean-starter script | 25 |
| C4 | Installer and health check explain each company's own accounts | 26 |
| C5 | Stage 0 and 0B tested once with a made-up company | 27, 28 |
| C6 | Hand-over note per company: discovery first, then a first video | 30 |
| C7 | A lawyer reviews `LICENSE-DRAFT.md` | owner |
| C8 | One real second brand through stage 0 (Rubik or Wimbr) | 4 |

**D. Later, only if a video needs it:** raw footage editing (21), 3D and shader libraries (11), automatic import of results (16).

### To prove the system works
1. Run one real video through all six approvals (the proving run). Needs the owner to name the feature. Nothing has gone through the whole line yet.
2. Run the moodboard stage on a design canvas for the first time (untested). The storyboard canvas has only been tested with placeholder frames.
3. Open the skill in a fresh session in this folder and confirm it loads and routes correctly (not trigger-tested).
4. Set up one real second brand (Rubik or Wimbr) through stage 0 (untested with a real team).
5. Partly done 12 Nov: a fresh, signed-out copy of the public repository installed on this Mac and passed the health check except the ElevenLabs key (it found and fixed two fresh-copy bugs). Still to do: a Mac that has never had the studio, and the one-step prompt in ONBOARDING.md run by a teammate.

### To finish the engine
6. Done 11 Nov: the background review finished and was checked as stills. All twelve were retuned; "rest" reads as still everywhere; Paper is light-only and Night dark-only (22 previews). Done 11 Nov (evening): the stage grain no longer shows over Colour field on the light page. A background that fills the frame with a strong colour now asks the stage for less grain (`useGrainShare` in `engine/src/kit/ui.tsx`); Colour field takes a fifth on the light page. Re-measured: still at rest (highest quarter-second 0.05, was 0.26), and rest, alive and peak still rise in order; `measured.json` and the backgrounds README updated. Not redone: the preview picture and the contact sheet (the change is grain only). Still to do: nobody has watched the backgrounds move at speed.
7. Done 11 Nov (night): the faithful Tulvo screen kit now lives in `engine/src/products/tulvo/` (product screens belong to a brand, so they sit apart from the brand-neutral kit), is type-checked, and is registered in Remotion Studio under "products". Inter comes from the engine's local variable file, so nothing goes online. No Tailwind was added. All 54 screens were rendered here and in the old project with the same Chrome: 47 identical to the pixel, 11 slightly different (PSNR 49 to 57 dB), all because the old project's Tailwind v4 hid the app's own gradients; here the onboarding fade and the deploy editor's sheen show, as in the live app. Re-capturing it is dropped (owner, 11 Nov): products change every week, so screens are captured per video instead (item 22). The kit stays as a pattern library for how screens are built and animated, and is never shown in a film as the current product.
8. Done 11 Nov (evening): `bash tools/film/render.sh jobs/<job> scene S02 --splice` re-renders one scene and swaps it into the preview. Previews now start a fresh frame exactly where each scene begins, so the cut needs no re-encoding; the preview's own sound is put back untouched. It refuses, in plain words, when there is no preview, when scene times have changed since the preview (a copy of `film.json` is kept beside it), or while a render runs. All renders now share one lock, `engine/out/.render.lock`. Tested on the sample: same 732 frames, every frame outside the scene identical, sound identical. Also tested on the first and last scene with no change made: changed frames stayed inside the scene, the picture matched to 51.7 dB on average (44.5 at worst, far past what the eye can see), sound identical. Not tested: a silent end card, previews without captions.
9. Done 11 Nov (evening): a scene can be silent (`"silent": true, "seconds": 2.5` in shots.json), at the end of the film only: the sound is one mixed track, so a silent beat mid-film would cut the music and push the later lines out; leave a pause in the voice script for that. End cards start half a second after the voice; `mix.py` reads them from shots.json and lets the music play on under them to the last frame, and the scaffold warns when a mix is older than the end card. Tested on copies of the sample job (sample unchanged, end card in place on a still, mix and film both 14.7 s with a stand-in tone for music). Not tested: a storyboard run with an end card, and listening to the music under it.
10. Check the five newest moves on the dark page and at the calm and hype presets. Tune the preset values on a real scene.
11. Install and try the 3D and shader libraries named in section 4, only if a video needs them.

### To finish the checks
12. **Done 12 Nov 2026 (evening), with phase 7 of the capture plan.** The four checks that were only written are built and wired into `knowledge/craft/08-directors-checks.md` and the `checker` role: text size after camera moves (`tools/checks/text_size.mjs`: the finished frame read at every click, hover, mark, reading hold and on-screen text; product words at the action against a floor that is a setting, 4% by default and also reported against 3% until the owner chooses; film text against 2.6%), captions over product UI (`tools/checks/captions_clear.mjs`), flashes (`tools/checks/flashes.py`: more than three flashes in a second over a quarter of the frame fails; sudden whole-frame brightness jumps listed) and the energy map against the measured film (`tools/checks/energy_map.py`: each scene's movement from `profile.py` against shots.json's energy; two levels off, or two scenes the wrong way round, is flagged). Each caught its planted fault and passed the clean version (numbers in CAPTURE-PLAN.md section 11, phase 7). Still to do: caption contrast against the frame, red flashing, and running all four on a finished real film.
13. Done 11 Nov (evening): the frame check reads each brand's rejected colours from its `brand.json` (`--brand`, else the default brand) and names any colour word it cannot check. It knows ten colour families and common names for them (lilac, blush, navy and so on). Tested on plain colour clips: purple, pink and grey caught for Tulvo, red for the test brand, Tulvo's blue left alone.

### To finish learning and sharing
14. Done 12 Nov: the repository is public at https://github.com/rubikdesign-marketing/video-studio (owner's decision), started from one clean commit; the earlier private history is kept as the private archive `video-studio-private-archive`. Left out of the public repository: other companies' reference films (shared privately) and Remotion's skills (setup fetches them). `LICENSE.md` says all rights reserved, read and learn freely, ask before using it for a business. Still to do: the Remotion company licence.
15. Build the lesson step as a tool: draft lessons from a brand's feedback log, owner approves, approved ones become rules.
16. Done 11 Nov (evening): results are typed in by hand for now (owner's decision). The ledger record's `results` is a list, one entry per channel and check-in, with hold rate (and what it means on that channel), click rate, views, spend, period and source; the delivery stage says how. Automatic import is for later.
17. Write study cards for the other 37 reference videos, at least the launch films. Test downloading a Meta Ads library video.
18. Done 12 Nov: six helper roles in `.claude/agents/` with a model each (checker on the cheapest; scene-builder, capture-runner, frame-critic, reference-studier, researcher on the middle one), and usage logged per stage in `job.json` (`usage`), as part of the token plan in `.claude/skills/video-studio/skill-map.md`. Not yet used on a real video.

### To finish the editor
19. The other control-room tabs: jobs, sliders for a video's settings, the motion and background library, references, rules, usage.
20. Let the review page be opened by people who do not have the folder.

### Lanes not built
21. Editing raw footage: dead-air cutting, noise clean-up, edit by transcript. **Planned 12 Nov 2026, not built.** `FOOTAGE-PLAN.md` adds face tracking and framing in every size, punch-ins on jump cuts, retake finding, full picture post-processing, sound repair, dialogue, mix and master, cutouts, a consent check and an editor timeline export, in eight phases. Approved by the owner 12 Nov (its section 13). **Phase 1, ingest and log, built 12 Nov 2026 and tested on four synthetic clips with known contents (31 checks pass); not yet on real footage.** `tools/footage/footage.mjs ingest jobs/<job>` measures each clip, makes a working copy (steady frame rate, upright, HDR converted), transcribes word by word with fillers kept and edges snapped to the sound (within 30 ms on clean and phone sound), finds shot changes, picture problems (soft, grainy, dark, bright, blown, flat, flicker, shake) and sound problems (noise, clipping, clicks, hum, rumble, wind, echo, music under speech), makes a contact sheet with brightness and colour scopes, and writes `edit/log.md`. Its own Python 3.12 (uv) and the larger transcription model come with the installer; the health check covers them. Everything under `jobs/*/edit/` stays on the Mac. Phase 1 is marked done when the owner's three real clips pass. **Phase 2, paper edit and rough cut, built 17 Nov 2026 and tested on the synthetic talking clip (9 whole-job checks, 18 fast tests); not yet on real footage.** `footage.mjs paper` proposes (opening lines, retakes, fillers, long pauses), the transcript page at /paper on the review server is where a person decides and sends, `footage.mjs cut` places the cuts on the sound with the meaning guard, and `footage.mjs rough --render` joins the dialogue with 15 ms crossfades, listens back word for word and renders `FootageCut` with captions to `jobs/<job>/out/rough-cut.mp4`.
22. **Built and tested on a local test page, 11 Nov (night); not yet tried on a real product.** The capture tool, `tools/capture/capture.mjs` (how to use it: `tools/capture/README.md`). It drives the installed Google Chrome with `playwright-core` (its own small package in `tools/capture/`, installed by `setup/install.sh`, checked by the health check). A person signs in once per brand by hand (`capture.mjs signin <brand>`, kept in `.capture/<brand>/`, never synced); the tool never types, reads or keeps a password or code. Each capture is a plain list of steps in the job (`jobs/<job>/capture/<id>.json`: open, click, type, press, hover, scroll, wait, mark), found by the words on screen with optional `in`/`near`. `run` records a 1920 x 1080 window at double sharpness with Chrome's own screencast (real frame times), made into a steady 60 fps 3840 x 2160 video (x264, quality 12), moves the real mouse on eased curves so hovers happen, and writes `cursor.json`, a still per mark and `capture.json`. `check` runs the steps again and names the moments that changed, with side-by-side pictures. Where the product lives and what never to show is `brands/<brand>/product/capture.json` (Tulvo's is filled in). In the engine, `CaptureClip` (`engine/src/kit/CaptureClip.tsx`) plays a capture in a frame region with the brand's pointer and click rings drawn from `cursor.json`, with a seconds range and an optional zoom; `CapturePreview` shows one in Remotion Studio. By default every capture hides the product loading: the clip starts 0.2 s before the first page load ends (or at the first mark, if earlier), and each later load over 0.6 s is sped up to last 0.6 s with the "Sped up" label (`trimLoads={false}` turns it off; hand-set time effects still win). Hand recording with Cap goes into `footage/` (README). The enhancement plan (browsers, product kinds, set dressing, motion data, engine motion, transitions, checks, edge cases, build phases 2 to 8) is in `CAPTURE-PLAN.md`, waiting for the owner's decisions in its section 12.
    - Tested on the test page: sign-in window opens and closes cleanly; a 12.2 s, 13-step capture gave 3840 x 2160, 60 fps, length matching the steps to within one frame; the pointer path has no jumps; every click shows on screen within 50 ms of the button; mark stills are 3840 x 2160 and the video frames match them at about 41 dB; check said "no change" on a re-run (0.000% different) and caught a renamed and an added row (0.08%); password and sign-in code steps, a sign-in page, a never-show page, a never-show e-mail and a link to another site were all refused with plain messages; one preview still rendered with the pointer and ring.
    - Not tested: a real product (Tulvo not signed in yet), long captures (over a minute), pages with heavy animation (Chrome may send fewer than 60 pictures a second there: `capture.json` records how many it sent), sites that block automated browsers, playing a 4K capture through a full film render. Not built: the page-code snapshot for moving single rows on cue (use the rebuilt product screens for that), and a way to undo rows a capture adds in the demo account.
    - **Phase 2, reliable takes: built and tested on a local practice page, 11 Nov (night).** The capture tool now tidies the screen before and during every take (studio defaults hide cookie and consent banners, the common chat widgets, scrollbars, the caret's blink, spellcheck lines and Chrome autofill; each brand adds `clean_screen` lists to hide, dismiss and keep), stops with a boxed still when anything unlisted covers a page, sets language, region, time zone, theme and reduced motion, and freezes the product's clock at the demo time (running on from there; a resumed take picks up where the earlier take was). It waits for fonts, pictures, a quiet network and a still picture before the first step and after every step, and has `wait for` words, things, "settled" and "stopped changing" (for streamed AI answers). The never-show list is checked on every page, three times a second while recording and at every mark; each mark scans for e-mails, phone numbers and people's names not on the safe list, blurs them in the still and its words file and lists them in `warnings.txt`; `mask` blurs a thing in the recording too. All step types in plan 5.1 except `layer`, `snapshot` and `as` work, scrolls and drags move one small step per recorded frame on an eased curve, `track` writes a per-frame `tracks.json`, and there are `rehearse`, `dry`, numbered takes with a `best.json` pointer, `--from <mark>`, and a failure screen (still, words, what was looked for and found). Tested: three takes of a 51-step, 44 s script gave identical marks (9 of 9 at 0.0000% difference, words identical) and `check` said no change; a `--from` take matched 6 of 6 marks; rehearse (70 s at half speed, visible) and dry run (19.5 s) passed all steps; the cookie banner, chat widget and pop-up were hidden or dismissed; the e-mail, phone number and name were blurred and flagged; never-show text stopped the take mid-step with the line blurred in the still; a missing target and an unlisted pop-up gave clear failure screens; across nine scrolls about 1 frame in 75 was late (one held or doubled step), the rest followed the curve with neighbouring steps within 2 px. Not checked: Tulvo or any real product, real third-party cookie and chat scripts, Chrome autofill with saved data, the browser's own drag events, pop-up windows opened by `window.open`, frames from another site, very long takes, and the engine reading `tracks.json` (phase 4). The privacy scan's name check knows only common first names, and the recording itself is not blurred by the scan (only by `mask`).

    - **First real product test, Tulvo, 11 Nov (night).** Signed in by the owner once; a look-only take on Kestrel Studio (Lead Pipeline board, then Campaign Launch Board from the sidebar, then resting on New): 3840 x 2160, 60 fps, 10.4 s, three marks right, and `check` found no change (0.000% at all three). The example lives in `jobs/_tulvo-capture-test/`. Three studio fixes came out of it: (1) on a Mac, closing the sign-in window leaves Chrome running, so the tool now also checks every second whether any window is left, and says Cmd+Q works too (not yet re-tested by a person); (2) real products keep background requests open (Tulvo: its Amazon sign-in refresh and its Firestore live-update channel), so known sign-in, analytics, error-reporting, chat and live-update traffic no longer counts as "still loading", and a brand can add its own under `background_requests`; (3) a fresh capture profile meets the product's real cookie banner, which the clean screen hid as it should.
    - **Phase 4 part A, engine motion for captures: built and tested on a local practice page, 12 Nov (night).** `CaptureClip` draws its own pointer, re-pathed between the recorded clicks and presses (arcs of 350 to 600 ms, arriving 125 ms before each click, pressing to 90%, hidden while typing, fading after 1.2 s of rest, blur on fast moves, shape from the events), in nine styles with five click effects, hover magnet and glow, a glowing field while typing and key caps; its camera zooms in on each action from `tracks.json`, follows the pointer 150 ms behind, never passes 2x or moves in a reading hold, and has ten hand-set moves; speed ramps, freezes, jumps, rewinds, pins and loops all go through one time map that the picture, pointer, tracks and camera share. Eight look presets set it in one word. The pieces are pure functions in `engine/src/kit/capture/`, checked by `tools/checks/capture_motion.mjs`; 42 entries and previews are in the motion library, and `library/motion/capture-sheet.jpg` shows every pointer style and look. Tested: clicks 125 ms after arrival and still; no jumps from the engine (`smoothness.py` flagged only the practice page's own instant pop-up, which is in the raw recording too); zoom room at least 6%; a 3x ramp kept the dragged card and pointer in step; a pin landed within a frame. Not checked: a real product or Tulvo, text size after zoom (4% is not reached at 2x on a 1600 px card), pointer shapes from a log (inferred), dark product screens, 30 fps films, and full-size previews (all rendered at half size). Staging, product animations, transitions and sound are part B.
    - **Phase 4 part B, staging, animations on the product and sound placement: built 12 Nov 2026 (night), tested on Tulvo's boards take and a practice take.** `CaptureShot` (`engine/src/kit/capture/staging.tsx`) places a capture in twenty brand-neutral stagings (card; browser frame light or dark with the take's address; full screen; floating screen; isometric; laptop, monitor, tablet and phone that copy no company's device; a tall crop following the action; stacked windows; two or three takes side by side on one clock, marks aligned; picture in picture; grid; wall; before and after; mail; terminal), and each look stages itself. Eighteen animations on the product (`emphasis`: lift, isolate, fly out, focus pull, outline, underline, ring, sweep, magnifier, callout, arrow, connection line, step badges, typed again, toast pop, success moment, blur reveal, privacy blur) are placed by one function from the tracked rectangle through the picture's own camera, cut from the recording's pixels when they move or enlarge a thing, and draw no word or number the capture lacks; a take with no tracks can be given fixed `things`. `tools/audio/capture_sounds.mjs` places ten named sound slots from the event log into the job's `sfx.json` for `mix.py`, and lists missing slots instead of making any (Tulvo has none yet: all ten are missing). New checks: `tools/checks/capture_glue.mjs` (on a render, the real thing against its tracks and the drawn mark against the real thing) and `tools/film/seen_scroll.mjs` (where the picture really scrolled). Measured: outline within 1.4 px and lifted layer within 1.5 px of the real card in every frame through a camera move and two scrolls, after fixing two causes found on the way (late, uneven scroll pictures, and the decoder taking the frame before the one asked for). Frame lock: one take shown twice side by side differed by at most 1.4 grey levels (of 255) in every moving frame, against 4.6 on average and 11.1 at most with one side a frame late; before and after of one take, the movement either side of the line lined up best at zero frames (correlation 0.95, against 0.59 and 0.57 a frame either way); a light and a dark take aligned by marks landed their four marks 0, 0, 1 and 0 frames apart (28 to 30 frames apart unaligned; one mark could not be pinned and still landed a frame off); `smoothness.py` found no jumps the engine added in 46 previews (the three it flagged are Tulvo's own placeholders turning into cards). Found and not fixed (capture tool, out of scope): takes recorded out of sight without `--show` came out about 0.9 s short with typing and scrolls sped up in the picture. Not checked: the other sixteen animations measured on a render, previews watched frame by frame (contact sheet only, `library/motion/product-sheet.jpg`), dark products, phone-size takes, exploded view and phone notification (need capture-side layers), sound by ear, the 20 s Tulvo scene, transitions.
    - **Phase 5, transitions between captures: built 12 Nov 2026, tested on Tulvo's boards takes 1 and 2 (fixed copies, as the capture tool re-recorded the take meanwhile).** `CaptureJoin` (`engine/src/kit/capture/transitions.tsx`; the plan, pure and measured, is `joins.ts`) joins two takes, or two parts of one take split at the click that opens the next page, on one film clock, inside any staging, with twenty transitions: straight cut, match cut on the click's exact frame, snap cut, zoom through, shared element (the thing's own pixels fly and change size into its place), container grow, push and soft slide the way the pointer last moved, depth push, circle reveal from the click, card flip, stack shuffle, grid zoom (the other screens are stills of real marks), scroll relay (starts at the take's own scroll speed), cursor drag, whip, window split, device swap, blur dissolve and cross-dissolve. One pointer is carried across each join that passes through the click; the next shot starts on the last shot's camera view and eases out; dissolves ease both cameras out together so only what changed dissolves. Lengths come from the energy (scene token held to 600 to 900 ms; cuts one frame; whip and snap cut only in hype films, falling back to push and cut). Each look names its transitions (calm explainer: cross-dissolve and container grow; product demo: zoom through, match cut, push; launch: shared element, depth push, whip; tutorial: cuts and soft slides; social vertical: snap cut and whip; feature montage: grid zoom and stack shuffle; documentary: straight cuts; two people: window split). Measured: pointer jump at the hand-over 0.00 px (match cut), 0.13 px (zoom through), 0.01 px (shared element), the clicked thing 0.00, 0.00 and 0.08 px; take 1 into take 2 the same. `smoothness.py` on all 21 previews (20 joins and a take 1 into take 2 match cut): no jumps or judder anywhere, inside or outside the joins, after one fix (the grid zoom's edge screens popped out in one frame at its end; they now fade); `capture_motion.mjs` on both parts: click 125 ms after arrival, no pointer or camera jumps. Contact sheet: `library/motion/transition-sheet.jpg`. Not checked: a three-take sequence, frame-by-frame viewing, dark products, phone-size takes, a scroll relay on a take that scrolls, sound on the joins.
    - **Phase 3, your own Chrome and recording by showing: built 12 Nov 2026; tested in a throwaway Chrome profile only.** `--browser mine` (the default for `run`, `rehearse`, `dry` and `show`; `check` stays in the studio's window; a brand sets `"browser"` in its `capture.json`, the studio `"capture_browser"` in `studio.json`) drives the person's own Chrome through Microsoft's free Playwright Extension: `tools/capture/yourchrome.mjs` runs a small relay on 127.0.0.1 (extension protocol 2, the route Playwright MCP's `--extension` uses), Chrome is asked to open the extension's page, the person clicks "Allow & select" on any tab, and the tool opens a tab of its own beside it, drives only that tab and its pop-ups, and closes it at the end. The picked tab is never attached; nothing is read from the person's Chrome folder (the health check says how to check the extension is installed: `chrome://extensions` or `capture.mjs connect`). For the take the page is locked to 1920 x 1080 at double sharpness, a site zoom is made up for, things the person's extensions draw are hidden and named (a whole-page translation or recolouring stops the take), fields are set not to offer autofill, light or dark is set, and closing the tool's tab puts Chrome back. `capture.mjs show` records a person clicking through: clicks by words or labels (with `near` when two things share a name), final typed text, keys, ticks, lists, drags, scrolls, hovers that lasted, back, reload and typed addresses, marks on Control+M; it drops stray clicks, things opened and closed at once, pages opened and left, hovers before a click, repeats and scrolls that went nowhere, never reads a password or code field, saves the script (the old one kept as `.before-show`) and prints it. The picture feed now stays current in both browsers: a one-pixel nudge each frame while the page may be changing, identical pictures dropped, a Chrome setting that finishes drawing before each picture in the studio's window, and "settled" waits for loading skeletons to go.
    - Tested (Chrome 157, the extension built from Microsoft's source and loaded into a throwaway profile, a practice page): connect, run, rehearse, dry and show all worked through it; a 1280 x 860 window recorded the full page at 3840 x 2160 (found and fixed: Chrome sends window-sized pictures each time its feed starts until the size is set again); 110% zoom gave the same layout; a test extension's badge, picture, outside-the-body note and icons in fields were hidden and named; a translated page stopped the take; no answer stopped after `--wait` with plain steps; `show` turned 19 actions into a clean 10-step script and the password typed never reached the file or the terminal; it replayed. Picture lag on a practice page changing 20 times at known moments: before, 2 of 3 takes had stalls of 70 and 78 frames (1.2 to 1.3 s); after, 60 changes over 3 takes showed in a median of 1.2 to 1.6 frames, worst 3.1 frames (52 ms), and 1.8 median, worst 2.7 through the person's Chrome. Tulvo, studio window, look only: before, the real cards appeared 0.30 s after "settled"; after, 0.35 s in the kept take (take 2), and in 4 of 5 trial takes 0.22 to 0.36 s, right after the mark's still. With the clock running free (a trial copy of the script) the cards appeared 0.39 to 0.65 s before "settled" in 3 of 3, so on Tulvo the remaining delay comes with the frozen demo clock: the cards enter the page about 0.4 s after the click but are not drawn until the mark's still, while Chrome keeps sending a fresh picture every frame. `check` on the new take: no change at all three marks.
    - Not checked: a person's real Chrome with the extension from the Web Store, other Chrome versions, Windows or Linux, real Grammarly, password managers or ad blockers (only a test extension that draws the same kinds of things), a window on a second screen or covered mid-take, the person moving their mouse over the tab (it cannot be blocked: Chrome's block also stops the tool), single-page apps' back button and drags in `show`, Tulvo through the person's Chrome. Not met: a take through your Chrome is not frame for frame identical to one through the studio's window (same layout and words, about 0.6% of pixels differ at text edges), so `check` only compares takes from the same browser. Chrome does not let the extension set a page's language or time zone; those takes warn and point to `--browser studio`. The Tulvo delay under the frozen clock is not solved.
    - **Hidden-window timing, fixed 12 Nov 2026 (later).** The short, hurried hidden takes and the late Tulvo cards had one cause in how the video was put together, not in the clock or Chrome slowing a hidden page (Playwright already turns off its background throttling): out of sight, Chrome sends pictures out of drawing order and mostly at 1920 x 1080, switching to full size around each still, and taking them as they arrived, with ffmpeg rebuilding its filters at every size change, dropped pictures and pulled the rest early (one take 1 s short, a scroll's end up to 2 s late). Pictures are now put in drawing order and ffmpeg keeps its filters, so practice takes hidden and shown match to about two frames and Tulvo's cards are in the picture 0.86 s before "settled" (they were 0.35 s after); "settled" also now waits for plain grey placeholder bars and for the picture to follow them away, and hidden takes still come mostly at normal sharpness (use `--show` for full).
    - **Phase 6 part A, product kinds: built 12 Nov 2026, tested on local practice pages and a test extension only (Tulvo: one look-only dry run).** A brand's `capture.json` names its `"kind"` (web app, AI product, WordPress, shop, extension, phone web; desktop, phone app and command line say they come with part B), which fills clean-screen, wait, privacy and page-size defaults (`tools/capture/kinds.mjs`). AI answers are recorded once with Playwright's HAR recording (only the brand's answer addresses, never sign-in or token ones, every token, cookie and key removed) plus each streamed piece's arrival time, and replayed for retakes at the same pace (`answers.mjs`); a replay the product no longer matches is refused and a fresh answer recorded. New steps: `layer` (one thing as a see-through PNG with its position; the few pictures taken without the page's background are left out of the recording), `snapshot` (an area's HTML with only its own CSS, scoped to one class as `scope-css` did, rows and numbers tagged; `parts.mjs`), `as` (a second demo user's window with their own sign-in, `signin <brand> --as <role>`, recorded on one clock: two recordings and one `events.json`). Extensions load from a folder through Chrome's DevTools (Chrome 137 and later ignore `--load-extension`) and their popup or side panel is filmed as a page at its real size, marked in `capture.json`. Phone web runs at 390 x 844 with touch, no hover and a phone identity; taps and swipes are logged for the touch pointer. `capture.mjs email` turns a `.eml` file or a Mailpit message into a still and a scrolling recording with the privacy scan. Brands name `setup` and `tidy` scripts that run around every take (Tulvo's are look-only placeholders). Measured: a replayed answer had the same 14 pieces and words with arrival times within 10 ms, and the product's server was not asked again; a layer matched the page exactly inside the thing (mean difference 0.00) with 0% solid pixels outside it, and the recording did not change; a snapshot rendered on its own differed from the page by 0.76 of 255 on average; two users' windows changed on the same frame when a message was sent (4.117 s in both). Not checked: the engine showing two users side by side, layers or snapshots in a render, recording an answer in your own Chrome (the first take records in the studio's window), Mailpit itself (not installed), a real WordPress site, shop or Tulvo AI answer. Details: `CAPTURE-PLAN.md` section 11, phase 6.
    - **Phase 8, other sizes: built 12 Nov 2026, tested on Tulvo's boards take (and a phone-size stand-in cropped from it).** Only when asked, after the 16:9 master is approved (section 1): the same scene in a 9:16, 1:1 or 4:5 composition re-lays each staging for its frame and a follow camera (`engine/src/kit/capture/relayout.ts`) keeps the thing being acted on and the pointer inside the frame's safe area with a margin, trailing the pointer, one way per move, still on reading holds, never past the recording's sharpness. On 9:16 the safe area is what Instagram, TikTok and YouTube Shorts all leave free, captions sit at its bottom, and a preview-only overlay shows the three apps' buttons; the social vertical look is full bleed by default, the others have their own vertical version, a phone-size take fills the frame with the touch pointer. Measured on a full-size 9:16 render: thing and pointer inside on all 472 frames, the thing within 1.4 px of the plan in the picture, no camera jumps, all three platforms clear at key moments; the clicked label's words are 1.04% of frame height at the sharpest the recording allows, so small UI text in vertical stays under the 2.6% minimum (a phone-size take or a rebuilt screen is needed where it must be read). 16 library entries, contact sheet `library/motion/relayout-sheet.jpg`, check `tools/checks/capture_relayout.mjs`. Not checked: a real phone-size take, real-length captions in 9:16, earlier phases' 16:9 renders after the page-box fix, previews frame by frame (details in `CAPTURE-PLAN.md` section 11).
    - **Phase 6 part B, WordPress demo sites, desktop apps, phone apps and terminals: built 12 Nov 2026, tested on practice material only (Tulvo not recorded).** A brand with `product/blueprint.json` gets a throwaway WordPress site built by WordPress Playground (through npx) before Chrome opens and torn down after; its demo users are signed in from the site's own link, and the admin is cleaned (no update nags, welcome guides or "Howdy"); a brand may instead bring its own staging site, signed in by hand. Electron desktop apps are opened from their path and recorded like a page; command-line tools run for real and the studio draws the terminal itself (xterm.js, no VHS), logging every key; phone apps go through the iOS Simulator (with idb for taps) or the Android emulator. Proved on this Mac: a free plugin's settings page on a built site, a small Electron app (packaged and from source) and a 45 s terminal take, each with matching marks on `check`. Not runnable here: phone apps (no Xcode, idb or Android SDK; tested only against stand-ins, and the tool says what to install). Found and fixed: the assembler dropped pictures less than 40 ms apart in every take, web takes included. Details: `CAPTURE-PLAN.md` section 11, phase 6.
    - **Phase 7, checks and delivery: built 12 Nov 2026 (evening), tested on a practice page, Tulvo's boards take (check only) and the sample job.** `check` now compares each mark three ways: the picture, the words (as a set of labels, so a reshuffled row is not a change; it names renames such as "New lead" became "Add lead") and the layout (every named button, link, tab, field and heading, and the tracked things, saved with each mark in `marks/<mark>.layout.json`; anything moved or resized by more than 3 px is named with how far). `capture.mjs compare` does the same between two saved takes. Readable after zoom, captions clear of UI, flashes and the energy map are new checks (item 12). `tools/film/sources.mjs` is the proof of source in the delivery pack: every product shot with its capture, take, date, address and browser, failing on a shot with no source; it and `check` are steps of the delivery stage. Planted faults caught: a renamed label and a moved card on a practice page, a caption over the New button, a flashing clip, a scene planned calm but rendered busy, and a shot whose capture was removed. Not checked: layout for terminal and phone takes (they save none), a desktop app take (it goes through the same mark step, not run), things inside frames, a film rendered from shots.json captures (none exists yet), caption contrast.

### To make it shareable with other companies (added 11 Nov, night)
23. Keep the studio free of any one company: move Tulvo-only rules out of `knowledge/rules/starting-rules.md` into `brands/tulvo/rules.md` (for example rule 11, Tulvo's colours, and rule 15, how to say "Tulvo"); remove Tulvo from the skill files, the review page, the study card template and the edit playbook; give the engine package a neutral name. A check in the health report lists any brand's name found outside its own folders.
24. Reference videos are other companies' films and cannot be handed on. Share the measurements, study cards, craft notes and the links; each company downloads its own copies (yt-dlp) or adds its own (owner, 11 Nov). To build: a links-only reference list in the starter, and a step that downloads them on first setup.
25. A clean starter to hand over: the studio with the `_template` and `demo` brands only, no Tulvo folders, no jobs, no renders, no keys, no feedback or ledger. A script makes it from this folder, so Tulvo keeps working here. Each company gets it as its own private copy in its own GitHub (owner, 11 Nov), with the licence once a lawyer has looked at `LICENSE-DRAFT.md`.
26. Per company, its own accounts: ElevenLabs key, Remotion company licence above three people, its own GitHub repository. The installer and the health check say so in plain words.
27. Stage 0 for a company that is not Tulvo: also asks where its product lives, its demo account, its voice and pronunciations, and its own rejected colours and patterns. Test it once with a made-up company before handing over.

### Product discovery (added 11 Nov, night, owner)
28. Stage guide and template written 11 Nov (night): `stages/00b-product-discovery.md` and `templates/discovery.md`, and the skill routes to it when a brand has no approved discovery. Not yet run on any product. Before a company's first video, the studio runs a product discovery and saves it in `brands/<brand>/product/discovery/`: what the product does and for whom (the ideal customer, their jobs, pains and words), positioning and proof, pricing and plans, the key flows worth filming, competitors and how they show themselves, the brand's voice, what must never be shown, and where the demo environment is (one the studio builds, or the company's own). It is a new part of stage 0, guided by questions and the company's own material, and every later stage reads it.
29. For Tulvo: run the discovery and package it, with the brand, the capture recipe and a starter set of capture scripts, as the hand-over for the Tulvo team. Existing material to start from: `brands/tulvo/brand.md`, `brands/tulvo/product/`, the Black Friday film's research, and `tulvo-phase2-positioning-report.pdf` in the Marketer folder.
30. For other companies: the hand-over says what to do next for each product: run the discovery first, then a first video.

### Decisions made by the owner (sharing, 11 Nov night)
- Each company gets the clean starter (item 25) as its own private copy in its own GitHub. Tulvo's folder stays here and keeps working.
- They may use and change it for their own business, but not resell it or pass it on. Draft licence in `LICENSE-DRAFT.md`; it needs a legal look before anything is handed over.
- They get our study cards, craft notes and the list of reference links, not the reference video files; each company downloads its own copies.

### Decisions made by the owner, 11 Nov 2026 (evening)
- Backgrounds may drift slowly enough to read as rest, so a film can be still about a quarter of the time. Written into `craft/00-principles.md` and starting rule 7.
- Tulvo gets one short sound on the closing logo, made once with ElevenLabs and reused in every film. Made 12 Nov with the owner's yes, together with the ten-sound kit for captures: `brands/tulvo/sounds/` (not yet listened to).
- No live-action lane for now: real product screens and graphics only (starting rule 23).
- Pure white is Tulvo's default light page, like tulvo.io (white and #FAFAFA, checked 11 Nov). Warm paper stays for social posts only.
- Performance numbers are typed into each video's ledger entry by hand for now (hold rate, click rate, from Meta Ads Manager or YouTube Studio). Automate later.
- Study cards: launch films, ads and the promo first; the 31 social clips stay measured only.
- Product screens: changed later the same night. Screens are captured fresh for each video with the capture tool (item 22, `CAPTURE-PLAN.md`); the rebuilt kit is a pattern library only.
- The unsent draft note on the review page stays as it is.

### Footage editing, first real edit (13 Nov 2026)
The Product Hunt launch reel (`jobs/ph-launch-reel/`) was built from 43 raw clips in one session, ahead of the footage plan's phases 2 to 8, in the simple form that video needed: picks by measurement (`edit/listen/`), DeepFilterNet voice cleaning and a joined dialogue with room tone (`edit/assemble.py`), MediaPipe face tracks (`tools/footage/py/faces.py`), skin-matched plates (`tools/footage/py/plates.py`), Robust Video Matting cutouts (`tools/footage/py/matte.py`), and the engine's `kit/footage/footage.tsx` (a shot with a face-anchored camera and a layer behind the person). Models live in `tools/footage/models/`, downloaded per Mac and kept out of git. Not yet folded into `footage.mjs`; the phase 2 paper-edit tool from the other session was left untouched.

### Housekeeping
- `engine/out/` holds test renders that can be deleted.
- About 60 browser snapshot files were left in `Desktop/Marketer/.playwright-mcp` by a helper.
