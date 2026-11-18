# Sound credits

Every sound in this library is CC0 / public domain, or made here and given away as CC0. Each source below is listed with its licence text, the version it was fetched at and the date. Per-file detail (author, source URL, original file name, checksum) is in each group's `index.json`.

## Sourced sounds: click, interface, pop, foley, chime, ambience

All files below are CC0 / public domain, read from the source itself on 2026-11-18. Each file's own line is in its group's `index.json` (`source`, `author`, `licence`, `source_url`, `original`, `fetched`, `sha256`). Files were cut where noted, trimmed, levelled to a -3 dBFS peak and encoded as MP3 with `tools/audio/level.py`.

### romainsimon/uisfx (UI SFX), 44 files
- URL: https://github.com/romainsimon/uisfx
- Commit: `9950fe66f993a6660dab9c2651dcbcd899ffd83b` (shallow clone of the default branch, 2026-11-18); package version 0.4.0 (`packages/uisfx/manifest.json`: "license": {"code": "MIT", "audio": "CC0-1.0"}).
- Licence: CC0 1.0 for the audio. `LICENSE-AUDIO` at that commit reads: "UI SFX audio assets are dedicated to the public domain under the Creative Commons CC0 1.0 Universal Public Domain Dedication. To the extent possible under law, Yuki Capital has waived all copyright and related or neighboring rights to the procedurally generated audio files in `packages/uisfx/sounds`. You may copy, modify, distribute, and use these files, including for commercial purposes, without asking permission." The code is MIT; no code was used. The CC0 dedication does not cover `.generated`; nothing was taken from there.
- Used: MP3 files from `packages/uisfx/sounds/<pack>/<cue>.mp3` (packs minimal, mechanical, rubber, zen, organic, studio, glass, soft, scifi, arcade, dreamy).

### Kenney audio packs, 45 files
Downloaded from kenney.nl with a browser User-Agent through the site's own download link on 2026-11-18. Every pack's `License.txt` reads Creative Commons Zero (CC0); the pack page lists "License: Creative Commons CC0". Kenney's text: "This content is free to use in personal, educational and commercial projects. Support us by crediting Kenney or www.kenney.nl (this is not mandatory)" (Interface Sounds, Impact Sounds) and "You may use these assets in personal and commercial projects. Credit (Kenney or www.kenney.nl) would be nice but is not mandatory." (UI Audio, RPG Audio, Casino Audio). Credit: Kenney, www.kenney.nl.
- Kenney Interface Sounds 1.0: https://kenney.nl/assets/interface-sounds (zip sha256 `f2193d072726d6758a5f7871b2dcc54dcce0d5c35c6f0a62f92549b327c81232`)
- Kenney UI Audio: https://kenney.nl/assets/ui-audio (zip sha256 `946fc23a63d535d693eb31b2eabb80c8c28d6351e2186b344ceb71b2cb1d5eb6`)
- Kenney Impact Sounds 1.0: https://kenney.nl/assets/impact-sounds (zip sha256 `029d734af1582474edf3a694d1b0cebc97c1c152f2f39fa34d4c2bafc5de77f8`)
- Kenney RPG Audio: https://kenney.nl/assets/rpg-audio (zip sha256 `6dbeaf8544da958d8f2adcb4a4a4b76c1ade34a05f8ab9edccd327da7375f38b`)
- Kenney Casino Audio 1.1: https://kenney.nl/assets/casino-audio (zip sha256 `f36250766ac5bc378c13708ddf12a23a8e54a3251f8d482c7536e51b5dbafa18`)
- The download links are signed and expire, so `source_url` is the pack page plus the path inside the zip (`Audio/<file>.ogg`).

