# Brief expansion: from one line to a director brief

How the engine turns a one-line request ("I need this kind of motion graphics") into a full director brief before any frame is made. Built from the ten study files in `study/` and the batch notes in `notes/`, which cover all 292 corpus records. Record ids are cited so each claim can be traced.

**What this rests on, and what it does not.** All ten study files and all ten notes were read. Effort and iteration counts come from `corpus.json`. No video was re-watched for this document; every timing number is taken from the study files, which measured 207 videos with `profile.py` and studied about 60 closely; the rest were judged from prompts and posters. Likes are a weak signal: most prompt-motion records have none recorded, the top kinetic-type reels were early posts of one shared prompt, and some liked records are tutorials or screen captures (revid:4, revid:202). Where a rule below is a judgement rather than a measurement, it says so. No creator's prompt is quoted; prompts are described in our own words.

## 1. The anatomy of a strong motion prompt

Ranked by how much each part changed the result in the corpus. The first three did most of the work; the last one did almost none.

1. **One subject the film proves, carried by one idea.** The largest single difference. The same stock showreel one-liner gave the top reel (pm:stephanlivera-df17a2, 17.1k likes) when the film found a thesis (easing, ending on a joke) and single-digit likes when it did not (pm:rendesr-86be44, pm:sudo-kiran-49176d). Of 16 films from that one-liner in kinetic-type-2, 11 open on a dot on black and 14 end on the model's name. A 106-character prompt naming one fact (pm:viktoroddy-98c1d8, 105 likes) beat a 14,877-character brief (pm:daniel-haida-8691d4, 10 likes). One subject plus one change ("assemble this logo, slowly") gave the most-liked shapes film (pm:tdinh-me-815acb, 319).
2. **Real material to work from.** A URL, repo, case study, design file, supplied drawings, music or real numbers. Every product-ui-4 film with real copy, prices or UI had a research instruction (pm:bizibeast-10f264, pm:wozu-co-242285, pm:heyiammallik-e72d17). All five product-ui-2 films above 100 likes show the real product. A case study gave pm:astrodevil-3f2054 a true number in every shot. Brand-name-only briefs make the model invent a theme with nothing about the product (pm:reflex-cloud-72ffe5, pm:maxalexweber-67688b).
3. **A length.** When a length was given, product-ui-4 films hit it within 0.1 s; without one they ran 23 to 76 s (median 33.5 s) and were the slowest films in the batch. Stated lengths were still overrun elsewhere (pm:pluginplay-3d4006 ran 26 s against 15 s), so the engine must enforce length itself.
4. **Named bans.** Naming the defaults to avoid removed them on screen: corner frames and corner text (pm:souravbhar871-61f424, fliki:29), a beige "artsy" look and eyebrow labels (pm:lexnlin-038035), glows, particle bursts, crossfades and bouncy easing (pm:twoclipping-5cba86, pm:twoclipping-6dd14e).
5. **Structure with a start and an end.** A start state and end state with the numbers that must show (pm:ror-fly-9950f1, reused almost unchanged by pm:sarut0bisasuke-cefa43); three named acts (pm:pluginplay-3d4006); a genre with a fixed ritual (pm:allforbigfire-86ff3c); a camera journey (pm:dale-vaz-cc612a); a timestamped beat list, followed closely (pm:brainextends-e19ac3). A beat list without a length runs long (pm:charlesmendez-73b6e4: 57 s, about 7 s a step).
6. **Tempo and sound as numbers.** A BPM, something on every beat, cuts on bar lines. The best reels cut on whole bars at 128 BPM (1.875 s a bar); pm:notdwd-7de38a's cuts landed within one frame of its frame table. Loudness targets and a sound plan appear only in the most engine-like brief (pm:ik-builds-b8bdcf).
7. **One look, named once.** A reference word or named style sets a whole grammar: "Apple-style" (pm:gautam-mer1-2ae354), "Anthropic-like" (pm:iammxfschr-d68f90), one print style versus one instrument style on the same script (pm:rneayan-474bcf, pm:rneayan-ea6129). A famous reference on its own copies the surface, not the movement (pm:davidshulmanfl-371638).
8. **Build and review rules.** Every frame a pure function of time, subframe motion blur, a beat map and four stills before the full render (pm:twoclipping-5cba86, pm:twoclipping-221cab, pm:ultimaxbt-2ddf1e). These prevent defects more than they add quality; the engine should hold them as defaults, not wait to be asked.
9. **Audience and placement.** Useful when they change a decision: a README hero (pm:hqmank-7c61f1), a course landing page (pm:theviableedge-9065be). An audience-size note changed nothing visible (pm:cansincengiz-me-cf68dd).
10. **Intensity words and quantity rules.** "Go all out", repeated "best of the best" (pm:sudo-kiran-6609ed), "juicier" (pm:ho-ba-f3f0e9) moved little. Quantity rules are obeyed literally but give no taste (pm:aichrislee-a6cb42: moving 99% of the time, still a stock look).

