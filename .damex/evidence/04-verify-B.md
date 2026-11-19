# Part B: matched short brief, old vs new

**Setup, the same for every run**
- Brief: "12 s vertical reel, demo brand, same-day shipping, no voice, library music, ends on logo, stop at first approval".
- `claude -p --model sonnet --permission-mode acceptEdits --max-budget-usd 1.50`, with no one available to answer.
- Raw output is in `04-B-raw/`.

| | Old (RC2 a644abd) | New, round 1 (tools blocked) | New, round 2 (allow list active) |
|---|---|---|---|
| Model | claude-sonnet-5-5 | claude-sonnet-5-5 | claude-sonnet-5-5 |
| Elapsed (wall / API) | 57 s / 51.7 s | 49 s / 44.0 s | 74 s / 64.6 s |
| Turns | 13 | 17 | 13 |
| Input / output tokens | 20 / 5,567 | 20 / 4,930 | 20 / 5,558 |
| Cache read / write | 862k / 105k | 864k / 104k | 885k / 106k |
| API-equivalent estimate* | $0.56 | $0.55 | $0.57 |
| Questions to the person | 0 | 2 | 1 (pick a concept; also invites a real cut-off or region) |
| Blocked tool calls | 3 | 4 | 2 |
| Job files | job.json, concepts.md | job.json, concepts.md | job.json, **brief.json**, ideas.md |

\*The API-equivalent figures are list-price estimates; billing is subscription. Subscription usage for this whole stretch (all runs, two Haiku probes at $0.03, and the lead) as the app shows it: the 5-hour window went from 33% to 37%, and weekly from 6% to 7%.

**Quality, same checks:** every run passes all of these:
- `job.json` is valid.
- The brand is `demo` and the next stage is `idea`.
- The size is 9:16 and `length_cap_seconds` is 12.
- No voice, and the reel ends on the logo.
- Three concepts, nothing rendered, and nothing written outside `jobs/`.

What round 2 adds:
- A real brief from `brief.mjs new` and `approval_mode: guided`.
- It refuses to invent a cut-off time it wasn't given.
- `gate.mjs status` shows every gate MISSING, which is correct.

**Findings**
1. **The allow list only works in a trusted workspace.** Claude Code prints "Ignoring 10 permissions.allow entries … workspace has not been trusted". A customer accepts the trust prompt on first open, so it applies to them. The probes confirm the rule itself is correct: 1 call blocked untrusted, 0 blocked with `--settings`.
2. Round 2's two blocked calls were `J=... && node tools/plan/brief.mjs decide $J`. A variable prefix doesn't match the allow rule. A line was added to the SKILL.md Tools row; it has not been retested.
3. `brief.mjs` read "demo brand" as kind `product-demo`. Upgrade-line bug.
4. `hooks.mjs find` rejected the platform flag the agent used. CLI and docs disagree.
5. Fixture: `studio.json` was set to `demo` by hand. The exporter doesn't rewrite it (for Prompt 04).

**Not proven**
- One run per configuration, so timing differences are noise.
- Nobody judged the concepts' craft.
