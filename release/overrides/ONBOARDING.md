# Welcome to the Damex Video Engine

The Video Engine makes videos with Claude, one video at a time, to the same standard every time. Claude stops for your approval at six steps, and nothing is final until you say so.

Setup takes about 5 minutes, most of it downloading.

## 1. Set up (once)

You need:

- **A computer:** a Mac (Apple silicon or Intel), a Windows 10 or 11 PC, or a Linux PC (Ubuntu 24.04 or similar).
- **Claude:** a plan that includes Claude Code. On a Mac or Windows, use the Claude desktop app. On Linux, use Claude Code in a terminal.
- **Google Chrome**, to film your product.

You do not need to install anything else, and no admin password is needed. If your computer has no suitable Node.js, the studio downloads its own copy into its folder.

1. **Download** the zip from the link in your purchase email. Download the file itself. Do not add it to your own Google Drive.
2. **Unzip it into your Documents folder.** On a Mac, double-click the zip. On Windows, right-click it and choose **Extract All**. You get a folder named `video-engine`. Move it into Documents if it is not there already.
3. **Start it.** Open the Claude desktop app, choose the **Code** tab, open the `video-engine` folder, and paste this:

   ```text
   Start the studio. On a Mac or Linux run "bash setup/start.sh", on Windows run "powershell -ExecutionPolicy Bypass -File setup\start.ps1". Stay with it until it finishes, then tell me in plain words whether the studio is ready.
   ```

   It takes about 2 minutes. It downloads the video engine's parts for your computer, then checks them.

   Prefer a terminal? Run the same command in the `video-engine` folder yourself.
4. **Start a new chat in the same folder.** When Claude asks whether to trust the folder and install its plugins, say yes. From now on, always work in this folder.
5. **Optional: add your ElevenLabs key** for generated voice, music and sound effects. Open a terminal (Terminal on a Mac or Linux, PowerShell on Windows) and run these two lines one after the other. The second asks for the key without showing it and keeps it on your computer only:

   ```bash
   cd ~/Documents/video-engine
   ```

   ```bash
   node setup/runtime/key.mjs
   ```

   If the terminal says `node` is not found, use the studio's own copy instead: `.runtime/node/bin/node setup/runtime/key.mjs` (on Windows: `.runtime\node\node.exe setup\runtime\key.mjs`).

Never put keys or passwords in a chat or a file. The studio never asks for them.

Extra tools (noise removal, transcription, mastering) are not part of setup. Claude adds each one the first time a video needs it, and asks before anything that needs an admin password.

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

- **Updates:** while your update plan is active, we email you a link to each new version. Unzip it next to your current folder (for example as `video-engine-new`), open the new folder in the Code tab and say: **"Start the studio and bring my work from Documents/video-engine"**. Claude runs the start step with `--import-from` and your brands, videos, key and product sign-ins come across. Your old folder stays as it was until you delete it.
- **Something broke?** Tell Claude "fix the studio, not just this video". If Claude says files are missing, say "start the studio" again: it puts back anything a copy or sync dropped. For anything Claude can't fix, contact Damex Digital support through the address in your purchase email.

## 7. Where things are

| Need | Look at |
|---|---|
| The skill map and token plan | `.claude/skills/video-studio/skill-map.md` |
| Capturing a product | `tools/capture/README.md` |
| A brand's colours, voice, rules and product notes | `brands/<brand>/` |
| One video's files | `jobs/<video>/` |
