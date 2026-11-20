# Batch kinetic-type-2: study notes

27 records, group kinetic-type. The full data is in `study/kinetic-type-2.json`.

## What was and was not checked

- All 27 records were read. Every one has a prompt; none is a Skill record.
- Likes and views are empty for every record, and none of them appears in the revid ranking, so nothing could be ranked by popularity. Three are featured on the fliki page (nolkeeg, samaote, amitsingha89), which is the only outside signal.
- All 27 videos were downloaded and measured with profile.py, so the cut, shot and stillness numbers cover the whole batch. I also looked at a 10-frame strip of every video.
- Six videos were studied at 2 fps contact sheets: zheke and fionntobin (best craft judged from the strips), nolkeeg and samaote (featured on fliki), souravbhar871 (the only prompt that bans an AI tell) and aichrislee (the most detailed prompt). I made three transition window sheets: the zheke recap burst, the fionntobin grid-to-type change and the nolkeeg title-to-warp change.
- The other 21 records were judged from their strip, their measurements and their prompt only. Their look and technique notes may miss things.
- I did not listen to any audio beyond the loudness curve. Stacks are guessed unless the prompt names one. Fonts are described, not identified.

## Mix of categories

- Showreel / capability reel: 17
- Ad / social promo cut: 3
- Kinetic typography reel: 2
- One each: illustrated or character story, concept explainer, data story, product launch film, lyric video

Sixteen of the 27 prompts are the same one-line showreel brief, or a translation of it. Energy: 20 hype, 5 confident, 2 calm. Nineteen are 15 s long.

## The six watched films

| Record | Length and shape | Cuts | Average shot | Still | Notes |
|---|---|---|---|---|---|
| zheke (kinetic type showreel) | 15.1 s, square | 20 | 0.72 s | 0% | A fixed "I can" stem with a new verb on every beat, and each verb is acted out by the type. Four colours. Cuts land on a 128 BPM grid. Before the end card, a 0.6 s recap replays nine earlier words. |
| fionntobin (blue editorial showreel) | 15.1 s, 16:9 | 8 | 1.67 s | 8% | Cobalt on cream only, with eight numbered chapters on design basics. A grid fills while a number counts the filled cells. Cuts at the end come every half beat (0.233 s). |
| nolkeeg (one second) | 45.1 s, 16:9 | 7 | 5.6 s | 12% | The model chose its own concept. Five counters climb to true figures over a globe and the sun, and a 32 s stretch has no cut. The first 3 s are nearly empty. |
| samaote (lyric video) | 29.7 s, 16:9 | 2 | 9.9 s | 0% | Each line of lyric gets its own layout, and the pictures run from sunset to sun to eclipse. A bar counter and a countdown in the frame follow the song. The song is commercial. |
| souravbhar871 (type self-portrait) | 10.0 s, 16:9 | 0 | one shot | 0% | Five first-person lines, each set in a type treatment that does what the verb says. Three colours. No corner chrome, as its prompt asked. |
| aichrislee (rule-heavy prompt) | 18.6 s, 16:9 | 1 | 9.3 s | 0% | Loud pop colour with a spinning word cube and a fake metrics dashboard. It moves the whole time, as the prompt asked, but the result looks generic. The prompt also asked for camera moves, and there are none. |

## What separates strong from weak

- **A spine.** The best films carry one idea from start to finish: a list of things "I can" do, one second measured five ways, a set of fundamentals, a self-portrait in verbs. The template reels are lists of effects.
- **Motion that means something.** A word squashes when it says squash. Letters snap onto a straight line for "straight". A counter stops on a true number. A runner jumps on the beat.
- **Few colours.** One ink (fionntobin), three colours (souravbhar871) or four (zheke). The weaker reels change palette with every scene.
- **No dead air.** The weakest films are 69% still (amitsingha89, 54 s) or have a typical motion of about 1 (sudiyasa, gonzalomacagno).

## The template to avoid

The one-line showreel brief nearly always produces the same film. Of the 16, 11 open on a dot, line or circle on black (13 across the whole batch), and 14 end on the model's name in a wordmark with an accent full stop. In between come the same pieces: a big MOTION word on orange, Bauhaus tiles, a particle sphere, an op-art spiral, and in 7 films a made-up "+%" bar chart. Corner timecodes and frame labels appear in almost every one, and one creator banned them by name as a sign of AI-made work. Only use corner text that means something, like samaote's bar count or fionntobin's chapter names.

## What worked in prompts

- Let the model pick a concept, or give it one, and name the failure you want to avoid. Nolkeeg asked it not to make a glorified slide deck.
- Name one AI tell to leave out. Souravbhar871 banned corner frames and corner text.
- Supply what the film is about: the music, the image, the event details or the brand's own tool.
- Rules about how much should move (move every second, no slow fades) are followed exactly, but they do not give the film taste.

## Timing numbers worth keeping

- Beat-locked cutting at 128 BPM. Shots of 0.93 s (two beats), then 0.47 s (one beat), then 0.233 s (half a beat) for the last burst.
- Recap burst: 3 to 7 frames per earlier shot at 60 fps, about 0.6 s in all, then black, then the logo dot grows over about 4 frames.
- Title to particles to warp to subject in 1.3 s.
- A 5-letter word rises from its mask letter by letter in about 0.12 s.
- End cards hold for 1 to 1.5 s.
- A data-story chapter runs 5 to 6 s, with its counter ending on a true figure.

## Gaps in the engine's moves

The engine's 246 moves have nothing for these:
- particle text that forms and dissolves
- a warp-speed starfield fly-through
- a flash recap built from the film's own shots
- type that deforms to act out a word
- a fixed stem phrase with a new payload and colour on every beat
- text on a rotating 3D ring
- a glass lens over type
- glossy metaballs
- an isometric block field with a wave running through it
- a halftone moiré
- a grid that fills while a number counts the cells
- lyric lines that each get their own layout
- an eclipse-style disc that slides over another
- a simple figure moving on the beat
- a split screen whose divide moves

## Rights

- Prompts are summarised in my own words and never copied.
- The lyrics in samaote are not reproduced here.
- samaote uses a commercial song, and micheleharmonic uses a named anime character. The engine should only make films like these with cleared music, words and characters.
