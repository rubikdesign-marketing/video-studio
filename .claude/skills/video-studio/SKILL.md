---
name: video-studio
description: Make a video (promo, feature demo, tutorial, or an edit of raw footage) for any brand set up in this folder, through a step-by-step production line with human approval at each step. Use whenever someone in this folder asks to make, plan, script, storyboard, animate, review or revise a video, to set up or change a brand (logo, colours, fonts, voice, style), to study a reference video, or to record something learned about a product.
---

# Video Studio

One video at a time, six approvals, each a save point. Works for any brand in `brands/`. Read only what the current stage needs.

## Start of every session

1. If a job is in progress, read `jobs/<job>/job.json`. It names the brand and the next stage. If there is no job, start at stage 1. If the brand is not set up yet, start at stage 0. If the brand has no approved `brands/<brand>/product/discovery.md` and the video shows its product, run stage 0B first.
2. Read the one stage file for that stage. Do not read the others.
3. At the end of the stage, write the outputs, update `job.json`, give the hand-over note, and stop for approval. The next stage starts in a fresh session.

## Stages

| # | Stage | Stage file | Approval |
|---|---|---|---|
| 0 | Set up a brand (once per brand) | `stages/00-brand-setup.md` | Brand sheet |
| 0B | Product discovery (once per product, before its first video) | `stages/00b-product-discovery.md` | Discovery |
| 1 | Intake and idea | `stages/01-intake-and-idea.md` | Idea |
| 2 | Script and voice | `stages/02-script-and-voice.md` | Script and voice read |
| 3 | Moodboard | `stages/03-moodboard.md` | Moodboard |
| 4 | Storyboard | `stages/04-storyboard.md` | Storyboard |
| 5–6 | First and full animation | `stages/05-animation.md` | First animation, then full animation |
| 7 | Delivery and learning | `stages/06-delivery-and-learning.md` | — |

## Always true

- Everything that belongs to a brand lives in `brands/<brand>/`: colours, fonts, logo, voices, pronunciation, its own rules, what is known about its product, its ledger of finished videos and its lessons. `studio.json` names the default brand.
- Fixed across a brand's videos: logo, typeface, caption style. Everything else is decided per video.
- Colours, fonts and logos come only from `brands/<brand>/brand.json`. Nothing is hard-coded in a scene.
- The studio's rules in `knowledge/rules/` apply to every brand unless that brand's `rules.md` says otherwise.
- Only real product UI, captured from the real product, with data that matches the voice. Never invent a screen.
- The picture is fitted to the voice. The voice is never stretched or sliced.
- The length cap is agreed at the idea stage and is binding.
- Each video differs from the brand's last five in its ledger and adds one new move to `library/`.
- Nothing from a reference video is placed in a finished video.
- No cut goes to a person until the checks in `knowledge/craft/08-directors-checks.md` have run. Failures are listed, not hidden.
- Say plainly what was not checked. Claude has not watched the film at speed and cannot hear it.
- Third-party logos need a person's confirmation before they appear.

## Where things are

| Need | Read |
|---|---|
| Principles every video follows | `knowledge/craft/00-principles.md` |
| A brand's colours, fonts, logo and how to use them | `brands/<brand>/brand.md`, `brand.json` |
| A brand's voices, pronunciation and own rules | `brands/<brand>/voices.json`, `pronunciation.md`, `rules.md` |
| What is known about a brand's product, who it is for, and its key flows | `brands/<brand>/product/discovery.md`, then the rest of `brands/<brand>/product/` |
| Capturing the product (filming recipe, capture scripts, takes) | `tools/capture/README.md`, `brands/<brand>/product/capture.json`, `CAPTURE-PLAN.md` |
| Design styles | `knowledge/craft/13-design-styles.md` |
| Direction and energy | `knowledge/craft/01-direction.md` |
| Motion tokens and presets; advanced techniques | `knowledge/craft/02-motion.md`, `09-advanced-motion.md` |
| Transitions | `knowledge/craft/03-transitions.md` |
| Type and captions | `knowledge/craft/04-type-and-captions.md` |
| Product UI on screen; flows | `knowledge/craft/05-ui-choreography.md`, `10-flows.md` |
| Charts, numbers, dashboards | `knowledge/craft/11-data-visualisation.md` |
| Light and finish; quality of each frame | `knowledge/craft/06-light-and-finish.md`, `12-frame-quality.md` |
| Sound | `knowledge/craft/07-sound.md` |
| Checks before an approval | `knowledge/craft/08-directors-checks.md` |
| Shape and rules per video type | `knowledge/playbooks/<type>.md` |
| Reference films, study cards, measurements | `library/references/index.json` |
| Backgrounds and animations ready to use | `library/` and `engine/README.md` |
| Studio rules and pending lessons | `knowledge/rules/`, `brands/<brand>/lessons/` |
| Templates | `templates/` |
| Tools | `tools/` (each prints its usage when run with no arguments) |

