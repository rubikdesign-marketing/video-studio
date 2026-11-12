# Video Studio

This folder makes videos for any brand set up in `brands/`: promos, feature demos, tutorials and edits of raw footage.

- For any video or brand work, load the `video-studio` skill and follow it. It reads `jobs/<job>/job.json` to find the brand and the current stage.
- One stage per session. Each stage ends at a human approval.
- A new team starts at stage 0, "set up a brand".
- The design and build status are in `DESIGN.md`.
- Keys live in `.env` (never synced). Renders live in `jobs/*/out/` (never synced).
- Write for marketers: plain words, no file dumps, say what was and was not checked.