**What the weak prompts leave out:** a subject, real material, a length and an aspect. They put adjectives where those should be. No prompt in shapes-particles gives aspect, palette, beat list or timings.

## 2. Reading a short brief

**Step 1: pick the recipe (kind of film).** Route with the triggers and the routing rules in `recipes.json` (its `about` field: the longest matching phrase wins, then unordered word sets; stop words such as video, animation and reel never score alone; look words set the style, not the recipe; tie-breakers; and one fallback question when nothing matches). Then check against the material supplied. If two recipes fit, prefer the one the material can prove. `recipes.json` is the single source for triggers and defaults: the table below is generated from it, and if the two ever disagree, `recipes.json` wins.

| Request says (first triggers) | Recipe id | Defaults: length, aspect, energy, style, fps | Look at first |
|---|---|---|---|
| launch video, product launch, launch film | product-launch-film | 20 s, 16:9 or 1:1 or 9:16, confident, Paper, 60 fps | pm:twoclipping-221cab, revid:16, revid:19 |
| teaser, coming soon, sneak peek | product-teaser | 15 s, 16:9 or 1:1, calm, Glass, 60 fps | pm:notdwd-7de38a, pm:jake11moran-f60e35, pm:cansincengiz-me-cf68dd |
| product demo, feature demo, walkthrough video | feature-walkthrough | 30 s, 16:9, calm, Paper, 60 fps | pm:ajith-io-c52e09, pm:miskinho-443898, revid:57 |
| ui morph, morphing button, micro-interaction video | ui-morph-loop | 14 s, 1:1, confident, Paper, 60 fps | pm:twoclipping-5cba86, revid:58, revid:43 |
| developer tool video, cli demo video, api launch video | dev-tool-film | 20 s, 16:9, confident, Blueprint, 60 fps | pm:polydao-7a572b, pm:ho-ba-f3f0e9, revid:61 |
| pricing video, sale promo, black friday video | price-offer-film | 20 s, 16:9 or 9:16, confident, Colour field, 60 fps | pm:bizibeast-10f264, revid:47, pm:thayto-dev-44b911 |
| kinetic typography, kinetic type, animated text video | kinetic-type | 15 s, 16:9 or 1:1 or 9:16, hype, Colour field, 60 fps | pm:zheke-38deff, pm:souravbhar871-61f424, pm:stephanlivera-df17a2 |
| thought leadership video, make the case for, point of view video | argument-film | 30 s, 16:9, confident, Editorial, 30 fps | revid:6, revid:7, revid:21 |
| lyric video, music video, animated lyrics | lyric-video | 30 s, 16:9 or 9:16, confident, Editorial, 60 fps | revid:2, revid:25, pm:samaote-5e2fc2 |
| quote card, quote post, linkedin post animation | quote-card | 10 s, 1:1 or 4:5, calm, Editorial, 30 fps | none in the corpus |
| logo reveal, logo animation, logo sting | logo-reveal | 10 s, 16:9 or 1:1, calm, Night, 60 fps | pm:tdinh-me-815acb, pm:stephanlivera-df17a2, pm:robvjourney-ce3e1a |
| showreel, sizzle reel, motion design reel | motion-showreel | 15 s, 16:9, hype, Colour field, 60 fps | pm:stephanlivera-df17a2, revid:14, revid:22 |
| brand film, brand video, brand spot | brand-spot | 18 s, 16:9 or 9:16, confident, Colour field, 60 fps | pm:lexnlin-038035, pm:slvdev-64c45a, revid:28 |
| milestone announcement, we hit, anniversary video | occasion-post | 15 s, 1:1 or 9:16 or 16:9, confident, Night, 30 fps | pm:viktoroddy-98c1d8, revid:62, pm:gonzalomacagno-2de1a9 |
| testimonial video, customer story, case study video | customer-story | 25 s, 16:9 or 1:1 or 4:5, confident, Editorial, 30 fps | none in the corpus |
| lower third, lower thirds, title card | graphics-package | 5 s, 16:9 or 9:16, confident, Paper, 30 fps | none in the corpus |
| explain this concept, explainer video, educational animation | concept-explainer | 30 s, 16:9 or 9:16, confident, Paper, 30 fps | pm:himanshutwtxs-5f4b43, revid:59, pm:emollick-8661a8 |
| how it works, how does it work, under the hood | how-it-works | 30 s, 16:9 or 1:1, calm, Blueprint, 30 fps | pm:parkerrex-1a54fe, revid:55, pm:blueoctopusai-dd17bd |
| recipe video, how-to video, step by step guide | step-by-step | 30 s, 1:1 or 9:16, calm, Paper, 30 fps | pm:ror-fly-9950f1, pm:sarut0bisasuke-cefa43, pm:ajith-io-c52e09 |
| explainer video for our product, product explainer, saas explainer | product-explainer | 75 s, 16:9 or 9:16, confident, Paper, 30 fps | pm:alex-prompter-1ea044, revid:50, pm:amitsingha89-150378 |
| data story, stats video, by the numbers | stat-story | 30 s, 16:9 or 9:16, confident, Night, 60 fps | pm:nolkeeg-bf062e, pm:astrodevil-3f2054, pm:jesscaroline7-1ff7cb |
| history of, timeline video, evolution of | timeline-history | 45 s, 16:9, confident, Paper, 30 fps | revid:2, pm:pluginplay-3d4006, pm:loicrambo-ad6830 |
| map animation, animated map, our offices worldwide | map-journey | 20 s, 16:9 or 1:1, calm, Paper, 30 fps | none in the corpus |
| satisfying video, oddly satisfying, physics simulation video | physics-loop | 30 s, 9:16 or 1:1, confident, Night, 60 fps | pm:kantamk-61f410, pm:kamstudiolabs-447565, pm:3xtihor-0f6911 |
| abstract animation, geometric animation, bauhaus style animation | shape-sequence | 25 s, 16:9 or 1:1, calm, Editorial, 60 fps | pm:hbcoop-de365c, revid:14, pm:pankajkumar-dev-0bee87 |
| music visualiser, audio reactive video, visualizer for my track | beat-visualiser | 30 s, 1:1 or 9:16 or 16:9, hype, Night, 60 fps | revid:10, pm:monokern-ade5b6, pm:rames-jusso-589f80 |
| animated short, short story animation, cartoon video | illustrated-short | 45 s, 16:9 or 9:16, calm, Paper, 30 fps | revid:9, pm:anilraok-eff262, pm:kamstudiolabs-0b0824 |
| ambient loop, background video loop, calm looping scene | ambient-scene-loop | 30 s, 16:9 or 9:16, calm, Paper, 30 fps | pm:itsolelehmann-e47532, pm:x4b47x-9cc84f, pm:demitiyageekzen-7770ad |
| instagram ad, tiktok ad, facebook ad | social-hook-ad | 15 s, 9:16 or 1:1 or 4:5, hype, Colour field, 30 fps | pm:lexnlin-038035, revid:18, revid:17 |
| edit my talking head, add captions to my video, podcast clip edit | talking-head-edit | 30 s, 9:16, confident, Editorial, 30 fps | pm:sab8a-364a5a, revid:38, revid:45 |
| weekly recap, news round-up, top 5 video | news-recap | 45 s, 9:16 or 16:9, confident, Editorial, 30 fps | pm:gigabit-million-16b3a0, pm:slvdev-64c45a, revid:62 |
| portfolio video, personal intro video, about me video | portfolio-reel | 25 s, 16:9 or 9:16, confident, Night, 60 fps | pm:heyiammallik-e72d17, pm:kikelopezdesign-7cc9e8, pm:blushpetal795-0c85c2 |

