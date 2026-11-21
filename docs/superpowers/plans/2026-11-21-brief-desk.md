# Brief desk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A branded "Video brief" page, published in the first chat after install, that runs the engine's own brief questions against the studio's memory through a local connector, then hands a confirmed brief to the usual six approvals.

**Architecture:** A zero-dependency stdio MCP server (`tools/connector/`) wraps the existing brief logic. The brief logic gains answer choices and one `applyAnswer` entry point, and its file handling moves out of the CLI into a shared store, so the CLI and the connector run the same code. One HTML page (`studio/brief-desk/index.html`) calls the connector through the artifact `mcp` capability (`host:damex-engine`), uses `sample` only to word ideas and propose values, and falls back to `db` when the connector cannot be reached. Install registers the connector; the studio skill publishes the page.

**Tech Stack:** Node 22.13+ ES modules, `node:test`, no npm packages for the connector. The page is plain HTML, CSS and JS, loading Chakra Petch from Google Fonts.

**Spec:** `docs/superpowers/specs/2026-11-21-brief-desk-design.md`

## Global Constraints

- Node: works on 22.13 or newer, not 23, on Mac, Windows and Linux, including the portable Node in `.runtime/node`. The connector imports only `node:` modules.
- One brief logic: questions, checklist and validation live only in `tools/plan/lib/brief.mjs`. The page never re-creates them.
- At most three questions at a time, each with its recommended answer, most important first. Never ask about colours, fonts, logo, music, transitions or captions.
- The connector reads only `brands/`, `jobs/*/brief.json`, `jobs/*/job.json`, `jobs/*/plan.md`, `knowledge/`, `library/references/index.json` and `studio.json`. It never reads `.env`, `.capture/`, `jobs/*/out/`, captures or footage. It writes only inside one job folder.
- Tool replies are short summaries and IDs, never whole files. No customer file contents go into the page's versions, data or assets.
- Fresh studio: never fall back silently to the `demo` brand.
- All six approvals stay: Idea, Script and voice, Moodboard, Storyboard, First animation, Full animation. Figma stays optional.
- Release: no Tulvo or other client content. `release/manifest.json`'s banned-word scan must pass. New code and tests use the brand names `demo` and `acme` only.
- Page wording: plain words, sentence case, no dots as separators, no coding-style typeface. Title "Video brief".
- Page tokens (from `brands/damex-engine/brand.json`, which is local only and not on main): page `#010B24`, ink `#FFFFFF`, accent `#BBFC9E`, warm `#FFA724`, type Chakra Petch 400 and 500.
- Build on branch `brief-desk` from `origin/main`, in its own worktree. Leave the `rubik-ep1-v4` checkout and its uncommitted work alone.
- Commit only on the `brief-desk` branch. Never push without the owner's yes.

## Review Focus

1. A job name sent by the page that tries to leave `jobs/` (`../.env`, `a/b`, an absolute path): refused with a plain message, nothing read or written. Test in Task 5.
2. A `brief.json` that is not valid JSON (hand-edited): `brief_check` answers with a plain error naming the job, and `studio_context` skips that job instead of failing. Tests in Tasks 4 and 5.
3. A studio whose only brand is `demo`: the brief is parked with `brand_status: "none"`, never planned for `demo` unless the customer's words name the demo brand. Test in Task 5.
4. Customer words that are very long (5,000 characters) or hold quotes and line breaks: stored word for word in `brief.json`, shown cut to 120 characters in summaries. Test in Task 5.
5. The studio folder moved after install, so `.mcp.json` points at an old path: the health check says the brief page needs attention, and running the start step again repairs it. Test in Task 7.

---

### Task 0: Worktree and documents

**Files:**
- Create (copy from the `rubik-ep1-v4` checkout): `docs/superpowers/specs/2026-11-21-brief-desk-design.md`, `docs/superpowers/plans/2026-11-21-brief-desk.md`

- [ ] **Step 1: Create the worktree** with superpowers:using-git-worktrees: branch `brief-desk` from `origin/main` (`e6cb576` or later), at `../video-studio-brief-desk`.
- [ ] **Step 2: Copy the two documents** from `/Users/wedevs/Desktop/Marketer/projects/tulvo/video-studio/docs/superpowers/` into the same paths in the worktree. Leave the originals where they are.
- [ ] **Step 3: Run the existing suites to know the starting state**

