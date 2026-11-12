#!/usr/bin/env bash
# Side-by-side + difference image of a rebuilt still vs a live screenshot.
#
#   src/products/tulvo/tools/compare.sh <still.png> <screenshot.jpg> <out.png>
#
# Writes:
#   <out.png>            side by side: rebuilt (left) | live (right), same size
#   <out>-diff.png       |rebuilt - live| per pixel, gain x4 (black = identical)
#   <out>-blend.png      50/50 overlay (ghosting shows misalignment)
# Both inputs are scaled to the still's size (lanczos) unless SIZE=WxH is given.
# Env:
#   CROP=w:h:x:y   compare only this region (in the common size), e.g. CROP=250:805:0:0 (sidebar)
#   SIZE=WxH       common size (default: the still's size)
#   GAIN=4         difference amplification
set -euo pipefail
if [ "$#" -ne 3 ]; then
  sed -n '2,15p' "$0"; exit 1
fi
STILL="$1"; SHOT="$2"; OUT="$3"
GAIN="${GAIN:-4}"
if [ -z "${SIZE:-}" ]; then
  SIZE="$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$STILL")"
fi
W="${SIZE%x*}"; H="${SIZE#*x}"
CROPF=""
[ -n "${CROP:-}" ] && CROPF=",crop=${CROP}"
BASE="${OUT%.*}"
mkdir -p "$(dirname "$OUT")"

prep="[0:v]scale=${W}:${H}:flags=lanczos,format=rgb24${CROPF}[a];[1:v]scale=${W}:${H}:flags=lanczos,format=rgb24${CROPF}[b]"

ffmpeg -v error -y -i "$STILL" -i "$SHOT" -filter_complex "${prep};[a][b]hstack=inputs=2" -frames:v 1 "$OUT"
ffmpeg -v error -y -i "$STILL" -i "$SHOT" -filter_complex \
  "${prep};[a][b]blend=all_mode=difference,lutrgb=r='min(val*${GAIN},255)':g='min(val*${GAIN},255)':b='min(val*${GAIN},255)'" \
  -frames:v 1 "${BASE}-diff.png"
ffmpeg -v error -y -i "$STILL" -i "$SHOT" -filter_complex "${prep};[a][b]blend=all_mode=average" -frames:v 1 "${BASE}-blend.png"

# mean absolute difference (0 = identical, 255 = inverted), on the compared region
MAD="$(ffmpeg -v error -i "$STILL" -i "$SHOT" -filter_complex "${prep};[a][b]blend=all_mode=difference,format=gray,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" -frames:v 1 -f null - 2>/dev/null | grep -o 'YAVG=[0-9.]*' | head -1 | cut -d= -f2)"
echo "compare: $OUT  (+ -diff, -blend)  mean |diff| = ${MAD:-?} / 255"
