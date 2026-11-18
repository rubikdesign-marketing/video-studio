# Starting rules

Approved 11 Nov 2026. Taken from 34 rounds of feedback on the Black Friday and UGC work. New rules are added only from `brands/<brand>/lessons/` after the owner approves them.

| # | Rule | Tags | Check | Times it was said |
|---|---|---|---|---|
| 1 | No jumps, jitter or chatter | animation | `tools/checks/smoothness.py`, every flag looked at | 6 |
| 2 | The length cap is agreed first and is binding; the latest cap wins | idea, animation | Master length against `job.json` | 5 |
| 3 | No hold without a reason; nothing waits after a line lands | storyboard, animation | Voice gaps 0.6–0.8 s; at most two proof holds of about 1.3 s | 4 |
| 4 | Fluid and human, not fast or flashy. One camera direction per shot; finish the zoom, then land the number | storyboard, animation | Storyboard review; contact sheets | 4 |
| 5 | Offer wording is fixed once and identical everywhere | script, storyboard, animation | On-screen text and transcript against `job.json` | 4 |
| 6 | Voice at 100%, music at 20–30% | sound | Mix levels measured | 2 |
| 7 | Every background is alive but may drift slowly enough to read as rest, so a film can be still about a quarter of the time; no dot patterns | moodboard, animation | Stage drift under the stillness line of `tools/study/profile.py`; the film's share of still time against `craft/00-principles.md` (settled by the owner 11 Nov 2026) | 2 |
| 8 | Captions are liquid glass, live with the voice, and never cover UI | animation | Caption box against capture regions | 2 |
| 9 | A real hook or the offer in the first 3–5 seconds; full sentences spoken to a buyer; never generic | script | Script approval | 4 drafts |
| 10 | Real UI, real and varied data, showing exactly what the line says | idea, storyboard | Each capture traced to a real page | 3 |
| 11 | Stay in the brand colours: blue, ice blue, warm peach. No purple, pink or ash | moodboard | Palette on the moodboard | 3 |
| 12 | Highlight only what the beat is about | storyboard | Storyboard review | 2 |
| 13 | The logo opens and closes the film; it is not on every frame, and it is never missing where the product shows it | storyboard | Storyboard review | 3 |
| 14 | Little text on screen, but large enough to grab attention | storyboard | Text budget and type scale | 2 |
| 15 | "Tulvo" is said TOOL-voh; no whispered lines; promos get a high-energy read | script | Transcript check; listening at the voice approval | 2 |
| 16 | The voice is never stretched or sliced; the picture is fitted to it | script, animation | `tools/audio/voice_check.py` on the joined voice | 1, and measured |
| 17 | Low-resolution previews while iterating; full quality only for finals | animation | — | 1 |
| 18 | Third-party logos need a person's confirmation | storyboard | Listed at the storyboard approval | — |
| 19 | Sound comes from the brand's own kit first, then the shared library (`library/sounds/`: public domain or made by the studio, every file's licence recorded), and only then is made on the ElevenLabs plan; every library sound used is named in the hand-over. Music is made for the film by default; a bundled public-domain bed may be used for a quick cut or a draft. Nothing that needs a credit on screen or forbids sharing (changed by the owner 18 Nov 2026, on the library plan; was "only from the ElevenLabs plan") | sound | `node tools/audio/sounds.mjs check`; the licence note in the delivery pack lists library sounds | 1 |
| 20 | No coding-style (monospaced) typeface anywhere | moodboard, storyboard, animation | Fonts loaded by the engine; look at labels on the contact sheet | 1 |
| 21 | No dots: not in backgrounds, not inside pills, not between words | script, storyboard, animation | `tools/checks/onscreen_text.py --never "·"` plus a look at pills and labels | 2 |
| 22 | Nothing on screen or spoken reads as if a machine wrote it | script | The "Human wording" list in `craft/04`; read every line aloud | 1 |
| 23 | Real product screens and graphics only: no filmed or generated people (decided by the owner 11 Nov 2026; revisit if a live-action lane is ever built) | idea, moodboard | Idea approval | 1 |
