# 05 Phase 1: library gaps for ugc-01

Date: 2026-11-19. Scope: ambient, foley and motion, ranked by what each unlocks in a concrete shot of `library/fixtures/ugc-01/` (16 s, 9:16, Kestrel board). Counts taken from the index files; nobody listened to anything.

## Not gaps
- Motion previews are all present (243 entries, 0 missing previews). Preview files left out on purpose are not flagged.
- Interface, click, pop, whoosh, riser, impact, transition, chime and the 30 kit slots cover every sound event in the slice (see `soundPlan` in `card.json`).
- 9:16 reframing, pointer follow, rings, callouts, notification opener, caption-box and caption-pop already exist.

## Ranked gaps (10)

| # | Gap | Kind | Shot it unlocks (ugc-01) |
|---|---|---|---|
| 1 | Phone buzz / vibration (a phone on a table, 0.5 to 1 s) | foley | Hook 0.0 to 0.5: `opener-notification-drop` has a ping (`notification`) but no physical buzz, which is what makes a notification read as "on a real phone" |
| 2 | Finger tap and swipe on glass (screen touch) | foley | Demo 2.5 to 6.0: the click-through on a phone-framed screen. The kit has mouse clicks only, and `stage-phone-crop` implies a phone |
| 3 | Home-office or co-working ambience (quiet keyboards and distant voices, 16 s) | ambience | Whole slice: the one room bed, `room-apartment-window-01`, has a known fan hum; `room-house-01` also hums. No "someone works nearby" bed |
| 4 | Comment-reply bubble (a question card that the film answers) | motion | Hook 0.0 to 2.5: the most common UGC opener; today the hook is a plain line. No move draws a comment bubble and answer sticker |
| 5 | Sticker or emoji pop | motion | Proof 9.0 to 13.0: a small tick or reaction on the board title; `product-success` and `product-toast` are product-style, not creator-style |
| 6 | Screen-recording tell (a REC dot, a timer or a tap ripple on a phone frame) | motion | Demo 2.5 to 9.0: signals "I recorded my own screen" without faking a person |
| 7 | Cafe or kitchen ambience (cups, soft room, 16 s) | ambience | Alternate room bed for a second take of ugc-01, so two variants do not share the same room |
| 8 | Laptop lid open and close, mouse-wheel scroll | foley | Hook or demo cut-in on a desktop version; `keyboard-burst-*` exists, a lid and a wheel do not |
| 9 | Handheld micro-drift on a still (very slight, no shake) | motion | Demo/proof stills: `camera-float` gives a drift, but a screen shake is banned without the owner's yes (03-transitions.md); a documented "tiny drift" preset that stays under that rule would help |
| 10 | Mug sip / set-down with a lip or a swallow, packaging rustle | foley | Optional human-presence cutaway in a later cleared-footage version; `cup-set-down-01` exists but nothing human |

## Cross-checks
- `tools/audio/master.sh` fails only above -0.5 dBTP though the target is -1 dBTP. The fixture card requires -1; verify the "after" line by hand.
- Foley has known doubts in `library/sounds/README.md`: two concrete footsteps and the wood footstep are heard as ticks.
