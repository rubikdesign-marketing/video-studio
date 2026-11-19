---
name: video-menu
description: The front door of the video studio. Use it at the start of a session, or when the user says "video menu", "what can you make", "show me the options", wants to browse presets, components, motion, backgrounds, sounds or hooks, or names a job to resume or pastes a full brief.
argument-hint: "[job name or a full brief]"
---

# Video menu

Argument: `$ARGUMENTS`. Decide which of the three cases applies, in this order. Keep every message in plain words for a marketer.

## 1. The argument names an existing job: resume it, no menu

A job exists when `jobs/<argument>/job.json` exists (also accept `jobs/<argument>`).
1. Read `jobs/<job>/job.json`: it names the brand, the type and the next stage.
2. If `tools/conductor/` exists, run `node tools/conductor/dispatch.mjs resume jobs/<job>` (it marks interrupted helper work as preserved and names the next step), then `node tools/conductor/gate.mjs status jobs/<job>`.
3. Continue at the first gate that is not satisfied. Read only that stage's file from the `video-studio` skill's stage table, and follow the skill from there.

## 2. The argument is a full brief: skip the menu if nothing is open

A full brief is more than one sentence of description (what, for whom, where it runs) and is not a job name.
1. Pick a job folder name: `jobs/<today's date>-<two or three words from the brief>`.
2. Run `node tools/plan/brief.mjs new jobs/<name> "<the brief, in the creator's words>"`.
3. Run `node tools/plan/brief.mjs check jobs/<name>`.
4. No open questions: start stage 1 of the `video-studio` skill at once. Open questions (at most three): ask them with AskUserQuestion, record each answer with `node tools/plan/brief.mjs set jobs/<name> <field> "<value>"` (or `decide` for anything that is not one of its fields), then start.

## 3. Otherwise: show the menu once

Ask ONE AskUserQuestion with these 4 options:
- **Start a new video**: ask for the type (promo, demo, tutorial, edit) and a sentence on what it is for, then go to case 2 with that text.
- **Browse presets and components**: ask one follow-up AskUserQuestion with 4 options: presets; components; motion and backgrounds; sounds and hooks. Then browse as below.
- **Resume a job**: list up to 4 recent jobs, newest first, skipping names that start with an underscore: `ls -t jobs/*/job.json | head -8`. Show each as name, brand and next stage from its job.json. The pick goes to case 1.
- **Set up a brand**: start stage 0 of the `video-studio` skill.

### When AskUserQuestion is not available

Print mode, or a surface without it: print this list and wait for a number.
```
What would you like to do?
1. Start a new video
2. Browse presets
3. Browse components
4. Resume a job
5. Set up a brand
```
For 2 and 3 browse as below; if the user asks for motion, backgrounds, sounds or hooks, use those kinds. For 4, print up to 4 recent jobs as a numbered list.

## Browsing

Browse ONLY with the registry tool. Never read `library/registry.json` or a catalog whole.
- `node tools/library/registry.mjs kinds`: the count per kind, with example ids. Show it first.
- `node tools/library/registry.mjs find <words> [--kind preset|workflow|motion|background|hook|sound|reference|component] [--tag t] [--customer]`: at most 5 one-line results.
- `node tools/library/registry.mjs get <id>`: the full entry for the one the user picked.

Kinds for each choice: presets: `preset`, `workflow`; components: `component`; motion and backgrounds: `motion`, `background`; sounds and hooks: `sound`, `hook`.
Ask what the user wants in a few words, run `find`, show the lines, and offer to `get` one or search again. Say what you did not look at.
