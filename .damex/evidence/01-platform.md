# Platform evidence: Claude Code project-level controls

Scope: installed Claude Code 2.1.325 (macOS), used from the CLI and the Claude desktop app Code tab.
Method: WebFetch of the official pages listed below on 2026-11-19. Quotes are from the fetched text. Where a fetch was truncated, the note says so. "Not documented" means the statement does not appear in the pages checked.

Pages checked:
- A: https://code.claude.com/docs/en/sub-agents
- B: https://code.claude.com/docs/en/settings (and https://code.claude.com/docs/en/settings-reference for keys)
- C: https://code.claude.com/docs/en/desktop
- D: https://code.claude.com/docs/en/tools-reference
- E: https://code.claude.com/docs/en/slash-commands (skills page content; linked skills page not separately fetched)
- F: https://code.claude.com/docs/en/costs
- G: https://platform.claude.com/docs/en/models/overview
- H: https://code.claude.com/docs/en/hooks (SessionStart section, chunk 100000 to 200000)
- I: https://code.claude.com/docs/en/cli-reference (flags)

---

## Q1. Subagent frontmatter

Source: A, https://code.claude.com/docs/en/sub-agents

Full documented field list: `name` (required), `description` (required), `tools`, `disallowedTools`, `model`, `permissionMode`, `maxTurns`, `autoCompactWindow`, `skills`, `mcpServers`, `hooks`, `memory`, `background`, `omitClaudeMd`, `effort`, `isolation`, `color`, `initialPrompt`, `experimental`.

- **model**: "`sonnet`, `opus`, `haiku`, `fable`, a full model ID such as `claude-opus-5-5`, or `inherit`. When you omit it, Claude Code picks the model in the subagent model order." Aliases confirmed: sonnet, opus, haiku, fable, inherit, full IDs.
- **effort**: supported. "Options: `low`, `medium`, `high`, `xhigh`, `max`; available levels depend on the model." Overrides session effort but not `CLAUDE_CODE_EFFORT_LEVEL`.
- **maxTurns**: supported. "Maximum number of agentic turns before the subagent stops. When the subagent reaches the limit, Claude Code returns its output marked as partial, and Claude can resume it."
- **tools**: supported. "Inherits every tool available to subagents if omitted."
- **disallowedTools**: supported.
- **permissionMode**: supported. "`default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan`, or `manual` as an alias for `default`. Ignored for plugin subagents."
- **skills**: supported. "Skills to preload into the subagent's context at startup. The full skill content is injected."
- **isolation**: supported. "Set to `worktree` to run the subagent in a temporary git worktree, giving it an isolated copy of the repository branched by default from your default branch rather than the parent session's `HEAD`."
- **Unavailable model**: not documented in general. The only documented fallback is for an org `availableModels` allowlist block: "the subagent runs on the first of these that applies: 1. For a blocked family alias, the newest permitted version in that family... 2. The model in `CLAUDE_CODE_SUBAGENT_MODEL`... 3. The main conversation's model, or the spawning subagent's model for a nested subagent." For a top-level subagent in an interactive session, "a warning names the requested model and its replacement." A model that is simply missing or unreachable is not documented.
- **AskUserQuestion inside subagents**: removed. "The first filter removes these tools, even when listed in the `tools` field: ... `AskUserQuestion`."

## Q2. Making a project agent the session default

Source: A (sub-agents), plus https://code.claude.com/docs/en/settings-reference (index row) and I (cli-reference)

- Yes, a settings key exists. From A: "To make it the default for every session in a project, set `agent` in `.claude/settings.json`: `{ "agent": "code-reviewer" }`. The CLI flag overrides the setting if both are present."
- Settings-reference index row for `agent`: "Start every session as a named [subagent] with its prompt, tools, and model | Agents, sessions, and worktrees | Any file." The full entry was truncated, so its scope line is not quoted.
- Flag: I lists `--agent` | "Specify an agent for the current session (overrides the `agent` setting)".
- Desktop app: the desktop page (C) does not mention `agent` or `--agent`. Its settings section is "not documented" for `--agent`. C says the desktop app and CLI read the same settings files: the settings page (B) says "the desktop app, which all read the same settings files." So the key is present in a file Desktop reads, but a Desktop-specific behavior for the `agent` key is not documented.

## Q3. Model controls in project settings

