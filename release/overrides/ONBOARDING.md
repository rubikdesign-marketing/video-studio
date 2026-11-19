# Welcome to the Damex Video Engine

The Video Engine makes videos with Claude, one video at a time, to the same standard every time. Claude stops for your approval at six steps, and nothing is final until you say so.

Setup takes about 20 minutes.

## 1. Set up (once)

You need:

- **A computer:** a Mac (Apple silicon or Intel), a Windows 10 or 11 PC, or a Linux PC (Ubuntu 24.04 or similar). Windows and Linux are new in this version.
- **Claude:** a plan that includes Claude Code. On a Mac or Windows, use the Claude desktop app. On Linux, use Claude Code in a terminal.
- **Node.js 22** (22.13 or newer, from nodejs.org) and **Google Chrome**.

No admin rights are needed for the studio itself.

1. Accept the GitHub invitation in your purchase email. It gives you access to the Video Engine repository.
2. Open the Claude desktop app, choose the **Code** tab, open any folder (your Documents folder is fine), and paste this, with the repository link from your purchase email:

   ```text
   Set up the Damex Video Engine for me. Download <repository link from my purchase email> into my Documents folder as "video-engine" (if it is already there, get the latest version instead). Then run the installer in that folder and stay with it until it finishes: on Windows "powershell -ExecutionPolicy Bypass -File setup\install.ps1", on a Mac or Linux "bash setup/install.sh". Ask me before installing anything that needs an admin password. Fix anything the health check says needs attention, then tell me in plain words what is ready and what I still have to do.
   ```

   The installer sets up only what your first video needs. Extra tools (noise removal, transcription, mastering) are added when a step needs them. The health check, `node setup/runtime/doctor.mjs`, says which are ready on your computer.

3. When it is done, open the folder `Documents/video-engine` in the Code tab. When Claude asks whether to trust it and install its plugins, say yes. From now on, always work in this folder.

4. **Optional: add your ElevenLabs key** for generated voice, music and sound effects. Open a terminal (Terminal on a Mac or Linux, PowerShell on Windows) and run these two lines one after the other. The second asks for the key without showing it and keeps it on your computer only:

   ```bash
   cd ~/Documents/video-engine
   ```

   ```bash
   node setup/runtime/key.mjs
   ```

Never put keys or passwords in a chat or a file. The studio never asks for them.

## 2. Set up your brand

Say **"set up my brand"**. Claude asks for your logo, colours, fonts and rules, and builds `brands/<your-brand>/`. If your videos show a product, Claude then studies the product, its customers and its key flows.

To film a web product, say **"sign in to <your product> for capture"** and sign in yourself in the Chrome window that opens. Use a demo account with sample data, not real customer data.

## 3. Make a video

Type **/video-menu** to start, browse presets and components, resume a video or set up a brand. Or just say **"make a video"** (or "make a feature demo about ..."); a full brief skips the menu. Claude walks you through six approvals:

| Step | You approve |
|---|---|
| 1 Idea | The hook, the length and the audience |
| 2 Script and voice | The words and how the voice reads them |
| 3 Moodboard | The look |
| 4 Storyboard | Every shot, and the product flows to film |
| 5 First animation | One scene at full quality |
| 6 Full animation | The whole film, then delivery |

- **Guided or grouped.** Guided (the default) is one approval per step; starting a new chat after each one and saying "continue the video" keeps it fast and cheap. Prefer fewer stops? Ask for grouped approvals: one brief review (idea, script, look) and one final cut review. Approvals you gave are remembered, so a restart never asks again for unchanged work.
- **Review notes:** the review page lets you pause the film, pin a note to a moment, and send it. Claude changes only those scenes and reports that each note landed.
- **Your next video is faster:** save an approved film's look as a style. The next video starts from it and asks only what is new.

## 4. What makes the videos good

- **Real product screens.** Claude films your real product with a scripted, smooth cursor, then animates it: zooms, highlights tied to real buttons, transitions and vertical versions.
- **Checks before you see anything:** smoothness, frame quality, wording, privacy and a design critique.
- **Your brand rules win.** Everything takes its colours, type and wording rules from your brand folder.

## 5. Keeping costs down

Every video follows the token plan in the skill map: one step per session, helpers on cheaper models for measuring and building, and half-size previews until the final film. Claude asks before any paid ElevenLabs or Kling call that isn't part of a step you approved.

## 6. Updates and help

- **Updates:** while your update plan is active, say **"update the studio"** in the folder. Claude gets the latest version and runs the health check.
- **Something broke?** Tell Claude "fix the studio, not just this video". For anything Claude can't fix, contact Damex Digital support through the address in your purchase email.

## 7. Where things are

| Need | Look at |
|---|---|
| The skill map and token plan | `.claude/skills/video-studio/skill-map.md` |
| Capturing a product | `tools/capture/README.md` |
| A brand's colours, voice, rules and product notes | `brands/<brand>/` |
| One video's files | `jobs/<video>/` |
