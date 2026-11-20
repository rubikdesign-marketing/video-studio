# Part C: multi-scene comparison, old vs new

**Setup, the same brief for every run:**
- The brief asked for "a 30 s 16:9 promo, demo brand, saved replies for the support inbox, five scenes, voice-over".
- Treat the recommended idea as approved, write the script and the scene list, generate no audio, and stop at the script approval.
- Settings: `claude -p --model sonnet --permission-mode acceptEdits --max-budget-usd 3`.
- The new copy also gets `--settings .claude/settings.json`, which stands in for a trusted workspace.
- Neither copy has a `.env` or `node_modules`, so a paid call or a render was impossible.
- Raw output is in `04-C-raw/`.

| | Old (RC2) | New, round 1 | New, round 2 (after fixes) |
|---|---|---|---|
| Model | claude-sonnet-5-5 | claude-sonnet-5-5 | claude-sonnet-5-5 |
| Elapsed (wall / API) | 122 s / 107.6 s | 123 s / 106.0 s | 169 s / 164.7 s |
| Turns | 17 | 21 | 41 |
| Input / output tokens | 22 / 9,711 | 34 / 9,076 | 50 / 16,937 |
| Cache read / write | 1.04M / 67k | 1.72M / 70k | 2.73M / 85k |
| API-equivalent estimate* | $0.47 | $0.54 | $0.78 |
| Helpers spawned | 0 | 0 | 0 |
| Blocked tool calls | 4 | 2 (one `J=` command) | 2 (shell heredoc and `sed -i`; no `J=`) |
| Idea approval | text in `job.json` | text in `job.json` | text plus **receipt** (`gate.mjs status`: idea OK) |
| Files | job, soul sheet, script, scenes.md | job, brief, script | job, brief, soul sheets, script, **shots.json**, receipts |

\*API-equivalent figures are list-price estimates; billing is subscription. The app's 5-hour window went from 37% to 41% across all four runs and the lead's work; weekly stayed at 7%.

**Quality, same checks:** all three pass.
- The job record is valid: demo brand, 16:9, 30 s cap, next stage script.
- The script is 124 to 134 words, about 24 to 28 s spoken, under the cap.
- Five scenes, and no audio files.
- The old copy's scene list needs real inbox captures that the demo brand does not have. Both new runs plan type and motion only, so they invent no screens.

**Fixes made between the two new rounds**
- Stage 1 and the stage 5 review step now call `gate.mjs approve`. Before, they said to write the approval into `job.json` only, which overrode the skill.
- `conductor.md` examples write `jobs/<job>` out in full instead of `JOB`.
- `CLAUDE.md` says to run studio tools as plain commands.

**Findings**
1. Once the fixes were in, the receipt and the plain commands both worked.
2. **Cost:** the new path cost more. The repeat runs below settle it at about +58%, and show where it goes.
3. `brief.mjs check` kept asking, because `decide` stores only free text. This is now fixed with `brief.mjs set`. "demo brand" misread as product-demo is also fixed. See the repeat runs.
4. Helpers were not used at these stages in either copy. This matches routing: idea and script stay with the lead.

**Not proven:** the craft of the scripts was not judged. Nothing was rendered or heard.

## Repeat runs (same brief and flags; `04-C-raw/repeats/`)

| Group | Runs | Turns, mean (range) | API-equivalent, mean (range) | API time | Output tokens | Cache read |
|---|---|---|---|---|---|---|
| Old (RC2) | 3 | 16 (14–17) | $0.43 (0.40–0.47) | 87 s | 8.5k | 0.86M |
| New before path and `set` fixes | 4 | 32 (26–41) | $0.70 (0.60–0.78) | 135 s | 15.2k | 2.18M |
| New with all fixes | 3 | 32 (24–37) | $0.68 (0.56–0.77) | 135 s | 14.0k | 2.30M |

The app showed the 5-hour window at 41% before these eight runs and at 45% after them; weekly went from 7% to 8%.

**The cost increase is real** (+58%, with ranges that don't overlap). The two fixes did not change it.
- **Fixes that worked:**
  - `gate.mjs` accepts `jobs/<job>/file` and absolute paths (test added).
  - `brief.mjs set` answers one question at a time, so `check` stops looping (test added).
  - "the demo brand" no longer reads as a product demo (test added).
- **What they removed:** approvals are now recorded on the first try, and `J=` commands fell from one per run to one in three runs.

**Where the extra turns go** (unique tool calls; each transcript logs about 1.3 entries per call, old and new alike):
- Old: about 15 calls. New: 32 to 35.
- The difference is the studio's quality tools. In the new copy, `beats.mjs` runs 2 to 7 times and the hook scorer 4 to 7 times, and the model revises the script until they pass. In the old copy, those same tools were blocked (its 3 to 4 denials), so it skipped them.
- The conductor's own share is small: 1 to 2 `gate.mjs` calls, 4 to 6 `brief.mjs` calls, and no helper claims.

**What the extra buys:** the same `beats.mjs` was run over every script.

| | Problems flagged | Offer beat |
|---|---|---|
| Old | 6, 7, 5 (mean 6) | missing in all three |
| New with fixes | 4, 3, 2 (mean 3) | present in all three |

This is the studio's own checker, so read it as playbook fit, not taste.

**Not settled:** an old copy *with* an allow list for its own tools would show how much of the gap is the allow list rather than the upgrade line. That needs three more runs.
