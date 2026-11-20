# rc7 candidate (built and checked locally, not recorded)

Source commit: 99257056be8f1d28c6b349f8dad718462d73c331 (branch rc7-integration)

## Export (node tools/release/export.mjs --ref rc7-integration --version 0.1.0-rc7)
- 998 files left out, 7 replaced by release files
- Preview links removed: library/motion/index.json 246; library/backgrounds/index.json 0
- Banned-word scan (exporter): passed, no problems reported

## Registry check (--strict)
- 1016 customer items checked, 0 mismatches; privacy scan passed (7 banned words, manifest.json)

## Content checks
- absent: library/fixtures, .damex, brands/tulvo, engine/src/jobs/ugc-01
- present: tools/film/export-worker.mjs, tools/conductor/, .claude/skills/video-menu/SKILL.md, brands/demo/styles/ugc-phone-take/style.json
- 9 new sound files all present (ambience/room-clean-01; click/finger-tap-glass-01..03; foley/phone-buzz-table-01..02; swish/glass-swipe-01..03, all under library/sounds/, .mp3)
- motion index: 0 preview values pointing at missing files

## Wide word grep (tulvo|dokan|wedevs|kestrel|kashfiq|rubik)
- tulvo, dokan, wedevs, kashfiq: 0 files
- kestrel / rubik: 9 files (NOT caught by the exporter's own list). All look benign:
  invented brand "Kestrel" in brands/_template/product/README.md, 2 ad-skill evals.json, motionmaxxing demo index.html, design-taste-frontend references/copy.md;
  Rubik is a Google font name in impeccable/scripts/data/font-index.json; also design-taste-frontend copy-lint.mjs, gate.md, copy-tells.md.
  Needs a human call on whether these count as leaks.

## Zip
- damex-video-engine-0.1.0-rc7.zip, 101242419 bytes
- SHA-256 6e3d47a4b6040c129d111b9f2643ff8b41b08cd2e0f1f37a31731f72dbe49870
- Location: scratchpad/rc7/zip (not uploaded anywhere)
