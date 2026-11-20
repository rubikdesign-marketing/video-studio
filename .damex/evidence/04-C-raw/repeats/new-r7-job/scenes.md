# Saved replies: script and scene list (for approval)

16:9, cap 30 s. Voice: Justin (demo brand's only voice). Estimated voice 21.9 s plus a short logo close, so about 25 s. Times are estimates at 2.5 words a second until the voice is made.
Offer wording, fixed: "Saved replies, now in your support inbox."

| Scene | Line | Said | Beat | Energy | Est. start, length |
|---|---|---|---|---|---|
| S1 | 01 | You've typed this reply before. Probably today. | hook | 4 | 0.3 s, 3.5 s |
| S2 | 02 | Same question. Same answer. | turn | 3 | 3.8 s, 2.4 s |
| S3 | 03 | Now you write a reply once, and save it. | proof | 2 | 6.2 s, 3.5 s |
| S3 | 04 | Next time someone asks, it's already there. | proof | 1 | 9.7 s, 4.9 s with a 1.3 s hold |
| S4 | 05 | Saved replies. | peak | 5 | 14.6 s, 1.2 s |
| S4 | 06 | Now in your support inbox. | offer | 4 | 15.8 s, 2.8 s |
| S5 | 07 | Write it once. Use it every time. | close | 4 | 18.6 s, 3.3 s, then the logo |

## Scenes (drawn type and shapes only, no screens)

| Scene | On screen (7 words at most) | What happens | Size and move |
|---|---|---|---|
| S1 Hook | "Typed this before?" | Logo opens for half a second. One reply line sits on the off-white page, a second one types in under it, in amber | Medium, slow push in |
| S2 Turn | "Same answer." | The lines keep stacking, each identical, until the stack fills the frame | Wide, stack grows, no camera move |
| S3 Proof | "Write it once." then "Already there." | The stack collapses into one clean card in deep green with a small tick. The card holds 1.3 s. A second, empty question shape slides in and the card answers it | Macro on the card, then medium. Different transition from S1 and S2 |
| S4 Peak and offer | "Saved replies" then "Now in your support inbox" | The card grows to carry the feature name in the hero size, then the offer line sets beneath it. Green accent on the name | Hero type, confetti-free, one confident push |
| S5 Close | "Write it once. Use it every time." | Page settles, line sets in two beats, logo closes the film | Still, then logo |

Stage: off-white page `#F6F4EC`, ink `#10201A`, accent green `#1F6B45`, amber `#C9822B` for the repeated lines only. Inter throughout.

## Scores for the three hooks (my judgement; the tool only counted words)

| Hook | Spoken | On screen | Score |
|---|---|---|---|
| Picked | You've typed this reply before. Probably today. | Typed this before? | 7 of 8. Subject is out at 2 s, one idea, "you" language, mild gap against what viewers believe. Weakest on disinterest |
| Kept as ad variant | Last week, this reply was typed again. Now it is saved. | Typed again. Now saved. | 5 of 8. 4.4 s to say, needs a real before and after |
| Kept as ad variant | Everyone says answer faster. Answer once instead. | Answer once | 5 of 8. Needs proof we do not have |

## Beat sheet findings

- Proof is short (8.4 s against about 11 to 13 s asked for) and the close is short in voice (3.3 s against 4 to 6 s). Both stay: this is a 30 s film with five scenes and no real product to show, so padding the voice would only add claims we cannot back. The close gets its length from the logo hold after the voice, which the tool does not count yet.
- The film comes in under the cap, at about 25 s of 30 s. The spare 5 s is deliberate headroom, not something to fill.

## Checks and what was not checked

- Read aloud against the human-wording list: no dashes joining clauses, no "introducing", no three-item lists, no feature adjectives. Zero-slop pass done by reading; no tool ran it.
- Ran: `beats.mjs` (findings above), `hooks.mjs measure` on all three hooks.
- Not done, by request: no voice generated, no audio played or measured. Nobody has heard these lines. Timings are word-count estimates.
- Not verified: how saved replies actually work. The script says only that you write a reply, save it, and it is there next time someone asks. If the real feature differs (for example, if replies are shared across a team), line 03 and 04 need changing.
- Not verified: "support inbox" as the feature's exact home. It is taken from the brief.
