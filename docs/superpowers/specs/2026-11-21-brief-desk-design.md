# Brief desk: a branded brief page for the Video Engine

Date: 21 Nov 2026. Status: approved by the owner, 21 Nov 2026. Build plan: `docs/superpowers/plans/2026-11-21-brief-desk.md`.

## Why

The Video Engine learns. It keeps everything a customer has done: their brands, every job's brief and decisions, the films they approved, the styles they saved, review notes, and lessons drawn from feedback. All of it sits in the studio folder, mapped and kept up to date. Today a customer only sees that memory at work if they read the chat closely.

The brief desk puts it in front of them. It is a page in the Damex Video Engine look that opens right after install. The customer describes the video in their own words. The page draws on their past work to suggest ideas, skips the questions the memory already answers, and asks the rest, a few at a time. When the brief is settled, the usual six approvals follow. At step 4 the storyboard goes to Figma when it is connected, and to a Claude Design canvas when it is not.

## Goals

1. Right after a first install, the customer has a working brief page in Damex Video Engine branding, without having to ask for it.
2. On that page the customer writes what they want and gets the engine's own follow-up questions: at most three at a time, each with a recommended answer, most important first. These are the same questions `brief.mjs check` asks in chat today.
3. The page uses the customer's past work. It suggests ideas ("your last two films were kinetic type, try a product demo?") and does not ask what the memory already settles (brand, product, audience from discovery, looks used lately).
4. When the brief is complete, the page shows the plan (`brief.mjs plan`). The customer confirms it there. That confirmation is the same "plan confirmed" decision the chat records today.
5. Every later stage runs as it does now, with all six approvals: Idea, Script and voice, Moodboard, Storyboard, First animation, Full animation.
6. At step 4 (and step 3), the board is built in Figma if the Figma connector is connected, and on a Claude Design canvas if not.

## Non-goals

- Running any stage after the brief inside the page. Concepts, script, moodboard, storyboard and animation stay in chat sessions, one per stage.
- Making Figma required. It stays optional, as onboarding already says.
- Team features (several people writing one brief, assigning briefs).
- A new memory system. The page reads the memory the engine already keeps.

## Anti-goals (a failure even if it technically works)

- The page asks something the memory already answers, or asks about colours, fonts, logo, music, transitions or captions. The intake rules forbid those.
- The page's questions drift from the chat's questions. There must be one brief logic (`tools/plan/lib/brief.mjs`), not a second copy in page code.
- Customer files end up on claude.ai. The page shows summaries the connector returns. It never stores file contents in the artifact's versions, data or assets.
- Anything Tulvo, or any other client, ships in the release. The release has `demo` and `_template` only, and the export's banned-word scan must stay clean.
- The page breaks or loses a brief when it is opened somewhere the connector cannot be reached.

## Constraints

- An artifact is a page hosted on claude.ai. It cannot read the customer's computer on its own. It reaches the studio folder only through a local connector (an MCP server declared as `host:<name>` under the page's `mcp` capability). That only answers when the page is opened in the Claude desktop app with the studio folder's connector loaded.
- Install (`setup/start.sh` / `start.ps1`) is a shell script and cannot publish an artifact. Claude publishes the page at the end of the "start the studio" chat.
- Customers use Mac, Windows and Linux. The engine supplies Node itself (`.runtime/node`) when none is installed. The connector has to run on all three with that Node.
- The release is built by `tools/release/export.mjs` from a commit, not from the working folder. New files must be included by `release/manifest.json` and pass its scan.
- Damex Video Engine branding comes from `brands/damex-engine/brand.json` and its `logo/`, which do not ship in the release. The page template has to carry its own tokens and inline logo.
- Studio writing rules apply to every word on the page: plain words, sentence case, no dots as separators, no coding-style typeface.

## Approaches considered

1. **Local connector (chosen).** The engine ships a small local MCP server. The page calls it directly for past-work context and for every brief step, which reuses `lib/brief.mjs`.
   - Gains: answers are instant, there is one brief logic, and no chat has to stay open while the customer fills the brief.
   - Costs: it only works inside the Claude desktop app, and it rests on a page reaching a project-level local connector, which has to be proven first.
2. **A chat watches the page.** The page saves the brief to its database. A Claude Code session watching it reads that with full memory and writes questions back.
   - Gains: works in any browser and has the full engine behind every turn.
   - Costs: needs a chat left open, every answer waits several seconds, and it spends tokens on every turn. This is the fallback if approach 1 fails its test.
3. **A memory summary inside the page.** After each video the engine publishes a summary into the page, and the page writes its own questions from it.
   - Dropped: the memory goes stale between videos, and the question logic would be copied into the page, which is an anti-goal.

