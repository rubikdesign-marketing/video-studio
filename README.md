# Video Studio

Makes high-quality product videos (promos, feature demos, tutorials, edits of raw footage) for any brand set up in `brands/`, one video at a time, with a person's approval at every step. Built with Claude Code, Remotion and ffmpeg. Tulvo is the first brand.

Shared openly so the team can set it up in one step. See `LICENSE.md` before using it for your own business.

## Start here

Follow `ONBOARDING.md`: paste one prompt into the Claude desktop app's Code tab, and Claude downloads the studio, installs everything and runs the health check. Then open the `video-studio` folder in Claude and say **"make a video"**.

## What is where

| Folder | What |
|---|---|
| `brands/` | Each brand: logo, colours, fonts, voices, rules, product knowledge, discovery, finished videos and lessons |
| `jobs/` | One folder per video |
| `engine/` | The Remotion video engine (brand-neutral) |
| `library/` | Backgrounds, animations and reference films with their measurements |
| `knowledge/` | Craft guides, playbooks and the studio's rules |
| `tools/` | Voice, music, mix, captions, capture, checks |
| `studio/` | The review page |
| `.claude/skills/video-studio/` | The skill Claude follows, one stage file per step |
| `DESIGN.md` | How the studio works, what is built, and what is left (section 14) |
| `CAPTURE-PLAN.md` | The plan for the product capture tool |
| `FOOTAGE-PLAN.md` | The plan for editing raw footage: transcript editing, face tracking, clean-up |

## Never in this repository

Keys (`.env`), product sign-ins (`.capture/`), renders and recordings (`jobs/*/out/` and similar), installed packages, other companies' reference films, and Remotion's skills (fetched at setup). `.gitignore` keeps them out; check before adding anything large or private.

## Working together

- Say "update the studio" in the folder to get the latest version.
- Changes to the studio itself (rules, tools, engine, skills) go in their own commits, with a line in `DESIGN.md` section 14.

## Selling it: the Damex Video Engine

The white-label version sold by Damex Digital ships as **one zip** for Mac, Windows and Linux, from 0.1.0-rc4 on (19 Nov 2026). Buyers unzip it, open the folder in Claude and say "start the studio", and it is ready in under a minute. How to ship a version, test it and send it: `tools/release/README.md`.

## Licences

Remotion is free for individuals and companies of up to three people; larger companies need a Remotion company licence. ElevenLabs needs its own paid plan. Fonts are under their own licences, noted in each brand's `brand.md`. The reference films belong to the companies that made them and are not in this repository.
