# Script and scene list: Saved replies (demo brand)

16:9, cap 30 s, voice Justin, Paper style, confident. Times are **estimates** at 2.5 words a second. Real timings come from the voice once it is made, and the picture is then fitted to them. No voice has been made or heard.

## Script

| # | Line (spoken) | Beat | Energy | Est. seconds |
|---|---|---|---|---|
| 01 | You've typed that same answer all day. | hook | 4 | 0.3 to 3.1 |
| 02 | Now you only write it once. | turn | 3 | 3.8 to 6.2 |
| 03 | Save the answer you trust. | proof | 2 | 6.9 to 8.8 |
| 04 | Use it on the next ticket, and the one after. | proof | 2 | 9.4 to 12.9 |
| 05 | Same answer. Same care. No retyping. | peak | 5 | 14.3 to 17.0 (then a planned 1.3 s hold) |
| 06 | Saved replies, new in your support inbox. | offer | 4 | 18.0 to 20.8 |
| 07 | Write it once, and get on with your day. | close | 4 | 21.6 to 25.2 |

Voice runs about 25.2 s; about 3 s of logo rest after it brings the film to roughly 28 to 29 s, under the 30 s cap.

**Offer wording, fixed:** "Saved replies, new in your support inbox." Spoken in line 06 and shown on screen exactly the same.

**Hooks (three, from three families; the first is used):**

| | Spoken | On screen | First frame | Score (my judgement) |
|---|---|---|---|---|
| **Picked** | You've typed that same answer all day. | Same answer. Again. | One sentence in amber, already repeated twice, a third typing in | 7/8 |
| Variant | The slow part isn't the answer. It's typing it again. | Typing it again | A finished answer, a blinking cursor beneath | 7/8 |
| Variant | Your best support answer is already written. Why retype it? | Why retype it? | One answer card centred, empty ticket shapes around it | 7/8 |

The picked hook says its first claim at 2.8 s, inside the 3 s limit. The two variants are kept for ad tests. The first variant measured 3.2 s before I shortened it; the shortened wording above measures 2.4 s.

## Scene list (five scenes)

| Scene | Time (est.) | Lines | What the viewer sees | Shot size and move | Transition out |
|---|---|---|---|---|---|
| 1. Same again | 0.0 to 3.8 | 01 | Paper page. One sentence, "Can I reset my password?", sits in amber, already repeated twice. A third copy types in. On-screen text: "Same answer. Again." | Medium, slow push | Wipe along the text line |
| 2. Once | 3.8 to 6.9 | 02 | The repeats fall away until one sentence is left, set in ink. The amber drains out of it | Close on the sentence | Match cut: the sentence becomes the card |
| 3. The card | 6.9 to 14.3 | 03, 04 | The sentence folds into one green card. A ticket shape slides in below it, the card's words land on it. Then a second ticket, a third | Wide, then a steady pan right | Hard cut on the beat |
| 4. No retyping | 14.3 to 18.0 | 05 | The peak. Three tickets in a row all receive the same words on one beat, with a soft tick on each and a one-second hold. On-screen text: "No retyping." | Wide, still, then a very small push | Push through the card |
| 5. Saved replies | 18.0 to about 28.5 | 06, 07 | The page clears. "Saved replies, new in your support inbox." sets in ink with "Saved replies" in the accent green. The demo logo opens up and rests for the last 3 s | Medium, then rest | End |

Notes on the picture:
- Everything is type and simple drawn shapes. **No product screen is shown**, because the demo brand has no product to capture. A person must say if they want the real inbox on screen.
- Text on screen is a few words per scene and never repeats the voice word for word, apart from the fixed offer wording.
- Colours and the Inter typeface come from `brands/demo/brand.json`. The logo opens and closes the film; scene 1 shows it briefly and scenes 2 to 4 do not.
- Sound is not planned yet: soft key ticks on the three tickets in scene 4, a quiet bed under the voice, no music peak. Nothing has been made.

## What the checks said

`node tools/plan/beats.mjs` on the final script reports three findings, and I am leaving them with these reasons:
- **Turn is long (3.1 s against 1.3 to 2.6 s).** One short sentence, and it is the pivot of the film. I would rather not cut it.
- **Proof is short (7.4 s against 12.9 to 15.4 s).** The proof is carried by the picture: scene 3's ticket slides and the scene 4 hold have no voice over them. The voice is deliberately lean.
- **Peak is long (3.7 s against 1.3 to 2.1 s).** It includes the planned 1.3 s hold on the three-tickets moment.

The `zero-slop` pass was done by hand on every line, not with the skill; no word is a stock marketing phrase and there are no numbers. The "Human wording" list in `craft/04` was not re-read.

## Not checked

- Nobody has listened to anything. No voice has been generated and no audio has been played, as you asked. Justin is listed as suiting tutorials and demos, so a promo read may need a stronger direction.
- Seconds are estimates, not the voice's real timings.
- The feature claim "write it once and reuse it on later tickets" comes from the feature's name. Nobody has confirmed it. I left out anything beyond that (speed, counts, how to open it, team sharing).
- The demo brand has no written voice guide and no pronunciation list, so "brand voice" here means the plain, warm style of the promo playbook.

## To approve

1. The script above and the fixed offer wording.
2. The scene list.
3. Confirm the reuse claim is true.

After approval: make the voice (`voice.mjs generate`, which is paid ElevenLabs usage, and which I have not run), then you listen and approve the read.
