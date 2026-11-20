# Video Studio

This folder makes videos for any brand set up in `brands/`: promos, feature demos, tutorials and edits of raw footage.

- For any video or brand work, load the `video-studio` skill and follow it. It reads `jobs/<job>/job.json` to find the brand and the current stage.
- `/video-menu` shows what you can do: start a video, browse presets or components, resume a job, set up a brand. When someone's first message has no clear task, offer it. Skip it when they give a complete brief or name a job to resume.
- This session leads. It makes the creative decisions and does the integration. Bounded work goes to the helpers in `.claude/agents/`, following `.claude/skills/video-studio/conductor.md`: at most two helpers at a time, and the model the person chose stays the lead.
- Approvals: guided (one per stage, the default) or grouped (a brief review and a final cut review), as the person prefers. Record each one with `node tools/conductor/gate.mjs approve`; approvals already given for unchanged inputs are not asked again after a restart.
- Run the studio's own tools (`node tools/...`) as one plain command each, with the job path written out. No `J=...` variables, `&&` chains or pipes, so they run without a permission prompt.
- A new team starts at stage 0, "set up a brand".
- The design and build status are in `DESIGN.md` in the studio's own copy, or `README.md` and `RELEASE.json` in a customer install.
- Keys live in `.env` (never synced). Renders live in `jobs/*/out/` (never synced).
- Write for marketers: plain words, no file dumps, say what was and was not checked.
