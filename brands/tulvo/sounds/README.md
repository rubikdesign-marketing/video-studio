# Tulvo sound kit

Made on 12 Nov 2026 with the team's ElevenLabs plan (sound effects), from the prompts below, then levelled so every sound peaks at about -3 dB (the mix sets the final level against the voice). The engine places them from a capture's event log (`tools/audio/capture_sounds.mjs`, slot names in `engine/src/kit/capture/sound.ts`); `logo-sting` is the closing logo sound (owner's decision, 11 Nov).

**Nobody has listened to these yet.** Listen to each before the first real film. `drag-lift` was very quiet as made and was raised by about 22 dB, so check it for hiss. `crisp-click` was remade once: the first take was silent.

| Slot | Length | Prompt it was made from |
|---|---|---|
| `soft-click` | 0.5 s | a single soft, muted mouse click on a laptop trackpad for a calm software app, clean, close, no reverb, no echo |
| `crisp-click` | 0.5 s | a single clearly audible, crisp plastic button click, like pressing a modern mouse button, sharp transient, clean, close microphone, no reverb |
| `soft-keyboard` | 1.5 s | soft laptop keyboard typing, six gentle keystrokes at a calm pace, quiet and clean, no room echo |
| `crisp-keyboard` | 1.5 s | crisp low-profile keyboard typing, a quick burst of eight keystrokes, clean and close, no room echo |
| `small-whoosh` | 0.6 s | a short, subtle, airy whoosh for a smooth on-screen transition in a software video, soft, no hiss |
| `large-whoosh` | 1.2 s | a smooth, deep, cinematic air whoosh for a scene change in a premium product video, clean tail, no rumble |
| `success-chime` | 1.0 s | a warm, gentle two-note success chime for a modern software app, soft glassy bell, short and calm, not cheesy |
| `toast-pop` | 0.5 s | a soft, rounded notification pop for a modern web app, subtle and friendly, very short |
| `drag-lift` | 0.5 s | a very subtle soft lift sound as a card is picked up on screen, light air and a faint paper touch, clean |
| `drag-drop` | 0.5 s | a soft, satisfying muted thud as a card drops neatly into place in a software app, clean, no echo |
| `logo-sting` | 2.2 s | a short modern logo sting for a calm, premium software brand: a soft rising shimmer that resolves into one warm, clean, confident tone, airy, no voice, no drums |

To remake one: edit its prompt in `jobs/_tulvo-sound-kit/audio/sfx.json`, delete its file in `jobs/_tulvo-sound-kit/audio/sfx/`, run `node tools/audio/sound.mjs sfx jobs/_tulvo-sound-kit` (a paid call: ask the owner first), level it to about -3 dB peak, and copy it here with the same name.
