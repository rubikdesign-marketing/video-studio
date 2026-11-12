# Type and captions

Sizes are a share of frame height so they hold at any size. At 1080p, 1% is about 11 px.

## Fixed

- Typeface: the brand's headline face for everything, with its accent face for one emphasis word if it has one (`brands/<brand>/brand.json`). No coding-style typeface unless the brand's own rules ask for one.
- Caption style: one design for every video (below).

## No dots

A studio default, set by the first brand's owner. A brand's `rules.md` may say otherwise.

Dots are out, everywhere:

- No dot between words or items ("Fast · Simple · Yours"). Use separate lines, a line break, or plain words.
- No dot inside a pill, badge or label. A pill holds words only.
- No bullet dots in on-screen lists. Use spacing, numbers or short lines.
- No dot grids or dotted patterns in backgrounds.
- No row of dots for "loading" or "thinking". Use a word or a moving line.
- A full stop at the end of a sentence is punctuation, not a dot, and stays.

## Human wording

Nothing in a video, on screen or spoken, should read as if a machine wrote it.

- Write the way a person at the company would say it to a customer across a table. Short, plain, specific.
- No dashes joining clauses, no "not just X, but Y", no lists of three for rhythm, no "seamless", "effortless", "unlock", "elevate", "supercharge", "game-changing", "in today's world".
- No empty openers ("Introducing", "Meet", "Say hello to") unless the owner asks for one.
- Say what the product does with a real example and a real number, not an adjective.
- Labels are things a person would write: "New this week", not "FEATURE UPDATE".
- Read every line aloud before it is approved. If it sounds like an advert generator, rewrite it.

## Type scale

| Role | Size | Notes |
|---|---|---|
| Hero line | 8.5–12% | One to five words. Never more than two lines |
| Headline | 6–8% | The working size for statements |
| Label on UI | 2.6–3.5% | Minimum for anything that must be read |
| Legal and "Sped up" | 2–2.4% | The only text allowed below the minimum |

- Text budget: at most seven words on screen at once, not counting real UI and captions.
- One line is read at about three words per second. A line stays up for its word count ÷ 3, plus 0.4 s.
- Tight tracking on big type (−0.03 to −0.04 em). Normal tracking below 4%.
- One highlighted phrase at a time, in the accent colour.

## How type moves

| Move | What happens | Use |
|---|---|---|
| Word rise | Each word rises 30–40% of its height from behind a mask, 40–50 ms apart | Default for headlines |
| Blur in | Each word goes from soft to sharp while settling | Calm films |
| Letter stagger | Letters arrive 15–25 ms apart | Hero lines only; too busy for sentences |
| Weight shift | The variable font moves from regular to semibold on the key word | Emphasis without colour |
| Tracking settle | Letters start 6–8% wider and close up | Openings and closings |
| Type-on | Characters appear at a human rhythm: bursts of 3–6 letters, small pauses at spaces | Prompts and search fields |
| Number roll | Digits roll to their value in fixed-width figures, slowing into the last digit | Prices, counts, percentages |
| Swap | One word slides out, its replacement slides in, the rest of the line holds | Before → after in one line |

- Type enters on the voice: the word appears as it is spoken, or up to 100 ms before. Never after.
- Type leaves faster than it enters.
- Type never moves while it is the thing being read.

## Captions (fixed design)

- **Shape:** a dark liquid-glass pill, centred, in the bottom safe area. The background behind it is blurred and slightly refracted at the edges; a soft inner highlight on the top edge.
- **Text:** white, semibold, 3.8–4.2% of frame height (larger than the Black Friday captions).
- **Live:** words arrive as they are spoken. The word being spoken is at full white; words already spoken sit at about 70%.
- **Highlight:** at most one key phrase per line, in the accent colour. Fewer than one line in three carries a highlight.
- **Lines:** up to 42 characters, split at a comma or a natural pause. One line at a time.
- **Behaviour:** the pill changes width smoothly between lines. It disappears in gaps longer than 0.9 s and re-forms with the next line.
- **Position:** it never covers product UI or the focal point. If the focal point is low, the caption moves to the top safe area for that shot.
- **Layer:** captions are a separate layer. Every master exports with and without them, plus a captions file.

The caption design is approved once, at the first moodboard, then it is fixed.

## Checks

- Every on-screen word is read back from frames and compared with the approved script and offer wording.
- Text size is measured after every camera move, not before: `tools/checks/text_size.mjs` reads the finished frame at every click, hover, mark, reading hold and on-screen text. Product words being read at the action are held to a floor that is a setting (`--ui-floor`, 4% by default; the owner has not yet chosen between 4% and about 3% for product screens, so both are reported).
- Captions never cover product UI: `tools/checks/captions_clear.mjs` checks the pill against every tracked and acted-on thing at its moment.
- Caption contrast is measured against the frames behind it.
