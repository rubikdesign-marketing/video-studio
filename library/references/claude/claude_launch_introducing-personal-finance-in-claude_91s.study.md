# Study card: Claude — Introducing Personal Finance in Claude

File: `library/references/claude/claude_launch_introducing-personal-finance-in-claude_91s.mp4` · 91.3 s · 1280x720 · 24 fps
Studied: 2026-11-11 · Depth: frame by frame (8 overview sheets at 2 fps, 39 window sheets, 1 comparison sheet, all in `library/references/claude/_study/personal-finance/`)

Reading notes: frame counts are at 24 fps (1 frame = 42 ms). Sizes are a share of the 1280x720 frame, measured off 400 px thumbnails, so treat them as ±1–2%. 720p source: small card text is soft, so wording of tiny labels is not relied on. Window sheets stamp time from the start of the window, not of the film.

## 1. What it is, in one paragraph
A launch film for a money feature inside a chat assistant, aimed at ordinary households rather than finance people. Its one idea: you ask about your money the way you would text a friend, and the answer comes back as a small, clear picture. It tells this as one continuous story, a family planning a week in Rome, told through five questions that each produce a different kind of answer card, and it ends on the line "Personal finance is now personal". The feeling is calm, warm and slightly funny: the questions are sloppy and human ("Dumb question... what can we even afford?"), the answers are tidy. Three bursts of real footage (Rome skyline, a gelato counter, a hotel courtyard) keep reminding the viewer what the numbers are for.

## 2. Structure
| Time | Beat | What the viewer learns | Energy 1–5 |
|---|---|---|---|
| 0.0–9.5 | Cold open on footage: two chat bubbles over sky, camera tilts down to Rome, "Picturing" status, serif reply over the city | Who is asking, what they want, that the assistant has a voice | 3 |
| 9.5–12.3 | Title: "Introducing: Personal Finance in Claude" with four tilted data cards drifting around it, "Beta" pill | The product name | 4 |
| 12.3–18.2 | Setup: "Connect your accounts. Share only the ones you want." Button press, three accounts appear, three checkboxes tick, button press | It is opt-in and takes three taps | 2 |
| 18.2–20.3 | Chapter card 1: "Ask it the way you'd say it" | The first promise | 2 |
| 20.3–30.4 | Question 1 → emoji reaction → thinking dots → streamed reply → three cards in a carousel (donut, merchants list, accounts) | It reads your accounts and shows where you stand | 4 |
| 30.4–39.6 | Question 2 → reply → "Spending this month" card with two bars filling | Fixed vs flexible spending | 3 |
| 39.6–49.6 | Question 3 shown huge, then shrinks into chat → "Thinking" → car payment card, then credit card fees card | It spots things you did not ask about | 3 |
| 49.6–53.1 | Footage break: gelato counter, giant bubble typing "Ooooooooh that could be our gelato allowance..." | The human reaction; a laugh | 5 |
| 53.1–55.1 | Chapter card 2: "Play out scenarios" | The second promise | 2 |
| 55.1–65.3 | Question 4 (two bubbles) → reply → month calendar builds: totals, fund bar, 20-odd day chips | It can plan forward, on a calendar | 4 |
| 65.3–72.5 | Question 5 → "Thinking" → reply → view pulls back, two hotel cards rise | It goes beyond numbers to options | 3 |
| 72.5–78.7 | Hotel card is pressed, its photo grows to fill the frame, slow push in, bubble "Yep, this feels like us." | The payoff: the trip feels real | 4 → 1 |
| 78.7–83.0 | Blue disc wipes up, becomes a giant chart ring, shrinks to an icon over "Personal finance is now personal" | The line to remember | 4 → 2 |
| 83.0–86.0 | Tag joke: "Can we just MOVE to Rome?" → "Running scenarios..." | It never stops being playful | 2 |
| 86.0–91.3 | Logo: dot → spark → wordmark types on, 4 s hold | Who made it | 1 |

How it holds 91 s: a fixed 10-second loop (ask 1.5 s → react and think 1.3 s → streamed sentence 1–2 s → card builds 1–3 s → hold 1–1.5 s → exit 0.4 s) repeated five times, where only the card changes and each card is bigger than the last (card width 40% → 48% → 52% → 63% → 86% of frame → full-frame photo). Footage lands at 0%, 54% and 80% of the running time, so the longest stretch of plain cream is 40 s.