Run: `node --test tools/plan/tests/*.test.mjs setup/runtime/*.test.mjs tools/release/tests/*.test.mjs`
Expected: all pass. Write down any test that already fails; it is not this plan's to fix.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-11-21-brief-desk-design.md docs/superpowers/plans/2026-11-21-brief-desk.md
git commit -m "docs: brief desk design and build plan"
```

### Task 1: Prove the connector (throwaway, gates everything after it)

Nothing in this task is kept except the written result. Work in the scratch folder, not the worktree.

**Files:**
- Create (scratch): `$SCRATCH/spike/echo.mjs`, `$SCRATCH/spike/page.html`
- Modify (kept): the spec's "First step: prove the connector" section gets a dated "Result" paragraph

- [ ] **Step 1: Write a minimal stdio MCP server `echo.mjs`** that answers `initialize`, `notifications/initialized`, `tools/list` (one tool `ping`, annotated `readOnlyHint: true`, and one tool `note` with `readOnlyHint: false`) and `tools/call` (returns `{ structuredContent: { pong: <input.text>, cwd: process.cwd() } }`). Newline-delimited JSON-RPC on stdin and stdout.
- [ ] **Step 2: Make a fresh release copy to test in**

Run: `node tools/release/export.mjs --ref HEAD --out "$SCRATCH/spike/studio"` (from the worktree), then add to its `.mcp.json`: `"damex-engine": { "type": "stdio", "command": "<absolute path of node>", "args": ["<absolute path of echo.mjs>"] }`, and to its `.claude/settings.json`: `"enabledMcpjsonServers": ["damex-engine"]`.
Expected: export finishes with no banned words.

- [ ] **Step 3: Open the copy in the Claude desktop app and start a chat.** Record: was the server asked about, auto-approved, or ignored; does `mcp__damex-engine__ping` appear in the chat's tools.
- [ ] **Step 4: From that chat, publish `page.html`** with the Artifact tool and `capabilities: { mcp: { servers: [{ server: "host:damex-engine", tools: ["ping", "note"] }] } }`. The page has two buttons that call `callTool("host:damex-engine", "ping", { text: "hi" })` and `callTool("host:damex-engine", "note", { text: "hi" })` and print `result.payload` or the error `code`.
- [ ] **Step 5: Click both buttons in the desktop app, then open the same link in a browser.** Expected: in the app, `ping` prints `{ pong: "hi", cwd: <the copy's folder> }`; record whether `note` asks the viewer to confirm. In the browser, both reject with `server_not_connected`.
- [ ] **Step 6: Fresh install path.** Delete the scratch copy's `engine/node_modules`, open it in the desktop app, say "start the studio", let it finish, start a new chat as `CLAUDE.md` says, and check the connector is running in that new chat and that the chat can publish `page.html`.
- [ ] **Step 7: Windows.** Hand the owner `$SCRATCH/spike/` with a one-page checklist of steps 2 to 6 (Windows paths: `node.exe` absolute path, `setup\start.ps1`). The owner runs it on a Windows machine and reports the six recorded answers.
- [ ] **Step 8: Write the result** in the spec, under "First step: prove the connector": date, Mac and Windows outcomes, whether `enabledMcpjsonServers` auto-approves, whether non-read-only calls prompt, and the `cwd` the server sees. Commit the spec.
- [ ] **Step 9: Gate.** If a page could not call the server on either system, stop here and ask the owner to choose between approach 2 (a chat watches the page) and another way. Tasks 2 and 3 are useful either way; Tasks 4 to 9 assume a pass.

### Task 2: Answer choices and one way to apply an answer

**Files:**
- Modify: `tools/plan/lib/brief.mjs`
- Test: `tools/plan/tests/answers.test.mjs`

**Interfaces:**
- Produces, exported from `tools/plan/lib/brief.mjs`:
  - `HOOK_FAMILIES = ['question','contrarian','outcome','problem','curiosity-gap','proof','story','how-to','list','mistake-warning','callout','comparison','offer','demonstration','pattern-interrupt','propose']` (the ids in `library/hooks/index.json`, plus `propose`)
  - `SIZES = ['9:16','1:1','4:5','16:9']`, `VOICES` (now exported, unchanged)
  - `LABELS: Record<string,string>`: plain words for every choice value (`'problem-aware': 'Aware of the problem'`, `'colour-field': 'Colour field'`, `'9:16': 'Vertical 9:16'`, …)
  - `questions()` items gain `field: string` and `choices: { value, label, recommended: boolean }[] | null`, and `many: boolean` for `ref-N`
  - `checkAnswer(brief, questionId, value) -> { ok: boolean, field: string, value: string|string[]|null, reason: string|null }`
  - `applyAnswer(brief, questionId, { value, words }) -> brief` (new object; throws `Error` with a plain message when the answer is not valid)

Question id to field and choices:

| id | field | choices |
|---|---|---|
| `brand` | `brand` | none (validated by the store) |
| `size`, `master` | `size` (through `setField`) | `SIZES` (`master`: the sizes already in `deliver`) |
| `kind` | `kind` | `KINDS` |
| `ref-N` | `references.N.liked_for` | `QUALITIES`, several allowed |
| `reference` | `references` | none; `words` is a link or library title, or a value of `none` sets `no_reference: true` |
| `product` | `product` | none |
| `audience` | `awareness`, with `words` going to `for` | `AWARENESS` |
| `viewer` | `viewer_should` | none |
| `angle` | `angle` | none |
| `proof` | `must_show` (appends `{ what: words, evidence: '' }`) | none |
| `show-N` | `must_show.N.evidence` | none |
| `voice` | `voice` | `VOICES` |
| `length` | `length_cap_seconds` (through `setField`) | none |
| `look` | `look` | `LOOKS` |
| `hook` | `hook.family`, with `words` going to `hook.idea` | `HOOK_FAMILIES` |

`checkAnswer` normalises before comparing: trims, lowercases, spaces to hyphens (`"Problem aware"` matches `problem-aware`, `"colour field"` matches `colour-field`). The recommended choice is the one whose value appears at the start of the question's existing `recommended` text, else none.

- [ ] **Step 1: Write the failing tests**

```js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyAnswer, checkAnswer, HOOK_FAMILIES, questions } from '../lib/brief.mjs';

const base = () => ({ brand: 'acme', references: [{ source: 'their reel', liked_for: [] }] });

test('answers: choice questions carry their field and choices, open ones carry none', () => {
  const q = questions(base());
  const size = q.find((x) => x.id === 'size');
  assert.equal(size.field, 'size');
  assert.deepEqual(size.choices.map((c) => c.value), ['9:16', '1:1', '4:5', '16:9']);
  assert.equal(size.choices.find((c) => c.value === '9:16').recommended, true);
  assert.equal(q.find((x) => x.id === 'ref-0').many, true);
  assert.equal(q.find((x) => x.id === 'angle').choices, null);
});

test('answers: plain words map to a value, anything else is refused with a reason', () => {
  assert.deepEqual(checkAnswer({}, 'audience', 'Problem aware'), { ok: true, field: 'awareness', value: 'problem-aware', reason: null });
  assert.equal(checkAnswer({}, 'look', 'colour field').value, 'colour-field');
  const bad = checkAnswer({}, 'look', 'neon');
  assert.equal(bad.ok, false);
  assert.match(bad.reason, /paper, night, glass/);
  assert.ok(HOOK_FAMILIES.includes('demonstration'));
});

test('answers: applyAnswer fills the field so the question is not asked again', () => {
  let b = applyAnswer(base(), 'size', { value: '9:16' });
  assert.equal(b.deliver[0].size, '9:16');
  b = applyAnswer(b, 'audience', { value: 'cold', words: 'agency owners' });
  assert.equal(b.awareness, 'cold'); assert.equal(b.for, 'agency owners');
  b = applyAnswer(b, 'ref-0', { value: ['pacing', 'sound'] });
  assert.deepEqual(b.references[0].liked_for, ['pacing', 'sound']);
  b = applyAnswer(b, 'hook', { value: 'demonstration', words: 'the export lands first' });
  assert.deepEqual(b.hook, { family: 'demonstration', idea: 'the export lands first' });
  b = applyAnswer(b, 'proof', { words: 'export to PDF' });
  assert.deepEqual(b.must_show, [{ what: 'export to PDF', evidence: '' }]);
  const ids = questions(b).map((x) => x.id);
  for (const id of ['size', 'audience', 'ref-0', 'hook', 'proof']) assert.ok(!ids.includes(id), id);
});

test('answers: "none" for the reference means the studio chooses', () => {
  const b = applyAnswer({ brand: 'acme' }, 'reference', { value: 'none' });
  assert.equal(b.no_reference, true);
});

test('answers: an invalid answer throws and leaves the brief untouched', () => {
  const b = base();
  assert.throws(() => applyAnswer(b, 'kind', { value: 'documentary' }), /kind must be one of/);
  assert.throws(() => applyAnswer(b, 'nonsense', { value: 'x' }), /No question nonsense/);
  assert.equal(b.kind, undefined);
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test tools/plan/tests/answers.test.mjs`
Expected: FAIL, `applyAnswer` is not exported.

- [ ] **Step 3: Implement** the exports above in `tools/plan/lib/brief.mjs`. `applyAnswer` uses `setField` for `size`, `kind`, `voice`, `length_cap_seconds`, `for`, `viewer_should`, so the chat's `brief.mjs set` and the page share one validation. `questions()` adds `field`, `choices` and `many` after sorting; it keeps every existing property and order.
- [ ] **Step 4: Run the new and old brief tests**

Run: `node --test tools/plan/tests/answers.test.mjs tools/plan/tests/intent.test.mjs`
Expected: PASS, all.

- [ ] **Step 5: Commit**

```bash
git add tools/plan/lib/brief.mjs tools/plan/tests/answers.test.mjs
git commit -m "feat(brief): answer choices and applyAnswer shared by chat and page"
```

### Task 3: The brief store, shared by the CLI and the connector

**Files:**
- Create: `tools/plan/lib/brief-store.mjs`, `tools/plan/tests/helpers.mjs` (exports `scratchStudio()` and `completeBrief()`)
- Modify: `tools/plan/brief.mjs` (use the store; output and exit codes unchanged)
- Test: `tools/plan/tests/brief-store.test.mjs`

**Interfaces:**
- Consumes: `plan`, `preflight`, `questions`, `assumptions`, `FRAMEWORK`, `applyAnswer` from Task 2; `loadFrameworks` from `tools/plan/lib/frameworks.mjs`.
- Produces, from `tools/plan/lib/brief-store.mjs` (every function takes the studio `root` so tests can use a scratch studio):
  - `studioContext(root) -> { brands: { [name]: { setUp, discovery } }, defaultBrand, references }` (moved from the CLI's `context()`, same rules)
  - `customerBrands(ctx) -> string[]`: set-up brands other than `demo`
  - `loadJob(jobDir) -> { brief, job }` (throws `Error("<job>: brief.json cannot be read")` on bad JSON; `brief` null when missing)
  - `saveBrief(jobDir, brief)`: atomic write, same format as today (`JSON.stringify(data, null, 1)`)
  - `startBrief(root, jobDir, words) -> brief`: from `templates/brief.json`, refuses when `brief.json` exists
  - `jobFolderName(words, date = today) -> 'YYYY-MM-DD-<slug>'`: slug from the first five words that are not `a, an, the, for, of, to, and, my, our`, lowercase ASCII and hyphens, at most 40 characters, `video` when nothing is left
  - `setDotted(obj, dotted, value)` (moved from the CLI)
  - `writePlan(root, jobDir) -> { lines, outline, framework, uses, md } | null`: picks the framework as the CLI does today and writes `plan.md`; null when the checklist is not complete
  - `decide(jobDir, what, { by = 'owner', applies = 'all' }) -> brief`
  - `confirmPlan(root, jobDir) -> job`: records the decision `plan confirmed`, and when `job.json` is missing creates it from `templates/job.json` with `name`, `brand`, `type` (kind to type: `product-demo` demo, `tutorial` tutorial, `footage-edit`/`ugc`/`animated-short` edit, anything else promo), `size` (the master), `length_cap_seconds`, `created` (today), `stage_next: 'idea'`, `approval_mode: 'guided'`. An existing `job.json` (a saved-style job) is left as it is apart from a note. Throws when `plan.md` is missing or the plan is not complete.

- [ ] **Step 1: Write the failing tests**, each in a scratch studio made by a helper `scratchStudio()` that copies `templates/brief.json`, `templates/job.json`, `library/structure/frameworks.json` and creates `brands/acme/brand.json` and `brands/demo/brand.json` and `studio.json` (`{ "default_brand": "demo" }`):

```js
test('store: jobFolderName makes a short dated folder name', () => {
  assert.equal(jobFolderName('A vertical demo of the new export button for agencies', '2026-11-21'), '2026-11-21-vertical-demo-new-export-button');
  assert.equal(jobFolderName('!!!', '2026-11-21'), '2026-11-21-video');
});
test('store: customerBrands leaves out demo', () => {
  assert.deepEqual(customerBrands(studioContext(root)), ['acme']);
});
test('store: a bad brief.json is a plain error naming the job', () => {
  fs.writeFileSync(path.join(jobDir, 'brief.json'), '{ nope');
  assert.throws(() => loadJob(jobDir), /brief\.json cannot be read/);
});
test('store: confirmPlan refuses before the plan, then makes job.json at the Idea stage', () => {
  startBrief(root, jobDir, 'a demo');
  assert.throws(() => confirmPlan(root, jobDir), /plan/);
  saveBrief(jobDir, completeBrief());            // the complete brief from intent.test.mjs, brand acme
  assert.ok(writePlan(root, jobDir).md.startsWith('# The plan, in brief'));
  const job = confirmPlan(root, jobDir);
  assert.equal(job.stage_next, 'idea'); assert.equal(job.type, 'demo'); assert.equal(job.brand, 'acme');
  assert.ok(loadJob(jobDir).brief.decisions.some((d) => d.what === 'plan confirmed'));
});
```

Add one CLI test that runs `node tools/plan/brief.mjs new <scratch job> "a vertical demo"` then `check <job>` and asserts exit code 1 and the line `Pre-flight: ` in the output, so the refactor keeps the CLI working.

- [ ] **Step 2: Run to see them fail**

Run: `node --test tools/plan/tests/brief-store.test.mjs`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `brief-store.mjs`, then make `tools/plan/brief.mjs` import from it** (`studioContext`, `loadJob`, `saveBrief`, `startBrief`, `setDotted`, `writePlan`, `decide`). The CLI's printed text and exit codes stay the same. `startBrief` keeps the recipe hint in the CLI only.
- [ ] **Step 4: Run all plan tests**

Run: `node --test tools/plan/tests/*.test.mjs`
Expected: PASS, all.

- [ ] **Step 5: Commit**

```bash
git add tools/plan/lib/brief-store.mjs tools/plan/brief.mjs tools/plan/tests/brief-store.test.mjs tools/plan/tests/helpers.mjs
git commit -m "refactor(brief): move file handling into a store the connector can share"
```

### Task 4: What the memory knows (`studio_context`)

**Files:**
- Create: `tools/connector/lib/memory.mjs`
- Test: `tools/connector/tests/memory.test.mjs`

**Interfaces:**
- Consumes: `studioContext`, `customerBrands`, `loadJob` (Task 3); `questions` (Task 2).
- Produces:
  - `safePath(root, rel) -> string`: absolute path, throws `Error("Not allowed: <rel>")` unless `rel` matches the read list in Global Constraints and stays inside `root` after resolving
  - `studioMemory(root) -> { parked: boolean, brands: Brand[], styles: Style[], briefs: Brief[] }` where
    - `Brand = { name, discovery: boolean, last_films: { name, type, date, hook, look }[] (newest 5 from ledger.json), lessons: { date, title }[] (newest 3 from brands/<b>/lessons/*.md, README left out; title is the first heading) }`, customer brands only
    - `Style = { ref: '<brand>/<style>', size, kind, scenes: number, from_job }`
    - `Brief = { job, words (first 120 characters), brand, stage: job.stage_next or 'brief', confirmed: date string or null, open: number of questions, parked: boolean }`, jobs not starting with `_`, newest confirmed first, then newest changed, at most 10; a job whose `brief.json` cannot be read is left out

- [ ] **Step 1: Write the failing tests** in a scratch studio (`scratchStudio()` from `tools/plan/tests/helpers.mjs`, Task 3):

```js
test('memory: refuses the keys file, captures and renders', () => {
  for (const rel of ['.env', '.capture/acme/state.json', 'jobs/x/out/film.mp4', 'jobs/../.env', '../outside.json']) assert.throws(() => safePath(root, rel), /Not allowed/);
  assert.ok(safePath(root, 'jobs/x/brief.json').endsWith(path.join('jobs', 'x', 'brief.json')));
});
test('memory: last five films and newest lessons per customer brand, demo left out', () => {
  // ledger.json with 7 films, lessons/2026-11-01-a.md and 2026-11-09-b.md
  const m = studioMemory(root);
  assert.deepEqual(m.brands.map((b) => b.name), ['acme']);
  assert.equal(m.brands[0].last_films.length, 5);
  assert.equal(m.brands[0].lessons[0].date, '2026-11-09');
  assert.equal(m.parked, false);
});
test('memory: the most recently confirmed brief comes first, a broken one is skipped', () => {
  // job A confirmed 2026-11-20, job B confirmed 2026-11-21, job C brief.json = "{ nope"
  assert.deepEqual(studioMemory(root).briefs.map((b) => b.job), ['B', 'A']);
});
test('memory: a studio with only the demo brand is parked', () => {
  fs.rmSync(path.join(root, 'brands/acme'), { recursive: true });
  assert.equal(studioMemory(root).parked, true);
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test tools/connector/tests/memory.test.mjs`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `memory.mjs`.** Every file read goes through `safePath`. `confirmed` is the `date` of the newest decision whose `what` is `plan confirmed`.
- [ ] **Step 4: Run**

Run: `node --test tools/connector/tests/memory.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/connector/lib/memory.mjs tools/connector/tests/memory.test.mjs
git commit -m "feat(connector): summaries of what the studio's memory knows"
```

### Task 5: The six connector tools

**Files:**
- Create: `tools/connector/lib/tools.mjs`
- Test: `tools/connector/tests/tools.test.mjs`

**Interfaces:**
- Consumes: Tasks 2, 3 and 4.
- Produces:
  - `TOOLS: { name, description, inputSchema, annotations: { readOnlyHint } }[]` for `studio_context` (read only), `brief_check` (read only), `brief_start`, `brief_answer`, `brief_plan`, `brief_confirm`
  - `makeHandlers(root) -> { [toolName]: (input) => object }`, each throwing `Error` with a plain message on bad input
  - Inputs: `brief_start { words: string, style?: '<brand>/<style>' }`; `brief_check { job }`; `brief_answer { job, question, value?: string|string[], words?: string }`; `brief_plan { job }`; `brief_confirm { job }`. `job` is a folder name matching `/^[a-z0-9][a-z0-9-]{0,80}$/` that exists in `jobs/`; anything else throws `Not a brief: <job>` before a path is built.
  - `brief_check` returns `{ job, brand_status: 'ready'|'none'|'needs-setup'|'needs-discovery', assumed, preflight: { id, label, done, known, todo }[], questions: (first three, with field, choices, many), more: number, ready_for_plan: boolean, parked: boolean }`
  - `brief_start` and `brief_answer` return `brief_check`'s reply, plus `brief_answer` adds `recorded: boolean, reason: string|null`
  - `brief_plan` returns `{ job, lines, outline: { n, name, from, to, shows }[] }` or throws `Not yet: …` listing open items
  - `brief_confirm` returns `{ job, stage: 'idea', next: 'Start a new chat in the studio folder and say "continue the video".' }`, or, when parked, `next: 'Set up your brand first: start a new chat in the studio folder and say "set up my brand".'`

Rules the tests pin:
- With no customer brand, `brief_check` builds its context without `defaultBrand`, so `demo` is not assumed unless the words name it. `brief_start` then sets `brief.parked = 'no brand yet'`; the brief is still filled, `brand_status` is `none`, and `brief_confirm` records the decision but answers with the brand set-up step.
- `brief_answer` with `words` always records the decision `<question in short>: "<words>"`. A `value` that fails `checkAnswer` records nothing else and returns `recorded: false` with the reason. A `brand` value must be one of `customerBrands`.
- `brief_start` with `style` spawns `process.execPath tools/plan/style.mjs new jobs/<name> --style <ref> <words>` with `cwd: root` and returns its failure message as the error.

- [ ] **Step 1: Write the failing tests**

```js
const h = makeHandlers(root);
test('tools: start, answer and plan a brief in the page\'s order', () => {
  const s = h.brief_start({ words: 'A vertical demo of the export button for acme' });
  assert.match(s.job, /^\d{4}-\d{2}-\d{2}-vertical-demo-export-button/);
  assert.ok(s.assumed.some((a) => a.id === 'size' && a.value === '9:16'));
  assert.ok(s.questions.length <= 3);
  const a = h.brief_answer({ job: s.job, question: 'look', value: 'neon', words: 'something neon' });
  assert.equal(a.recorded, false); assert.match(a.reason, /paper/);
  assert.ok(loadJob(path.join(root, 'jobs', s.job)).brief.decisions.some((d) => /something neon/.test(d.what)));
});
test('tools: job names that leave jobs/ are refused', () => {
  for (const job of ['../.env', 'a/b', '/etc', 'C:\\x', '']) assert.throws(() => h.brief_check({ job }), /Not a brief/);
});
test('tools: a broken brief.json is a plain error', () => {
  assert.throws(() => h.brief_check({ job: 'broken' }), /broken: brief\.json cannot be read/);
});
test('tools: only the demo brand means parked, never demo by default', () => {
  const r = makeHandlers(demoOnlyRoot).brief_start({ words: 'a launch reel for our new app' });
  assert.equal(r.brand_status, 'none'); assert.equal(r.parked, true);
  assert.ok(!r.assumed.some((x) => x.id === 'brand'));
});
test('tools: long words with quotes and line breaks are kept word for word', () => {
  const words = `"Quoted"\nsecond line ${'x'.repeat(5000)}`;
  const s = h.brief_start({ words });
  assert.equal(loadJob(path.join(root, 'jobs', s.job)).brief.in_their_words, words);
  assert.ok(studioMemory(root).briefs.find((b) => b.job === s.job).words.length <= 120);
});
test('tools: confirm makes job.json at the Idea stage', () => { /* complete brief, brief_plan, brief_confirm; job.json stage_next idea */ });
test('tools: TOOLS names match the handlers, and only check and context are read only', () => {
  assert.deepEqual(TOOLS.map((t) => t.name).sort(), Object.keys(h).sort());
  assert.deepEqual(TOOLS.filter((t) => t.annotations.readOnlyHint).map((t) => t.name).sort(), ['brief_check', 'studio_context']);
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test tools/connector/tests/tools.test.mjs`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `tools.mjs`.** Job names are checked before any path is built, then the path goes through `safePath`.
- [ ] **Step 4: Run**

Run: `node --test tools/connector/tests/*.test.mjs tools/plan/tests/*.test.mjs`
Expected: PASS, all.

- [ ] **Step 5: Commit**

```bash
git add tools/connector/lib/tools.mjs tools/connector/tests/tools.test.mjs
git commit -m "feat(connector): the six brief tools"
```

### Task 6: The stdio server

**Files:**
- Create: `tools/connector/lib/rpc.mjs`, `tools/connector/server.mjs`
- Test: `tools/connector/tests/rpc.test.mjs`

**Interfaces:**
- Consumes: `TOOLS`, `makeHandlers` (Task 5).
- Produces:
  - `createServer({ name, version, tools, handlers }) -> { handle(message: object) -> object | null }`
  - `serveStdio(server, input = process.stdin, output = process.stdout)`: newline-delimited JSON-RPC 2.0; logs only to stderr
  - `server.mjs`: `root = process.env.DAMEX_STUDIO_ROOT || <studio folder from the file's own location>`, name `damex-engine`, version from `<root>/RELEASE.json` (`version`) when present, else `0.0.0`

Protocol: `initialize` answers with the client's `protocolVersion` when it is one of `2025-06-18`, `2025-03-26`, `2024-11-05`, else `2025-06-18`, and `capabilities: { tools: {} }`. `tools/list` returns `TOOLS`. `tools/call` returns `{ content: [{ type: 'text', text: JSON.stringify(out) }], structuredContent: out }`, or on a thrown error `{ content: [{ type: 'text', text: message }], isError: true }`. `ping` returns `{}`. Notifications get no reply. Unknown methods get error `-32601`. A line that is not JSON gets error `-32700` with `id: null`.

- [ ] **Step 1: Write the failing tests**

```js
test('rpc: initialize, list and call over a real child process', async () => {
  const child = spawn(process.execPath, [SERVER], { env: { ...process.env, DAMEX_STUDIO_ROOT: root } });
  const ask = lineClient(child);   // writes a JSON line, resolves with the reply that has the same id
  const init = await ask({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } });
  assert.equal(init.result.protocolVersion, '2025-06-18');
  assert.equal(init.result.serverInfo.name, 'damex-engine');
  const list = await ask({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert.equal(list.result.tools.length, 6);
  const ctx = await ask({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'studio_context', arguments: {} } });
  assert.equal(ctx.result.structuredContent.brands[0].name, 'acme');
  const bad = await ask({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'brief_check', arguments: { job: '../.env' } } });
  assert.equal(bad.result.isError, true);
  child.kill();
});
test('rpc: a line that is not JSON gets a parse error, an unknown method gets -32601', () => {
  const s = createServer({ name: 'x', version: '1', tools: [], handlers: {} });
  assert.equal(s.handle({ jsonrpc: '2.0', id: 9, method: 'nope' }).error.code, -32601);
  assert.equal(s.handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test tools/connector/tests/rpc.test.mjs`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `rpc.mjs` and `server.mjs`.**
- [ ] **Step 4: Run**

Run: `node --test tools/connector/tests/*.test.mjs`
Expected: PASS, all.

- [ ] **Step 5: Commit**

```bash
git add tools/connector/lib/rpc.mjs tools/connector/server.mjs tools/connector/tests/rpc.test.mjs
git commit -m "feat(connector): zero-dependency stdio MCP server"
```

### Task 7: Install registers the connector, the health check reports it

**Files:**
- Create: `setup/runtime/connector.mjs`
- Modify: `setup/runtime/start.mjs` (step 1 of 3), `setup/runtime/doctor.mjs` (capabilities), `.claude/settings.json`
- Test: `setup/runtime/connector.test.mjs`

**Interfaces:**
- Consumes: `tools/connector/server.mjs` (Task 6).
- Produces:
  - `registerConnector(root, nodePath = process.execPath) -> 'added' | 'updated' | 'unchanged'`: writes `.mcp.json` `mcpServers['damex-engine'] = { type: 'stdio', command: nodePath, args: [<absolute path of tools/connector/server.mjs>] }`, keeping every other server and key; creates `.mcp.json` when missing
  - `probeConnector(root, { timeoutMs = 5000 }) -> Promise<{ ok: boolean, tools: string[], error: string | null }>`: reads the entry from `.mcp.json`, starts it, sends `initialize` and `tools/list`, stops it
- `start.mjs`: after "Hidden files", prints `Brief page connector: added` (or updated, or already set). Doctor adds a capability check with id `brief-page`: pass, found `the brief page's connector starts (6 tools)`; otherwise skip, found the error, fix `run the start step again: bash setup/start.sh (Windows: setup\start.ps1)`. Because `doctor.sh` and `doctor.ps1` already hand off to `doctor.mjs`, they need no change.
- `.claude/settings.json`: add `"enabledMcpjsonServers": ["damex-engine"]` only if Task 1 recorded that it auto-approves; otherwise leave settings alone and add one line to `release/overrides/CLAUDE.md` telling Claude to ask the person to approve "damex-engine" when the app asks (done in Task 9).

- [ ] **Step 1: Write the failing tests**

```js
test('connector: register adds the entry and keeps other servers', () => {
  write(root, '.mcp.json', JSON.stringify({ mcpServers: { viralhooks: { type: 'http', url: 'https://example.com/mcp/' } } }));
  assert.equal(registerConnector(root, '/x/node'), 'added');
  const m = JSON.parse(fs.readFileSync(path.join(root, '.mcp.json'), 'utf8'));
  assert.ok(m.mcpServers.viralhooks);
  assert.deepEqual(m.mcpServers['damex-engine'], { type: 'stdio', command: '/x/node', args: [path.join(root, 'tools', 'connector', 'server.mjs')] });
  assert.equal(registerConnector(root, '/x/node'), 'unchanged');
});
test('connector: a moved folder is caught by the probe and fixed by registering again', async () => {
  copyConnector(STUDIO, root);   // copies tools/connector, tools/plan and templates into the scratch root
  registerConnector(oldRoot, process.execPath);
  fs.cpSync(path.join(oldRoot, '.mcp.json'), path.join(root, '.mcp.json'));   // still points at oldRoot
  fs.rmSync(oldRoot, { recursive: true });
  assert.equal((await probeConnector(root)).ok, false);
  assert.equal(registerConnector(root, process.execPath), 'updated');
  const p = await probeConnector(root);
  assert.equal(p.ok, true); assert.equal(p.tools.length, 6);
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test setup/runtime/connector.test.mjs`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `connector.mjs`, then wire it into `start.mjs` and `doctor.mjs`.** On Windows `nodePath` is `node.exe`'s absolute path; the server path uses `path.join`, so backslashes are right.
- [ ] **Step 4: Run the setup suites and the doctor**

Run: `node --test setup/runtime/*.test.mjs` then `node setup/runtime/doctor.mjs`
Expected: tests PASS; the doctor's optional list shows the brief page line as ready (after `node -e "import('./setup/runtime/connector.mjs').then(m=>console.log(m.registerConnector(process.cwd())))"` in the worktree).

- [ ] **Step 5: Commit**

```bash
git add setup/runtime/connector.mjs setup/runtime/connector.test.mjs setup/runtime/start.mjs setup/runtime/doctor.mjs .claude/settings.json
git commit -m "feat(setup): register the brief page connector and report it in the health check"
```

### Task 8: The brief page

**Files:**
- Create: `studio/brief-desk/index.html`, `studio/brief-desk/capabilities.json`, `tools/connector/preview.mjs`
- Modify: `.claude/launch.json` (add `brief-desk-preview`)
- Test: `studio/tests/brief-desk.test.mjs`

**Interfaces:**
- Consumes: the six tools through `callTool("host:damex-engine", <tool>, <input>)`, reading `result.payload` (Task 5 shapes).
- Produces:
  - `capabilities.json`, the exact object the skill publishes with:

```json
{
  "mcp": { "servers": [{ "server": "host:damex-engine", "tools": ["studio_context", "brief_start", "brief_check", "brief_answer", "brief_plan", "brief_confirm"] }] },
  "sample": {},
  "db": { "rules": [{ "path": "briefs", "read": "admin", "write": "admin" }] }
}
```

  - `db` documents written only in the fallback: `briefs/<id>` = `{ words: string, at: ISO string, status: 'waiting' }`; the chat sets `status: 'taken'` and `job` when it picks one up
  - `tools/connector/preview.mjs [--root <studio>] [--port 4417]`: serves `index.html` with a stub `window.claude.use` injected before the page script, where `use('mcp')` posts to `/call` and runs the real handlers for `--root`, `use('sample')` returns `null`, and `use('db')` keeps documents in memory. `?nohost=1` makes `use('mcp')` reject every call with `{ code: 'server_not_connected' }`.

Page states, in order: **start** (welcome line, "What video do you want to make?", one large text box, ideas from `studio_context`; with no past work, three starter examples), **questions** (what the engine understood, up to three cards with the recommended choice preselected and a box for the customer's own words, a strip with the eight checklist items), **plan** (the plan lines and outline, "Confirm this plan" and "Change something"), **hand-off** (the `next` text from `brief_confirm`), **parked** (the brand set-up step, the brief kept), and a **your briefs** list (from `studio_context.briefs`, stage and confirmed date, click to resume with `brief_check`).

Behaviour the page must have:
- Error codes, each its own message: `server_not_connected` shows the fallback (works in the Claude desktop app with the studio folder open; the brief box still saves to `db`); `cancelled` and `approval_required` keep the card and say the app needs the customer's OK; `tool_error` shows the tool's message in the card it affects; `server_unavailable` retries reads once after a short random delay, never writes. Writes run only on a click.
- `sample` is optional: with it, ideas are worded from the summaries and free text on a choice card is sent as `value` (the proposed choice) plus `words`; without it, ideas show as the plain summaries and free text goes as `words` only.
- Branding: tokens on `:root` (Global Constraints values), Chakra Petch from Google Fonts with a system sans fallback, the Damex Video Engine wordmark inlined as SVG from the local `brands/damex-engine/logo/wordmark-on-dark.svg`. Dark only for now, written as tokens so a light set can follow. Works at 375 px wide with a 16 px gutter.
- No file inputs, no uploads. References are links or library titles typed in; the page says files are added in chat ("I have a file to add").

- [ ] **Step 1: Write the failing static test**

```js
test('brief page: calls only the connector tools that exist, and declares them all', () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  const caps = JSON.parse(fs.readFileSync(CAPS, 'utf8'));
  const called = [...html.matchAll(/callTool\(\s*HOST\s*,\s*'([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(called)].sort(), TOOLS.map((t) => t.name).sort());
  assert.deepEqual(caps.mcp.servers[0].tools.sort(), TOOLS.map((t) => t.name).sort());
  assert.match(html, /const HOST = 'host:damex-engine'/);
});
test('brief page: brand tokens, no uploads, no banned words, no browser storage for briefs', () => {
  const html = fs.readFileSync(PAGE, 'utf8');
  for (const t of ['#010B24', '#BBFC9E', '#FFA724', 'Chakra Petch']) assert.ok(html.includes(t), t);
  assert.doesNotMatch(html, /type="file"|localStorage\.setItem\([^)]*brief/i);
  const banned = new RegExp(JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).banned.join('|'), 'i');
  assert.doesNotMatch(html, banned);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `node --test studio/tests/brief-desk.test.mjs`
Expected: FAIL, the page does not exist.

- [ ] **Step 3: Build `index.html`, `capabilities.json` and `preview.mjs`.** Load the `artifact-design` skill before writing the page.
- [ ] **Step 4: Run the static test**

Run: `node --test studio/tests/brief-desk.test.mjs`
Expected: PASS.

- [ ] **Step 5: Walk the page in the browser pane against a scratch studio** (`preview_start` with `brief-desk-preview`, root a scratch copy holding `brands/acme` with a ledger): type a brief, answer every card until the plan shows, confirm, check the scratch job has `job.json` at `idea`. Then reload with `?nohost=1` and check the fallback saves the words. Then at 375 px. Screenshot each state. Check the console has no errors.
- [ ] **Step 6: Commit**

```bash
git add studio/brief-desk studio/tests/brief-desk.test.mjs tools/connector/preview.mjs .claude/launch.json
git commit -m "feat(brief-desk): the branded brief page"
```

### Task 9: Publishing, the stages and the release

**Files:**
- Modify: `.claude/skills/video-studio/SKILL.md`, `.claude/skills/video-studio/stages/00-brand-setup.md`, `stages/00b-product-discovery.md`, `stages/01-intake-and-idea.md`, `stages/03-moodboard.md`, `stages/04-storyboard.md`, `release/overrides/CLAUDE.md`, `release/overrides/ONBOARDING.md`, `release/overrides/README.md`
- Test: `tools/release/tests/overrides.test.mjs` (add assertions)

Exact rules to write (wording in the studio's style; the meaning is fixed):

- **SKILL.md, "Start of every session", new first step:** when `studio.json` has no `brief_page` and the `damex-engine` tools are in this chat, publish `studio/brief-desk/index.html` with the Artifact tool, `capabilities` from `studio/brief-desk/capabilities.json`, title "Video brief", icon `video`; store the link as `brief_page` in `studio.json`; tell the person in one line it is their brief page; offer once to pin it, and pin only on a yes. When `brief_page` exists and the page file changed since (an update), publish to the same `url`. "Open my brief page" opens `brief_page`, or publishes again when the link is gone.
- **SKILL.md, picking up a brief:** on "continue the video" with no job named, take the job with the newest `plan confirmed` decision, name it, and offer the others. On "make a video" or "continue the video", read the page's `briefs` collection with ArtifactData; for each `status: 'waiting'`, run `brief.mjs new` with its words and set `status: 'taken'` and `job`.
- **Stage 01:** a new first line under "1. Intake": when `brief.mjs show` lists the decision "plan confirmed", skip intake and the pre-flight questions and go to the three concepts.
- **Stages 00 and 00B, end:** jobs whose `brief.json` has `parked` get the new brand set with `brief.mjs set <job> brand <brand>` and the `parked` field removed; then say the brief is ready on the page.
- **Stages 03 and 04:** before building, check Figma with a harmless read (`whoami`). Connected: build in Figma, one frame per artboard or shot with the same notes, and record `figma_file` in `job.json`. Not connected: the design canvas, as now. The brand's "designers want Figma" rule still wins. Hand edits in Figma are carried back into the scene files.
- **release/overrides/CLAUDE.md:** one line, "Open my brief page" opens the brief page; the first chat after setup publishes it. Plus the approval line from Task 7 when settings do not auto-approve.
- **release/overrides/ONBOARDING.md and README.md:** one line each under "Make a video": after setup, the first chat opens your brief page; write the video you want there, then start a new chat and say "continue the video".

- [ ] **Step 1: Add the failing release assertions** to `tools/release/tests/overrides.test.mjs`: the onboarding and README overrides mention "brief page"; `release/overrides/studio.json` has no `brief_page` (so the first chat publishes); `release/manifest.json`'s `exclude` covers none of `tools/connector`, `studio/brief-desk`, `setup/runtime/connector.mjs`.
- [ ] **Step 2: Run to see them fail**

Run: `node --test tools/release/tests/overrides.test.mjs`
Expected: FAIL on the "brief page" lines.

- [ ] **Step 3: Write the skill, stage and override changes above.**
- [ ] **Step 4: Run the release tests**

Run: `node --test tools/release/tests/*.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit** (the export reads the commit, never the working folder)

```bash
git add .claude/skills/video-studio release/overrides tools/release/tests/overrides.test.mjs
git commit -m "feat(studio): publish the brief page on first chat, route confirmed briefs and Figma-or-canvas boards"
```

- [ ] **Step 6: Export the branch**

Run: `node tools/release/export.mjs --ref HEAD --out "$SCRATCH/rc"`
Expected: no banned words, and `$SCRATCH/rc` holds `tools/connector/server.mjs`, `studio/brief-desk/index.html` and `setup/runtime/connector.mjs`.

- [ ] **Step 7: Fresh-install walk-through on the export (Mac):** open `$SCRATCH/rc` in the desktop app, say "start the studio", start a new chat, and check: the page is published and opened without asking, `studio.json` holds `brief_page`, a brief typed on the page reaches a plan, and in a fresh studio the page parks the brief and shows the brand set-up step. Then "set up my brand" picks the parked brief up, and "continue the video" goes straight to the three concepts. Fix anything found in a new commit and export again.

### Task 10: Whole-branch check

- [ ] **Step 1: Run every touched suite**

Run: `node --test tools/plan/tests/*.test.mjs tools/connector/tests/*.test.mjs setup/runtime/*.test.mjs studio/tests/brief-desk.test.mjs tools/release/tests/*.test.mjs`
Expected: PASS, all, with the same pre-existing failures noted in Task 0 and no new ones.

- [ ] **Step 2: Windows.** Send the owner the export from Task 9 with the Task 9 step 5 checklist (Windows commands). Record the outcome in the spec.
- [ ] **Step 3: Report to the owner** what was checked and what was not (Linux not walked through by hand; Windows as reported). Ask before pushing or opening a pull request.
