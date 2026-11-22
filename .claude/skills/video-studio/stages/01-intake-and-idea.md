# Stage 0–1: intake and idea

Ends with the **Idea** approval.

## Read first

- `knowledge/playbooks/<type>.md` once the type is known
- `knowledge/craft/00-principles.md`
- `knowledge/craft/01-direction.md` (soul sheet and energy map sections)
- `brands/<brand>/ledger.json` (the last five videos)
- For motion graphics: the recipe card (`node tools/plan/recipe.mjs show <id>`) and `knowledge/craft/18-brief-expansion.md`

## 1. Intake: the brief, in their words

When `node tools/plan/brief.mjs show jobs/<job>` lists the decision "plan confirmed" (the brief page does this), skip this section and the pre-flight questions below and go straight to section 3, the three concepts. Say in one line that the plan is already confirmed.

Start with what the creator said, word for word: `node tools/plan/brief.mjs new jobs/<date>-<name> "<their words>"`. Add any references or footage they gave to `brief.json` (`references`, `materials`), each with what they said about it. Then run `node tools/plan/brief.mjs check jobs/<job>`.

- It states back what their words already settle ("vertical" is 9:16): say it in one line so they can correct it; do not ask it.
- It lists only the questions whose answers change what gets made, most consequential first. Ask at most three at a time, each with the recommended answer, in plain words. The usual first ones: the master size; what kind of film (product demo, launch reel, edit of their footage, a person talking, an animated short); and, for every reference, **what they like about it**: the camera, the pacing, the presenter's delivery, the look, the type or the sound. That answer decides what gets copied. A reference liked for its delivery needs a short performance test before anything else is made; one liked for its camera needs a motion test, not a still.
- For every claim the film makes ("it connects", "it's fast"), ask what the viewer literally sees that proves it, and write it as `must_show[].evidence`.
- Record each answer once. A field goes in with `node tools/plan/brief.mjs set jobs/<job> <field> "<value>"`, which stops `check` asking it: `kind`, `for`, `viewer_should`, `voice`, `length_cap_seconds` and `size` are checked and normalised, and any other field is set as given (`brand`, `product`, `awareness`, `angle`, `look`, `hook.family`, …). Anything else goes in with `brief.mjs decide`. Run `check` once more at the end, not after every answer. Every later stage reads `brief.mjs show` instead of re-asking.

**Motion graphics.** `brief.mjs new` names the closest recipe when the words point to one (or run `node tools/plan/recipe.mjs match "<their words>"`). Read its card, then `node tools/plan/recipe.mjs apply jobs/<job> <id>`: it records the recipe and fills only the empty kind, length and size from the recipe's defaults (say those back in one line). The card's questions replace the generic ones where they overlap; ask none whose default is fine for this brief. When the brief is one line, expand it into the director brief of `knowledge/craft/18-brief-expansion.md` section 4 and show that, not a list of questions.

Do not ask for facts you can look up in `knowledge/` or the brand folder.

### The pre-flight checklist

`check` opens with eight items. **Nothing is captured, generated, scripted or proposed until all eight are known and the creator has confirmed the plan.** Each one is known when:

| # | Item | Known when | Look up before asking |
|---|---|---|---|
| 1 | Brand | `brand` names a set-up folder in `brands/` | their words, `job.json`, `studio.json`. Not set up: stage 0 first |
| 2 | Product | `product` names the product and the one feature or moment | `brands/<brand>/product/`. No approved discovery: stage 0B first. Not needed for an edit of footage or an animated short |
| 3 | Audience | `for` (who exactly) and `awareness` (cold, problem-aware, solution-aware, product-aware) | discovery section 2: propose the ideal customer, ask them to confirm |
| 4 | Message angle | `angle` (the one sentence the film argues), `viewer_should`, and at least one `must_show` with its `evidence` | discovery section 3, key messages |
| 5 | Style and look | `look`: one of the six styles, a reference's look, or `propose` | the brand's last five films in `ledger.json`, so the look differs |
| 6 | Hook | `hook.family` or `hook.idea`, or `propose` (three openings from three families) | `hooks.mjs find --awareness <level> --brand <brand>` |
| 7 | Video type and references | `kind`, and every reference with what they like about it (or `no_reference: true`) | `check` shows library films to point at: "like this one?" |
| 8 | Size, length and voice | the master size, `length_cap_seconds`, `voice` | their words ("vertical") |