Defaults come from each recipe's `defaults` in `recipes.json`, set from the measured best films in each group where there were any; they are judgements, not rules the corpus states. Four recipes (quote-card, customer-story, graphics-package, map-journey) have no corpus reference and rest on the craft guides alone. The full trigger lists are in `recipes.json`.

**Step 2: infer what was not said.**
- **The message.** Find the one fact, flow or promise the film proves. Read it from the supplied material (site headline, changelog, case study). If there is no material and no message, this is the one thing worth asking (section 3).
- **The carrying idea.** Choose one object or device that runs through every scene and ends inside the final frame: the product's own element (the notch in pm:jake11moran-f60e35, the square in revid:31), a running total (pm:bizibeast-10f264, $196 down to $15), a square that becomes the full stop (revid:22 and pm:hbcoop-de365c carry a dot this way; the house style uses a square), a slogan split across the film (revid:21).
- **Energy.** Audience and product beat tone words. A parenting app asked for hype and came out calm, which was the better call (pm:francoxavier33-d2dfd2). "Slick", "premium" and "Apple-like" mean confident, centred, one accent. "Punchy", "launch day" and "drop" mean hype. This word map is the shared energy rule in `recipes.json` (`about`, ENERGY), and every starter prompt carries calm, confident and hype pacing, so the energy chosen here changes the film.
- **Sound.** If music is not supplied, plan cleared or generated music at 120 to 128 BPM and cut on its bars. At least 16 studied files have no audio track; treat silence as a defect unless asked for.

