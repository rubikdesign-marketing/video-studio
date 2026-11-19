# Damex Video Engine

Your own video studio, run by Claude on your Mac, Windows PC or Linux PC. Describe the video you want, approve each step, and get a finished film in your brand. Formats: product demos made from your real screens, launch reels, kinetic-type reels, and edits of your own footage.

Made and supported by Damex Digital. See `LICENSE.md` for what your licence allows.

## Start here

Follow `ONBOARDING.md`. Open this folder in the Claude desktop app's Code tab and say **"start the studio"** (or run `bash setup/start.sh` on a Mac or Linux, `powershell -ExecutionPolicy Bypass -File setup\start.ps1` on Windows). It takes about 2 minutes. Then start a new chat in this folder and say **"set up my brand"**, then **"make a video"**.

`setup/dotfiles/` holds the studio's hidden files (`.claude` and others) under visible names, so a copy or sync cannot lose them. The start step puts them back.

## What is where

| Folder | What |
|---|---|
| `brands/` | Your brands: logo, colours, fonts, voices, rules and product notes. `demo` is a test brand. `_template` is the starting point for yours |
| `jobs/` | One folder per video. `_sample` is a tiny test film |
| `engine/` | The video engine, built on Remotion |
| `library/` | Backgrounds, motion moves, sounds, hooks and study notes on reference films |
| `knowledge/` | Craft guides, playbooks and the studio's rules |
| `tools/` | Voice, music, mix, captions, capture and quality checks |
| `studio/` | The review page where you pin notes to moments in a film |
| `.claude/skills/video-studio/` | The skill Claude follows, one file per step |

## Updates

While your update plan is active, we email you a link to each new version. Unzip it next to this folder, open the new folder in Claude and say **"start the studio and bring my work from <this folder>"**. Your brands, videos, key and product sign-ins come across; this folder stays as it is. If you stop the plan, you keep the version you have.

## Never in this folder

Keys (`.env`), product sign-ins (`.capture/`), renders and recordings (`jobs/*/out/` and similar) stay on your computer. `.gitignore` keeps them out of the folder's history.

## What you need, and other licences

- A Mac (Apple silicon or Intel), a Windows 10 or 11 PC, or a Linux PC, with a Claude plan that includes Claude Code and Google Chrome. Node.js 22.13 or newer is used if you have it; if not, the start step downloads a portable copy into `.runtime/node` (no admin). Some optional features are system-specific. Phone recording from the iOS Simulator needs a Mac with Xcode, and terminal recording needs a Mac or Linux. On other systems, record yourself and import the recording.
- **Bundled tools:** DeepFilterNet (noise removal, MIT or Apache 2.0) is downloaded per system when you first need it.
- **Remotion** is free for individuals and companies of up to 3 people. Larger companies need a Remotion company licence ("Remotion for Creators", per person who makes videos): remotion.dev/license.
- **Optional:** an ElevenLabs plan for generated voice, music and sound effects. A Kling account for generated footage.
- Fonts are under their own licences, noted in each brand's `brand.md`. Bundled third-party skills keep their own licence files (`.claude/skills/THIRD-PARTY.md`). Reference films belong to the companies that made them and are not included. Only our study notes are.
