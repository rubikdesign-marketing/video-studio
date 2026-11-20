# rc7 baseline (Task 0)

Source: `rc7-integration` @ `9848122` (= `release-zip`, the rc6 source). 2026-11-20.

| Suite | Command | Result |
|---|---|---|
| Node tools, studio server, setup runtime | `node --test 'tools/film/tests/*.test.mjs' 'studio/tests/*.test.mjs' 'setup/runtime/*.test.mjs'` | 71/71 pass |
| Editor app | `cd studio/app && npx vitest run` | 21 files, 296/296 pass |

How these must be run on this Mac:
- With Node 22: `export PATH=/Users/wedevs/.nvm/versions/node/v22.23.1/bin:$PATH`. The default `node` here is v20.20, below the studio's 22.13 floor; on it, 9 of the 21 editor test files fail to start (undici needs Node 22.19+).
- Outside the Claude sandbox: it blocks local ports (`listen EPERM`), which the server tests need.
- Pass file globs to `node --test`; Node 22 treats a folder argument as a file.
- `engine/node_modules`, `studio/app/node_modules` and `tools/footage/.venv` are symlinks to identical installs (same lockfiles) in `video-studio` and `video-studio-release-zip`.
