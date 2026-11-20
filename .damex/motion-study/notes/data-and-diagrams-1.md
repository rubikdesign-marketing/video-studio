# Data and diagrams, batch 1: study notes

34 records read. 6 videos watched and measured. Full data is in `study/data-and-diagrams-1.json`.

## What was and was not checked

- Watched: revid:2, revid:4, pm:himanshutwtxs-5f4b43, pm:ror-fly-9950f1, revid:50 and revid:55. For each one we ran the motion profile, made a contact sheet and looked at it. We also made frame-by-frame sheets of three transitions.
- revid:41 was picked for watching, but its host refused the download (HTTP 403), so revid:55 took its place.
- revid:2 runs for 142 s, so its contact sheet is at 1 fps instead of 2.
- The other 27 records were classified from their prompt, title and tags only. Their output was not seen.
- Many prompt-motion records have no likes recorded. That means the count is missing, not that it is zero.

## What this batch is

Despite the group name, only a few of these are charts films. There are 8 showreels (most from one shared template) and 7 concept explainers. There are 5 process explainers: two cocktail recipes, two data-centre tours and one roof-inspection service film. There are also 3 history timelines and 1 music video, which is the best-liked piece in the whole corpus. We added one new category, "news recap / listicle", for pm:gigabit-million-16b3a0. It is a dated round-up of several items, which none of the starting categories fits.

## What separates the best from the rest

- **Tell a story; don't just present.** revid:2 (9,900 likes) puts AI history inside a pop song about a drawn character. The loss curve, the time-horizon chart and the compute counters are plot points. The topic-only version of the same subject (pm:kloss-xyz-fe0c31) is a list of key moments.
- **Use one idea that carries the film.** pm:himanshutwtxs-5f4b43 shows each animation principle while naming it. In pm:ror-fly-9950f1 a glass fills in real 1:1:1 ratios.
- **Keep devices running across cuts.** revid:2 keeps a date stamp, a climbing percentage and a lyric card on screen through every cut. revid:55 keeps a tray of collected photos, and pm:ror-fly-9950f1 a six-step tracker. These let many shots read as one film.
- **Tie every number to an action you can see.** The ounce counter fills with the pour, and the FLOP odometer advances with the story.
- **Keep the pace up.** The strong pieces change the picture every 0.45 to 2 s. The weakest one we watched (revid:50) is still for 17% of its 69 s.

## Measured timings

| Film | Length | Hard cuts | Median shot | Still | Notes |
|---|---|---|---|---|---|
| revid:2 music video | 141.6 s | 73 | 1.67 s | 0% | 8 cuts in 2.4 s before the finale |
| pm:himanshutwtxs-5f4b43 reel | 15.1 s | 3 (plus 2 light/dark switches the profiler did not flag) | 2.53 s | 2% | kinetic words about 0.45 s each, 1-frame red flash |
| pm:ror-fly-9950f1 recipe | 30.0 s, 1:1 | 0 | one shot | 3% | steps take 3 to 5.5 s, title 3 s, end hold 3 s |
| revid:55 roof explainer | 28.7 s | 6 | 3.3 s | 2% | first cut at 2.75 s, headline lines fade up over about 0.3 s |
| revid:50 AI agent film | 68.8 s | 4 | 3.6 s | 17% | slow, small type at 720p |
| revid:4 site capture | 11.0 s | 2 | 3.0 s | 0% | screen recording; not a craft reference |

## Prompt patterns

- **Works:** give the story a start state and an end state, and say which numbers must show while it changes. pm:sarut0bisasuke-cefa43 reused the recipe brief with only the drink changed.
- **Works:** one structural rule where the form mirrors the content (pm:emollick-8661a8).
- **Works:** name the look and a persona (pm:nikolajankovic-ce4ff4), name the right tool for the subject (Manim for calculus), and do design and narration in separate passes (pm:tak3sh8-be5012).
- **Most engine-like:** pm:ik-builds-b8bdcf. It sets the tempo in seconds and bans invented figures, editor chrome and jargon. It asks for one main move per transition and start states that are safe to seek to. It also sets a loudness target.
- **Mixed:** the 15-second showreel template appears in nine records. It works when the subject is the model itself. With a brand swapped in, there is no message.
- **Weak:** one-line topic prompts, and loose style words such as "bold text, smooth transitions".

## Things that look cheap

- Fake editor chrome (scrubber, timecode) and animator jargon on screen.
- The lavender glass-orb "AI startup" look.
- Long soft holds with small type.
- Openings with nothing to read in the first 2 s.
- A brand dropped into a template with no story.

## Gaps in the engine's moves

None of the 246 moves covers these:

- liquid pour with a rising fill level
- a step tracker outside screen-capture films
- an exploded view with leader-line labels
- photos pinned to a 3D model while the camera orbits
- an illustration dissolving into particles
- running overlays that persist across cuts (date clock, story percentage, lyric card)
- a character riding a line chart
- onion-skin trails and squash-and-stretch on a bounce
- handwritten notes with arrows
- a dot grid that reacts to a moving object
- a paper-to-charcoal theme switch as a named transition
- icons orbiting a logo
- a stop-motion boil and pencil-drawing look
- a sentence split across a cut onto a colour card