### BigSoundBank (Joseph Sardin), 36 files
- URL: https://bigsoundbank.com ; licence page https://bigsoundbank.com/licenses.html ("Royalty-Free Sound License (CC0-like)"), read 2026-11-18.
- Licence: CC0 1.0 Universal / WTFPL / public domain. The page reads: "You are allowed to: Share, copy, distribute and communicate the material by all means and in all formats. Adapt, remix, transform and create from material. Use, including for commercial purposes. Without any restrictions. Without asking permission." and "This is: Creative Commons CC0 1.0 Universal. WTFPL license ... Public Domain Dedication." Each sound's page also carries "CC0 (public domain): Free and royalty-free". Credit is welcome but "Nothing is mandatory": "Additional sounds: Joseph SARDIN - BigSoundBank.com".
- Used: only sounds in the "Free and royalty-free" set, fetched as `https://bigsoundbank.com/UPLOAD/mp3/<number>.mp3` (the MP3 the site serves for each sound number; the `original` field gives the number). Long recordings were cut to the part used (a click, a pop, a 2.6 s typing burst, a 16 s ambience window).
- Four sounds (s2212, s1290, s0480, s0097) answered 403 to the same download and were not used.

### Looked at and not used
- maximilianfeix/plinkfx (commit `7e5f6a477037679a29df9c5141e9853b1267e7d8`): CC0 sounds ("The sounds in plinkfx are dedicated to the public domain under CC0 1.0 Universal ... and every audio file rendered from them", `LICENSE-SOUNDS`), but the repository ships recipes in TypeScript and no audio files; rendering them needs its own build and running its code. Nothing was taken from it in this batch.

### Music beds (library/sounds/music/), 6 files
- Source: the Internet Archive items of Komiku and Loyalty Freak Music (the same artist, Monplaisir: the item descriptions link `chezmonplaisir.bandcamp.com` and `loyaltyfreakmusic.com`), fetched 2026-11-18 from `https://archive.org/download/<item>/<file>`.
- Licence: each item's metadata field `licenseurl` reads `http://creativecommons.org/publicdomain/zero/1.0/` (CC0 1.0 Universal; the Cliff Road Chill item reads the same with `https`), read from `https://archive.org/metadata/<item>` on 2026-11-18. The `creator` field reads "Loyalty Freak Music" (three items, once as "Loyalty freak music") or "Komiku" (two items). This is the uploader's licence declaration on the Archive; it was not cross-checked on the artist's own site.
- Used (title, item, what was kept of the original; every bed was cut on a bar start, given a 2 s fade-out, and levelled to -1 dBFS peak):
  - `calm-lofi-01`: "Lack of Color - I'm glad you are here with me", https://archive.org/details/loyalty-freak-music-lofi-ambient-songs , 15.44 to 66.885 s of 126.857 s.
  - `minimal-pulse-01`: "One Cool Minute", https://archive.org/details/MINIMALAMBIENTBOUNCE , 15.507 to 63.508 s of 193.0 s.
  - `driving-electro-01`: "I'M ON FIRE", https://archive.org/details/LoyaltyFreakMusic-ROLLERDISCODANCEDANCE , 13.433 to 67.126 s of 184.687 s.
  - `build-and-drop-01`: "Pop City" (Helice Awesome Dance Adventure !!), https://archive.org/details/Komiku-HeliceAwesomeDanceAdventure , 24.905 to 68.11 s of 96.0 s.
  - `upbeat-groove-01`: "Everything is groovy (How to move your body)", same item, 36.004 to 84.004 s of 116.0 s.
  - `playful-chiptune-01`: "Cliff Road Chill", https://archive.org/details/komiku-cliff-road-chill , 16.008 to 64.011 s of 88.0 s.
- No vocals: each original was checked with `earshot match` for "singing vocals" (no match on all six). Not an exhaustive listen.
- The other HoliznaCC0 items on the Archive that carry a CC0 `licenseurl` are long meditation and ambient pieces with no beat, so none was used. The HoliznaCC0 items with a beat have no `licenseurl` on the Archive (or are CC BY-ND / BY-NC-ND), so none was used.
