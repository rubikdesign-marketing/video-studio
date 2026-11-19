# Scene list: saved replies (30 s, 16:9)

Timings are planned from about 2.5 words a second. They are fitted to the real voice once it exists. The voice is never stretched.

| # | Seconds | Beat | Voice (line) | On screen (max 7 words) | Picture | Energy |
|---|---|---|---|---|---|---|
| 1 | 0.0 to 5.0 | Hook | 01 "You've typed this exact answer five times today." | "Same answer. Fifth time." | Logo mark for a beat, then a support inbox: five open conversations, all asking the same thing. Wide shot. | 4 |
| 2 | 5.0 to 9.5 | Turn | 02 "Saved replies. New in your support inbox." | "Saved replies" | The inbox settles; a "Saved replies" control appears in the reply box. Medium shot, one move. | 3 |
| 3 | 9.5 to 20.0 | Proof | 03 "Write an answer once, and save it." then 04 "Next time, pick it from the list, change a line if you like, and send." | "Write once. Save." then "Pick. Edit. Send." | Write a reply, save it. Next conversation: open the list, pick it, change one line, send. Close shot on the reply box, then a short hold after sending (about 1.0 s). | 3 then 2 |
| 4 | 20.0 to 23.5 | Peak | 05 "Still sounds like you." | "Still sounds like you." | The edited line gets the green accent; the other four conversations show the same reply sent. The stack-to-one move. | 5 |
| 5 | 23.5 to 30.0 | Offer and close | 06 "Saved replies. Answer faster, and keep it personal." | "Answer faster. Keep it personal." | Offer line over the clean inbox, then the logo alone on the page for the last 2 s, silent. | 4, then rest |

## Notes

- Voice runs about 24 s; the last 5 to 6 s are the offer, the logo and rest. Total stays under the 30 s cap.
- Every scene has one camera direction and one transition style; three proof moments are not needed, the proof is the two actions in scene 3.
- Logo opens (scene 1) and closes (scene 5), not on the frames between.
- All text uses the brand's real spelling; no dots, no coding-style typeface.
- Captions are live with the voice and never cover the reply box.
- Screens: see "Rule gap" in `job.json`. Scenes 1 to 4 need real captured product UI; the demo brand has none.
- Cut-downs (only if asked): 15 s = scenes 1, 3, 5; 6 s = scenes 1 and 5.

## Beat sheet findings (`beats.mjs`, run on the script)

- Turn reads 3.5 s against 1.2 to 2.4 s: stays, because the line also tells the viewer where the feature lives. Could be cut to "Saved replies, new in your inbox." if you want it tighter.
- Proof reads 10.4 s against 12.1 to 14.5 s: made up by the hold after sending and the move into the peak.
- No rest before the peak: the line before the peak is marked energy 2; the tool read it as 3. I left it as a quiet line plus a 1.0 s hold. Check by ear when the voice exists.
- No close line: the close is the silent logo card. Not a gap.
