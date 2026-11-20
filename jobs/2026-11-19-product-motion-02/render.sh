#!/bin/bash
# Renders this job. Run build.mjs first (it grades the stills once and scaffolds). Chrome must run unsandboxed on this Mac.
#   render.sh preview   half size (540x960), lower quality     -> out/preview.mp4
#   render.sh export    1080x1920, 30 fps, full quality        -> out/raw.mp4, then tools/audio/master.sh -> out/2026-11-19-product-motion-02.mp4
# Both read the SAME graded recording (engine/public/jobs/product-motion-02/capture/take-5/recording.mp4), which build.mjs graded once from edit/grade.json.
# Not render.sh of tools/film: that would scaffold again at 60 fps. Logs: out/<mode>.log. Nothing here uses the network or a key.
set -euo pipefail
JOB="$(cd "$(dirname "$0")" && pwd)"; STUDIO="$(cd "$JOB/../.." && pwd)"; OUT="$JOB/out"; mkdir -p "$OUT"
# A headless Chrome already on this Mac (Remotion would otherwise download one): override with CHROME=...
CHROME="${CHROME:-$STUDIO/engine/node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell}"
# (this worktree has none: no network to download one, so the main checkout's copy is used read-only)
[ -x "$CHROME" ] || CHROME="$STUDIO/../video-studio/engine/node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell"
[ -x "$CHROME" ] || CHROME=""
BROWSER=(); [ -z "$CHROME" ] || BROWSER=(--browser-executable="$CHROME")
cd "$STUDIO/engine"
case "${1:-}" in
  preview) npx remotion render src/jobs/product-motion-02/entry.tsx product-motion-02 "$OUT/preview.mp4" --scale 0.5 --crf 28 --jpeg-quality 70 --color-space=bt709 "${BROWSER[@]}" 2>&1 | grep -v "trust settings" | tee "$OUT/preview.log" | tail -4 ;;
  export)  npx remotion render src/jobs/product-motion-02/entry.tsx product-motion-02 "$OUT/raw.mp4" --crf 16 --jpeg-quality 95 --audio-bitrate 320k --color-space=bt709 "${BROWSER[@]}" 2>&1 | grep -v "trust settings" | tee "$OUT/export.log" | tail -4
           bash "$STUDIO/tools/audio/master.sh" "$OUT/raw.mp4" "$OUT/2026-11-19-product-motion-02" 2>&1 | tee "$OUT/master.log" ;;
  *) echo "usage: render.sh preview|export"; exit 2 ;;
esac