## 3. Measured
From `tools/study/profile.py`: 5 hard cuts (9.54, 18.17, 49.58, 53.08, 78.67 s) · median shot 11.07 s · longest shot 31.42 s (18.2–49.6) · still 26.75 s (29%) · share of time moving 0.66 · typical movement 1.18, peak 37.32 · movement follows sound 0.05 (no link).
Chart: movement comes in short spikes of 0.5–1 s every 3–5 s (each is a scene swap or a card build) with flat floor between them while text is read. The two tallest peaks are the gelato footage (50.75–51.25) and the photo expanding (73.0). Rests of 3–4 s sit at 22–26, 31–35, 67–71 (typing and thinking) and 80.5–82.5 (end line). There are about 13 more scene changes that the cut detector does not see because they are one-frame swaps on the same cream background (section 4).

## 4. Shot and transition list
| Time | From → to | Technique | Frames it takes | What carries the eye across |
|---|---|---|---|---|
| 0.04 | Blurred sky → first bubble | Bubble appears at 2x size and settles to 1x; text types inside | 12 | Bubble stays centred while it shrinks |
| 2.54 | One bubble → two | Second bubble pops in full, stack shifts up 3% | 6 | Stack keeps its right edge |
| 4.0–4.4 | Bubbles → "Picturing" status | Stack slides up 16% of frame height; label fades in under it | 10 | The footage tilt-down keeps running underneath |
| 6.25 | Status → serif reply | Status removed, reply fades in in its place; footage defocuses and darkens through to 9.5 | 3 (reply) | Same left edge and baseline |
| 9.42–9.54 | Footage chat → cream title scene | Overlay shrinks about 4% for 3 frames, then hard cut; cards slide in from all four edges | 3 + 10 | Shrink direction continues as cards converge on centre |
| 12.3–12.8 | Title scene → "Connect your accounts." | Whole scene scrolls up, speeding up; cards travel about 1.5x faster than the title; new lines fade grey → black | 12 out, 8 in | Upward travel |
| 14.75–15.9 | Heading + button → accounts list | Button press dip, heading fades, button slides from 55% to 86% of frame height, list rows fade in above it top-down | 4 + 16 + 14 | The button never leaves the screen |
| 17.6–18.17 | Accounts → chapter card 1 | Button press dip (4 frames), hold 10 frames, hard cut to empty cream; title builds word by word | 13 for 7 words | The press is the cause, the cut is the effect |
| 19.8–20.33 | Chapter card → question 1 | Words leave first-word-first; one-letter bubble appears where the line was and types on | 12 out | Same vertical position |
| 25.75–26.0 | Chat → donut card | Chat shrinks to 0.78 in 6 frames; one-frame swap; card arrives at 1.58x and settles | 6 + 12 | Continuous shrink across the swap |
| 27.2–27.75 | Donut card → merchants card | Stage pulls back, row slides left, new card scales up, old card dims behind | 12 | Sideways travel; old card stays visible |
| 28.6–29.0 | Merchants → accounts card | Same carousel move | 12 | Same |
| 30.1–30.5 | Cards → question 2 | Neighbour cards fade, focus card flies up and out, bubble pops at centre-left | 8 + 1 | Upward travel |
| 34.9–35.4 | Chat → reply 2 | Chat eases upward 10 frames, one empty frame, new text starts 14% low and rises while it streams | 10 + 8 | Upward travel handed over |
| 38.9–39.7 | Bars card → hero question 3 | Page scrolls up and out, accelerating to about 9% of frame height per frame; big bubble appears 10% low and drifts up to rest | 18 + 16 | Upward travel handed over |
| 40.46–40.9 | Hero bubble → chat-size bubble | Shrinks 75% → 67% wide in 5 frames, jumps to chat size at top right, settles | 5 + 1 + 3 | Same words, same object |
| 44.0–44.5, 46.3–46.8 | Text → card, card → next text | Page scrolls up about 30% / 45% of frame height; next item starts appearing before the scroll stops | 12 each | Scroll |
| 49.25–49.58 | Fees card → gelato footage | Page starts scrolling up 8 frames, hard cut mid-move to footage with one-letter frosted bubble | 8 + cut | Colour jump is the point; bubble anchors the eye at centre |
| 52.8–53.08 | Footage → chapter card 2 | Bubble slides off left, hard cut, title builds word by word | 9 for 3 words | Leftward travel, then centre |
| 54.9–55.1 | Chapter card → question 4 | Title rises 11% in 6 frames, one-frame swap, bubble keeps rising and slows | 6 + 8 | Upward travel handed over |
| 60.75–61.1 | Chat → calendar | Page scrolls up; calendar (86% wide) rises from below already drawn as a skeleton | 12 | Scroll |
| 65.3–66.0 | Calendar → question 5 | Calendar scrolls up and out, accelerating; one empty frame; bubble present, drifting up | 16 + 1 | Upward travel |
| 71.1–71.5 | Chat → chat + hotel cards | Whole chat scales to 0.72 about its centre; cards rise from below, photos first | 12 + 10 | Pull-back makes the space the cards fill |
| 72.58–73.2 | Hotel card → full-frame photo | Card dips (press), photo grows from 26% wide to full frame | 4 + 9 | The photo itself |
| 78.33–78.67 | Photo → ring scene | Blue disc rises from bottom centre until the frame is solid blue; hard cut to cream with the blue now a thick arc | 8 + cut | The blue |
| 79.88–79.92 | Giant ring → end line | Ring collapses to an icon 8% of frame height; two serif lines fade grey → black | 2 + 8 | Ring lands above the words |
| 82.8–83.0 | End line → tag bubble | Line and icon fade out in 4 frames; bubble appears lower right, drifts up | 4 + 6 | None needed; it is a deliberate beat change |
| 85.75–86.1 | Tag chat → logo | Chat scrolls up and out; a dot appears at centre, opens into the spark, wordmark types | 8 + 3 + 6 | Clay dot colour matches the thinking dots |