Read one craft file at a time, only when the stage file names it.

## Skills the studio uses

75 other skills are bundled in `.claude/skills/`, and five plugins are declared in `.claude/settings.json` (Superpowers, claude-mem, Matt Pocock's skills and Ponytail on; ECC off). Many overlap. **Before starting any task, read `skill-map.md` (in this folder)**: it names, for each task, the skill that leads, the sub-guides to read for each video type and craft topic, the ones that support it, and the ones not to use, and how conflicts are settled. Load a skill with the Skill tool when its task starts; one or two per task, never all.

The short version:

| Stage or task | Leads |
|---|---|
| Ideas, scripts and on-screen words | the stage guide; `zero-slop` as the last pass on every line a viewer reads or hears; `ugc-ad-scripts` for creator ads |
| Look of frames (moodboard, storyboard, end cards) | `impeccable`; `hallmark` and `impeccable` critique before a person sees it |
| Motion | `knowledge/craft/14-motion-systems.md` (shot sizes, choreography, restraint, rhythm, anti-slide); `bang-motion` for its techniques; `motion-design`, `motion-foundations`; `motionmaxxing` curves and studies for feel |
| Hearing anything (Claude cannot hear) | `earshot` through `tools/audio/listen.mjs`: never say how something sounds without its number |
| Placing and finding sounds | the studio's sound tools; `real-sfx` for placement by a sound's attack; `tools/media/openverse.mjs` and `real-sound` for real recorded sounds with their licences |
| Scene code | `remotion-best-practices`; `hyperframes` for what Remotion handles poorly |
| Jumps and judder | `fixing-motion-performance` |
| Paid ads around a video | `advertising-kickoff` (it routes the ad skills) |
| Changing the studio's own tools | Superpowers (brainstorming, plans, debugging, verification) |

Studio and brand rules always win over a bundled skill. After every video, log the skills used in `job.json` (`skills_used`) and follow "Keeping the skills sharp" in `skill-map.md`.

## Other requests

- **"Set up our brand" or "change our colours, logo, fonts"**: stage 0.
- **"Study this video"**: copy it into `library/references/<brand>/` with a clear name, run `tools/study/profile.py`, then fill `templates/study-card.md` using `tools/study/sheets.sh`. Add it to `index.json`.
- **"Learn this product update"**: walk the feature in the product, compare with `brands/<brand>/product/`, record what changed with the date and a screenshot.
- **Review notes on a cut**: they arrive from the review page (`stages/05-animation.md`, "Review notes").

## Next episode in a saved style

When a brand has an approved film the creator wants more of, save its style once: `node tools/plan/style.mjs save jobs/<job> --name <style>`. A new episode then starts from it: `node tools/plan/style.mjs new jobs/<date>-<name> --style <brand>/<style> "<their words>"`. The size, cuts, kind, voice, energy, stage, scene structure, scene code, sound recipe, references and corrections already verified are settled; idea, moodboard and look approvals are skipped. Ask only what `brief.mjs check` lists, fill the words, then storyboard and animation as usual. Platform cuts from an approved master: `tools/footage/.venv/bin/python tools/film/cut.py <master> 4:5 <out>`, which refuses when a crop would lose anything on screen.

## Time and money per job

Every render, storyboard and master writes its time to `jobs/<job>/runs.jsonl`; every paid generation goes through `.generations/ledger.json` (`node tools/film/kling.mjs ledger`), which never pays twice for the same request. `node tools/film/costs.mjs jobs/<job>` shows both, apart from AI tokens and approval waits. When the app shows a session's token use, add it: `node tools/film/lib/runlog.mjs add jobs/<job> tool=ai stage=<stage> input_tokens=... cached_input_tokens=... output_tokens=...`. Never estimate a number that was not recorded.

## Keeping usage low

Every video follows "The token plan, for every video" in `skill-map.md`: one stage per session; helper roles from `.claude/agents/` on the right model (`checker` on the cheapest; `scene-builder`, `capture-runner`, `frame-critic`, `reference-studier`, `researcher` on the middle one); Ponytail on; skills and sub-guides loaded narrowly; scripts measure and you read their summaries and contact sheets; half-size renders until the master; usage logged per stage in `job.json`.

## Rendering

The render browser cannot start inside the command sandbox. A render command must be allowed to run outside it.

## Build status

See `DESIGN.md`, section 11, for what is built, tested and still to come.
