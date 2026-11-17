# Structure and retention: beats, timing, and what the graph says

How a film is laid out in time: which beats it has, how long each takes, how long a shot and a line of text can last, and, after it is published, where viewers left. The studio's playbooks set each film type's shape; this guide adds borrowed frameworks, timing rules and how to read a retention graph. Credits: `library/structure/CREDITS.md`. The brand's rules and `00-principles.md` win where they differ.

Where it is used: the script stage gives every line its beat and energy and runs the beat sheet (`node tools/plan/beats.mjs jobs/<job>`) before the script approval; the storyboard stage runs it again on the shot list; the learn stage reads the retention export (`node tools/plan/retention.mjs <export.csv> --job jobs/<job>`).

A warning, as in `15-hooks.md`: the sources give timings as their authors' rules of thumb, not measurements. This guide keeps the timings as starting points and leaves out every claim about results.

## 1. The shape is the playbook's

Each film type starts from its playbook's shape, and `beats.mjs` uses it unless told otherwise:

| Type | Framework | Beats |
|---|---|---|
| Promo, ad | `studio-promo` | Hook 3 to 5 s, turn 5 to 10%, proof 50 to 60%, peak 5 to 8%, offer 10 to 15%, close 4 to 6 s |
| Demo | `studio-demo` | Result first 3 to 5 s, the job 5 to 10%, three steps 60 to 70%, payoff 8 to 10%, close 4 to 6 s |
| Tutorial | `studio-tutorial` | Promise 5 to 8 s, what you need 3 to 5 s, chapters, recap 5 to 8 s, next 3 to 5 s |
| Edit | `studio-edit` | Hook 3 to 5 s, the story, close 3 to 6 s (the edit playbook sets no shape; the paper edit decides the story) |

The promo shape needs room: under about 25 s the hook and close take most of the film. A 15 s cut uses a short-form framework below.

## 2. Borrowed frameworks

`node tools/plan/beats.mjs frameworks` lists them; `--framework <id>` uses one. Their timings are the source's, allowed 25% either way.

| Framework | Beats | For | Source |
|---|---|---|---|
| `energy-curve` | Hook (2 s at most), build, apex, release, call to action | Promos and ads of 15 to 30 s | shotkit |
| `pain-reframe-promise` | Pain, reframe, promise | Ads, 15 to 60 s | shotkit |
| `hero-trilogy` | The world, the hero, the transformation | Brand promos and demos | shotkit |
| `founder-explainer` | Hook, stakes, insight, proof, call to action | A founder talking to camera | shotkit |
| `content-spiral` | A wide claim, then two zooms each faster than the last, then a snap back | 15 s edits and promos | shotkit |
| `educational-demo` | Problem, reveal, walk-through, result | 15 s tutorials, one technique | shotkit |
| `short-form-retention-arc` | Hook (1 s), setup, body, payoff that loops to the start | Short-form, about 20 s | iart-ai/tiktok-video-skills |
| `reel-shape` | Hook (0 to 2 s), the stake (by about 7 s), body, payoff in the last 3 s | Reels, 15 to 45 s | Jakeschincariol/instagram-agent-skill |
| `long-form-skeleton` | Hook (30 s at most), setup, first body, a re-hook at 40 to 60%, second body, payoff, outro (15 s at most) | YouTube films of 10 to 12 minutes | yaxeen/storytelling-skills |

## 3. What the beat sheet checks

`beats.mjs` lays the script against the framework, from the voice's own timings when the voice has been made (estimated at 2.5 words a second before), and names:

- **Hook late:** the hook's first line is still being said after the framework's limit, or after about 3 s on Reels, TikTok and Shorts.
- **Beat long or short:** outside what the framework gives it, by more than a tenth of its longest allowed length (and at least half a second).
- **Beat missing, out of order, split or unknown:** a required beat with no line; beats in the wrong order; one beat in two places; a line marked with a beat the framework does not have.
- **Line long:** a line over 6 s to say. One thought a line.
- **Over the cap:** longer than `length_cap_seconds`.
- **The energy map** (`01-direction.md`): never open at 3; never the same number more than three beats running; a 1 or 2 directly before the peak; the peak once; end one step below it.
- **With a shot list:** a scene marked with a beat its lines are not in; a scene that holds lines from two given beats; on-screen text up too briefly to read (below).

Each line in `audio/script.json` may say its `"beat"` and `"energy"`. A line without a beat is placed by time, and the sheet says the beats were guessed: say them, so the check is about the film and not the guess.

## 4. Shot lengths