## 5. Techniques worth taking

### Relay scroll (hand the speed across a hidden cut)
- **Seen at:** 34.9–35.4, 38.9–40.3, 54.9–55.4, 65.3–66.3, 30.1–30.5.
- **What happens:** The outgoing content starts moving up slowly and speeds up for 10–18 frames. It is removed in a single frame (sometimes with one empty cream frame). The incoming content is already fully visible on its first frame, sitting 10–14% of frame height below where it will rest, and keeps travelling up, slowing for 8–16 frames (steps of roughly 7, 4, 2, 2, 1, 1 thumbnail px). Nothing fades.
- **Easing:** Ease-in only on the way out, ease-out only on the way in. The two halves read as one move.
- **Why it works:** It feels like a chat feed scrolling, but the screen is fully cleared each time so every beat starts clean. It costs under half a second.
- **Use it for:** Any step-to-step change in a product demo or explainer where the background stays the same.
- **Rebuild:** Two `<Sequence>`s that meet on a frame. Out: `translateY = interpolate(f,[0,18],[0,-0.65*H],{easing:Easing.in(Easing.cubic)})`. In: `translateY = interpolate(f,[0,16],[0.1*H,0],{easing:Easing.out(Easing.cubic)})`, opacity 1 from frame 0. In HyperFrames the same pair as `power3.in` then `power3.out` tweens butted together. Keep both directions identical for the whole film.

### Zoom-through swap (shrink out, arrive big)
- **Seen at:** 25.75–26.5, 40.46–40.9, 9.42–9.6.
- **What happens:** The whole outgoing group scales down about its centre to 0.78 over 6 frames. On the next frame it is gone and the incoming card is on screen at 1.58x its final size (61% of frame width vs 40%), and it keeps shrinking to rest over 12 frames while its contents start to draw.
- **Easing:** Ease-in on the outgoing shrink; long ease-out on the incoming settle (width steps 252, 243, 224, 203, 194, 187, 180, 174, 170 … 160).
- **Why it works:** The eye reads one continuous pull-back, so a complete change of content does not feel like a cut. It also says "stepping back to see the bigger picture".
- **Use it for:** Moving from talk to evidence: a claim, then the chart that backs it.
- **Rebuild:** Out: `scale 1 → 0.78`, 6 frames, `Easing.in(Easing.quad)`. In: `scale 1.58 → 1`, 12 frames, `Easing.out(Easing.cubic)`, `transformOrigin` at the card's centre. No opacity ramp. Start the card's inner build on the first incoming frame, not after it settles.

