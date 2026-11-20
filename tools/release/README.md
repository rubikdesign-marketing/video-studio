# Releasing the Damex Video Engine

For the owner and whoever ships a version. This folder never goes to buyers (`release/manifest.json` leaves it out).

## Status (19 Nov 2026): zip delivery is done

From **0.1.0-rc4**, buyers no longer get a GitHub invite. They get a link to **one zip file**, the same for Mac, Windows and Linux. They unzip it, open the folder in Claude and say "start the studio". About a minute later the studio is ready. Nothing to install first: no Node.js, no Homebrew, no admin password, and no tests or sample render during setup.

Measured on the 0.1.0-rc4 zip, unzipped into a folder with a space and an accent, with the system's own Node hidden, so the portable Node download ran each time:

| System | Unzip to ready | Then | Receipt |
|---|---|---|---|
| Apple-silicon Mac (owner's) | 17 s | sample film rendered, second start instant | local run, 19 Nov |
| Ubuntu 24.04 x64 (GitHub runner) | 15 s | sample film rendered, second start instant | `zip-start` run 44529719869 |
| Windows Server x64 (GitHub runner) | 52 s | sample film rendered, second start instant | `zip-start` run 44529719869 |

Not tested yet: an Intel Mac, a physical Windows 11 PC, Windows on Arm, ARM Linux. The core install before this work took about 1.5 minutes of machine time. The old 3 to 4 hours went on everything around it: the GitHub invite, installing Node and Homebrew, plugins, and optional models.

## Current download

Buyers download from their page at damex.digital/video-engine/studio/, which serves the zip from the R2 bucket `damex-ve-releases`. Which version is current is the bucket's `current.json`; there is no link to share and no welcome email to send. The page shows the version and the SHA-256 it was published with. Version 0.1.0-rc5 was the last one delivered through Google Drive.

## Ship a new version

Run these from the studio folder on the release branch (`release-zip` today, which grew from `platform-04`).

1. **Commit the change.** The export reads a commit, never the working folder, so unfinished work never ships.

2. **Export the white-label release.** It writes `projects/damex-video-engine`, takes out every client brand, job and film, and stops if a banned word (a client's name) is left anywhere:

   ```bash
   node tools/release/export.mjs --version 0.1.0-rc5
   ```

3. **Record it in the release folder**, one commit per version:

   ```bash
   git -C ../../damex-video-engine add -A && git -C ../../damex-video-engine commit -m "Damex Video Engine 0.1.0-rc5"
   ```

4. **Build the zip.** It writes `projects/damex-video-engine-builds/damex-video-engine-<version>.zip` and a `.sha256` beside it:

   ```bash
   node tools/release/package.mjs
   ```

5. **Test it as a buyer would.**
   - **Mac:** unzip into a scratch folder and run `bash setup/start.sh` with Node hidden (`env -i HOME="$HOME" PATH=/usr/bin:/bin bash setup/start.sh`). It should end with "The studio is ready". Then `node setup/runtime/sample.mjs` with `.runtime/node/bin` first on PATH should render the sample.
   - **Windows and Linux:** push the branch to the **private** archive remote (`git push archive release-zip`). The `zip-start` workflow builds the zip and runs the same test on a Windows and an Ubuntu runner. It takes about 4 minutes and the minutes are billed.

     ```bash
     gh run list -R rubikdesign-marketing/video-studio-private-archive --workflow zip-start.yml --limit 1
     ```

6. **Publish to damex.digital.** It checks the zip against its `.sha256`, reads the three guides and the start prompt from the release folder, then uploads the zip, `releases/<version>/release.json` and last `current.json`. It stops at the first failure and leaves `current.json` alone.

   ```bash
   node tools/release/publish.mjs --version 0.1.0-rc6
   ```

   It uses website-v3's wrangler (set `WRANGLER` to use another) and needs that wrangler signed in to Cloudflare. Rehearse first without touching the real bucket: add `--local --persist-to <folder>`.

7. **Check the page.** Sign in as a buyer and open `/api/video-engine/me/`: it must show the new version. Buyers see it on their page at damex.digital/video-engine/studio/. Nothing to email: updates are included.

**Roll back:** `node tools/release/publish.mjs --current <previous version>` points `current.json` at an older version that is still in the bucket (it checks that `releases/<version>/release.json` exists).

Never push to `origin`: `rubikdesign-marketing/video-studio` is public. Releases and CI runs go to `archive` (private).

## How it works

| Part | File | What it does |
|---|---|---|
| Export | `tools/release/export.mjs` + `release/manifest.json` + `release/overrides/` | A clean copy of one commit: client material out, buyer README, ONBOARDING, CLAUDE.md and licence in, banned-word scan |
| Zip | `tools/release/package.mjs` | One zip for all systems. Hidden top-level files (`.claude`, `.mcp.json`, `.gitignore`, `.env.example`) travel visibly in `setup/dotfiles/`, so no download, copy or sync can lose them |
| Start (Mac, Linux) | `setup/start.sh` | Clears the Mac's "downloaded from the internet" mark, finds Node 22.13+ or fetches the official portable Node into `.runtime/node` (checked against nodejs.org's SHA-256 list), then runs `start.mjs` |
| Start (Windows) | `setup/start.ps1` | The same on Windows: unblocks the files, portable Node (win-x64; Windows on Arm runs it under emulation) |
| Start, every system | `setup/runtime/start.mjs` | Puts back hidden files, runs the core install only if it is missing (engine packages, render browser, capture tool), runs the core checks, writes `.damex/ready.json` |
| Updates | `start.mjs --import-from <old folder>` | Copies brands, videos, own films, `.env`, product sign-ins and `studio.json` from an older copy, and never overwrites anything else |
| Test | `setup/runtime/start.test.mjs`, `.github/workflows/zip-start.yml` | Unit tests for the start step; the end-to-end buyer test on Windows and Linux |

Why one zip instead of one per system: the packages and the render browser are built per system (about 900 MB each), and downloading them on the buyer's computer takes under a minute. It also avoids Apple's and Windows' warnings about unsigned programs, because programs a script downloads are not marked as coming from the internet.

Optional tools (transcription models, noise removal, mastering FFmpeg, footage Python) are never part of setup. `node setup/runtime/install.mjs --with <capability>` prints the commands when a video first needs one, and `node setup/runtime/doctor.mjs` says what is ready.

## Still open

- **Protection:** a buyer can pass the zip on. The licence notice travels inside it. A licence key checked at start is not built.
- **Refunds:** handled on the website side (the buyer's access), not here.
- **The licence (`release/overrides/LICENSE.md`) is still a draft** for a lawyer to review before sales.