**Step 3: defaults for anything unsaid.**
- Length from the recipe, enforced to within 0.1 s. The best motion pieces in the corpus run 15 to 30 s.
- Aspect, size and fps from the recipe's defaults (60 fps unless the recipe says 30), at 1920x1080, 1080x1920, 1080x1080 or 1080x1350. 9:16 when Reels, TikTok or Shorts is named; 1:1 or 4:5 for a LinkedIn, Instagram or Facebook feed; 1:1 for loops. A second aspect is recomposed, not cropped; expect to be asked (pm:palashbagchi11-0a4b6b).
- Hook: something moving by 0.5 s, a readable line by 1.0 s, the problem or product by 2.0 to 2.5 s.
- Pace: a new picture every 1.5 to 2.5 s in a 15 s film, about 3.3 s per scene in a 40 s tour. Still time under 10% (hype, confident) or 13 to 15% (calm). Typical motion in profile.py units: hype 4.4 to 6.5, confident 1.2 to 1.7, calm 0.5 to 0.9.
- Type: headlines about 6% of frame height or larger (revid:16 measured about 6%); product words at least 4% and other text at least 2.6% (`08-directors-checks.md`); nothing that cannot be read on a phone. One type pairing. Three to five flat colours plus one accent.
- End: 1.0 to 1.75 s of hold on the client's mark, closing the carrying idea. Never the model's name.
- Copy: real facts only. No invented figures.

## 3. The few questions worth asking

Ask nothing when the request names a subject and points at real material (a URL, repo, deck or numbers) and the recipe is clear. Make the choices, show them in the brief, and let approval do the asking. The strong prompts in the corpus work the same way: they list the inputs they need with a default for each (pm:twoclipping-5cba86, pm:notdwd-7de38a, pm:rossaxbt-3085b7), and one packaged skill interviews the user before building (pm:anthonyriera-9b1b2a).

Otherwise ask at most three, in this order, and only the ones that would change the film:
1. **What should the viewer believe or do at the end?** Asked when there is no material to read it from. Without it the film becomes a feature list (pm:visheshbaghell-3aba37, pm:ratheejaisal-1f4538).
2. **What is the source of truth?** The site, repo, numbers or assets. Always asked for a data story, because seven corpus films dropped in made-up metrics (kinetic-type-2 failure modes) and the engine must not.
3. **Where will it be seen?** Asked only when it changes aspect or length (feed, website hero, keynote, README).

Never ask about energy, style, palette, transitions or music tempo. Choose them, state them in the brief and accept edits. Never ask for another company's assets or a commercial song; offer cleared alternatives instead.

