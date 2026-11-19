# Video Studio

This folder makes videos for any brand set up in `brands/`: promos, feature demos, tutorials and edits of raw footage.

- **Not set up yet?** If `engine/node_modules` is missing, or the person says "start the studio", run the start step and stay with it until it finishes: `bash setup/start.sh` on a Mac or Linux, `powershell -ExecutionPolicy Bypass -File setup\start.ps1` on Windows. It puts back hidden files a copy may have dropped, installs the core and runs a quick check. Then tell the person to start a new chat in this folder, so the studio's skills load.
- **Node:** if `node` is not found, use the studio's own copy by putting `.runtime/node/bin` (Windows: `.runtime\node`) first on PATH for the command.
- **Updates** come as a new zip. In the new folder, run the start step with `--import-from <old studio folder>`: it copies the person's brands, videos, `.env` and product sign-ins, and never overwrites anything.
- For any video or brand work, load the `video-studio` skill and follow it. It reads `jobs/<job>/job.json` to find the brand and the current stage.
- One stage per session. Each stage ends at a human approval.
- A new team starts at stage 0, "set up a brand".
- Optional tools (transcription, noise removal, mastering, footage) are not installed up front. When a step needs one, `node setup/runtime/install.mjs --with <capability>` prints the commands for this computer; `node setup/runtime/doctor.mjs` says what is ready.
- Keys live in `.env` (never synced). Renders live in `jobs/*/out/` (never synced).
- Write for marketers: plain words, no file dumps, say what was and was not checked.
