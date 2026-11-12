# Study card: Claude — Introducing Claude Whiteboards, Sheets and Data

File: `library/references/claude/claude_launch_introducing-claude-whiteboards-sheets-and-data_58s.mp4` · 57.8 s · 3840x2160 · 24 fps
Studied: 2026-11-11 · Depth: frame by frame (8 overview sheets at 2 fps, 31 window sheets, 4 close-ups)
Sheets: `library/references/claude/_study/whiteboards/` (`sheet_01–08` overview, `w01–w31` windows). Window sheets are stamped from 0; add the window's start time.

## 1. What it is, in one paragraph
A launch film for three new artifact types in Claude (Whiteboards, Sheets, Data), aimed at people who plan and report at work. It follows one small story (a pie shop's holiday launch) through plan → build → share, so each product hands its output to the next. The one idea is the closing line: work "at the speed of thought". The feeling is calm speed: a quiet cream page where named cursors (Claude and four teammates) do everything, nothing is ever fully still, and the viewer is never jolted by a visible cut.

## 2. Structure
| Time | Beat | What the viewer learns | Energy 1–5 |
|---|---|---|---|
| 0.0–4.75 | "New in" pill, Claude's caret types "Artifacts", letters turn into 7 product icons | Artifacts is now a family of things | 2 |
| 4.75–9.5 | Icons collapse to one; two cursors drag in "Plan it out with / Claude Whiteboards"; grid fades in | First product, and it is multiplayer | 2 |
| 9.5–15.0 | Comment pin dropped, camera pushes in, prompt typed to @Claude | You ask in plain words, on the canvas | 3 |
| 15.0–22.0 | Claude draws an illustrated timeline while camera pulls back; teammates react | Claude builds the board for you, live | 4 |
| 22.0–27.0 | "Build it with / Claude Sheets", prompt bubble, "You got it." | Second product, same asking pattern | 2 |
| 27.0–32.2 | Sheet app: Claude fills cells and formulas, chat sidebar collapses | Real formulas, referencing your data | 3 |
| 32.2–36.2 | "Share a story with / Claude Data"; dashboard builds beside the title, then takes the frame | Third product: live dashboard | 4 |
| 36.2–44.0 | Zoom to Design tool, pick "Scrollyteller", dashboard becomes a scrolling story | Same data, restyled in one click | 4 |
| 44.0–48.0 | Zoom to Share, click, burst of ~20 app logos, fly through them | It connects to the tools you have | 5 |
| 48.0–54.3 | Tagline; first word swaps Plan → Build → Share → Work; teammates' cursors gather | The promise, summed up | 2 |
| 54.3–57.8 | Spark grows from a dot, wordmark types on, hold 2.4 s | Brand | 1 |

## 3. Measured
From `tools/study/profile.py`: hard_cuts 0 · median_shot 57.82 s · longest_shot 57.82 s · still_seconds 6.25 · share_of_time_moving 0.80 · typical_movement 1.18 · peak_movement 12.3 · movement_follows_sound 0.18.
- Chart: quiet first 9 s (movement under 3.5), then a peak roughly every 4 s: 10.0 (push to comment), 14.0 (pan), 22.25 (board exits), 37.5 (punch-in, 12.3), 39.25 (restyle), 42.0 (scroll), 45.75 (Share burst). Densest stretch 35.5–48 s. Rests at 3.5–4.75, 7.5–8.25, 11–12, 24.75–25.5, 28–28.75, 49–49.75, 56.25–57.25; the longest rest is 1.25 s.
- **Correction to "0 hard cuts": there are two real cuts, both disguised.** Found by eye and confirmed with a per-frame difference at 160x90: 27.00→27.04 s (only 14% of pixels change because both sides are mostly cream) and 45.79→45.83 s (23.5% change, less than the 38.7% of the zoom frame just before it, so the cut is the smaller of two jumps). Every other scene change is a move.

## 4. Shot and transition list
| Time | From → to | Technique | Frames it takes | What carries the eye across |
|---|---|---|---|---|
| 0.38–1.5 | Empty page → "Artifacts" | Caret with "Claude" tag pops in (3 f), types 2 f per letter | ~27 | The tagged caret |
| 2.46–3.3 | Word → row of 7 icons | Letter-by-letter replacement, left to right; "New in" pill fades in 3 f | ~20 | Right edge of the word stays fixed |
| 4.79–5.25 | 7 icons → 1 icon | Icons vanish right to left, one per 2 f | 12 | The surviving first icon |
| 5.0–5.7 | Icon → title line 1 | Line dragged in from left by Claude cursor, tilted ~17°→5°, in a selection outline | 17 | Cursor tag riding on the line |
| 5.75–6.5 | Line 1 → full title | Line 2 dragged in from right by "Mia" cursor, tilted −8°→0°; icon redraws as whiteboard glyph | 16–18 | Second cursor colour |
| 7.2–8.0 | Title card → canvas | Grid lines fade in under the unchanged title, in patches | ~18 | Title does not move |
| 9.5–10.3 | Canvas → comment box | Cursor becomes a comment pin (3–4 f pop); camera pushes 1.0→~1.33x; card unfolds from the pin | 17 | The pin |
| 13.9–15.5 | Comment → empty board | Pan right across the same canvas: 20 f accelerating out, 4 f of bare grid, 12 f decelerating onto Claude's cursor | ~38 | Grid continuity, then the cursor |
| 16.25–17.75 | Close-up → full board | Continuous pull-back ~1.9x→1.0x while stickies land; app chrome enters from frame edges | 36 | Claude's cursor drawing the path |
| 21.8–22.7 | Board → Sheets title | Board slides off left, accelerating; title already in place beneath fades up; line 2 three frames later | 20 | Title appears exactly where the eye rests (centre) |
| 23.9–24.2 | Title → title + prompt | Bubble rises 8% of frame height, decelerating | 8 | — |
| 25.55–25.8 | Prompt → reply | Title blurs and dims; "You got it." appears tinted, cools to ink | 6 | Focus shift |
| 27.00/27.04 | Conversation → app window | **Cut on motion**: bubble and reply accelerate upward 6 f, cut, window enters still rising and settles in 9 f | 1 (+15 around) | Same direction; same two messages reappear in the chat sidebar |
| 29.0–30.0 | Chat + sheet → sheet only | Sidebar slides out left, sheet fills the frame, typing never pauses | 24 | The cell being edited |
| 32.15–32.8 | Sheet → Data title | Same slide-off reveal as 21.8 | 16 | Centre title |
| 33.3–34.0 | Title → title + dashboard | Title glides left 23% of frame width; cards unfold in the right 52% | 18 | Counting numbers |
| 35.2–36.2 | Split → full dashboard | Dashboard slides left and pushes title off (14 f), then header and toolbar drop in from the top | ~24 | Numbers still counting |
| 37.2–37.7 | Dashboard → toolbar | Punch-in ~1→2.6x to the icon the pointer is heading for; panel opens on landing | 12 | Black pointer |
| 39.04–39.6 | Dashboard → story page | Cross-dissolve of page content inside the same chrome while camera pulls back to 1.0x | 14 | Toolbar stays put |
| 40.9–41.5, 42.0–42.9 | Section → section | In-page scroll, ease in and out, then a ~1 px/frame creep | 18–20 each | Pinned logo bottom-left, scrollbar |
| 43.8–44.4 | Page → Share button | Punch-in to the window's top-right corner, ~4x, overshooting into empty page | 14 | Pointer |
| 45.71–45.83 | Share → logo cloud | **Zoom-through cut**: 3 f accelerating zoom (1→1.15→1.9), cut, logos burst outward from centre in 7 f | 3 + 1 + 7 | Outward optical flow continues |
| 46.2–48.2 | Logo cloud → tagline | Camera flies through; near logos blur into colour blobs and leave; tagline fades in over 4 f at 48.08 | ~48 | Empty centre |
| 49.3–51.1 | Plan → Build → Share → Work | Selected word replaced in 1 frame, every ~14 f | 1 each | Highlight box and cursor |
| 54.1–55.25 | Tagline → logo | Group accelerates up and off (12 f); dot seeds at centre 6 f before it is gone, grows to the spark (16 f); wordmark types 1 letter per frame | ~28 | The dot at dead centre |

## 5. Techniques worth taking

### Cursor-dragged title assembly
- **Seen at:** 5.0–6.75
- **What happens:** Each title line arrives as a selected object: thin outline in the cursor's colour, the cursor's name tag sitting on it, tilted (line 1 about +17°, line 2 about −8°). It travels from off-frame to centre in 16–17 frames while the tilt relaxes; the outline drops and the line snaps level a few frames after landing. Lines come from opposite sides, carried by different people.
- **Easing:** Pure ease-out. Per-frame steps for line 1: 25, 18, 13, 9, 8, 5, 5, 3, 4, 2, 1 px at 400 px width (each step ~70% of the last). No overshoot.
- **Why it works:** The headline demonstrates the product (things being moved by collaborators) before any UI is shown.
- **Use it for:** Section titles in any collaborative-tool video; feature names; a "meet the team" beat.
- **Rebuild:** One wrapper per line holding text + 1px outline + cursor tag. Animate `translateX` from off-frame and `rotate` to 0 together. Remotion: `interpolate(..., {easing: Easing.out(Easing.exp)})` over 16 frames, or `spring` with `damping: 200`. HyperFrames: GSAP `ease: "expo.out", duration: 0.68`. Remove the outline 6–8 frames later with no fade.

### Letters swap into icons
- **Seen at:** 2.46–3.3 (close-up `w02b`)
- **What happens:** The 9 letters of the hero word are replaced left to right by 7 small outline icons, one every 2–3 frames. A letter disappears in one frame; its icon starts as a stub (a tick, a dot) and redraws through 2–3 in-between shapes over 5–6 frames. Icons pack to the left; the remaining letters stay pinned to the right edge until they are consumed.
- **Easing:** Stepped, not tweened; the charm is the 2–3 frame rhythm.
- **Why it works:** Says "this one word now means these seven things" with no caption.
- **Use it for:** Turning a category word into a feature set; plan names into feature icons.
- **Rebuild:** Split the word into spans inside a fixed-width flex row (`justify-content: space-between`, icons in a left group, letters in a right group). Per index `i`, at `start + 2.5*i` frames unmount the letter and mount an SVG whose `stroke-dashoffset` draws in over 5 frames while scale goes 0.4→1. Give each icon its own colour.

### Accent-then-ink typing
- **Seen at:** 0.67–1.5 (hero word), 25.6 ("You got it."), 28.4 (cell text), 55.04–55.25 (wordmark, grey variant)
- **What happens:** Each new character appears in the cursor's colour (or light grey) and turns to ink within 2–3 frames, so the newest letter always glows. Hero word: 2 frames per letter. UI typing: 1 character per frame (10.8–13.5). A typed "@Claude" converts to a blue chip at 11.1.
- **Easing:** Linear colour fade, 3 frames.
- **Why it works:** Shows who is writing without a label and gives fast typing a soft leading edge.
- **Use it for:** Any typed headline, AI reply, or form fill.
- **Rebuild:** Per-character span; colour = `interpolateColors(frame - appearFrame, [0,3], [accent, ink])`. Drive characters from `Math.floor((frame-start)/framesPerChar)`. Caret is a 2px bar with the name tag attached above it.

### Title card becomes the canvas
- **Seen at:** 7.2–8.0 (dot grid), 23.4–24.0 (spreadsheet cells), then entered at 9.5–10.3
- **What happens:** The section title sits on the blank page; the product's own background (grid, cells) fades in under it in patches over ~18 frames. The title is now an object on the canvas, and the camera can push into the same space (1.0→1.33x in 17 frames) to start the demo. A comment card unfolds from a pin: dot → circle → rounded square → wide card in 8 frames, its fields fading in line by line.
- **Easing:** Push is ease-in-out: slow 9.5–9.75, fastest 9.9–10.05, long tail to 10.5.
- **Why it works:** Removes the border between "title" and "demo", so no transition is needed.
- **Use it for:** Opening of any product section.
- **Rebuild:** Put title and UI in one "world" div; background pattern as a CSS background on the world with opacity 0→1 (mask it with a moving radial gradient for the patchy look). Camera = `scale` + `translate` on the world with `transform-origin` at the target.

### Whip pan across the empty canvas
- **Seen at:** 13.9–15.5
- **What happens:** To leave the prompt and reach the place where work will happen, the camera pans right across the same grid. Content leaves left accelerating over 20 frames (steps 2, 7, 5, 8, 8, 10, 13, 12, 14, 16, 18, 20 … 38 px), there are 4 frames of nothing but grid, then the pan decelerates over 12 frames (76, 48, 34, 22, 18, 12, 10, 6, 4) onto Claude's waiting cursor.
- **Easing:** Ease-in out of the old, exponential ease-out into the new; the fast middle happens over empty background.
- **Why it works:** A location change inside one space reads as "same document, further along", and blank grid hides the speed.
- **Use it for:** Prompt → result; step 1 → step 2 on a canvas, timeline or long page.
- **Rebuild:** World 2–3 frames wide; tween `translateX` over ~38 frames with `Easing.bezier(0.7, 0, 0.2, 1)`. Keep at least 4 frames where only the pattern is visible. The pattern must move with the world.

### Build while pulling back (with sticker slap)
- **Seen at:** 15.46–17.75 (close-up `w09b`)
- **What happens:** The shot starts tight on the first stroke the cursor draws. As items land, the camera pulls back ~1.9x→1.0x over 36 frames so the frame stays full, and the app's title bar and toolbar slide in from the frame edges simply because they are part of the scene. Each sticky note lands oversized (~1.2x) with a curled corner and flattens in 3 frames; its label and drawing fade in 2–4 frames later. A new item every 4–6 frames.
- **Easing:** Pull-back decelerates (sticky width 70, 62, 55, 45, 40, 38, 37 px every 6 frames).
- **Why it works:** The viewer sees detail first and scale second; the reveal of "it's a whole board" is the payoff.
- **Use it for:** Any generated artefact: a page, a report, a site being built.
- **Rebuild:** World `scale` 1.9→1 with `Easing.out(Easing.cubic)`, origin on the first element. Sticky: `scale` 1.2→1 in 3 frames plus a corner triangle (darker tint) shrinking to 0; no opacity fade. Stagger items by 4–6 frames.

### Slide-off reveal
- **Seen at:** 21.8–22.7 and 32.15–32.8
- **What happens:** The finished UI is treated as a card with a visible right edge. It accelerates off to the left over 16–20 frames. The next section's title is already sitting underneath at its final centre position and fades up (3–4 frames) as the edge passes it; the bold second line follows 3 frames later, grey to black; the icon grows last.
- **Easing:** Exit is ease-in, roughly exponential (right-edge steps 14, 14, 19, 19, 25, 34, 36, 52, 78+ px). The title does not travel, only a ~2% upward settle.
- **Why it works:** The eye is pulled left by the exit and returns to centre to find the title already there. Used identically twice, it becomes the film's chapter mark.
- **Use it for:** Moving between features in a multi-feature video.
- **Rebuild:** Title layer below, UI layer above. UI: `translateX` 0→−110% with `Easing.in(Easing.exp)` (GSAP `expo.in`) over 18 frames. Title opacity 0→1 over 4 frames starting when the UI's edge crosses centre. Same timings every time.

### Rack focus to the conversation
- **Seen at:** 25.55–25.8
- **What happens:** When the reply arrives, the title and icon behind the prompt bubble blur and drop to about 60% strength over 5 frames; bubble and reply stay sharp.
- **Easing:** Linear, 5 frames.
- **Why it works:** Depth without a camera: the title becomes background, the exchange becomes subject.
- **Use it for:** Moving attention from a headline to an interaction on the same screen.
- **Rebuild:** `filter: blur()` 0→~0.3% of frame width and opacity 1→0.6 on the title layer only.

### Momentum cut
- **Seen at:** 26.6–27.4 (close-up `w14b`)
- **What happens:** Bubble and reply drift up, then accelerate (bubble top 127, 126, 125, 123, 120, 116, 110, 104, 95, 78 px). On the next frame they are gone and the app window is on screen, entering from about 9% of frame height below its rest position and still rising; it settles in 9 frames. The same two messages are now in the window's chat sidebar, bubble right, reply left.
- **Easing:** Ease-in before the cut, ease-out after it; direction and background colour identical on both sides.
- **Why it works:** The eye tracks motion, not content, across the cut; the repeated messages confirm continuity afterwards.
- **Use it for:** Any jump from a simplified view to full UI.
- **Rebuild:** Two `<Sequence>`s. Outgoing: last 6 frames `translateY` with `Easing.in(Easing.cubic)`. Incoming: first 9 frames `translateY` from +9% to 0 with `Easing.out(Easing.exp)`. Same background hex. Repeat one element on both sides.

### Title makes room, data lands live
- **Seen at:** 33.3–36.2
- **What happens:** The centred title glides left by 23% of frame width (18 frames, ease in and out, fastest at 33.5–33.6). Dashboard cards unfold in the right 52%, bleeding off the right and bottom: each starts as a sliver and widens in ~4 frames, then its number rolls up like an odometer (~40 frames), the line chart draws left to right, table rows fill one by one. At 35.2 the dashboard slides left and pushes the title out (14 frames), still counting.
- **Easing:** Glide ease-in-out with long tail; takeover ease-out.
- **Why it works:** Title and proof share a frame for 2 s, and nothing is ever shown empty or finished.
- **Use it for:** Dashboards, analytics, any results screen.
- **Rebuild:** Title `translateX` 0→−23vw; cards staggered 3–4 frames, width 10%→100%; numbers via `interpolate` + digit columns with `translateY`; SVG line with `stroke-dashoffset`. Start the takeover before counting ends.

### Cursor-led punch-in
- **Seen at:** 37.2–37.7 and 43.8–44.4
- **What happens:** The pointer starts toward a control; 4–8 frames later the camera punches in on it (1→~2.6x in 12 frames; second time ~4x in 14, with most of the change in 3 middle frames). The click lands with the zoom, and the result (side panel) opens during the zoom's tail. The pointer lives in the scene, so it grows with the zoom (to ~10% of frame height).
- **Easing:** Sharp ease-in-out (scale 1.0, 1.02, 1.08, 1.15, 1.25, 1.4, 1.8, 2.1, 2.3, 2.5, 2.55, 2.6).
- **Why it works:** The viewer always knows why the camera moved, and tiny toolbar controls become legible.
- **Use it for:** Any click on a small control.
- **Rebuild:** `scale` on the world with `transform-origin` at the control, `Easing.bezier(0.8, 0, 0.2, 1)`, 12 frames; start the pointer tween 6 frames earlier; fire hover/click state on the last zoom frame.

### Zoom-through cut to a burst
- **Seen at:** 45.71–46.1 (close-up `w24b`)
- **What happens:** On the click, three frames of accelerating zoom into the button (1→1.15→1.9), then a cut to the bare page where ~20 app logos scale up from near zero and fly outward from centre. Four are visible on the first frame, all by frame 9; the burst then slows into a steady drift.
- **Easing:** Exponential in for 3 frames, exponential out for ~7.
- **Why it works:** Zooming in and bursting outward are the same optical flow, so the cut reads as passing through the button.
- **Use it for:** "Connects to…", integrations, any one-to-many reveal.
- **Rebuild:** Scene A: `scale` 1→1.9 in 3 frames (`Easing.in(Easing.exp)`). Scene B: items at final ring positions × 0.15 and scale 0, to × 1 and scale 1 over 7 frames `Easing.out(Easing.exp)`, starts staggered 0–8 frames, then a linear 1→1.3 group scale over 2 s.

### Defocus fly-through as a wipe
- **Seen at:** 46.2–48.2
- **What happens:** The camera keeps moving forward through the logo cloud. Logos sit at different depths, so near ones grow faster, blur heavily, turn translucent and leave as soft colour blobs. By 48.0 only two blobs remain at the corners; the tagline fades in at centre over 4 frames while they exit.
- **Easing:** Near-constant forward speed.
- **Why it works:** The scene clears itself; the blur tells the eye to stop reading logos just as the line arrives.
- **Use it for:** Leaving any cloud of items (logos, avatars, cards) for a closing line.
- **Rebuild:** CSS `perspective` on the parent, each item with its own `translateZ`; advance a shared Z linearly. Per item, blur and opacity are functions of apparent scale (blur from ~1.5x, fade from ~2.5x). Text opacity 0→1 over 4 frames once the centre is empty.

### Selected-word swap
- **Seen at:** 49.3–51.1
- **What happens:** Claude's cursor selects the first word of the tagline (pale blue-grey highlight). The word is replaced in a single frame, about every 14 frames: Plan → Build → Share → Work. The line re-centres on the same frame. The highlight drops at 51.8 and teammates' cursors arrive one every ~10 frames.
- **Easing:** None; hard swaps.
- **Why it works:** Recaps three products with one line of type, and looks like an edit being made rather than an animation.
- **Use it for:** End lines that sum up several features; "for X / for Y" audience lines.
- **Rebuild:** `words[Math.floor((frame-start)/14)]` in a highlighted span inside a centred line. No transition.

## 6. Camera
- One continuous virtual camera over a flat 2D world; it pushes, pulls, pans and scrolls, never rotates or tilts. Only the logo cloud (46–48 s) uses depth.
- Pushes: 1.0→1.33x in 17 f (9.5); 1→2.6x in 12 f (37.2); 1→~4x in 14 f (43.8). Pull-backs: 1.9→1.0x in 36 f (16.25); 2.6→1.0x in 14 f (39.1). Pan: ~38 f (13.9). Scrolls: 18–20 f.
- Trigger: a cursor always moves first. The camera goes only where a cursor is about to act, and lands on the action.
- Between moves there is a creep of about 1 px per frame at 400 px width (seen 10.3–13.5, 41.5–42.0, 44.4–45.7), so holds are not frozen.
- Never happens: shake, rotation, 3D tilt of UI, device frames, a visible cut between unrelated images, a dissolve between scenes (the one dissolve, 39.04, is inside a page).

## 7. Product UI treatment
- UI is real product layout, simplified, on the same cream page as the titles. The app window is a white rounded card with a soft shadow; it is shown whole only briefly (17.5–21.8, 36.2–37.2) and otherwise cropped to the working area.
- Two cursor systems. Collaborators and Claude: small arrowhead plus a coloured name tag (tag ~5% of frame width in wide shots, ~9% in close-up). The viewer's own pointer (35.6 on): plain black arrow, used only for clicks.
- Claude's work is always attributed: the cell being edited has a terracotta outline with a "Claude" tag on its corner; the path on the board extends from Claude's cursor.
- Click feedback: hover tint 3 frames before the click (38.75, 45.4), then the result opens; no ripple or ring.
- Typing: 1 character per frame, box grows as lines wrap, mic icon turns into a send arrow on the first keystroke.
- One screen becomes the next by: sidebar collapsing (29.0), panel sliding in from the right (37.6), content cross-dissolving inside fixed chrome (39.04), in-page scroll (40.9).
- Amount on screen: one working region at a time, about 5–8 stickies or one table or four stat cards. Status text ("Reading last year's numbers…") reveals with a left-to-right shimmer.

## 8. Type and captions
- Two faces: a warm serif for all film titles, and a plain sans for UI text and cursor tags. Titles are ink on cream, centred, no shadows or boxes.
- Sizes (approximate font size as share of frame height): hero word ~12%; section titles ~7% in two lines (light first line, bold product name); tagline ~8.5%, one line, 56% of frame width; end wordmark ~13%. UI text in close-up ~3%.
- Section title layout is fixed: icon at 37% of height, line 1 at 46%, line 2 at 54%, centred.
- Entry: typed (hero word, wordmark), dragged by cursors (first section title), or faded up in place in 3–4 frames (later titles, tagline). Exit: covered or pushed by UI, or accelerating off the top. No letter-by-letter fades, no bounces.
- Never more than two short title lines (max 5 words a line). No captions or subtitles; the only running text is the prompts, which double as narration.

## 9. Colour, background, light, texture
Sampled from frames, quantised to steps of 4, so treat as ±4 per channel.
- Page: starts neutral `#f7f7f7`; a warm patch grows from the centre from ~4 s and the whole page is warm cream `#f9f6f3` by ~20 s to the end.
- Ink `#101010`. Claude accent (cursor, caret, cell outline, spark) `#d47454`. Selection highlight `#a4c4cc`. Prompt bubble `#e4e1de`.
- Teammate cursors: teal `#0c7874`, magenta `#c05498`, blue `#386cd0`, green `#388c48`.
- Board: sticky yellow `#fcdc88`, path peach `#fcc074`, map green `#b8e4a4`. Sheet tints: blue `#c4d8ec`, green `#e0f0e4`, yellow `#f8f0d8`. Dashboard: page `#fcf4e8`, cards `#fcfcfc`, dark green `#1c5840`, pink bars `#ecc4c8`.
- Light and texture: flat. One soft shadow under the app window and cards; no grain, gradients only as the faint warm patch and the blurred logos. Colour comes from content, never from the background.

## 10. Sound (from measurement only)
Not heard; this is read from the loudness track in the profile.
- 0–15.5 s: quiet bed, −22 to −27 dB, with two bumps: 2.5–3.5 s (−15 to −18 dB, while letters turn into icons) and 6.0–6.5 s (−14.6 dB, as the second title line lands).
- 15.5 s: level rises about 8 dB and stays at −13 to −17 dB until 51.75 s. The rise coincides with Claude's first stroke on the board (15.46 s). Inferred: the main music enters here.
- Loudest point −10.8 dB at 45.9 s, one frame or two after the Share cut and logo burst (45.83 s).
- 51.8 s: drops more than 10 dB to −23 to −28 dB as the word swap ends; fades to silence from 56 s under the logo hold.
- movement_follows_sound is 0.18: loudness does not track movement moment to moment. Sound marks three structural points (work starts, biggest reveal, wind-down), not every move.

## 11. Principles
1. Every scene change is a move of the camera or of a panel; if a cut is unavoidable, hide it inside motion in the same direction on the same background colour.
2. Nothing changes on screen until a named cursor has arrived at it.
3. Things leave accelerating (12–20 frames) and arrive decelerating (8–17 frames); nothing moves at constant speed except a slow drift.
4. The frame is never completely still for more than about 1.25 s; holds carry typing, counting, cursor drift or a slow creep.
5. Every product section opens with the same title card (icon, light line, bold name) in the same position, and leaves the previous section the same way.
6. Content builds while the camera moves; no screen is shown empty, and none is shown already finished.
7. The camera zooms only to the control about to be used, starts after the pointer, and lands on the click.
8. New text arrives in an accent colour and settles to ink within 3 frames.
9. One background colour family for the whole film; all strong colour belongs to content.
10. Titles are at most two short lines, and the prompts do the explaining.

## 12. Not to copy
- The Claude spark and wordmark, and the spark-grows-from-a-dot end lockup.
- The terracotta "Claude" cursor tag and the named cast of teammate cursors (Mia, Rosa, Dev, June).
- The warm cream page with terracotta accent and the brand serif: this pairing is the Claude look.
- The pie-shop story, its mascot and illustrated stickies.
- The line "… at the speed of thought" and the product names.
- The exact section-title wording pattern ("Plan it out with / Build it with / Share a story with").
Take the mechanics (cursor-caused change, slide-off reveal, momentum cut, build while pulling back); give them Tulvo's own colours, type, cursor design and story.
