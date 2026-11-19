# 05 · Creative library — handoff

**Status:** Done. Committed on `creative-library-05` (670d84d, plus the decisions commit). Not pushed. Dispatch cap reached (5/5).

**Refs:** `projects/tulvo/video-studio-05` from `47480ad`. Shipped `damex-video-engine` @ `a644abd`.

**Decisions (2026-11-19, lead, delegated by owner):**
- Take-5 material: Tulvo's own organic channels only; paid ads need the owner's yes; bundling never. Basis: Kestrel Studio `safe_to_show`, take-5 privacy_flags [].
- Offer: "Try it today" (no pricing claim).

**Samples (lead-verified):**
- `jobs/2026-11-19-ugc-01/out/2026-11-19-ugc-01.mp4`: 1080x1920, 30 fps, 16 s, bt709, -14.07 LUFS / -1.75 dBTP (master.sh), sync ≤ 0.11 frame, no flashes, 13 s cut fixed.
- `jobs/2026-11-19-product-motion-02/out/…mp4`: 4.1 s, bt709, -14.02 LUFS.

**Finding for Prompt 02:** the engine's webpack cache (`engine/node_modules/.cache/webpack`) served stale scene code after a `.tsx` edit, and the render showed the old CTA. Fixed by moving the cache aside. Render paths should bust or disable that cache.

**Open:** Prompt 04 manifest excludes for `library/fixtures` and `.damex`; paid-ad use; office ambience with voices; no listening pass; skin tested on synthetic patches only.

**Usage:** 98% weekly; hidden usage unavailable. No paid work or downloads.

**Next command:** owner reviews the ugc-01 export.
