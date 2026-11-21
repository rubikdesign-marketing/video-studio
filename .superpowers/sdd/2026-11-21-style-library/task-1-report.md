# Task 1 report: library shape, loader and check

## Implemented
- tools/styles/lib/library.mjs: TABS, TAB_LABELS, ENERGY_TARGETS, ENERGIES, SKETCHES, loadLibrary, engineNames, promptText, checkLibrary (min option, default 100).
- tools/styles/check.mjs: flags --tab, --skip-clips, --corpus, --min; banned list read from release/manifest.json "banned" (regex strings, matched case-insensitively against each entry's JSON); default corpus .damex/motion-study/corpus.json if present.
- library/styles/sketches.json (8 ids), library/styles/README.md.
- Tests plus fixtures: tools/styles/tests/library.test.mjs, tools/styles/tests/fixtures/lib/ (10 entries over 5 tabs incl. one made-on-request, miniature motion index, registry, backgrounds, sounds, and an invented corpus).

## Decisions
- Real shapes: moves = motion/index.json moves[].name; registry = items[].name and id; backgrounds = backgrounds[].name; sounds = each library/sounds/<group>/index.json sounds[] (id, basename, file) plus file basenames. Real studio: 254 moves, 2052 registry, 12 backgrounds, 789 sound names.
- Corpus records have a single `prompt` field; used it, falling back to every string over 40 chars when absent. Runs are matched per prompt field (what, when, avoid), lower-cased, punctuation ignored.
- Ruling R2: sound entries need preview.sound to exist (names.sounds or file under library/sounds); no clip rule for sound.
- Ready entry engine names are checked against the union of all four name sets.
- Mesh blob rule checks prompt.what, prompt.when and line (not avoid). Motion range inclusive; still: calm inclusive, others upper-exclusive.
- Extra checks beyond the brief: missing required fields, tab mismatch, unknown energy, avoid_with ids exist, timing keys present.

## TDD evidence
Honest note: I wrote the implementation before running the test file, so there was no true RED before GREEN. RED was shown afterwards by hiding library.mjs: `node --test tools/styles/tests/library.test.mjs` -> ERR_MODULE_NOT_FOUND (library.mjs). GREEN: same command, 7 pass, 0 fail (one initial fail was a wrong fixture path in the test, fixed).
Full: `node --test tools/styles/tests/*.test.mjs tools/plan/tests/*.test.mjs` -> 91 tests, 91 pass.
`node tools/styles/check.mjs --skip-clips` on the real studio: exit 1, five "could not be read: the file is missing" notes and five "0 entries" lines, as expected.

## Concerns
- check.mjs prints load notes and the count problems both for a missing tab (two lines per tab); harmless.
- Banned strings in the manifest are regexes, so check.mjs treats them as such.
