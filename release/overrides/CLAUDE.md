# Video Studio

This folder makes videos for any brand set up in `brands/`: promos, feature demos, tutorials and edits of raw footage.

- **Not set up yet?** If `engine/node_modules` is missing, or the person says "start the studio", run the start step and stay with it until it finishes: `bash setup/start.sh` on a Mac or Linux, `powershell -ExecutionPolicy Bypass -File setup\start.ps1` on Windows. It puts back hidden files a copy may have dropped, installs the core and runs a quick check. Then tell the person to start a new chat in this folder, so the studio's skills load.
- **Node:** if `node` is not found, use the studio's own copy by putting `.runtime/node/bin` (Windows: `.runtime\node`) first on PATH for the command.
- **Updates** come as a new zip. In the new folder, run the start step with `--import-from <old studio folder>`: it copies the person's brands, videos, `.env` and product sign-ins, and never overwrites anything.
- For any video or brand work, load the `video-studio` skill and follow it. It reads `jobs/<job>/job.json` to find the brand and the current stage.
- `/video-menu` shows what you can do: start a video, browse presets or components, resume a job, set up a brand. When someone's first message has no clear task, offer it. Skip it when they give a complete brief or name a job to resume.
- This session leads. It makes the creative decisions and does the integration. Bounded work goes to the helpers in `.claude/agents/`, following `.claude/skills/video-studio/conductor.md`: at most two helpers at a time, and the model the person chose stays the lead.
- Approvals: guided (one per stage, the default) or grouped (a brief review and a final cut review), as the person prefers. Record each one with `node tools/conductor/gate.mjs approve`; approvals already given for unchanged inputs are not asked again after a restart.
- Run the studio's own tools (`node tools/...`) as one plain command each, with the job path written out. No `J=...` variables, `&&` chains or pipes, so they run without a permission prompt.
- **"Open my brief page"** opens the brief page, a page where the person writes the video they want. The first chat after setup publishes it. If the app asks to approve the "damex-engine" connector, the person should say yes, because the brief page uses it.
- The brief page also holds the **style library**: more than 500 filming, motion, animation, product-screen and sound styles, each with a short preview, that the person can pick for their video, plus a director's brief. Stage 1 uses what they picked (see the `video-studio` skill).
- A new team starts at stage 0, "set up a brand".
- Optional tools (transcription, noise removal, mastering, footage) are not installed up front. When a step needs one, `node setup/runtime/install.mjs --with <capability>` prints the commands for this computer; `node setup/runtime/doctor.mjs` says what is ready.
- Keys live in `.env` (never synced). Renders live in `jobs/*/out/` (never synced).
- Write for marketers: plain words, no file dumps, say what was and was not checked.