The owner picked approach 1 on 21 Nov 2026.

## Decided by the owner

- The page draws on the engine's full memory of past work, chats and feedback.
- All six approvals stay. The brief only feeds step 1.
- Storyboard: Figma if connected, otherwise a Claude Design canvas.
- Figma is optional. No Tulvo in the release.
- Local connector approach.

## The design

### 1. The connector (`damex-engine`, local MCP server)

A small Node program in the studio (proposed `tools/connector/server.mjs`), registered in the studio's `.mcp.json` under the name `damex-engine`, started over stdio with the studio's own Node. Its tools:

| Tool | Does | Writes |
|---|---|---|
| `studio_context` | Short summaries of what the memory knows: set-up brands and whether each has an approved discovery, saved styles, the last five films per brand (from `ledger.json`), lessons and feedback that bear on a new brief, and open or recent briefs with their stage | nothing |
| `brief_start` | Starts a job from the customer's words (`brief.mjs new` logic), names the job folder, then returns `brief_check` | `jobs/<date>-<name>/brief.json` |
| `brief_check` | What the words already settle, the pre-flight items with known or missing, and the next questions (at most three, with recommended answers) | nothing |
| `brief_answer` | Records one answer, as a field (`set`) or a decision (`decide`), then returns `brief_check` | `brief.json` |
| `brief_plan` | The plan in brief once all eight items are known (`brief.mjs plan`) | `jobs/<job>/plan.md` |
| `brief_confirm` | Records "plan confirmed" (`decide`) and returns what to say next | `brief.json` |

Rules:
- It calls `tools/plan/lib/brief.mjs` and the existing helpers directly. It must not reimplement the checklist or the questions.
- It reads only `brands/`, `jobs/*/brief.json`, `jobs/*/job.json`, `knowledge/` and saved styles. It never reads `.env`, `.capture/`, `jobs/*/out/`, captures or footage.
- It writes only inside the job's own folder, and only through the brief tools above.
- It returns short summaries and IDs, never whole files.

### 2. The page (brief desk)

A single HTML page kept in the studio (proposed `studio/brief-desk/index.html`), published by Claude with the Artifact tool.

- **Look:** Damex Video Engine dark tokens (page `#010B24`, ink `#FFFFFF`, accent `#BBFC9E`, warm `#FFA724`, from `brands/damex-engine/brand.json`), the wordmark inlined as SVG, and the brand's typeface where its licence allows web use. Defined as tokens so a light variant can follow later.
- **Capabilities:** `mcp` with `host:damex-engine` and the six tools above, plus `sample` for idea suggestions. `db` is used only for the fallback below.
- **Flow:**
  1. Start: a welcome line, then "What video do you want to make?", with one large text box. Below it are ideas from `studio_context`, worded by `sample` from the summaries (for example "Next episode in your saved *launch* style" or "A demo of the feature your last brief didn't cover"). Clicking an idea fills the box. With no past work, it shows a few starter examples.
  2. Questions: after submitting, the page shows what the engine understood ("vertical, so 9:16"), then up to three questions as cards. Each card has the recommended answer preselected and room for the customer's own words. A progress strip shows the eight items.
  3. Plan: when all eight are known, the plan appears in plain words, with a confirm button and an "change something" option that goes back to the questions.
  4. Hand-off: after confirming, the page says to start a new chat in the studio folder and say "continue the video". Step 1 then picks up the confirmed brief and goes straight to the three concepts.
  5. A list of the customer's briefs and the stage each has reached, so a half-finished brief can be resumed.
- **`sample` is a garnish, not a dependency.** If it is refused or unavailable, ideas show as plain summaries and questions show in the engine's own wording.
- **Fallback when the connector can't be reached** (for example the page is opened in a browser): the page explains that it works in the Claude desktop app with the studio folder open. It still lets the customer write the brief and saves that text to the page's `db`. The next "continue the video" or "make a video" chat checks for saved briefs with `ArtifactData`, runs `brief.mjs new` with the text, and continues in chat.

### 2b. Settled after the builder check

- **Turning the customer's words into brief fields.** The brief logic stays the only source of truth, so `lib/brief.mjs` gains answer choices for each question that has a fixed set: awareness, hook family, video type, size, what a reference is liked for, and the six looks. The connector returns those choices with the recommended one marked, and the page shows them as cards.
  - Every card also takes the customer's own words.
  - Free text: `sample` proposes the field value, the connector checks it against the allowed values, and the brief records the answer only if the check passes. The customer's exact words are always kept as a decision, whatever happens to the mapping.
  - Without `sample`, or when the check fails, the item stays open with the words attached and the page asks the customer to pick a card. Open-ended fields (`angle`, `for`, `must_show`) are stored in the customer's words, as chat does now.