## 4. The director brief template

The engine fills this, shows it, and waits for approval before building. Every field says whether it was given, read from material, or assumed.

```
DIRECTOR BRIEF: {working title}                               status: draft for approval
Kind            {recipe}. Why: {one line tying the request to the recipe}
Audience        {who watches, where, on what screen}
Message         {the one sentence the viewer should leave with}
Carrying idea   {the one object or device that runs through every scene and how it ends}
Source material {URL / repo / numbers / assets used; what each one supplies}
Length          {n} s, enforced to ±0.1 s      Aspect {16:9 | 9:16 | 1:1 | 4:5}, {size}, {fps}
Energy          {calm | confident | hype}: target still time {x}%, typical motion {range}
Design style    {Paper | Night | Glass | Colour field | Editorial | Blueprint}; palette {colours + one accent}
Structure       0.0–{t1} s  hook: {what moves by 0.5 s, what reads by 1.0 s}
                {t1}–{t2} s {beat}: {what is shown, what number or claim lands}
                ...         (one line per beat; beats sized to the bar grid)
                {tn}–{end}  close: {how the carrying idea resolves}, hold {1.0–1.75} s
Motion language {easing family, settle times, what causes each change (cursor, camera, the object)}
Transitions     {named joins with durations, e.g. push-through 0.4 s, container morph 0.3 s}
Type            {pairing, headline size as % of frame height, how words enter}
Sound           {cleared track or generated, BPM, cut grid, effects plan, -14 LUFS / -2 dBTP}
Quality bar     {references to match by id}; checks: length, fps, size, still time, first readable
                frame, end hold, nothing clipped by the frame edge, counters land on true values
Never           {recipe never-list + client bans}
Assumptions     {every default the engine chose that the person did not state}
Open question   {none | the one question that blocks the build}
```

Global never-list, to merge into every brief: corner timecode, frame counters and technique labels on screen; the model's name or a "made in code" sign-off; invented metrics or fake "+%" charts; the stock showreel kit (dot opener on black, voxel field, particle sphere, Bauhaus tiles, wordmark with a coloured full stop); purple neon, glass cubes, laser grids and lavender orbs; confetti, sunbursts and particle bursts on the logo; fades through black that leave empty frames; whole-app screenshots too small to read; the same layout for every feature at an even rhythm; cuts exactly every 1.0 s; strobing tunnels and spirals; headlines clipped by the frame edge; counters shown mid-count on a held frame; another company's brand or assets; commercial songs, lyrics or characters without clearance. Also check `knowledge/craft/13-design-styles.md`, which bans dots, coding-style typefaces, mesh blobs and glitch in the house styles.

## 5. Worked examples

**"A slick launch video for our SaaS."** Kind: product-launch-film (no feature named, so not a demo). Material: read the site for the headline promise, the real UI and one number. Audience: buyers on X and LinkedIn. Message: the site's own promise in one line. Carrying idea: the product's main object (a card, a message, a document) gathered into the app and changed by it, as in pm:wozu-co-242285. 20 s, 16:9 plus a 9:16 recomposition, confident (still time under 10%), Paper with one accent; Glass only if the brand already uses it (pm:notdwd-7de38a). Structure: 0–1.0 s headline readable; 1.0–2.5 s the problem as real objects; 2.5–4 s they are absorbed into the app icon (0.15 s) and the icon becomes the window; 4–15 s four proofs of about 2.75 s, each a headline then the real UI doing it within a second, cursor-driven (revid:16); 15–18.5 s one number lands; 18.5–20 s mark, hold 1.5 s. Motion: ease-out with a soft settle, entrances that start fast and settle long. Transitions: absorb into icon 0.15 s, push-through into a tile 0.4 s, colour flood of about 0.3 s grown past the far corner (pm:twoclipping-221cab). Type: one sans, headlines about 8% of frame height. Sound: cleared track near 120 BPM, one soft effect per UI event. Never: purple SaaS glass, logo wall and stat row ending, text cards on black between shots (revid:64). Optimise: the product visibly doing the work within 2.5 s.

