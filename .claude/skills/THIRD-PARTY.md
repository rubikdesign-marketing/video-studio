# Skills bundled with the studio

Every skill here except `video-studio` (the studio's own) is a copy of a public, open-source skill, taken at its latest version on 12 Nov 2026 (70 skills; five more added 17 Nov, one on 18 Nov) so every teammate gets the same set when they clone the repository. Refresh them with `bash setup/update-skills.sh`, then update this page and commit.

Which skill leads which task, and how overlaps are settled, is in `video-studio/skill-map.md`.

| Skill | What it is for here | Source | Version taken | Licence |
|---|---|---|---|---|
| remotion-best-practices, remotion-captions, remotion-create, remotion-docs, remotion-interactivity, remotion-license, remotion-maps, remotion-markup, remotion-multimedia, remotion-render, remotion-saas, remotion-studio, remotion-upgrade | Writing and rendering scenes in the Remotion engine | github.com/remotion-dev/skills | 4.0.543 (commit 7e541aa, 11 Nov 2026) | Not stated in the repository. Fine for this private team copy; ask Remotion before giving them to other companies |
| hyperframes, hyperframes-cli, hyperframes-registry, media-use, remotion-to-hyperframes, reverse-any-video, slideshow, style-sampling | HyperFrames clips (HTML rendered to video), studying a reference video, sampling a style | github.com/heygen-com/hyperframes | commit 9a048ac, 11 Nov 2026 (the engine runs HyperFrames 0.9.34) | Apache 2.0 |
| motion-design | Motion principles: timing, easing, choreography | github.com/lottiefiles/motion-design-skill | commit f9a8a04, 18 May 2026 | MIT |
| motion-foundations, motion-advanced, motion-patterns | Motion tokens, springs and advanced techniques | github.com/affaan-m/ecc | commit d2ef268, 6 Nov 2026 | MIT |
| fixing-motion-performance | Finding and fixing janky animation | github.com/ibelick/ui-skills | commit f511eae, 11 Nov 2026 | MIT |
| hallmark | Anti-slop design: audits, redesigns, studying a design | github.com/nutlope/hallmark | 2.0.0 (commit 04977e1, 11 Nov 2026) | MIT |
| impeccable | Design critique, polish, typography, colour, layout, motion and UX copy for any interface | github.com/pbakaus/impeccable | 4.8.2 (commit b4bff16, 11 Nov 2026) | Apache 2.0 |
| design-taste-frontend | Taste for web pages built by the studio (the review page, landing pages for a video) | github.com/Leonxlnx/taste-skill | 2.5.1 (commit f6b7657, 7 Nov 2026) | MIT |
| motion-doctrine, cut-the-curve, seam-craft, captions-overlay, oversized-cursor, changelog-video | HyperFrames' own craft doctrine: one continuous camera move, velocity-matched seams, seams that composite, captions as an overlay, pointer technique, the changelog video pattern | github.com/heygen-com/hyperframes (its `.claude/skills/` folder) | commit 748bfe3, 12 Nov 2026 | Apache 2.0 |
| figma (HyperFrames) | Bringing a Figma frame into a HyperFrames clip | github.com/heygen-com/hyperframes | commit 9a048ac, 11 Nov 2026 | Apache 2.0 |
| motionmaxxing | Motion feel: curves measured from 53 professional recreations, studies, review gates, a GSAP runtime for HyperFrames hero moments | github.com/Tejashmakwana/motionmaxxing | commit 8c8ec0f, 6 Oct 2026 | Apache 2.0 |
| zero-slop | The last pass on every line a viewer reads or hears: removes wording that sounds machine-made | github.com/manavmishra/ZeroSlop | commit 9f7bca2, 11 Nov 2026 | MIT |
| caveman | Terse notes between helper agents to save tokens; never for anything a person reads | github.com/juliusbrussee/caveman | commit 3dc497a, 8 Nov 2026 | MIT |
| 31 advertising skills (advertising-kickoff routes them: ad-format-fit, ugc-ad-scripts, ad-creative-test-plan, ad-creative-fatigue, ad-audience-targeting, ad-bidding-strategy, ad-spend-guardrails and more; the full list is in `.sets/`) | Planning and running videos as paid ads | github.com/mbfinotti/advertising-skills | commit ab1eb51, 26 Oct 2026 | MIT |
| viral-hooks | Hooks for the first three seconds: archetypes, the three-layer hook (seen, said, written), tactics by platform, anti-patterns. A second read beside the studio's own `knowledge/craft/15-hooks.md`; its retention figures and creator-attributed frameworks are unsourced and are not repeated by the studio | github.com/vyralcontent/content-skills | commit 349e495, 22 Jun 2026 | MIT |
| bang-motion | Motion craft: shot sizes, the camera going to what is speaking, transitions, type rhythm, the anti-slide tests. Written in Indonesian. Its house rules give way to the brand (`knowledge/craft/14-motion-systems.md` section 8) | github.com/bangtutorial/bang-motion | 1.19.0 (commit c1aa65e, 15 Sep 2026) | MIT |
| earshot, real-sound | Hearing with numbers: loudness, tone, events, sound-on-picture sync, the annotated sheet, the launch-film critique (`tools/audio/listen.mjs` runs it); building a soundtrack from real licensed recordings | github.com/Leonxlnx/earshot (the `earshot` program is installed by `setup/install.sh`, pinned to the same commit; its models, about 1.1 GB, live in `tools/audio/.earshot/`) | 0.4.1 (commit 4ac3d2a, 6 Nov 2026) | MIT (models: LAION CLAP, Apache 2.0; MIT AST, BSD 3-clause) |
| plinkfx | Sound effects designed as code: layers of oscillators and noise with envelopes, sweeps and filters, rendered and measured locally. For a brand's own interface sounds and stings; the studio's own `tools/audio/synth.py` makes whooshes, risers and impacts the same way | github.com/maximilianfeix/plinkfx (its command-line tool is fetched by npx on first use; no network after that, no AI models) | commit 7e5f6a4, 15 Nov 2026 | MIT (its sounds: CC0) |
| storyboard-architect | Turns a script into a timed storyboard with shot lengths and a "read twice" check on on-screen text. A second view beside the studio's own beat sheet (`tools/plan/beats.mjs`) and shot list; its timings are its authors' rules of thumb | github.com/whystrohm/shotkit (its NOTICE file is kept beside it) | commit e6d66a3, 16 Nov 2026 | Apache-2.0 |
| viral-short-form | Short-form structure: the retention arc, pacing by platform, loops. A second read beside `knowledge/craft/16-structure-and-retention.md`; its retention figures are unsourced and not repeated by the studio | github.com/vyralcontent/content-skills | commit 349e495, 22 Jun 2026 | MIT |
| title-kinetic-typography | Title and kinetic typography direction: hierarchy, reveal, hold and exit, safe zones, flash safety. Guidance for HyperFrames clips; the studio's own text moves are in `engine/src/kit/type/` | github.com/calesthio/generative-media-skills | commit 8c85352, 14 Jul 2026 | MIT |
| gsap-core, gsap-timeline, gsap-plugins | GreenSock's own guidance for GSAP tweens, timelines and plugins (SplitText, ScrambleText), for HyperFrames clips. GSAP itself is installed, never copied into this repository (its licence is free but not open source) | github.com/greensock/gsap-skills | commit aed9cfd, 21 Apr 2026 | MIT |
| real-sfx, hyperframes-to-after-effects | Placing real sounds on the exact frame (by attack or arrival, from cues, HyperFrames timings or the picture); turning a HyperFrames clip into an editable After Effects project | github.com/Clipwing/skills | commit edbefcb, 21 Oct 2026 | No licence file. real-sfx's README says its scripts are MIT and its bundled uisfx sounds CC0 (synthesised, MIT code); hyperframes-to-after-effects states none. Fetched on each Mac by `setup/update-skills.sh --missing`, never kept in the public repository |

Notes:
- The taste family was folded into one skill in taste-skill 2.5 (5 Nov 2026). Older names (gpt-taste, high-end-visual-design, minimalist-ui, redesign-existing-projects) no longer exist upstream and are not bundled.
- design-taste-frontend adds a finish check when it is used (a "Stop" step that checks a page it built). It does nothing in a folder where it has not built a page.
- Each skill folder keeps its own licence file. Do not edit a bundled skill in place: changes are lost at the next refresh. Put studio-specific guidance in `video-studio` instead.

## Plugins declared for the team (`.claude/settings.json`)

Claude Code offers to install these when a teammate opens the folder and trusts it.

| Plugin | What it adds | Marketplace | State |
|---|---|---|---|
| Superpowers | A disciplined way to plan, debug, review and verify changes to the studio | `claude-plugins-official` (Anthropic's) | On |
| claude-mem | Memory across sessions, kept on each teammate's Mac | `thedotmack` (github.com/thedotmack/claude-mem) | On |
| Matt Pocock's skills | `grill-me` and engineering skills (spec, tickets, code review, diagnosing bugs) | `mattpocock` (github.com/mattpocock/skills) | On |
| Ponytail | Keeps the code Claude writes to what the task needs (its own benchmark: about 45% fewer tokens); adds `/ponytail` levels and `/ponytail-gain` to see sessions' cost | `ponytail` (github.com/DietrichGebert/ponytail) | On |
| ECC (Everything Claude Code) | 314 skills, 71 agents, 98 commands and hooks, mostly for software engineering | `ecc` (github.com/affaan-m/ECC) | Off by default: every listed skill costs tokens in every session. Turn on for a job that needs it |

## Left out on purpose

- The other skills in Remotion's main repository (product-recording, homepage-video-assets, timeline-layout-reveal and about 60 more) are Remotion's own developer tools for its codebase and website; they do not work outside it. All 13 public Remotion skills are bundled.
- HyperFrames' registry blocks each carry a guide; `hyperframes-registry` reaches them, so they are not bundled separately.
- Openverse (github.com/WordPress/openverse, MIT) is used as a service, not a skill: `tools/media/openverse.mjs` searches its public API for sounds and photos and keeps each one's licence and credit.
- The hook library (`library/hooks/`) is data, not a skill: 147 formula patterns and the rules in `knowledge/craft/15-hooks.md` were taken, merged and reworded from ten MIT-licensed projects (Jakeschincariol's instagram-agent-skill and youtube-agent-skill, rediumvex/viral-hooks-skill, vyralcontent/content-skills, coreyhaines31/marketingskills, sergebulaev/youtube-skills, yaxeen/storytelling-skills, Ootto-AI/claude-virality-skill, artemnovitckii/content-skills, win4r/video-director). Versions, what was taken from each, and the licence text: `library/hooks/CREDITS.md`.
- Viral Hooks (viralhooks.org) is a connector, declared in `.mcp.json`, not a skill and not open source: a free library of short viral clips with no owner, source or licence stated for any clip. It is for studying openings. A clip may be used only as `knowledge/craft/15-hooks.md` section 8 says, through `tools/hooks/clips.mjs`.
- open-motion (github.com/Yuan-ManX/open-motion, MIT) is not bundled: it is a whole app. Its choreography, restraint, rhythm, transition and pointer-response tables are copied, with credit, into `knowledge/craft/14-motion-systems.md`.
