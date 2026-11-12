# Cursor video sample: editorial and production guide

## Scope

This guide summarizes 12 locally supplied videos filed under Cursor, totaling about 8.8 minutes. It describes the sample rather than a verified, official Cursor brand standard. The folder label does not establish who made a video, whether a speaker works at Cursor, or whether a creator is sponsored. Two samples visibly disclose Cursor sponsorship; other affiliations should not be inferred. Spoken claims in creator or interview material remain claims by the speaker unless the video itself demonstrates them.

The clips range from 26 to 109 seconds. Ten are vertical 9:16 and two are square: the creator tutorial at `spreshapp_144830568730845327` and the interview at `spreshapp_15339864615996608`. Eight of the twelve include substantial software UI or a visible built artifact; four rely on interview/direct explanation. Most product-demo shorts sit around 28–53 seconds, while the custom-command walkthrough runs 109 seconds. The shared files are 360 pixels wide, so detailed interface text is often too small to read in the supplied source.

## Inventory

| Video | Length | Opening hook and structure | Key learning |
|---|---:|---|---|
| `spreshapp_13342141422405428` | 47.5s | On-camera “WITHOUT PLANNING / WITH PLANNING” comparison; same app prompt, app test, then planned run and UI result. Spoken excerpt at 00:00–00:06: “Here we are using Opus 4.6 and we're going to start with our planning.” | The speaker says the visible difference was “a tiny difference,” but planning let the user inspect what the agent intended (00:41.80–00:47.88). |
| `spreshapp_144830568730845327` | 53.3s | “Here's how I built an AI web app in one hour without writing a single line of code myself” (00:00–00:03.84); four steps: stack, plan, build, iterate. | Numbered steps and a final iteration rule make advice easy to copy. Stack terms are ASR-uncertain. |
| `spreshapp_15016799649723968` | 28.2s | “What if you could build a game with a game controller?” (00:00–00:02.48); Raspberry Pi/controller setup, remapping with Cursor, game reveal. | An unusual input device supplies both the hook and the build challenge. |
| `spreshapp_15339864615996608` | 26.4s | Interview opening on running multiple agents from one prompt (00:00–00:06.04); code-review pain, prototypes/demos, logo card. | Explain workflow changes through the review burden they remove; show the demos if proof matters. |
| `spreshapp_15947667822150468` | 27.9s | “So agents can now use a computer. What changes?” (00:00–00:03.24); launch tasks, split across models, review returned demos. | Frame the agent story around how a person compares its output with their intended result. |
| `spreshapp_16890554721472063` | 45.0s | “I built a car engine simulator that can recreate the sound of any car” (00:00–00:03.96); components, engineering challenge, Cursor/Composer, sponsorship disclosure. | Tangible hardware grounds an AI-coding story; show the audio result to close the proof loop. |
| `spreshapp_17155285696877758` | 31.9s | “A developer in a box” metaphor (00:00–00:06); explain agent tools/testing, then list Slack, mobile, web, and IDE. | Start with a memorable metaphor and support it with a few observable capabilities. |
| `spreshapp_19592129181108488` | 31.3s | “Cursor is an AI editor with a built-in coding agent” (00:00–00:02.96); define a harness as instructions, tools, and model. | A numbered explanation turns a technical abstraction into familiar parts; screen examples would aid retention. |
| `spreshapp_225396740501037221` | 45.9s | “What if your morning journal could turn into visual art?” (00:00–00:03.20); wallpaper examples, mobile cloud-agent story, app, comment CTA. | Show the emotionally resonant result first, then explain how it was built. |
| `spreshapp_7742418953992431` | 109.4s | Pro Tip 3: custom commands; create `commands/pr.md`, invoke `/pr`, run it, and report a pull-request link. | A full chain from instruction file to slash command to visible outcome makes a feature tutorial convincing. |
| `spreshapp_8659169728783488` | 44.5s | “Cloud Opus 4.7 vs Codex 5.3. Which model is better at building Pokemon Pocopia?” (00:00–00:05.28); setup, two playtests, audience vote. | A head-to-head is engaging; a shared checklist would make it a fairer comparison. Game title/model versions are ASR or speaker claims. |
| `spreshapp_9575782873080318` | 35.5s | “I built a scanner that analyzes 3D files before you print them” (00:00–00:04); maker pain, analysis/settings interface, audience question. | A focused niche problem and physical example make the feature easy to understand; show one detected error and corrected print. |

## Patterns worth reusing

**Open with the job or the result.** Eight clips begin with a specific task, claim, numbered tip, or comparison rather than an abstract company statement. The best openings are immediately testable as a premise: the controller question in `spreshapp_15016799649723968` (00:00), the car-engine simulator claim in `spreshapp_16890554721472063` (00:00), and the 3D scanner description in `spreshapp_9575782873080318` (00:00). The first video uses paired labels to make an invisible behavior—planning—visible. A useful hook answers: what is being built, what problem is solved, or what two options are being compared?