**"Kinetic type reel for our podcast."** Kind: kinetic-type, using its voice branch if an episode clip is supplied. One question to ask unless an episode is linked: which episode or line carries it? Audience: listeners scrolling a feed. Message: the show's promise, or one line from the episode. Carrying idea: a fixed stem phrase with a new word, treatment and colour field on every beat (pm:zheke-38deff), or each line acting out its verb (pm:souravbhar871-61f424). 15 s, 9:16, hype, Colour field with four colours. Structure: 0–0.5 s the first word full-bleed, no lead-in; 0.5–5.6 s two-beat shots (0.93 s at 128 BPM); 5.6–11.3 s one-beat shots (0.47 s); 11.3–12.7 s burst at half beats (0.233 s); 12.7–13.5 s optional recap flash of earlier words (3–7 frames each); 13.5–15 s show name and where to listen, hold 1.5 s. Type: one heavy condensed sans with an italic serif second voice. Sound: if a clip is supplied, words land on the spoken syllables; otherwise cleared music at 128 BPM. Never: corner chrome, a slow open on black, palette changes with no system. Optimise: every cut on the grid and every word readable at half a beat.

**"Explain how our API works."** Kind: how-it-works (explain verbs beat the product type, so not dev-tool-film). Material: the API docs; one real request and response; a real rate, limit or timing if published. Audience: developers evaluating the API. Message: what goes in, what happens, what comes back. Carrying idea: one request travelling the whole pipeline, every panel driven by one clock so numbers stay true (pm:parkerrex-1a54fe), with a step tracker that persists and ticks (pm:ror-fly-9950f1). 30 s (or the length asked for), 16:9, calm (still time 13–15%, none at the end), Blueprint. Structure: 0–2 s the result shown first (the answer before the explanation, pm:blueoctopusai-dd17bd); 2–8 s the request is written; 8–22 s three stations of 4 to 5 s each, the request travelling as a real request, a short title per station; 22–27 s the response lands with its real timing; 27–30 s product name and docs URL, hold 1.5 s. Motion: linear or stepped where the system is mechanical, ease-out for labels. Transitions: camera pushes along the path, no cuts. Type: titles large; code only as the real snippet, sized to read, set within the house style rules. Sound: a quiet bed, one tick per stage. Never: a 6.5 s dead hold (parkerrex), paragraphs of small body copy, glowing node networks. Optimise: a developer could repeat the flow after one viewing.

**"Show our growth numbers."** Kind: stat-story. Ask for the figures, dates and source, and do not build until they are supplied. Audience: customers, investors or staff (assume customers). Message: the one milestone that matters most. Carrying idea: one repeated layout, a large true number counting up beside a small graphic that draws at the same time (pm:astrodevil-3f2054), ending on the milestone as the climax (pm:viktoroddy-98c1d8). 30 s (the recipe default), 16:9, confident, Night. Structure: 0–2 s the first number already moving; 2–24.5 s four findings of about 5.6 s each, each landing on its true value, the last one the milestone count-up over about 3.5 s with ghosted leading zeros and a line drawn in step; 24.5–27.5 s a turn to the viewer; 27.5–30 s source line and mark, hold 1.5 s. Transitions: the landed number or graphic becomes the next shot's field. Type: tabular numerals for counts, the unit always on screen. Never: fabricated charts, confetti, a count caught at 0+ on any held frame, a 27% still slide-deck feel (pm:palashbagchi11-0a4b6b). Optimise: every figure true, readable and tied to something moving.

**"A logo sting."** Kind: logo-reveal. Material: the vector logo and brand colours; ask nothing else. Audience: whoever sees the start or end of the brand's videos. Message: the mark itself. Carrying idea: the mark built from its own geometry, as facets (pm:tdinh-me-815acb), the brand's unit shape (revid:31) or tiles (pm:amol909s-27533e). 10 s default, 16:9 plus 1:1, calm, Night in the brand's own colours. Structure: 0–1.5 s the first piece already moving by 0.5 s, posing the question; 1.5–5 s the build, speeding up towards the end; 5–6 s the resolve, a 0.1 s bloom while the mark gains its container over 0.35 s, so the mark is complete by 60% of the length; 6–8 s the mark slides aside in 0.15 s and the wordmark types in at about 8 characters a second, tagline after; 8–10 s hold about 2 s. A slower build of up to 20 s only if asked; tdinh-me took 12 s and held 3.5 s. Sound: one rising tone into one hit on the lock. Never: sunburst, confetti, stamp or script type (pm:deebeeeff-50fcd0), particle bursts or lens flares on the mark. Optimise: the last frame is clean and true to the brand guide.