Thorough is these eight, not more. Do not ask about colours, fonts, logo, music track, transitions or captions: the brand and the later stages settle those. A creator who says "you choose" on look or hook has answered: record `propose`.

### The plan, in brief

When `check` shows all eight known, run `node tools/plan/brief.mjs plan jobs/<job>`. It writes `jobs/<job>/plan.md`: the film in one line, who it is for, the angle and its proof, the look, the hook, the references and what is borrowed from each, a scene outline timed to the length cap with the proof placed on its beat, and what the studio will use (playbook, craft guides, the brand's references and study cards, the library, the leading skills from `skill-map.md`). Show it to the creator as it is: short, in their words. On their yes, `brief.mjs decide jobs/<job> "plan confirmed"`. A change sends you back to `set`, then `plan` again.

The scene outline is the spine for everything after: the three concepts fill it, the script is timed against it (`beats.mjs`), and the storyboard's `shots.json` gets one scene per beat. Load the skills `plan.md` names at the moment their task starts, not before.

## 2. The material

Choose each shot's source by what the film must prove: the real product (screen capture), the creator's footage, drawn motion and type, or generated footage. Defaults per kind are in `tools/plan/lib/brief.mjs` (`PATHS`); generated people and recurring characters always get a short test first.

If the film shows a web product: walk the task in the product in the browser pane (signed in to a demo account with no real customer data), using the product's Claude connector if it has one to set up believable demo data. Capture every screen and state at double resolution into `jobs/<job>/captures/`. Compare with `brands/<brand>/product/` and note what changed. Write the task as a flow table in `jobs/<job>/flow.md` (format in `knowledge/craft/10-flows.md`), marking each step show, shorten or cut. Reuse a saved flow from `brands/<brand>/product/flows/` if the product has not changed since.

If the product cannot honestly do something the brief assumes, say so now.

## 3. Three concepts

Only after the plan is confirmed. All three keep the confirmed audience, angle, proof and length; they differ in idea. Where the plan says `propose` for the look or the hook, the concepts are where those are proposed. Each concept is a filled `templates/soul-sheet.md` laid on the plan's scene outline, plus:

- A recommended length cap, energy preset and design style (one of the six in `knowledge/craft/13-design-styles.md`), with one line of reasoning each. With a recipe, start from its defaults and say where a concept departs from them and why.
- With a recipe: its structure beats with seconds, and which of its reference films each concept learns from (study only).
- The flow pattern it uses (`knowledge/craft/10-flows.md`).
- Up to three study cards it learns from, and the one technique taken from each.
- How its hook, look and signature move differ from the last five videos.
- The hook family each idea would open with (`knowledge/craft/15-hooks.md` section 4; `node tools/hooks/hooks.mjs find --type <type> --platform <platform> --awareness <level> --brand <brand>` gives formulas the brand has not used lately). The three ideas open in three different families.

### Their style picks and director's brief

`node tools/plan/brief.mjs show jobs/<job>` lists the creator's style picks and their director's brief, when they made any on the brief page. Treat both as the creator's own direction: a strong preference, to follow unless a rule or a fact stops it.
- **Each pick** is used as picked by at least one of the three concepts. Read it with `node tools/styles/styles.mjs show <id>` and put its `promptText` into that concept's direction, in its own words.
- **A made-on-request pick** (the `show` output ends "made on request") has no ready version yet. Use the closest ready style it names, and say so in one line: "<their style> is made on request, so this concept uses <closest style>."
- **Where the studio recommends something else**, say why in one line next to that concept. Their pick stays in at least one concept either way.
- **The director's brief** is the customer's direction under the same rule. Keep its logline, beats and energy unless a brand rule or the confirmed plan says otherwise, and say in one line what changed and why.

The three must differ from each other in idea, not only in styling. Recommend one.

## 4. Hand-over

Create `jobs/<date>-<name>/job.json` from `templates/job.json`. Present the three soul sheets and the recommendation. Stop for the Idea approval. Record the chosen concept and the length cap in `job.json`. When the person says yes (or their brief already approves it), also run `node tools/conductor/gate.mjs approve jobs/<job> idea --inputs <soul sheets file name, e.g. soul-sheets.md>` (paths inside the job folder) (add `--mode grouped` if they chose grouped approvals) so a restart does not ask again.
