# Direction: what gets decided before anything moves

Read at the idea, moodboard and storyboard stages.

## The soul sheet (one page, written at the idea stage)

Every video has one. Template: `templates/soul-sheet.md`.

| Line | What it answers |
|---|---|
| One sentence | What the viewer should say to a friend afterwards |
| Feeling | The single emotion at the end (relief, envy, excitement, calm confidence) |
| One idea | The visual or story idea the whole film hangs on |
| Signature moment | The three seconds people would screenshot or replay |
| Never | Three things this video must not be |
| Different from | How its hook, look and signature move differ from the last five in `brands/<brand>/ledger.json` |

If the one idea cannot be said in a sentence, the idea is not ready. Go back, do not start the script.

## The energy map

A film is a shape, not a level. Draw it before the script is final.

- Give every beat an energy from 1 to 5. Put the numbers in the shot list (`templates/shot-list.md`).
- Rules for the shape:
  - Open at 4 or 5, or open at 1 and jump. Never open at 3.
  - Never hold the same number for more than three beats.
  - Put a 1 or 2 directly before the biggest moment. Quiet makes loud.
  - The highest number appears once, at the signature moment or the offer.
  - End one step below the peak, on the call to action, then rest on the logo.
- Music, cut rate, camera size and sound density all follow this one map. That is where "high energy" comes from; it does not come from speed.
- After each render, `tools/study/profile.py` draws the real movement and loudness. Compare it with the map: peaks where planned, rests where planned.

## The colour script

One row of small frames, one per beat, showing only colour and light. It catches a film that is the same colour for a minute. Rules: one dominant colour per beat, the accent appears on what matters, the palette shifts at the turn of the story, and the end returns to the opening colour.

## Style frames before storyboards

Three frames at full polish: the opening, the signature moment, the ending. They are approved inside the moodboard step. No storyboard is built on a look nobody has seen finished.

## The animatic

Storyboard frames cut to the real voice and a temporary music bed, at preview quality. It is the cheapest place to fix pacing. Every promo and demo gets one before any scene is animated; it is part of the first-animation step.

## Shot grammar for product films

| Shot | Use | Share of film |
|---|---|---|
| Wide (the whole screen in its stage) | Orient: where are we | 10–15% |
| Medium (one panel or card) | The working shot | 40–50% |
| Macro (one field, one number, one button) | Proof and emphasis | 25–35% |
| Abstract (type, brand, shapes) | Hook, turn, offer, close | 10–20% |

- Change shot size when the meaning changes, not on a timer.
- Never show two wides in a row.
- A macro must be readable: text at least 4% of frame height.

## Eye trace

The viewer's eye is somewhere at the end of every shot. The next shot's subject starts there.

- Mark the focal point on every storyboard frame.
- Across a change of shot, the focal point moves less than a quarter of the frame width, or something visibly carries it (a cursor, a moving card, a line).
- One focal point at a time. If two things move, one of them is a mistake.

## Hand-off objects

The strongest way to join two scenes is an object that belongs to both: a card that becomes a row, a button that becomes the next screen's header, a number that becomes a chart bar. Plan one for every scene change at the storyboard stage. A change with no hand-off needs a reason.