**"A 15 s showreel of what we can do."** Kind: motion-showreel for the person's studio or company, not for the model. One question to ask: which four to six pieces of work, or which site to read? Audience: prospective clients. Message: the one thing the studio wants to be hired for. Carrying idea: a thesis the whole reel demonstrates (timing with one object in revid:14, easing ending on a joke in pm:stephanlivera-df17a2, one point gaining dimensions in pm:hbcoop-de365c, drawn there as a dot where we would use a square), using real work (pm:heyiammallik-e72d17, pm:jacksonfall-54b2ac). 15 s, 16:9, hype, Colour field, four flat colours. Structure, following the top reel's measured shape: 0–0.5 s movement; by 1.0 s the studio mark; 2.0 s a full-frame statement; 2–5.6 s one continuous first act; 5.6–11.25 s acts of 1.9–3.75 s on 128 BPM bar lines, each a real project; 11.25–12.65 s a burst of words at half beats; 12.65–15 s lockup held with something still moving. Transitions: a full stop that grows into the next field (about 0.1 s), an iris from a point, a scale-through into a grid (0.65 s). Never: the stock kit, technique names or scene numbers on screen, the model's name. Optimise: a viewer can say what the studio does after one viewing.

## 6. Effort and iteration

- **Recorded settings are sparse.** Of 292 records, 36 state an effort (Max 22, High 7, Medium 7, none lower) and 84 state iterations (80 one-shot, 4 "a few rounds"). Conclusions here are drawn from small numbers.
- **Effort does not rescue a weak brief.** Max-effort records run from 17.1k likes (pm:stephanlivera-df17a2) to 2 to 6 likes (pm:levabashidze-2d713a, pm:reflex-cloud-72ffe5, pm:web3wesley-7bb108). High effort still gave a generic tunnel (pm:m1n9-k7-ff9ab9) and a stock purple SaaS film (pm:kmasiff-cc72cb). Medium gave a stock celebration card (pm:deebeeeff-50fcd0) and a reel calmer than asked (pm:tolgayhickiran-e90799).
- **Effort pays when the model must invent structure.** With an open brief, Max produced a seven-chapter film with real product logic (pm:polydao-7a572b) and the strongest craft in its batch (pm:hbcoop-de365c). The engine should spend its highest effort on writing the brief and beat map, where the structure is decided.
- **Posted one-shots are a selection.** Identical prompts gave very different films (pm:ajith-io-c52e09 at 640 likes against pm:itisrazak-3ad902 at 148; 16 identical showreel briefs of widely varying quality). Treat any corpus one-shot as the best of several unseen runs, not as proof that one pass is enough.
- **Rounds help only with a check.** The richest data film came from Max plus a few rounds (pm:jesscaroline7-1ff7cb). Another film iterated a few rounds and was still 68% still (pm:iammxfschr-d68f90). The best-liked film in the corpus is described as one prompt and twelve hours of work (revid:2).
- **Spec drift is common without a check.** 30 fps delivered against 60 asked (pm:ultimaxbt-2ddf1e, pm:brainextends-e19ac3), 1080 against 1440 (pm:rossaxbt-3085b7), a camera zoom not done (pm:demonugc-4c5753), camera moves not delivered (pm:aichrislee-a6cb42), length overrun (pm:pluginplay-3d4006). Some of the frame-rate and size drift may be the gallery's re-encode; the studies could not tell.
- **Engine policy (recommendation).** Round 0: brief approved. Round 1: beat map plus four stills at named times, the gate the strongest prompts use. Round 2: full render, then automatic checks on length, fps, size, still time, first readable frame, end hold, clipping and counter end values. Round 3: polish only what the checks or the person flag. Expect a follow-up for a second aspect and for sound (pm:palashbagchi11-0a4b6b, pm:tak3sh8-be5012); plan for both from the start.
