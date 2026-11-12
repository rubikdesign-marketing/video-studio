# Welcome to the Video Studio

The Video Studio makes product videos (promos, feature demos, tutorials, edits of raw footage) with Claude, one video at a time, to the same standard every time. You stay in charge: Claude stops for your approval at six steps, and nothing goes out until you say so.

This guide gets you set up in about 20 minutes and shows how we keep improving the studio together.

## 1. Set up (once, one step)

You need a Mac with the Claude desktop app and Google Chrome.

1. Open the Claude desktop app, choose the **Code** tab, open any folder (your Documents folder is fine), and paste this:

   ```text
   Set up the Video Studio for me. Download https://github.com/rubikdesign-marketing/video-studio into ~/Documents/video-studio (if it is already there, get the latest version instead). Then run "bash setup/install.sh" in that folder and stay with it until it finishes. Ask me before installing anything that needs my Mac password. Fix anything the health check says needs attention, then tell me in plain words what is ready and what I still have to do.
   ```

2. When it is done, **add the folder to Claude**: in the Code tab, open the folder `Documents/video-studio`. When Claude asks whether to trust it and install its plugins (Superpowers, claude-mem, Matt Pocock's skills, Ponytail), say yes. From now on, always work in this folder.

3. **Add the ElevenLabs key** (the owner gives it to you privately). Open Terminal, then paste these two lines one after the other. The second asks for the key without showing it and keeps it on your Mac only:

   ```bash
   cd ~/Documents/video-studio
   ```

   ```bash
   read -rs "KEY?Paste the ElevenLabs key, then press Return: " && printf 'ELEVENLABS_API_KEY=%s\n' "$KEY" > .env && chmod 600 .env && unset KEY && echo "Saved."
   ```

4. **Product sign-in for filming:** in the studio folder, say "sign in to Tulvo for capture" and sign in yourself in the Chrome window that opens. To record in your everyday Chrome instead, install Microsoft's free Playwright Extension in Chrome once.

5. **Reference films** (optional): ask the owner for the team's private folder of reference films and copy it into `library/references/`. Everything works without them except re-measuring a film.

Never put keys, passwords or sign-ins in a chat or a file. The studio never asks for them.

## 2. Make a video

Say **"make a video"** (or "make a feature demo about ..."). Claude walks you through six approvals, one per session:

| Step | You approve |
|---|---|
| 1 Idea | The hook, the length, the audience |
| 2 Script and voice | The words and how the voice reads them |
| 3 Moodboard | The look |
| 4 Storyboard | Every shot, and the product flows to film |
| 5 First animation | One scene at full quality |
| 6 Full animation | The whole film, then delivery |

- **One step per session.** When a step is approved, start a new chat in the folder and say "continue the video". This keeps it fast and cheap.
- **Review notes:** the review page lets you pause the film, pin a note to a moment, and send. Claude picks the notes up and changes only those scenes.
- **New company or product:** Claude sets up the brand first (stage 0), then researches the product, its customers and its key flows (stage 0B), before any video.

## 3. What makes the videos good

- **Real product screens only.** Claude films the real product with a scripted, smooth cursor, fresh for each video, then animates it: zooms, highlights glued to real buttons, transitions, vertical versions. Nothing is invented.
- **Skills for every task.** About 70 specialist skills are built in (Remotion, HyperFrames, motion design, design critique, writing, ads). `.claude/skills/video-studio/skill-map.md` says which one leads each task, so the same task always goes the same way.
- **Checks before you see anything:** smoothness, frame quality, wording, privacy, and a design critique.
- **Brand rules win.** For Tulvo: no coding-style typeface, no dots as separators, sentence case, wording that sounds like a person.

## 4. Keeping costs down

Every video follows the token plan in the skill map: one step per session, helpers on cheaper models for measuring and building, Ponytail on, half-size previews until the final. Claude logs what each step cost, and the owner can see it. Claude asks before any paid ElevenLabs call that is not part of a step you approved.

## 5. Making the studio better

The studio improves with every video. Please help:

- **After each video,** Claude logs which skills helped or got in the way, and drafts lessons from your review notes. You approve the ones worth keeping; they become rules.
- **Once a month,** someone says "refresh the skills". Claude runs `bash setup/update-skills.sh`, reads what changed, and updates the skill map.
- **Found a great skill or tool?** Say "add this skill to the studio: <link>". Claude adds it to the updater and the skill map, and tries it on one real step first.
- **Something broke or felt awkward?** Tell Claude "fix the studio, not just this video". It fixes the tool and writes it down in `DESIGN.md`.
- **Getting the latest studio:** say "update the studio" in the studio folder; Claude gets the newest version and runs the health check.
- **Sharing an improvement:** the repository is public and read-only for most people. To suggest a change, ask Claude to "propose this change to the studio": it prepares it for the owner to review. The owner and anyone they add can save changes directly.

## 6. Where things are

| Need | Look at |
|---|---|
| How the studio works and what is left | `DESIGN.md` (section 14 is the to-do list) |
| The skill map and token plan | `.claude/skills/video-studio/skill-map.md` |
| Capturing a product | `tools/capture/README.md` and `CAPTURE-PLAN.md` |
| A brand's colours, voice, rules, product notes, sound kit | `brands/<brand>/` |
| One video's files | `jobs/<video>/` |

## 7. Not done yet

- No real video has gone through all six steps yet: the first one is the proving run.
- Tulvo's new sound kit has not been listened to.
- Some capture features (phone apps, desktop apps, terminals, WordPress demo sites) are new and lightly tested.

Questions: ask the owner, or ask Claude in the studio folder, "how do I ...".
