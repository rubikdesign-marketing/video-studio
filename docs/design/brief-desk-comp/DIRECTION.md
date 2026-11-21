# Brief desk and style library: design direction (comp)

Owner: approved style library design (docs/superpowers/specs/2026-11-21-style-library-design.md) plus these answers (21 Nov 2026):
- Audience: general marketers, not motion designers; want a very good film without spending much time.
- Use case: describe the video; the page points at styles they may like; confirm the brief. The engine's strengths to put forward: the UI library, the motion library, the sound designs, and the built-in skills.
- Tone: technical with a cinematic edge. Highly intelligent: it understands what the user wants and suggests styles alongside. Motion highly polished. Built-in prompt optimisation: rough words become a studio director's brief focused on detail (shots, camera, motion, timing, sound).

Hallmark picks (by the controller):
- Genre atmospheric with brand-first overrides. Custom theme anchored on the brand.
- Tokens: page #010B24, ink #FFFFFF, second ink white 62%, line white 16%, soft white 6%, accent lime #BBFC9E (on-accent #050B14), warm amber #FFA724 (only for warnings/clashes and "made on request"), extra brand blues for depth: night deep #061A4D, night mid #0A2A7A, azure #2E6BFF (sparingly, e.g. focus or a single bloom). Use OKLCH tokens equivalent to these.
- Type: Chakra Petch 400/500 (Google Fonts) for display headlines in CAPITALS (tracking -0.03em, line-height 0.92) — big headlines only. Onest (Google Fonts) for body, labels, buttons, cards, questions — sentence case. My Soul (Google Fonts) only for one decorative swash capital S in the hero headline.
- Shape: a two-pane "director's desk" app workspace, not a landing page. Left pane: write and direct. Right pane: the style library as a component playground where moving previews are the content. Top: brand bar (inline the wordmark SVG from wordmark-on-dark.svg in this folder) with a ⌘K search. Bottom: a picked-styles "reel" tray.
- Motion: previews loop on hover/focus only (still frame under prefers-reduced-motion); card fade on filter change; one short reveal when the director's brief arrives. transform/opacity only, named easings.

## Controller review of the comp (21 Nov 2026)

Checked in the browser at 800 and 1440 px: brief → understood chips → director's brief → questions → suggestions → pick → detail drawer → reel tray. No console errors.

To carry into the build:
1. The director's brief speaks plain words. Engine move names (e.g. opener-strike-out, camera-snap-zoom) appear only in "What the engine will use", or behind a small "engine details" fold.
2. The checklist strip uses the engine's real eight items: Brand, Product, Audience, Message angle, Style and look, Hook, Video type and references, Size, length and voice.
3. Library counts are placeholders until the real library exists.
4. Gate 67 waiver (brand line height 0.92 for capitals) and gate 20 ("Acme" sample name) are accepted.
