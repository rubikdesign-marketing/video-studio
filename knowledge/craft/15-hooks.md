# Hooks: the first three seconds

How a film opens: what is seen, said and written before the viewer decides to stay. The rules are gathered from ten open-source projects (credits: `library/hooks/CREDITS.md`) and put in the studio's words. The brand's own rules and `00-principles.md` win where they differ.

Where it is used: the script stage writes three hooks from three families (`node tools/hooks/hooks.mjs find`), measures each and scores it with the rubric below; the animation stage builds them for the hook lab and checks the written line can be read in time (`node tools/checks/hook_legible.mjs`); the learn stage records which formula the film used, so the brand's ledger shows what worked.

A warning that applies to everything here: almost nothing published about hooks is evidence. The sources report what their authors believe or saw on their own accounts. This guide leaves out every percentage, view count and "this always beats that". The only record of what works for a brand is that brand's ledger.

## 1. Three layers that agree

A hook is three things at once.

| Layer | What it is | The rule |
|---|---|---|
| Seen | The first frame | The payoff, the conflict or the stake, already moving. Never a logo, a title card or a face settling in |
| Said | The first spoken line | One claim, said once, short enough to say in three to five seconds, with its point out inside three |
| Written | The line on screen | Three to seven words, one idea, large and high in contrast, clear of the platform's own buttons |

- All three point at the same idea and none repeats another. If the voice says the sentence, the written line sharpens it: it compresses, raises the stake or names who it is for.
- Two tests. Cover the written line: does the picture alone say what this is? Cover the picture: does the written line alone earn a pause? Both should pass.
- Order of work: write the spoken line; choose the picture so it lands before the voice does; write the on-screen line last.
- The seconds after the hook must carry on from it. A new hook put on an old body breaks that join, so the next line is rewritten for each hook tried.
- The hook must not promise what the film does not deliver. If it cannot be delivered, change the hook.

(After vyralcontent/content-skills and coreyhaines31/marketingskills.)

## 2. The first frame

