# Motion systems: shot sizes, choreography, restraint and rhythm

Measured rules for how a film moves, taken from two open-source projects and translated to the studio's engines (Remotion frames and springs; HyperFrames GSAP timelines). The brand's own rules and `00-principles.md` win wherever they differ.

Sources, both MIT: **bang-motion** (github.com/bangtutorial/bang-motion, v1.19.0, bundled as the `bang-motion` skill; its references are in Indonesian) and **open-motion** (github.com/Yuan-ManX/open-motion, `open-motion/src/motion/`, not bundled: the tables below are copied from it).

Where they are used: the moodboard writes the motion signature and the restraint level; the storyboard names a shot size, a choreography and a transition for every shot; the animation stage builds to the numbers; the directors' checks (`08-directors-checks.md`) run the anti-slide and restraint checks.

## 1. Shot sizes: the camera goes to what is speaking

"Zoom" means a change of shot size, not a slow breathing scale (bang-motion, `references/techniques.md` §3b).

| Shot | What fills the frame | Use |
|---|---|---|
| Wide | The whole screen, card or scene | Setting the place; between beats |
| Medium | One panel, one card, one group | The thing being talked about |
| Close | One button, one number, one word | The moment that matters |

- The camera aims at the element that is "speaking" in this line of the voice or caption. Text appears only after the camera has arrived.
- Labels and captions sit outside the camera (they do not zoom with the picture).
- A push smaller than 1.08× reads as a miniature, not a shot change: either commit to a real shot size or hold still.
- Product UI: start the push 0.3–0.5 s before the pointer arrives; push to 1.4–2.2× over 0.6–0.9 s, eased in and out; the pointer rests about 0.2 s; the pressed thing dips to 0.92–0.97. At most one to three pushes per act, and never in and out again within about 1.5 s. (Compare the capture engine's camera, `CAPTURE-PLAN.md` 7.2, and keep the two consistent.)

## 2. Choreography: how several things move together

Name one per group in the storyboard (open-motion, `choreography.ts`; default 120 ms between items, 600 ms each).

| Pattern | What it does | Good for |
|---|---|---|
| Cascade | One after another, fixed gap | Lists, feature rows |
| Call and response | One moves, a second answers after a pause | A question and its answer; a click and its result |
| Unison | Everything at once, same timing | One strong beat; use rarely |
| Counterpoint | Opposite directions at once | Before and after; two sides |
| Wave | A travelling phase offset | Rows of icons, a logo wall |
| Canon | The same move started at intervals | Repeated cards that should feel related |
| Stagger grid | Diagonal sweep across a grid | Bento grids, dashboards |
| Ripple out | From the centre outward | A hub and its connections |

In Remotion: delay in frames = `ms × fps / 1000`. In HyperFrames: the same numbers as GSAP positions.

## 3. Restraint: how much moves at once

Too many things moving at once reads as noise (open-motion, `restraint.ts` and `restraintBudget.ts`).

- **At any moment:** more than three things animating at once is a warning; more than five is a fault. Stagger them.
- **Same easing on everything** in a scene (more than two things) is a warning: vary it on purpose.
- **Budget per scene**, by energy preset: calm 8, confident 20, hype 40 (open-motion's minimalist, balanced and expressive tiers). Each moving thing costs 1, plus: a loop +2; longer than 3 s +2 (longer than 1.5 s +1); a bounce, elastic or back easing +2; a spring with stiffness over 200 and damping under 15 +2; more than six keyframes +1; at most 5 for one thing.

## 4. Rhythm: motion on the music's grid

When a film has music, durations and gaps snap to its grid (open-motion, `motionTempo.ts` and `rhythmPatterns.ts`).

- One division lasts `(60000 / bpm) × 4 / division` ms (division 4 = a beat, 8 = half a beat, 16 = a quarter). Pick the division nearest the duration you wanted.
- A feel multiplies successive beats: steady 1, 1, 1, 1; swing 1.33, 0.67; syncopated 0.75, 1.25; gallop 1.5, 0.75, 0.75; rubato 1.2, 0.8, 1.4, 0.6 (for one emotional passage only).
- Big moments land on a downbeat (the studio's beat detection gives the grid). earshot's timeline reports how close they landed (section 7).

## 5. Transitions: a menu, used with variety

| Transition | Out | In | Overlap |
|---|---|---|---|
| Iris | 450 ms, ease-in-out | 450 ms, ease-out | 0.2 |
| Diagonal sweep | 500 ms | 500 ms | 0.5 |
| Stack pop | 400 ms, ease-in | 450 ms, ease-out | 0.4 |
| Blur dissolve | 600 ms | 600 ms | 0.7 |

(open-motion, `sceneTransitions.ts`.) bang-motion's rule for a whole film: at least two kinds of transition, at least one with depth, wipes at most twice, a push-through about once. The studio's own transitions (`03-transitions.md`, `CAPTURE-PLAN.md` 7.5) come first; these fill the gaps.

## 6. Text in motion

From bang-motion (`references/anti-ppt.md`, `references/techniques.md` §1):

- Entrances 0.7–1.3 s, strongly eased out; exits 0.35–0.55 s, eased in. Exits are faster than entrances.
- Five words or fewer to a line on screen; split anything over six.
- At most two levels of text in a scene (a headline and one more).
- Consecutive scenes differ in at least one of: text size, the side it enters from, where it sits.
- The background under text is darker than 25% or lighter than 80% brightness; anything decorative behind text stays under 35% opacity.
- At the size of a phone (1080 px wide frame): body text at least 44 px, labels at least 34 px, titles at least 100 px. (The studio's 4%-of-frame-height floor is the same rule.)

## 7. The anti-slide checks

A film that moves like a slide deck fails, whatever its polish (bang-motion, `SKILL.md` "anti-slide" tests):

- Three or more scene changes done by a plain fade: fail.
- A slow pan or zoom on a still (Ken Burns) as the only motion in a scene: fail.
- Every transition the same kind, or only fades, scale bumps and light leaks: fail.
- The template skeleton "hook, feature, feature, promise, logo, call to action" with nothing else: rework the structure.

## 8. Where the brand wins over these sources

bang-motion carries a house style meant for one-off openers. For a brand's series these parts do **not** apply:

- Its ban on typefaces such as Inter, Poppins and Montserrat: the brand's typeface is used.
- Its rule that each video differ from the last in palette, font, background and motion signature: a brand's films share their look on purpose.
- Its rule against matching a reference the owner supplies: the owner's reference wins.
- Its mandates for every film (no flat backgrounds, directional blur on all text, white titles with a shadow, no captions, grain or glitch looks): the brand's style family (`13-design-styles.md`) decides, and captions follow the brand.
