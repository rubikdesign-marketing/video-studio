# Motion-graphics recipes

One recipe per kind of motion-graphics film the studio makes from a short request: a launch film, a kinetic type reel, a logo sting, a concept explainer, a data story and so on. `index.json` is the catalogue.

Each recipe has:

- **triggers**: the words people use when they want this kind of film. `node tools/plan/recipe.mjs match "<their words>"` uses them to pick the recipe.
- **defaults**: length, sizes, energy, design style, how sound leads, frame rate.
- **structure**: the beats, with their share of the film.
- **starter prompt**: a director prompt with `{placeholders}`, written by the studio. It sets the quality bar, the motion language and what never to do.
- **questions**: the few worth asking when the brief is one line, each with its default.
- **optimise** and **avoid**: what to get right for this kind of film and the failures to watch for. The checks before a cut read them.
- **motion**: signature techniques, transitions, the engine moves it leans on (names in `library/motion/index.json`) and measured timing.
- **references**: films to study, with what to learn from each. They belong to their creators. They are for study only: nothing from them, and no creator's prompt, goes into a film.
- **engine_gaps**: techniques the recipe needs that the engine does not have yet.

## Where it came from

The recipes were distilled on 20 Nov 2026 from about 290 motion-graphics films made with Claude Opus 5.5 and the prompts or skills behind them, as collected on public galleries (prompt-motion.com, fliki.ai/features/claude-motion-graphics, revid.ai/claude-motion-graphics), ranked by likes on the original posts. The most-liked films were watched as contact sheets and measured with `tools/study/profile.py`. The study notes are the studio's own; the craft guide they led to is `knowledge/craft/17-motion-graphics.md`, and the method for short briefs is `knowledge/craft/18-brief-expansion.md`.

## Commands

```
node tools/plan/recipe.mjs list
node tools/plan/recipe.mjs match "a slick launch video for our app"
node tools/plan/recipe.mjs show <id>
node tools/plan/recipe.mjs apply jobs/<job> <id>
node tools/plan/recipe.mjs check
```