### Hero question that becomes a chat bubble
- **Seen at:** 0.04–0.6 (opening), 39.67–40.9, 49.6–53.0 (stays big).
- **What happens:** A question is first shown as a giant bubble, 75% of frame width and 28% of frame height, text about 10% of frame height, held 0.9 s. It then shrinks slightly (75% → 67% over 5 frames), jumps in one frame to normal chat size at the top right (about 40% wide, text about 5% of frame height) and settles for 3 frames. The answer then streams below it. The opening does the short version: 2x → 1x in 12 frames.
- **Easing:** Slow start, one-frame middle, short soft landing.
- **Why it works:** The question doubles as the section title, so no separate caption is needed, and the size change resets attention before the answer.
- **Use it for:** Opening hooks; the top of each section in a feature tour.
- **Rebuild:** One element, two layout states. Animate `scale` and `translate` between them with `Easing.bezier(0.7,0,0.2,1)` over 9–10 frames; the steep middle gives the one-frame jump. Keep the corner radius proportional (full pill) at both sizes.

### Streamed text with a tinted leading edge
- **Seen at:** 23.6–24.3, 24.4–25.3, 35.2–36.5, 42.0–43.6, 46.6–47.3, 57.9–59.5, 69.0–70.6.
- **What happens:** Assistant sentences appear left to right at about 2 characters per frame (about 45 a second). The newest 6–10 characters are clay-coloured and partly transparent; behind them the text turns near-black within about 6 frames. The same clay-then-black settle is used on every newly arrived label inside cards (card titles at 44.3 and 47.55, month labels, hotel names at 71.6).
- **Easing:** Linear reveal; the colour settle is a short fade.
- **Why it works:** The eye always knows where the newest information is, without a cursor or highlight box. One colour means "just arrived" everywhere in the film.
- **Use it for:** Any generated or typed text; any value that updates.
- **Rebuild:** Split into characters. For character i with reveal frame `r = i/2`: `opacity = interpolate(f,[r,r+3],[0,1])`, `color = interpolateColors(f,[r+2,r+8],[accent, ink])`. In HyperFrames, a staggered tween on per-character spans with two properties. Use the brand's own accent, not this clay.

### Word-by-word chapter title
- **Seen at:** 18.17–18.7 (7 words), 53.08–53.4 (3 words), 10.5–11.0 (title, 5 words across 3 lines), exit at 19.8–20.3.
- **What happens:** One serif line, centred, about 7% of frame height, nothing else on screen. Each word arrives 2–3 frames after the last, starting light grey and about 2% of frame width to the right, reaching black and its place in 2–3 frames. Held 1.1–1.5 s. Exit: words fade to grey and vanish first-word-first, 2 frames apart.
- **Easing:** Short ease-out per word.
- **Why it works:** Reading speed is set for the viewer; a five-word promise takes half a second to land, and the empty frame around it works as a breath between demo sections.
- **Use it for:** Section headers, value statements, end lines.
- **Rebuild:** Words as inline-block spans; stagger 2.5 frames; per word `opacity 0.25 → 1` and `translateX 0.02*W → 0` over 3 frames. Exit uses the same stagger from the first word. Maximum 7 words.

### Type-on bubble, reaction badge, thinking dots
- **Seen at:** 20.33–23.6, 30.5–34.0, 55.1–57.9, 66.0–69.0, 83.0–85.7.
- **What happens:** A user bubble appears holding one letter and grows to the right from a fixed left edge as text types at about 27 characters a second, pausing at "..." for 0.3 s. Its right edge ends at about 95% of frame width. 0.3 s after the last letter a small white circular badge with an emoji pops at the bubble's lower-left corner (grows past full size, then settles, about 6 frames). 0.1 s later one clay dot appears at the left margin (6% in), becomes three dots that keep changing size, sometimes followed by a grey status word ("Thinking", "Running scenarios...") that types on with a light sweep. After 1.0–1.3 s the dots are replaced by the streamed reply on the same line.
- **Easing:** Typing is stepped; the badge overshoots by about 15%.
- **Why it works:** Three small events fill the wait so there is never a dead frame, and they give the assistant a personality before it says a word.
- **Use it for:** Any chat or prompt-driven product; any moment where the product "works".
- **Rebuild:** Bubble is an inline-flex pill with `width:auto`; reveal text by slicing the string per frame so the pill grows naturally. Badge: `spring({frame, fps, config:{damping:12, stiffness:200}})` on scale. Dots: three circles whose scale follows offset sine waves.

