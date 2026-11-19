# Conductor (for the lead session)

Deterministic helpers in `tools/conductor/` (node, no dependencies, no network). They decide and record; they never run workers, never write settings, never spend money. Limits live in `tools/conductor/policy.json`. Commands below write the job path out (`jobs/<job>`). Run each as one plain command, with no shell variables, `&&` chains or pipes, so the allow list in `.claude/settings.json` matches it.

## 1. Route before you dispatch

`node tools/conductor/route.mjs <task-class>` (no argument lists all).

| Route | Task classes | Who |
|---|---|---|
| lead | idea_and_direction, script_and_wording, storyboard_decisions, integration, approval_and_asks | you: creative decisions and merging |
| script | measure, render, mechanical_check | tools in `tools/` (numbers, renders, hashes) |
| haiku | run_checks, lookup | `checker` (narrow evidence) |
| sonnet | scene_code, capture, critique, study, research | `scene-builder`, `capture-runner`, `frame-critic`, `reference-studier`, `researcher` |

## 2. Always ask a person

Ask, wait for a clear yes, never assume: an unresolved decision that changes the output; a brand requirement; asset rights (third-party logos, music, footage); external transfer (upload, send, publish); paid usage. Helpers cannot ask, so stop and bring it to the owner.

## 3. Approvals

- **guided** (default): idea, script_and_voice, moodboard, storyboard, first_animation, full_animation.
- **grouped**: `brief_review` (idea, script and moodboard decisions together), `storyboard` only when it does not fit into the brief review (optional), then `final_cut`. Approving `brief_review` or `final_cut` satisfies the gates it folds in.

Pick the mode with the owner at the idea stage; pass `--mode grouped` on the first approve and it is remembered in `jobs/<job>/receipts.json`.

```
node tools/conductor/gate.mjs approve jobs/<job> <gate> --inputs a.md,dir [--by owner] [--mode guided|grouped] [--folds g1,g2]
node tools/conductor/gate.mjs check   jobs/<job> <gate>     # exit 0 satisfied, 3 stale (inputs changed), 1 missing
node tools/conductor/gate.mjs status  jobs/<job>
```

Run `approve` only after the person said yes. Inputs are paths inside the job (folders hashed recursively). Exit 3 means the approved files changed: show what changed and ask again. Never edit `receipts.json` by hand.

## 4. Dispatch

Claim before every helper, release when it returns. One claim per helper call.

```
node tools/conductor/dispatch.mjs claim jobs/<job> --stage animation --task s3 --worker scene-builder --model sonnet --writes engine/src/jobs/j/scenes/s3.tsx [--paid]
node tools/conductor/dispatch.mjs release jobs/<job> c7 --status done|failed|partial [--tokens N|in:out]
node tools/conductor/dispatch.mjs resume jobs/<job>
node tools/conductor/dispatch.mjs usage jobs/<job>
```

`ALLOW <id>` (exit 0): dispatch. `STOP <reason>` (exit 4): do not dispatch; act on the reason.

| STOP reason | What to do |
|---|---|
| active cap (2 workers) | wait and release one, or do it yourself |
| stage cap (3; animation 6) | do the rest yourself or ask the owner |
| retry cap (1 retry per task) | take it over; look at the partial output first |
| write overlap | give workers disjoint write sets, or run one after the other |
| model blocked | say so to the owner; do the task in the lead session. Never swap the model |
| paid without approval | ask the owner, then `gate.mjs approve jobs/<job> paid_usage --inputs <note of what may be spent>` |

`partial` keeps the worker's files and counts toward the retry cap. Claims the session was killed on stay active until `resume`.

## 5. Start of every session

1. `dispatch.mjs resume jobs/<job>`: marks unreleased claims `interrupted`, lists their write sets as partial work to keep (read it before retrying), skips satisfied gates, prints `NEXT:`. Run it once, before dispatching anything.
2. `node tools/conductor/models.mjs`: which worker models settings allow, and the lead model. Read-only.
3. Record tokens only from numbers you were shown: `release ... --tokens`. `usage` prints "not recorded" otherwise.

## 6. What is actually enforced

| Limit | Level | By |
|---|---|---|
| active workers, stage cap, retry cap, write overlap | tool | `dispatch.mjs claim`, but only when you call it |
| model allowlist (`availableModels`) | tool + client | claim refuses; Claude Code enforces the list itself |
| paid work needs approval | tool | `claim --paid`; direct paid tool calls are not intercepted |
| gate receipts (stale or missing) | tool | `gate.mjs check`; nothing blocks you ignoring it |
| agent `maxTurns`, agent `model` | client | Claude Code, from the agent files |
| spend cap, token budget | instruction | none exists in interactive sessions (`--max-budget-usd` is print mode only) |
| always-ask list | instruction | this file |

Say plainly to the owner when a limit is `instruction` only.
