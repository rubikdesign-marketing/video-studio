# Batch product-ui-4: what I learned

32 records from prompt-motion.com, all tagged Product UI, all made with Opus 5.5. Full data: `study/product-ui-4.json`.

## What was and was not checked

- I read all 32 prompts. All 32 videos were downloaded and measured with `profile.py`, and I looked at every one as a 12-frame contact sheet.
- I studied six at 2 fps and made frame-by-frame window sheets of five transitions: heyiammallik, wozu-co, bizibeast, marouanegazouzi, francoxavier33 and slvdev.
- Likes and views are empty for every record, so I could not rank by popularity. I chose the six for craft, and preferred films whose prompts are a line or less, so the picture carries the information.
- I did not listen to the sound. The only audio information is profile.py's loudness levels.
- The categories, looks and techniques for the other 26 films come from 12 frames each. Fast details between those frames may be missing.

## What kinds of film are in the batch

| Kind | Films |
|---|---|
| Product feature demo (UI walkthrough) | 8 |
| Product launch film | 7 |
| Mobile app promo | 5 |
| Personal intro or portfolio reel | 3 |
| Ad or social promo cut | 3 |
| Code or developer-tool film | 2 |
| Showreel or capability reel | 2 |
| Data story or charts | 1 |
| UI morph | 1 |

I did not need a new category.

## What separates the strong films from the weak ones

- **One idea carried the whole way through.** Examples:
  - one post from idea to published (miskinho)
  - a closed laptop lid (cansincengiz)
  - a DNA helix unravelling into categories (madebyjmayala)
  - one notch-shaped pill that changes state (jazzen-chen)
  - a mascot (kangaroohere, thilina-a)
  - a price sum that falls from $196 to $15 (bizibeast)
- **Real content from the product.** The good films use real prices, real UI and real numbers. Films built on generic dashboards look weaker.
- **Content is the transition.** Examples:
  - a tile becomes the next page (bizibeast)
  - messages are pulled into the app icon (wozu-co)
  - the last frame shrinks into a wall of every earlier scene (slvdev)
  - a chart collapses into light that becomes the logo (marouanegazouzi)
- **Little still time.** The six films I studied closely are still for 0 to 16% of their length. The weakest are still for 27 to 68%: majorbaguette 67%, iammxfschr 68%, charlesmendez 35%.
- **Weak films repeat a template.** They are long walkthroughs that use the same layout for every feature (caption left, window right) for 30 to 76 seconds, with no story.

## Prompt patterns

- **Tell the model to research the real product.** Examples: research the site, analyse my portfolio, use the live site's assets. Every film with real copy and UI had an instruction like this.
- **Always give a length.** When a length was given, the result matched it to within 0.1 s every time. Without one, films ran 23 to 76 s (median 33.5 s) and were the slowest in the batch.
- **One reference word can set a whole style.**
  - "Apple-style" produced centred headlines, a device and a gradient accent.
  - "Anthropic-like" produced editorial serif with italic accents.
  - "YC videos" produced a SaaS tour split into tabs.
- **A self-critique loop helps.** The most layered film (heyiammallik) asked the model to question its plan, start over if the result did not look professional, and treat every frame as important.
- **A beat list gives structure but can run long.** One prompt listed the user's steps in order (charlesmendez). The story was clean, but with no length it ran 57 s at about 7 s per step.
- **The "showreel" prompt has a side effect.** About ten records use the "prove you are an incredible motion designer, showreel, go all out" wording. It gives dense, varied films. Several, though, label their own techniques on screen with timecodes and scene numbers. That turns an ad into a demo of the tool.
- **"Presentation video" gives slides.** majorbaguette's film is still for 67% of its length.

## Timing, measured

- **Length:** median 24.1 s. 12 of 32 films have no hard cuts, and the median is one cut per film. Most films join scenes with movement inside the frame, not cuts.
- **Scene length:** about 1.5 s per scene in 15 to 18 s reels, and about 3.3 s per scene in a 40 s tour.
- **Opening:** the best films show a readable line by 0.5 to 1.0 s and the problem by 2.5 s.
- **End cards:** 1.0 to 1.75 s of true stillness after the logo settles.
- **Transitions measured frame by frame:**

| Transition | Film | Length |
|---|---|---|
| Cards absorbed into the app icon | wozu-co | 0.15 s |
| Icon turns into the app window | wozu-co | 0.15 s |
| Push through a tile into its colour | bizibeast | 0.4 s |
| Recap pull-back to a wall of scenes | slvdev | 0.35 s |
| Stepped staircase wipe | heyiammallik | 0.45 s |
| Flare to logo | marouanegazouzi | about 0.75 s |
| One word per cut in the opening | heyiammallik | 0.25 to 0.5 s per word |

## What looks cheap or machine-made

- **On-screen labels that describe the film itself:** timecodes, "01/06 KINETIC TYPE", frame rate and BPM, corner brackets.
- **Default SaaS looks:** pastel glass with gradient text, purple SaaS, navy with cyan glow, black with neon green.
- **Repeated templates:** the same layout for every feature, or the same typing beat again and again.
- **Text too small to read:** tiny UI in 15 s reels, made worse by 720p renders.
- **Layout slips:**
  - a wordmark clipped at the frame edge (cansincengiz)
  - a long dip to black in the middle of the film (gautam-mer1)
  - a blurred frame held as a transition (kmasiff)
- **One device used too often:** a typed headline five times (francoxavier33), or the logo shown in the middle and again at the end (marouanegazouzi).

## Gaps in engine-moves.tsv

I checked these against the list. None of them has a move today.

1. **Absorb into icon:** many cards are pulled into one icon, which then becomes the product window.
2. **Stepped staircase wipe.**
3. **Light collapse and flare:** the picture shrinks to a point, blooms with a horizontal streak, and the light becomes the logo.
4. **Recap wall pull-back for the film's own scenes:** this exists today only for screen captures.
5. **New data moves:**
   - dots falling into a distribution curve
   - a radar sweep
   - a fan of many paths with percentile labels
   - a scatter of risk against return (an efficient frontier)
   - strands fanning out into categories
6. **Running total:** a sum that counts up as items land and down as they leave.
7. **Map with a route drawing and pins dropping.**
8. **3D flights:** point clouds, a camera flight over a card grid, or a device lid closing.
9. **One UI element through many states for a whole film.**
10. **Face-mesh scan, and a brush scribble that erases.**
11. **Headline handoff:** a centred typed headline moves to the top while the content of the beat rises in beneath it.

## Six films to look at first, by kind

| Film | Kind | Look | Energy | What to see |
|---|---|---|---|---|
| wozu-co | calm launch | Paper | calm | absorb and icon-to-window |
| bizibeast | feature tour | Colour field | confident | push-through into a tile, price sum |
| slvdev | brand ad | Colour field | confident | one noun per colour, recap wall |
| francoxavier33 | vertical app promo | Editorial | calm | typed serif headlines with highlighter |
| heyiammallik | portfolio reel | Night | hype then confident | one-word cuts, 3D drift, staircase wipe |
| marouanegazouzi | product-themed reel | Night / Blueprint | confident | distribution chart, flare to logo |

Ignore their on-screen technique labels.