The checklist, for every film (after Ootto-AI/claude-virality-skill; its timings are one maker's working rules, kept here as rules of thumb):

1. Frame 0 is already moving. No fade from black, no empty frame.
2. Frame 0 shows something the viewer knows at a glance: their own problem, a screen like theirs, the product at work. Not an abstract background.
3. The biggest thing in the frame is big: about two fifths of the frame or more.
4. Something happens before three seconds: a thing builds, breaks, snaps into place, or a number runs and stops.
5. The written line arrives early and is readable with the sound off (section 5).
6. The first spoken word comes at once and is the subject, not a warm-up.
7. It works with the sound off.
8. It is about the viewer's work, not about the maker or the tool in general.

Five pictures that work without sound (after yaxeen/storytelling-skills):

- **Caught mid-action.** Something already happening: a card being dragged, a page being torn up, a form half filled.
- **The thing out of place.** One object where it does not belong.
- **Before and after at once.** Both states in the frame, side by side.
- **The receipt.** A real number or result on a real screen.
- **The viewer's own view of the problem.** The crowded inbox, the forty open tabs.

For the studio's product films this means: open on the real product doing the thing (rule: real product screens only), at a close or medium shot size (`14-motion-systems.md` section 1), with the camera or the pointer already moving.

## 3. Deadlines by platform

Rules of thumb from the sources, not measurements.

| Where | What the hook is | How long it has |
|---|---|---|
| Reels and TikTok | Picture and first line together; lead with the picture | About two seconds |
| YouTube Shorts | Frame one states the payoff; no greeting, logo or request to subscribe | Less than the other feeds |
| YouTube, longer films | The title and thumbnail earn the click; the opening confirms the promise and raises the stake, without giving the payoff yet | The first 15 to 30 seconds |
| LinkedIn | The first one or two lines before "see more", and the first frame | The fold |
| X | The first line and the first frame | The scroll |
| A paid placement | The offer in small: specific, about a benefit, matched to what the viewer already knows | About two seconds, before it reads as an advert |

One film for several platforms keeps its angle and changes its execution: the pacing is re-timed and the written line is set again for each platform's safe area.

(After vyralcontent/content-skills and artemnovitckii/content-skills.)

## 4. The families

`library/hooks/index.json` holds the formulas, each in one family. `node tools/hooks/hooks.mjs families` lists them with their counts.

| Family | It | Often right for |
|---|---|---|
| Question | asks what the viewer already wants answered | Tutorials, problem-aware viewers |
| Contrarian | says the opposite of what the viewer believes, and means it | Cold viewers; needs proof in the next breath |
| Outcome first | shows or states the result before anything else | Demos, promos |
| Problem | names a pain the viewer recognises as theirs | Cold and problem-aware viewers |
| Curiosity gap | names the kind of answer, not the answer | Longer films; must pay off |
| Proof | leads with a number or a result that can be shown | Viewers comparing options |
| Story | starts in the middle of something that happened | Founder and customer films, edits of footage |
| How to | promises a method | Tutorials |
| List | promises a counted set | Tutorials, round-ups |
| Mistake or warning | points at a loss the viewer may be making | Problem-aware viewers; never fear for its own sake |
| Callout | names the exact people it is for | Narrow audiences, ads |
| Comparison | sets two things side by side | Demos, switching from an old way |
| Offer | is the deal itself, said plainly | Promos, viewers who know the product |
| Demonstration | shows the product doing the thing before any talk | Demos; the studio's home ground |
| Pattern interrupt | opens on a picture or move the feed does not usually show | Short-form; never a trick unrelated to the film |

Which family for which viewer is the studio's own layer (`suits.awareness` in the data), not a finding: a viewer who does not know the problem needs it named or shown; one who knows the product can be given the offer.

Three hooks for one film come from three different families. Three rewordings of one idea are one hook.

## Scoring a hook

Every weak opening fails in one of four ways (after artemnovitckii/content-skills). Score each from 0 to 2: 0 fails, 1 passes with a doubt, 2 passes cleanly. A hook under 6 of 8, or with a 0 anywhere, is rewritten. The scoring is a judgement, made by a person or by Claude in the session; `hooks.mjs measure` only counts what can be counted.

| Killer | The question to ask | The fix |
|---|---|---|
| Delay | Is the subject named before this platform's deadline? What is the first word that carries it? | Delete everything before the subject. No greeting, no warm-up |
| Confusion | Can it be understood in one pass, at speaking speed? | Fewer and simpler words, one idea a sentence, active voice |
| Irrelevance | Can the viewer see themselves in it, or is it about the maker? | "You" and "your" for "I" and "our"; frame it on a pain the viewer already has. A story may be in the first person when the pain is plainly the viewer's too |
| Disinterest | Is there an open question: a gap between what the viewer believes and what this claims? | Name what they believe and put the claim against it, or state the claim so the belief is implied |

Then two checks that are not scores: the film delivers what the hook promises, and the three layers agree (section 1).

## 5. The written line

- Seven words at most, one idea, the most interesting word first. Sentence case, no full stop.
- It is the other half of the spoken line, never a caption of it (after yaxeen/storytelling-skills). When the voice names the pain, the line hints at the answer. When the voice makes the claim, the line carries the number or the contrast. When the voice asks a question, the line names who it is for.
- Readable with the sound off by three seconds: type at least 7.8% of the frame's short side (84 px on a 1080 frame) and a contrast of at least 7:1 against what is really behind it. This rule is win4r/video-director's, which enforces it on its own renders; here `tools/checks/hook_legible.mjs` measures it. It is larger than the studio's ordinary film text (2.6% of frame height, `04-type-and-captions.md`) on purpose: this one line has to be read by someone who has not decided to watch.
- The caption pill is not the hook's written line. The hook line is film type, in the brand's headline face.

## 6. Openings to avoid

`library/hooks/avoid.json` holds the patterns `hooks.mjs measure` reports. The kinds (after vyralcontent/content-skills and coreyhaines31/marketingskills):

- A greeting, a welcome, "in this video", "today we are going to": the deadline is spent before the subject.
- A logo or a jingle that holds the film up. Where a playbook opens on the logo (the promo does), the logo is part of the first frame's movement and the hook's picture and written line are up with it: the logo never delays them.
- A tease with no shape: "you won't believe", "what nobody tells you". Name the kind of answer.
- An order with no reason yet: "stop scrolling".
- A request before any value: subscribe, follow, comment.
- The seller first: "we are excited to announce", "check out our new".
- Cleverness that needs explaining. Clear first; wit can come at the payoff.
- A hook that takes ten seconds. Cut it to one beat and let the next line carry the rest.
- Hype words. Say what the thing does.

Cautions for claims: a bold claim needs its proof on screen; a before and after must be honest; a first-person story needs a detail only someone who was there would know; naming a competitor in a paid ad needs legal review.

## 7. Hooks for ads

- Work from a slice of buyers, not the whole audience; then the one pain, wish or objection that moves that slice, in their own words from reviews, comments and calls; then the format; then the three layers (after coreyhaines31/marketingskills).
- Cover different slices and formats. Thirty rewordings of one cell are one test.
- Reading results: few people stopping points at the picture and the written line; people stopping and leaving points at the join after the hook; people watching and not clicking points at the offer. Change one thing per test.
- Google's ABCD rules for video ads (attention, branding, connection, direction) are a useful second checklist: support.google.com/google-ads/answer/14783551. The lift figures quoted there are Google's own, with Kantar.
- A paid ad never opens on a Viral Hooks clip (below).

## 8. Other people's clips

The Viral Hooks connector (`.mcp.json`) searches a free library of short viral clips. Use it to study what a strong first two seconds looks like. Its clips are real footage of real people with no owner, source or licence stated, so:

- Never in a paid ad. Never in the repository. Never a clip with a child or a recognisable private person, or with another creator's captions burned in.
- In a film only for an organic post, and only on the owner's decision for that one clip: `node tools/hooks/clips.mjs use <page> --job jobs/<job> --post organic --approved-by "<name>" --words "<what they said>"`, which writes the decision beside the clip. `clips.mjs check jobs/<job>` runs before delivery.
- The default is the studio's own opening made in the engine, the brand's footage, or licensed footage (`tools/media/openverse.mjs`). The engine's twelve hook openers (`library/motion/index.json`, family `opener`; `engine/src/kit/openers/`) give a pattern interrupt with nothing borrowed: a punch-in, a line that fills the frame, a sudden stop, a card at the lens, a number slam, a split screen, a strike-out, a building question, a glitch cut (banned by default), a spotlight, a notification, a whip. Each is moving on frame 0, sets the written line at 8% or more of the short side, and was checked in all four sizes; three of them (at the lens, sudden stop, whip-in) leave the line unreadable until about 1 s, so pair those with a picture that carries the first second.

## 9. How the library learns

- Every formula in the library is marked "untested", and stays so.
- Stage 6 records the film's `hook_formula` in the brand's ledger beside its results. A formula has "worked for the brand" only when the ledger says so; `hooks.mjs find --brand` leaves out the formulas of the brand's last five films so openings do not repeat.
- The two hooks not chosen are kept in `job.json` as ad variants.