**Let the artifact carry the proof.** The strongest screen/result sequences move from action to visible output: `spreshapp_7742418953992431` shows a Markdown command become `/pr` and ends with the presenter reporting a new PR link (01:43–01:47); `spreshapp_15016799649723968` ends on a neon arcade game after showing the controller setup; `spreshapp_225396740501037221` shows several wallpaper treatments before explaining the mobile build. Eight samples show substantial UI or a built artifact. In the other four, the three office interviews and the harness explainer, the idea is mainly verbal. For a feature claim, prefer a small, readable product insert or a test result over another abstract sentence.

**Keep the person and the product in a clear hierarchy.** Creator-led demos often pair a face or hands with a software capture. This adds human presence while showing the work. Use the person for motivation and the interface for proof. The close model-selector shot in `spreshapp_144830568730845327` makes the configuration legible; the game result in `spreshapp_8659169728783488` is easier to read than the code. At 360-pixel source width, a full desktop capture can shrink text to the point that it becomes texture. Crop to one active panel, zoom during the decision, and keep captions away from the critical control.

**Use captions to carry technical nouns.** Seven videos visibly use editorial captions or overlay text. Captions help sound-off viewers follow tool names and steps, but they should be checked against the actual narration. Local ASR rendered stack names in `spreshapp_144830568730845327` as “SuperBase, Shazian, Intel”; `spreshapp_9575782873080318` includes the uncertain phrase “zip reduction costs”; `spreshapp_16890554721472063` has a component name rendered “daisy seed.” Do not silently polish uncertain transcripts into new facts. Keep model versions, library names, dates, timings, and prices attributed to the person making the claim unless verified separately.

**Interview cuts need orientation.** Three samples use restrained office interviews: `spreshapp_15339864615996608`, `spreshapp_15947667822150468`, and `spreshapp_17155285696877758`. All rely on speech and wide/close coverage; none shows the product capability being discussed. The first sentence can carry the context, but a short title and verified speaker role would help when a clip is detached from its original setting. Add one interface insert at the strongest claim if the clip needs to demonstrate product behavior. A clean logo card is a good end marker, but it does not replace a hook or proof.

**Make comparisons fair and the conclusion proportionate.** The planning comparison in `spreshapp_13342141422405428` ends with a nuanced result: the speaker sees only a small visual difference but values inspecting the plan. The model contest in `spreshapp_8659169728783488` is fun, but it does not show a scoring rubric or controlled final comparison. These examples suggest an editorial rule: show the same task and conditions, disclose what changed, and state the conclusion at the strength the evidence supports. Demonstrations can be compelling without claiming a general winner.

**Close with a next action that fits the story.** Four clips use a clear social CTA: follow in `spreshapp_144830568730845327`, comment “journal” in `spreshapp_225396740501037221`, vote in `spreshapp_8659169728783488`, or suggest the next build in `spreshapp_9575782873080318`. The CTA is strongest when it continues the content promise. `spreshapp_7742418953992431` instead ends on a visible tutorial outcome, which suits a longer how-to. Avoid adding a generic follow request when a useful result already provides a natural close.

## Practical short-form templates

**15 seconds — one feature proof**

- 0–2s: State the problem or show the surprising result.
- 2–5s: Name who it helps and why the current task is hard.
- 5–10s: Show one prompt/action in the product, with the important control legible.
- 10–13s: Show the output or a simple before/after test.
- 13–15s: Give one next step or ask a tightly related question.

This is a compressed version of the maker clips: one object, one action, one result. Do not promise a full workflow if only one interaction fits.

**30 seconds — a small build story**

- 0–3s: Open on a challenge, finished artifact, or direct question.
- 3–7s: Establish the user problem or the unusual constraint.
- 7–16s: Show the prompt and the agent's important decision, not every click.
- 16–24s: Demonstrate the artifact with one or two specific tests.
- 24–27s: State what worked and any material limitation.
- 27–30s: Close with a CTA connected to the build.

This adapts the controller and 3D scanner stories while adding the proof step missing from the sampled clips.

**60 seconds — teach a repeatable workflow**

- 0–4s: Say what viewers will accomplish.
- 4–10s: Give the context, constraint, or prior pain.
- 10–28s: Walk through two or three meaningful steps; show a readable screen for each.
- 28–43s: Run the workflow and test the result against the original goal.
- 43–52s: Share the learning, including what did not work or what changed only slightly.
- 52–60s: Summarize the pattern and offer a relevant next action.

This keeps the clarity of the four-step app tutorial and the command walkthrough without forcing a 100-second lesson into every short.

## Production checklist

- State the audience task, hook, and payoff in one sentence before recording.
- Put the spoken hook and its caption in the opening seconds; check spelling of product, model, and library names.
- Show the actual prompt or decision, then a visible result or test that supports the claim.
- Crop screen recordings for the 360-pixel mobile frame. Enlarge small code/UI and leave the relevant control visible long enough to read.
- Use captions for technical terms and sound-off comprehension; keep them clear of the product area.
- Attribute personal wins, performance claims, time/cost claims, and model comparisons to the speaker unless independently verified.
- Make sponsorship visible where applicable. Do not infer sponsorship, employment, or official authorship from a folder or logo alone.
- In comparisons, keep the task and conditions clear and make the conclusion proportional to the evidence.
- End on either a concrete result or one CTA that follows naturally from the promise.
- Review the audio transcript for uncertainty. Preserve uncertain ASR wording as uncertain; do not turn it into a polished quote.
