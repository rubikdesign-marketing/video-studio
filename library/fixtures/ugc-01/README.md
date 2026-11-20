# ugc-01: Kestrel board in one take

A 16 s, 9:16, phone-first product slice with a UGC feel, built only from the studio's own capture of Tulvo's demo workspace (Kestrel Studio) and the studio's own CC0 and synthesised sound kit. No third-party clip, no ViralHooks clip, no person on screen. The full spec is `card.json`; this is the short card. Status: defined, not built.

## Transferable traits

1. **Show first, say little.** The hook is the product screen already in frame (a lead pipeline), with one line of seven words or fewer. The viewer needs no setup.
2. **One continuous, pointer-led path.** Lead pipeline, click to the campaign board, hover on New. The camera follows the pointer; there is no cut away from the product.
3. **Captions do the talking.** Captions sit in the bottom band (82% to 93% of frame height). The slice must work with no voice at all.
4. **Proof is what is on screen.** The proof beat holds a real board and names only what is visible: no numbers, no result claims.
5. **Room tone, not silence.** A quiet room bed under everything, with effects only where the screen does something.

## Allowed use

- Private study and drafts inside the studio: yes (`privateStudy: true`, from the studio's own capture).
- A published film, an ad, or shipping the stills in a bundle: not yet. `publicUse` and `bundling` are `null` until the owner records a yes.
- Organic only. Never mix in ViralHooks clips or anything from `library/references/`.
- Voice-over: none until `pending: paid TTS approval` or `pending: owner recording` is resolved.

## Open questions (owner)

1. May the Kestrel Studio stills be used in a public film, and shipped in a bundle? Are the demo client names on screen (for example Ferro Bike Works) fictional?
2. Is the `take-5` recording (60 fps, 3840x2160, 12.867 s) still on a Mac? It is not in the repo. Without it the slice is animated stills.
3. Voice: approve one paid TTS line, or record one yourself?
4. Is "Try it free" the approved offer wording for this slice?
5. Should the build gate be -1 dBTP as the card says (`tools/audio/master.sh` only fails above -0.5)?