### Card build order: shell, title, rows, then numbers that count while marks draw
- **Seen at:** 26.0–27.2 (donut), 35.9–37.5 (bars), 44.3–45.9 (car payment), 47.5–48.6 (fees), 61.0–64.5 (calendar).
- **What happens:** A white rounded card fades in empty over 3 frames. Title appears. Rows arrive one at a time, 2–3 frames apart, each at about 30% opacity rising to full in 3 frames. Every number starts at zero and counts up while its bar grows or its ring sweeps, both finishing on the same frame (donut total $39 → $4,716 in about 1.5 s; "Fixed" bar $7 → $4,089 in 1.5 s with the second bar starting 7 frames later). On the calendar, day chips pop in one by one 2–3 frames apart for about 2.5 s.
- **Easing:** Bars and counts start slowly, run fast, and land softly; rings sweep with a long ease-out.
- **Why it works:** The viewer watches the answer being worked out, so static data becomes an event, and the final figure gets the last frame of attention.
- **Use it for:** Every chart, stat, table or pricing card.
- **Rebuild:** One progress value `p = interpolate(f,[0,36],[0,1],{easing:Easing.inOut(Easing.cubic)})` drives both `width: p*100%` and `Math.round(p*value)`. Rings: SVG circle with `strokeDasharray` and `strokeDashoffset = (1-p)*circumference`, round caps. Use tabular figures so counting digits do not jitter.

### Three-card carousel with dimmed neighbours
- **Seen at:** 27.2–27.75, 28.6–29.0, held 27.75–30.1.
- **What happens:** The focus card shrinks from 40% to about 27% of frame width over 6 frames while an empty outline of the next card appears to its right. The row then slides left by about 35% of frame width and the next card grows to 48% wide. The previous card stays on screen behind and beside it at about 55% size and about a third opacity, slightly soft. With three cards, one is always sharp in the centre and two are faded either side.
- **Easing:** Ease-in-out across 12 frames.
- **Why it works:** Shows "there is more than one answer" without making anyone read three cards at once.
- **Use it for:** Feature lists, dashboards, template galleries.
- **Rebuild:** A horizontal track; per card derive `scale`, `opacity` and a small `blur()` from its distance to the focus index, and animate the index. Populate a card's rows only when it becomes the focus.

### Press without a cursor
- **Seen at:** 14.75–14.95, 17.6–17.8 (button), 72.58–72.75 (hotel card), 16.6–17.2 (checkboxes).
- **What happens:** There is no pointer anywhere in the film. A press is shown by the control itself: it scales to about 0.92 and lightens for 4 frames, then returns in 2. The result follows 1–2 frames later. Checkboxes go empty → small grey square → solid black square → tick in 4 frames, the three boxes 10 and 4 frames apart.
- **Easing:** Quick in, quicker out, no bounce.
- **Why it works:** Removes the hardest thing to animate well and keeps the frame clean; cause and effect still read.
- **Use it for:** Any click in a UI demo where where-to-click is obvious.
- **Rebuild:** `scale = interpolate(f,[0,4,6],[1,0.92,1])`, background from ink to 80% ink on the same keys. Trigger the consequence at frame 7.

### The pressed button stays and makes room
- **Seen at:** 15.0–15.9.
- **What happens:** After the press, the button slides straight down from 55% to 86% of frame height over 16 frames. The heading above fades out in 3 frames. The account rows then fade in top-down in the gap, 2–3 frames apart, balances counting up from $0.00.
- **Easing:** Fast start, long soft stop (steps 3, 4, 7, 10, 11, 8, 6, 5, 3, 3, 2, 2 thumbnail px).
- **Why it works:** One element survives the change, so the viewer never loses their place, and the same button is ready for the second press.
- **Use it for:** Form steps, modals opening, onboarding flows.
- **Rebuild:** Keep the button mounted across both states; animate only `translateY` with `Easing.out(Easing.cubic)`. Mount the list inside the same container.