Starting points by kind of shot (after shotkit; its authors' defaults, not measurements):

| Kind | Usual | Range |
|---|---|---|
| Kinetic type or an opinion | 1 to 1.5 s | 0.5 to 2 s |
| Someone talking to camera | 2.5 to 4 s | 2 to 6 s |
| Product or lifestyle footage | 1.5 to 2.5 s | 1 to 3.5 s |
| A demo or how-to step | 3 to 5 s | 2 to 7 s |
| A cinematic brand film | 3.5 to 6 s | 2 to 10 s |

- A shot over 5 s in a 15 s film, or over 7 s in a 30 s film, needs a reason in the shot list.
- Short-form: the picture changes every 2 to 4 s, at uneven intervals; an even beat reads as a metronome (after iart-ai/tiktok-video-skills).
- Long films: something changes every 20 to 40 s (a new angle, footage, text, a change of tone), and a planned re-hook comes at 40 to 60% of the film (after yaxeen/storytelling-skills).
- The call to action takes the last 3 to 4 s of a 15 s film, 4 to 6 s of 30 s, 6 to 10 s of 60 s; no movement on it; the logo only in its final 2 s (after shotkit).

## 5. On-screen text needs time

- The studio's rule (`04-type-and-captions.md`): a line is read at about three words a second and stays up for its word count ÷ 3, plus 0.4 s. `beats.mjs` checks every shot's text against it, counting the same text over shots in a row as one hold.
- Text the voice says at the same time is read along with the voice, and is not held to the rule.
- shotkit asks for more: long enough to be read twice. Use that for text that carries the offer, a price, a date or a number the viewer must remember.
- When text has too little time: cut words, carry the same text over the next shot, or lengthen the shot. Too-short text is the most common storyboard fault (shotkit).

## 6. The retention arc

The parts every source shares, in the studio's words:

- **Hook:** the first frame and the first line, about one idea (`15-hooks.md`).
- **The stake:** within the first few seconds of a short film, or the first 15 to 30 s of a long one, why it matters to the viewer and what they will have by the end. A film that confirms what its title or thumbnail promised keeps the viewer who clicked.
- **Body:** one idea a beat; something changes on screen often; open a question before closing the last one, and never answer the hook's question early.
- **Payoff:** deliver what the hook promised, and say so. A long film echoes a word, number or picture from its hook.
- **One ask** at the end. Never ask for a follow or subscribe in the first 30 s.
- **Loop** (short-form, optional): the last frame matches the first, or the last line leads back into the first.

The first 30 s of a long film (after sergebulaev/youtube-skills): a cold line or clip by 3 s; the title's promise restated by 10 s; the stake raised and a question opened by 18 s; what the film will do by 28 s; into the body by 30 s.

## 7. Reading a retention graph

YouTube Studio's audience-retention export is read with `retention.mjs`, against the film's beats and lines. It names:

| It finds | What it usually means | What to try |
|---|---|---|
| **Early drop** (the first 3 s of a short film, the first 30 s of one over a minute) | The opening did not hold: a slow first frame, a hook that did not land, or a film that is not what the title promised | A new hook from another family (`15-hooks.md`); the best frame first |
| **Cliff** (a sharp loss in a short stretch) | Something at that moment sent people away: a change of subject without a signpost, a long set-up, an ask | Read the line playing then; cut or move it |
| **Dip** (losing viewers clearly faster than the film's usual rate) | A slow stretch | Shorten it, or add a change on screen |
| **Spike** (more viewers than just before) | People rewatched or skipped to it. YouTube notes a spike can also mean something was unclear | Reuse what is there; or check it is clear |
| A steady, gentle slope | Normal | Leave it |

YouTube's own vocabulary (support.google.com/youtube/answer/9314415): intros (the share still watching after 30 s), top moments, spikes and dips. Key moments need a video of at least 60 s and 100 views, and data takes a day or two.

For a long film, read it by zones (after yaxeen/storytelling-skills): the first 30 s, the intro to about 2 minutes, the body, the sag at 40 to 60%, and the end. Compare with the same channel's best similar film, not with a number from a guide; a steep first 30 s with a healthy body means the opening betrayed the click, and the fix is the opening, not the story.

The reader has not yet been checked on a real export (none has been read). It takes every layout the export could plausibly have (positions as a percent, a ratio, seconds or m:ss; viewers as a percent or a ratio) and refuses anything else, or an export whose length does not match the film, with the reason. When the first real export is read, check its two columns by eye.

## 8. Not repeated here

The sources make claims with no evidence: the share of viewers who decide in three seconds, the share who watch muted, retention targets that "unlock" distribution, view-through rates by platform, which loop length works best, platform algorithm signals. None of them is in this guide. Where sources disagree (a hook of 1 s or 2 s; safe-area sizes), the studio uses its own rule and checks the platform's current specification.
