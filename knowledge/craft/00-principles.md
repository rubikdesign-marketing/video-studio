# Principles for every video

Drawn from a frame-by-frame study of three Claude launch films (11 Nov 2026) and from measurements of all 40 reference films. The study cards are in `library/references/claude/`. These are principles to follow, not a look to copy.

Frame counts below are at 24 frames per second; the milliseconds are what to use.

## Story

1. **One idea, shown as a physical move.** Say the idea in a sentence, then show it as something that happens on screen (an icon opens into an app). Repeat that move with new content.
2. **One loop, repeated.** Ask, think, answer, show, hold, leave. Each film runs the same loop three to five times and changes only what is inside it.
3. **Climb by getting richer, not faster.** Each loop's payoff is bigger than the last: a small card, then most of the frame, then the full frame. The pace does not change.
4. **Clear the screen at every step.** Never more than one card and two short blocks of text competing.

## Movement

5. **Scene changes are moves.** The camera or a panel carries the viewer. If a cut is unavoidable, hide it inside movement: the outgoing shot starts moving, the cut happens, and the incoming shot is already moving the same way on the same background, settling in 250–350 ms.
6. **Leave accelerating, arrive decelerating.** Exits take 500–800 ms and speed up. Entries take 350–700 ms and slow down. Nothing moves at constant speed except a slow drift.
7. **One direction between steps.** Pick a direction for moving on (up, in these films) and keep every other direction for a special moment.
8. **Each transition has one meaning.** Through the icon means another app. Sideways means another conversation. A transition is never reused for a second meaning.
9. **Build while moving.** No screen is shown empty and none is shown already finished. Content lands while the camera travels: shell, title, rows 80–120 ms apart, then numbers counting in step with their bar or ring and finishing on the same frame.

## The viewer's eye

10. **A lead object.** One thing stays on screen from start to finish and enters every scene first. In these films it is a large cursor. Nothing changes until it has arrived.
11. **Two zoom levels.** The whole window appears for at most 1.5 s to orient; then one readable element fills most of the frame. Do not pan or zoom slowly across small text.
12. **The camera follows the pointer.** It zooms only to the control about to be used, starts 170–330 ms after the pointer moves, and lands on the click.
13. **Show the press on the control.** The control dips to about 92% and lightens for 170 ms, recovers in 80 ms, and the result follows one frame later. A cursor is used when the path matters.

## Rest

14. **Rest where the viewer must read.** At least 1 s after a build, 1.5 s after a long prompt, about 4 s on the densest screen.
15. **A quarter to a third of the film is still.** Measured: the three films are still for about 17 seconds in every minute. Last night's two Tulvo films were still for none.
16. **No empty waits.** Every prompt is typed in 2–3 s whatever its length. Waiting is one status line with a running clock for about 3 s, then the result arrives at once.

## Colour and type

17. **One page, one ink, one accent.** They stay constant for the whole film. All other colour comes from the product's content.
18. **New has one colour.** Anything that has just arrived appears in the accent and settles to ink within 120–250 ms.
19. **Little film type.** At most three lines of six words. Section titles use the same format in the same place every time. The product does the rest of the talking.

## Measured targets

| Measure | Claude films | Tulvo films last night | Target for calm and confident films |
|---|---|---|---|
| Hard cuts per minute | 2.0 visible, plus cuts hidden in movement | 1.0–2.6 | Few, and hidden in movement |
| Share of time moving | 64% | 97–99% | 65–80% |
| Still seconds per minute | 17.4 | 0 | 10–18 |
| Typical movement | 0.97 | 2.0 | About 1 |
| Peak movement | 13.7 | 42–67 | Under 25; hype films may go higher at the one peak |

Hype films (sales) may run busier, but the Dokan Black Friday promo, a sale film, also rests about a quarter of the time.

## Rest and a living background (settled 11 Nov 2026)

Feedback said every background must move; these films use a still page and rest often. The owner decided both hold: the stage keeps drifting so slowly that it reads as rest, and the foreground stops completely at reading moments, so a film can be still about a quarter of the time. Stage drift stays under the stillness threshold of `tools/study/profile.py`; every background in `library/backgrounds/` measures as still at `rest`.

## Not to copy

The cream page, the hand-drawn cursor, the brush smears, the playful 12-drawings-a-second passages, the Claude mark and its accent colour. Those are Claude's look. Each brand takes the principles above and applies them with its own logo, typeface, colours and stage.