- **A fresh studio with no brand yet.** The page still takes the brief, then parks it. It shows a first step: "set up your brand: start a new chat in the studio folder and say 'set up my brand'". Stage 0 (and 0B when a product is involved) picks up the parked brief when it finishes. The page never lets the brief fall back to the `demo` brand without saying so: the connector reports "no brand yet" instead of the silent default.
- **References.** The page accepts links and the customer's note on what they like about each. It can also offer library films by title and a one-line description from the connector, as text only. Files and footage are added in chat ("I have a file to add"), and the page says so.
- **Saved styles.** An idea such as "next episode in your saved *launch* style" starts the job through `style.mjs new` logic. `brief_start` takes an optional saved style, so the brief only asks what the style leaves open.
- **Finding the brief in the next chat.** `brief_confirm` also creates `job.json` from `templates/job.json`, set at the Idea stage, so "continue the video" finds it the normal way. With several confirmed briefs open, the chat picks the one confirmed most recently, names it, and offers the others.
- **Where to build.** On a new branch from `origin/main` (which has `setup/start.sh`, `start.ps1`, `doctor.ps1` and `setup/runtime`), in its own worktree. The `rubik-ep1-v4` checkout and its uncommitted work are left alone.

### 3. Publishing it on first install

- A page can only declare `host:damex-engine` from a chat where that connector is already running. The "start the studio" chat adds the connector, and the customer has to approve it and start a new chat, which the release's `CLAUDE.md` already tells them to do. So the page is published in the **first chat after install**: the studio's skill sees that `studio.json` has no `brief_page` and publishes it before anything else. To the customer, it still appears on its own right after install.
- Claude stores the page's link in `studio.json` (`brief_page`), opens it, and offers once to pin it to the sidebar.
- The skill and onboarding get one line each: "open my brief page" reopens the stored link, or publishes again if it is gone.
- An update ("start the studio and bring my work from …") keeps the existing link and republishes the new page version to it.

### 4. Approvals and the storyboard

- Stage 1 (`01-intake-and-idea.md`) learns one new entry point: a job whose brief has "plan confirmed" skips intake and goes to the three concepts.
- Stages 2 to 6 are unchanged, apart from the routing below.
- Stage 3 (moodboard) and stage 4 (storyboard) check whether the Figma connector is connected, using a harmless read such as `whoami`. If it is, they build the board in Figma, one frame per shot with the same notes. If not, they use the Claude Design canvas, as now. The brand-level "designers want Figma" rule stays as an override. Hand edits in Figma still have to be carried back into the scene files.

### 5. Release

- `release/manifest.json` includes the connector, the page template and the `.mcp.json` entry. `release/overrides/ONBOARDING.md` and `README.md` mention the brief page.
- `setup/doctor.sh` and `doctor.ps1` report whether the connector starts, as a plain "ready" or "needs attention" line.
- The export's banned-word scan must pass.

## First step: prove the connector

Before building the page, a throwaway test confirms all of the following, on Mac and on Windows:

- A published artifact declaring `host:damex-engine` can call a project-level MCP server from `.mcp.json` in the Claude desktop app.
- On a fresh install, the connector is approved and running in the first chat after "start the studio", and that chat can publish the page.

If it can't, building stops and the owner chooses between approach 2 (a chat watches the page) and another way. The rest of this design assumes the test passes.

## My calls (the owner can overrule)

- The name "brief desk" (on the page: "Video brief").
- One page per studio, reused for every video, rather than one page per video.
- The connector tools and their split listed above.
- Moodboard follows the same Figma-or-canvas rule as the storyboard, for consistency.
- The `db` fallback for briefs written outside the desktop app.
- Offering to pin the page once, never pinning it without the customer's yes.
- Answer choices added to `lib/brief.mjs`, with `sample` only proposing values that the connector checks.
- On a fresh studio, the brief is parked until the brand is set up in chat.
- Links and library titles only on the page. Files go through chat.
- Saved-style ideas start through `style.mjs`.
- The page is published in the first chat after install, not in the "start the studio" chat.
- Built on a new branch from `origin/main`.

## Left to the builder

- File locations and names, the MCP wire details (SDK or a minimal stdio server), and how `.mcp.json` finds the right Node on each system.
- The exact wording on the page, within the studio's writing rules.
- Which lessons and feedback count as relevant to a new brief, and how long the summaries are.
- Tests: the connector's tools against `jobs/_sample` and a scratch job, and the brief logic's existing tests staying green.
