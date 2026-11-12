# Director's checks

Run before every approval. A cut does not go to a person until each check passes or its failure is written at the top of the hand-over note.

## Measured checks (scripts)

| Check | Pass | Tool |
|---|---|---|
| Frame jumps | Every instant change is one the shot list planned | `tools/checks/smoothness.py --planned-cuts` |
| Judder and chatter | Each flagged window looked at frame by frame and cleared (`tools/study/sheets.sh window`). Well-made reference films still show two to four flagged windows, so a flag means "look", not "fail" | `tools/checks/smoothness.py` |
| Length | At or under the agreed cap | master length |
| Dead time | No stretch where nothing moves, outside planned holds | `tools/study/profile.py` → `still_stretches` |
| Energy shape | Peaks and rests fall where the energy map says: no scene two levels or more from its planned energy, and no two scenes planned two apart moving the other way | `tools/checks/energy_map.py <render> --job jobs/<job>` (movement from `profile.py`, per scene, against shots.json's energy) |
| Voice gaps | None over 0.8 s outside planned holds | timing table |
| Voice quality | All voice checks pass | `tools/audio/voice_check.py` |
| Loudness | −14 LUFS, −1 dBTP | master step |
| On-screen wording | Every approved phrase is found; no retired phrase is seen | `tools/checks/onscreen_text.py --must ... --never ...` |
| Text size | Product words at each click, hover, mark and reading hold at least 4% of frame height (the floor is a setting, `--ui-floor`; the owner has not chosen between 4% and about 3% for product screens, so both are reported); film text at least 2.6% (2.0 to 2.6% for legal lines and "Sped up" only) | `tools/checks/text_size.mjs <full-size render> --job jobs/<job>`: measured in the finished frame, after camera moves |
| Captions | Never over a tracked product thing or the thing clicked, hovered or marked at its moment; contrast holds | `tools/checks/captions_clear.mjs jobs/<job>` (caption pill against the capture's things through the engine's plan); contrast still by eye |
| Flashes | No more than three flashes in any second over a quarter of the frame; sudden whole-frame brightness jumps listed to look at | `tools/checks/flashes.py <render>` |
| Rest frames | Each flagged frame looked at against `12-frame-quality.md` | `tools/checks/frame_quality.py` |
| Product still current | Every capture in the film re-run against today's product: no mark changed in its picture, its words (renamed, added or removed labels) or its layout (anything named or tracked moved or changed size by more than 3 px) | `node tools/capture/capture.mjs check jobs/<job> <id>`, for each capture |
| Proof of source | Every product shot traced to its capture, take, date, address and browser | `node tools/film/sources.mjs jobs/<job>` (also run at delivery; writes `deliver/sources.txt`) |

## Looked-at checks (the inspector reads contact sheets at two frames per second)

| Test | Question |
|---|---|
| Squint | With the frame blurred, is there exactly one focal point, and is it the right one? |
| Phone | At 390 px wide, can every word that matters be read? |
| Mute | With no sound, does the story still land from picture and captions alone? |
| First three seconds | Would a scrolling viewer stop? Is the hook or offer on screen and spoken? |
| Freeze-frame | Do the hero beats work as posters? |
| One idea | Does every scene serve the soul sheet's one idea? Which scene could be removed without loss? Remove it |
| Sameness | Any two neighbouring scenes with the same layout, shot size or transition? |
| Truth | Does every screen exist in the product, with data that matches the voice? |
| Brand | Logo at open and close only; typeface and caption style as fixed; colours in the approved set |
| Camera | One direction per shot; every move has a cause |
| Stage | Is the background alive in every shot, and quieter than the product? |
| Different | Against the ledger: is the hook, look and signature move new? |

## The ten-percent pass

Before the full-animation approval, look for 10% to remove: a beat that repeats, a hold that outlasts its reason, a word on screen the voice already said. Tight films are made by removing, not by speeding up.

## What the checks cannot do

- Nobody has watched it at full speed, and nobody has heard it. The hand-over note says this every time.
- Taste. The checks stop known mistakes. A person decides whether it is good.

## The hand-over note

Every approval request has the same four parts:

1. What to look at, with the file.
2. What passed and what did not, in one table.
3. What could not be checked.
4. The one or two decisions needed.
