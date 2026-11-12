# Prompt for the next session

Open the folder `video-studio` in the Claude desktop app (Code tab), start a new chat there, and paste everything below the line.

---

You are continuing the build of the Video Studio in this folder: a reusable system that makes high-quality videos (promos, feature demos, tutorials, edits of raw footage) for any brand, one video at a time, with human approval at six steps. It was built on 11 Nov 2026 and is mostly complete but has never produced a real video. On the evening of 11 Nov I decided: build the system first, no test runs yet. My answers to the open decisions are recorded in section 14.

Read these first, and nothing else until you need it:
1. `CLAUDE.md`
2. `DESIGN.md`, section 1 (what was agreed), section 11 (build status) and section 14 (what remains). Section 14 is the to-do list; tick items off there as you finish them.
3. `.claude/skills/video-studio/SKILL.md`

What exists and works: a brand-neutral Remotion engine (brands live in `brands/`, Tulvo is set up, `demo` is a test brand); 12 animated backgrounds and 26 reviewed animations in `library/`; tools for voice, music, effects, mix, mastering, captions, shot list to scenes, storyboard frames, and four checks; a review page where notes pinned to moments wake a waiting session; moodboard and storyboard on a design canvas; a one-step installer and a health check (`bash setup/doctor.sh --quick`).

Do this, in order:
1. Run the health check.
2. Build the capture tool, section 14 item 22. Screens are captured fresh for each video, not kept as a standing copy, because products change every week. The tool must work for any company's web product, not only Tulvo: the studio will be shared with other companies (section 14, "To make it shareable"). Plan it with me first in plain words, then build it with a helper. Test it on Tulvo: the in-app browser pane is signed in to app.tulvo.io in the Kestrel Studio demo workspace (ask me to sign in if it is not). Never copy real names or e-mails from the app into the studio. Do not film the "Client mix" chart on Kestrel's home page.
3. Then keep working down section 14 from item 10 (and the new items 23 to 27, which make the studio shareable), skipping the items under "To prove the system works" until I say so, and asking me before anything that is a decision of mine.

How I want you to work:
- Grill me in rounds when a decision is mine: number the questions, give your recommended answer to each, and word them so "yes" accepts it. Look up facts yourself.
- Plain words. I am a marketer, not a coder. Say what was checked and what was not. You cannot hear audio or watch at speed; say so when it matters.
- My standing rules for Tulvo videos and for anything you show me: no coding-style typeface, no dots as separators or in pills or backgrounds, wording that sounds like a person and never like a machine, real product screens only, sentence case.
- One stage per session where you can; start each stage fresh from the job file. Use helper agents for self-contained pieces, one at a time, and give each only the files it needs. Keep credit use low.
- Rendering cannot start inside the command sandbox: run render commands outside it, and never two at once (the tools use a lock at `engine/out/.render.lock`).
- The ElevenLabs key is in `.env`. Ask me before the first paid call of the session.
- The review page is the preview server named `tulvo-review`. There is one unsent draft note of mine on the sample film; leave it.
- Do not put anything on GitHub or share any canvas until I say so.

Still needed from me, ask when you reach them: my answers to the three sharing decisions at the end of section 14, an empty private GitHub repository and a GitHub sign-in, the Remotion company licence, more reference video links, and the go-ahead for the paid call that makes the closing logo sound.
