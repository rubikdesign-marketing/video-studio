# Hook library

155 formulas for the first three seconds of a video, in 15 families. A formula is a pattern to write from in the brand's own words, never a line to copy. The craft is in `knowledge/craft/15-hooks.md`.

```bash
node tools/hooks/hooks.mjs find --type promo --platform reels --awareness cold --brand tulvo
node tools/hooks/hooks.mjs measure "Are you still copying numbers between two tabs?" --on-screen "Still copying by hand"
node tools/hooks/hooks.mjs rubric
```

`find` gives one formula per family where it can, and leaves out the formulas the brand used in its last five films. `measure` counts what can be counted (length, speaking time, time to the first claim, openers to avoid). `rubric` prints the four questions a hook is scored on; the scoring is a person's or Claude's judgement, not the tool's.

| Family | Formulas | What it does |
|---|---|---|
| Question | 9 | It asks what the viewer already wants answered |
| Contrarian | 17 | It says the opposite of what the viewer believes, and means it |
| Outcome first | 7 | It shows or states the result before anything else |
| Problem | 10 | It names a pain the viewer recognises as theirs |
| Curiosity gap | 11 | It opens a gap with a shape: the kind of answer is named, the answer is not |
| Proof | 14 | It leads with a number, a result or a receipt that can be shown |
| Story | 16 | It starts in the middle of something that happened |
| How to | 7 | It promises a method the viewer can use |
| List | 8 | It promises a counted set |
| Mistake or warning | 8 | It points at a mistake or a loss the viewer may be making |
| Callout | 8 | It names the exact people it is for |
| Comparison | 7 | It sets two things side by side: before and after, this or that |
| Offer | 9 | It is the deal itself, said plainly |
| Demonstration | 14 | It shows the product doing the thing, before any talk |
| Pattern interrupt | 10 | It opens on a picture or a move the feed does not usually show |

Each formula has: the spoken pattern with its slots, one example, the written line that goes on screen with it (seven words at most), what the first frame shows, what kind of film, platform and viewer it suits, and the trap: how that formula goes wrong.

**Every formula is marked "untested".** The library says what a formula is, never that it works. What worked for a brand is recorded in that brand's ledger (`hook_formula` and the results), and that is the only place a formula earns "worked".

`avoid.json` lists openers to avoid, each with its reason. `CREDITS.md` names the open-source projects the patterns came from.

To add a formula: add it to `index.json` with every field and run `node tools/hooks/hooks.mjs check`. The check refuses a duplicate, an on-screen line over seven words, an example that makes a claim about results, and a source whose licence does not allow copying.