Sources: settings-reference (https://code.claude.com/docs/en/settings-reference), B (precedence), C (desktop)

- `model`: "Set the model every new session uses, so you don't have to pick one with `/model` each time. Setting it here doesn't stop you from switching mid-session. If your admin set an organization default model to override user selection, you get that model even when you set this key in user, project, or local settings."
- Precedence (B): "Project local settings... Shared project settings... User settings" are in the order listed, highest first, under managed and command line. So a project `model` overrides a user `model`. "A managed `model` is a starting default, not a lock; the locks are `availableModels` and `deniedModels`."
- `availableModels`: scope "Any file". "Restrict which models people can select for the main session, subagents, skills, and the advisor. A managed list constrains `/model`, `--model`, and the `model` key in a developer's own files." Non-managed merge: "Across non-managed scopes Claude Code merges the arrays as usual."
- `fallbackModel`: scope "Any file". "Name backup models for Claude Code to try, in order, when your primary model is overloaded or unavailable." Lists do not merge: "takes the whole value from the highest-precedence file that defines it."
- `effortLevel`: scope "Any file". "Set a default effort level for models you haven't saved a level for."
- `modelPicker`: "User or managed". "Claude Code... ignores it in project and local settings so a repository you clone can't relabel the picker."
- Should a project override the user's model: the docs do not say. They describe the mechanism only. Note: a shared project file changes the model for every teammate who clones it, which B describes as the reason personal choices go in `.claude/settings.local.json`.

## Q4. Budgets and concurrency caps

Sources: I (cli-reference), A (sub-agents), F (costs)

- `--max-budget-usd`: "Stop the run once estimated spend on API calls reaches this amount (print mode only)." Subagent spend counts toward it. "Once spend reaches the cap, spawning another subagent fails with `Budget limit reached`." So it is print-mode only. It is not available for interactive sessions.
- `--max-turns`: "Limit the number of agentic turns (print mode only). No limit by default."
- `maxTurns` subagent field: applies per subagent (see Q1). Not documented as a session-wide cap.
- Token or spend cap for interactive subscription sessions: not documented. F describes `/usage` but no cap. F says "The Session block in `/usage` shows API token usage and is intended for API users."
- Concurrent subagents: yes. From A: "By default, when 20 subagents are running in a session, spawning another with the Agent tool fails with `Concurrent subagent limit reached`... To change the limit, set `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` to any positive whole number." Also: "there is no limit on the total number of subagents spawned over a session." This is an env var, not a settings key (as documented).
- Settings-reference: no budget, maxBudget, or spend-cap key found in the entries checked ("Not documented as a settings key").

## Q5. Custom slash commands and skills

Sources: E (https://code.claude.com/docs/en/slash-commands, skills content), C (desktop)

- `.claude/skills/<name>/SKILL.md` becomes `/<name>`: yes. "The directory name, or the frontmatter `name` when you set one, becomes the command you type." Example: "`.claude/skills/deploy-staging/SKILL.md` → `/deploy-staging`."
- CLI: yes, as above.
- Desktop: C says "type `/` in the prompt box ... This includes built-in commands, your custom skills, project skills from your codebase, and skills from any installed plugins." This is the Desktop slash-command menu. Desktop's personal-skill loading: "Local sessions load your personal skills from `~/.claude/skills/`." Project skill loading in Desktop is covered by the menu quote above.
- Frontmatter, all supported (quoted from E's reference table):
  - `user-invocable`: "Set to `false` when only Claude should invoke the skill... Default: `true`."
  - `disable-model-invocation`: "Set to `true` to prevent Claude from automatically loading this skill... Default: `false`."
  - `argument-hint`: "Hint shown during autocomplete... Example: `[issue-number]`."
  - `description`: "What the skill does and when to use it." Truncated at 1,536 characters in the listing.
  - Also documented: `allowed-tools`, `model`, `effort`, `context` (`fork`), `agent`.
- `.claude/commands/`: still supported. "**Custom commands have been merged into skills.** Your existing `.claude/commands/` files keep working." Prefer a skill for new work.

## Q6. AskUserQuestion

Sources: D (https://code.claude.com/docs/en/tools-reference), A (sub-agents), C (desktop)

- Available in interactive CLI: yes. D: "`AskUserQuestion` | Asks multiple-choice questions to gather requirements or clarify ambiguity. Questions stay open until you answer them by default." Its behavior section: "Answer by picking an option, or type your own text through the `Other` row or the notes field."
- Desktop: not documented. C has no AskUserQuestion entry.
- Limits: questions per call and options per question: not documented in the sections read.
- Auto-continue: "Questions stay open until you answer them. If you want a question you leave unanswered to eventually close... set the `askUserQuestionTimeout` setting to `60s`, `5m`, or `10m`." The timer "never starts for a question Claude asks in a background session, in screen reader mode, or while the session is connected to Remote Control."
- Inside subagents: no. See Q1 quote from A: the filter removes `AskUserQuestion`, "even when listed in the `tools` field."

## Q7. SessionStart hooks

Sources: H (https://code.claude.com/docs/en/hooks, SessionStart section), B (settings-reference for systemMessage in hooks JSON output)

- Shown to the model: "On these events, your plain-text stdout reaches Claude or the compaction summary: `UserPromptSubmit`, `UserPromptExpansion`, `SessionStart`, and `PostModelSwitch`: Claude Code adds plain-text stdout as context that Claude can see and act on." Also `additionalContext`: "String added to Claude's context at the start of the conversation, before the first prompt."
- Shown to the user: exit code 2 only. "`SessionStart` | No | Shows stderr to user only." And: "For `SessionStart`... Claude Code renders the exit code 2 stderr in the transcript as a `<hook name> hook error` notice... Claude doesn't see it." An error notice, not a menu or first-run message.
- Visible message: `systemMessage` in JSON output is documented generally as "Warning message shown to the user." Quote: "To surface a message to the user on any platform, return `systemMessage` in JSON output. Some events discard it or deliver it elsewhere, and each event's section says so." The SessionStart section does not explicitly say `systemMessage` displays there; it mentions `systemMessage` only as an example for reporting resume cost. So it is "not confirmed for SessionStart" from the text read.
- Output display of SessionStart plain stdout to the user: "The section doesn't say whether output appears in the transcript or on screen."
- Supported menu or first-run UI from a hook: not documented.

## Q8. Usage reporting

Source: F (https://code.claude.com/docs/en/costs)

- API users: "The Session block in `/usage` shows API token usage and is intended for API users." Shows "Total cost", "Usage by model" with token counts and dollars. Cost is computed "locally from token counts at list price, unless a `modelPricing` table is in effect."
- Subscription users (Pro, Max, Ultra, Team, Enterprise): "Claude Pro, Max, and Ultra subscribers have usage included in their subscription, so the session cost figure isn't relevant for billing purposes. Subscribers see plan usage bars, activity stats, and a usage breakdown on the same screen."
- Plan usage breakdown: "Attribution: recent usage attributed to skills, subagents, plugins, and individual MCP servers, each shown as a percentage of the total."
- Per-subagent token counts: attribution is shown as a percentage share, not as raw token counts. Raw per-subagent token counts in `/usage` are not documented in F. The prompt cache line "covers the main conversation only, not subagents."
- `/cost`: F says "the built-in alias `/cost` still runs the built-in command" (slash-commands page E). Its output is the Session block above.

## Q9. Models overview

Source: G (https://platform.claude.com/docs/en/models/overview)

Quote from G: "If you're unsure which model to use, start with Claude Opus 5.5 for most workloads. Use Claude Fable 5.2 for demanding reasoning and long-horizon agentic work."

| Model | Claude API ID | Alias | Default effort |
|---|---|---|---|
| Claude Opus 5.5 | `claude-opus-5-5` | `claude-opus-5-5` (same row) | `medium` |
| Claude Fable 5.2 | `claude-fable-5-2` | `claude-fable-5-2` (same row) | `high` |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | `claude-sonnet-5-5` (same row) | `high` |
| Claude Haiku 5.5 | `claude-haiku-5-5` | `claude-haiku-5-5` (same row) | `medium` |

G's table row "Claude API alias" repeats the ID for each model. G notes: "Every Claude model ID is a pinned snapshot, including the dateless IDs used from the 4.6 generation on." Short aliases `opus`, `sonnet`, `haiku`, `fable` are documented as subagent `model` values in A, not on G.

---

## Contradictions to expectations

1. `agent` is a real settings key (A). The `--agent` flag is also documented (I).
2. `--max-budget-usd` and `--max-turns` are print-mode only (I). No interactive spend or turn cap is documented.
3. AskUserQuestion is removed from subagents even when listed (A).
4. A SessionStart hook's stdout goes to Claude, not to the user (H). A visible first-run message is not documented as possible.
5. Desktop: skills and slash commands are documented (C), but AskUserQuestion, `--agent`, and CLAUDE.md/`.claude/agents` behaviour in Desktop are not.

## Gaps and limits of this pass

- Settings-reference `agent` entry (full text) was truncated. Only the index row was read.
- Hooks `systemMessage` for SessionStart: not confirmed.
- AskUserQuestion per-call limits: not found in the tools-reference text read.
- Subagent `model` unavailable case (outside the `availableModels` allowlist): not documented.
- Skills page linked from E was not fetched separately; E's content was used.