### Ticker bubble on footage that follows its own last letter
- **Seen at:** 49.6–53.0; footage treatment also at 0–9.5.
- **What happens:** Over full-frame footage, a frosted, semi-transparent bubble 28% of frame height types one character every 2 frames (12 a second). When its right edge reaches about 97% of frame width (50.7 s) the bubble starts sliding left at typing speed so the newest letter stays at 92–95%. The footage pans the same way. At the end the bubble keeps going and exits left into the cut. In the opening, the footage is gradually defocused and darkened from 6.3 s as the serif reply appears, so white text stays readable without a box.
- **Easing:** Linear slide matched to typing.
- **Why it works:** A long line stays huge and readable, and the slide gives a still caption the energy of the footage.
- **Use it for:** Reaction beats, testimonial quotes, long product names over b-roll.
- **Rebuild:** `translateX = -max(0, textWidthSoFar - 0.6*W)`. Bubble: `background: rgba(255,255,255,0.7); backdrop-filter: blur(20px)`. Footage via `<OffthreadVideo>`; add `filter: blur() brightness()` ramped over 60 frames when text sits directly on it.

### Thumbnail grows into the whole frame
- **Seen at:** 72.58–73.25, then 73.25–78.3.
- **What happens:** After the press dip, the chosen card's photo grows from 26% of frame width to full frame in 9 frames (widths 100, 112, 118, 131, 152, 186, 236, 298, 352, 383, 400), pushing the rest of the chat off left and bottom. Once full, the photo pushes in slowly, about 15–20% over 5 s (estimated by comparing 73.5 and 78.2). A white bubble pops on it at 74.9.
- **Easing:** Slow start, hard arrival, 2-frame settle.
- **Why it works:** The interface literally opens onto the real thing; it is the emotional peak, and the measured loudness drops here too.
- **Use it for:** Payoff moments: from the tool to the result it produced.
- **Rebuild:** Shared element: animate the image's `width/height/left/top` from card rect to `0,0,W,H` with `Easing.in(Easing.cubic)`, border radius to 0 at the last frame; then `scale 1 → 1.18` linear over 5 s.

### Wipe shape that turns into the next object
- **Seen at:** 78.33–79.92.
- **What happens:** A blue disc rises from the bottom centre and fills the frame in 8 frames. On the cut the background flips to cream and the blue is now one thick arc (stroke about 12% of frame height) of a ring too large for the frame. The ring turns clockwise about a quarter turn over 28 frames, slowing, bringing grey, orange, green and yellow segments into view. It then collapses in 2 frames to a small ring icon above the end line.
- **Easing:** Wipe accelerates; rotation decelerates; collapse is near-instant.
- **Why it works:** The earlier donut chart returns as the closing symbol, tying the demo to the tagline with no new graphics.
- **Use it for:** The turn from demo to end card.
- **Rebuild:** Disc: a circle with `scale` 0 → cover, origin bottom centre, 8 frames ease-in. Ring: SVG arcs with round caps, `rotate` 0 → 90° over 28 frames `Easing.out(Easing.cubic)`, then `scale` to icon size over 2 frames. Build it from a shape that already appeared in your own product UI.

### Floating data cards around a title
- **Seen at:** 9.54–12.8.
- **What happens:** Four white cards slide in from the four edges in 10 frames and sit around the centred title at slight tilts (about 5–8°), partly cropped by the frame. Their contents keep counting and drawing for the full 2.5 s. On exit they scroll up about 1.5x faster than the title.
- **Easing:** Ease-out on entry, shared ease-in on exit.
- **Why it works:** A title card that already shows the product working; the speed difference gives depth without 3D.
- **Use it for:** Title and "introducing" cards.
- **Rebuild:** Absolutely placed cards with fixed `rotate()`; reuse the real card components with their build animations; exit multiplier 1.5 on `translateY`.

## 6. Camera
On the cream scenes there is no camera in the film sense, only three whole-frame moves: vertical scroll (always upward, never down), scale pull-backs (to 0.72–0.78 at 25.75, 40.5, 71.1) and one sideways carousel slide. Moves last 6–18 frames and are triggered by content arriving, never by time passing. Footage has its own motion: a steady tilt down from sky to skyline (0–5 s), a hand-held pan right along the counter (49.6–53 s), a slow push on a still photo (73.3–78.3 s). Never seen: rotation of the frame, 3D perspective, shake, whip pans, zooms into a UI detail, a cursor to follow.

