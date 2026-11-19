# Damex Video Engine

Your own video studio, run by Claude on your Mac, Windows PC or Linux PC. Describe the video you want, approve each step, and get a finished film in your brand. Formats: product demos made from your real screens, launch reels, kinetic-type reels, and edits of your own footage.

Made and supported by Damex Digital. See `LICENSE.md` for what your licence allows.

## Start here

Follow `ONBOARDING.md`. You paste one prompt into the Claude desktop app's Code tab, and Claude installs everything and runs a health check. Then open this folder in Claude and type **/video-menu**: it starts a video, browses presets and components, resumes a job or sets up your brand. You can also just say **"set up my brand"**, then **"make a video"**.

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

While your update plan is active, say **"update the studio"** in this folder to get the latest version. If you stop the plan, you keep the version you have.

## Never in this folder

Keys (`.env`), product sign-ins (`.capture/`), renders and recordings (`jobs/*/out/` and similar) stay on your computer. `.gitignore` keeps them out of the folder's history.

## What you need, and other licences

- A Mac (Apple silicon or Intel), a Windows 10 or 11 PC, or a Linux PC, with a Claude plan that includes Claude Code, Node.js 22 (22.13 or newer) and Google Chrome. Some optional features are system-specific. Phone recording from the iOS Simulator needs a Mac with Xcode, and terminal recording needs a Mac or Linux. On other systems, record yourself and import the recording.
- **Bundled tools:** DeepFilterNet (noise removal, MIT or Apache 2.0) is downloaded per system when you first need it.
- **Remotion** is free for individuals and companies of up to 3 people. Larger companies need a Remotion company licence ("Remotion for Creators", per person who makes videos): remotion.dev/license.
- **Optional:** an ElevenLabs plan for generated voice, music and sound effects. A Kling account for generated footage.
- Fonts are under their own licences, noted in each brand's `brand.md`. Bundled third-party skills keep their own licence files (`.claude/skills/THIRD-PARTY.md`). Reference films belong to the companies that made them and are not included. Only our study notes are.