## 7. Product UI treatment
No app chrome at all: no window, sidebar, input box, avatar or cursor. The product is reduced to three parts on a flat background: grey user pills on the right (right edge at about 95%, up to 62% wide), assistant sentences in serif on the left (left edge at 6%), and white cards under the assistant text sharing that left edge. One card is in focus at a time and never more than about 8 rows are readable. Data is believable and consistent across cards (the same account totals appear at 17 s and 30 s; a car loan chip of about $348 appears to return on the calendar, though that text is too soft at 720p to be sure). Typing is stepped per character; presses are a 4-frame dip; one screen becomes the next by scrolling up or by the swaps in section 5. Card widths grow through the film from 40% to 86% of the frame.

## 8. Type and captions
Two families: a soft serif for titles, chapter lines, the assistant's voice and the logo; a plain rounded sans for user bubbles and everything inside cards. Sizes as a share of frame height: titles and chapter lines about 7% (line pitch 8%), up to 3 lines, centred; assistant text about 5%; bubble text about 4.5–5%; hero bubble text about 10%; card labels 3–4%; logo wordmark about 11%. There are no subtitles: the chat itself is the caption track. Text enters by typing (user), streaming with a tinted edge (assistant) or word-by-word fade from grey (titles), and leaves by scrolling up or word-by-word. Seldom more than 25 words readable at once; the calendar is the one dense screen and is held longest (about 4 s).

## 9. Colour, background, light, texture
Sampled from frames (compression shifts these a little): background cream `#fbf8f5`; user bubble `#efede9`; ink `#141411`; card `#ffffff`. Accent clay about `#d97757` (dots, text edge, logo spark; sampled between `#e07050` and `#c87858` on small shapes, so approximate). Chart colours: blue `#2f6fd0`, green `#1ea37e`, orange `#ec6a34`, yellow about `#f0a818`, warm grey about `#c0c0b0`. Progress and "money in" green about `#01a603` with pale track about `#c8e0c8`; fee red about `#d03838`; account icon maroon about `#781838`. Opening sky about `#cadadf`.
Background is one flat cream throughout, no gradient. Cards are flat white with a radius of about 4% of their width and a shadow so soft it is only clearly visible on the calendar. On footage, bubbles are frosted and semi-transparent; on the hotel photo the bubble is solid white. No grain or vignette visible at this resolution. Colour is used sparingly: a card usually carries one or two hues, and the only saturated full-frame moments are the footage and the blue wipe.

## 10. Sound (from measurement only)
Not heard; this is read from the loudness values in the profile (one reading per 0.25 s). Quiet opening (about -31 dB for 2 s, rising to -21 dB by 9 s). From 18.0 s, where chapter card 1 arrives, the level steps up to about -17 dB with regular pulses roughly every 0.5–0.75 s, and holds that through 72.75 s. At 73.0 s, as the hotel photo fills the frame, it drops to about -33 dB for 4.25 s. It returns to full at 77.25 s, about one second before the blue wipe, runs to 88 s and fades to silence by 91 s. Short dips to about -30 dB sit at 11.5, 13.75, 16.0 and 31.5–32.0 s. Overall movement does not track loudness (0.05); what lines up is structure: level steps at 18.0, 73.0 and 77.25 match scene boundaries, not individual moves.

## 11. Principles
1. Repeat one loop (ask, think, answer, show, hold, leave) and change only the payload; here 5 loops of about 10 s.
2. Make each payload bigger or richer than the last, so the film climbs without getting faster (40% → 86% of frame → full frame).
3. Move in one direction only between steps (up) and reserve every other direction for a special moment.
4. Clear the screen at every step; never let more than one card and two short text blocks compete.
5. Let no wait be empty: fill thinking time with a reaction, dots and a status word, each under 1.3 s.
6. Give "new" one colour and use it everywhere something arrives, then let it settle to ink.
7. Count numbers up in step with the bar or ring they describe, ending on the same frame.
8. Show a press on the control itself; use no cursor unless the path matters.
9. Break a long flat-background film with real footage at roughly the start, middle and four-fifths marks, each under 6 s.
10. Hold after every build for at least 1 s, and for about 4 s on the densest screen; about 30% of the film is still.

## 12. Not to copy
The spark logo and its dot-to-spark reveal; the clay accent and cream background pairing; the serif-voice / sans-user type pairing and the exact bubble styling; the three-dot clay thinking indicator and "Thinking" / "Picturing" status wording; the multi-colour ring icon; the Rome family story, its lines and jokes; the hotel, merchant and bank names; the specific card designs (donut, fee chips, calendar). Take the moves, the order of builds and the pacing; build them from Tulvo's own colours, type, product screens and story.
