#!/bin/bash
# Master a rendered film's sound to the delivery level, and make a light preview.
#   master.sh <rendered.mp4> <out_base>      -> <out_base>.mp4 and <out_base>-preview-720p.mp4
# Two-pass loudness normalisation to -14 LUFS with peaks under -1 dBTP. The picture is copied untouched.
# It measures the result and fails loudly if the output is missing or off target. The new master is written beside the
# old one and replaces it only once it has passed; the old one moves to versions/ (the last 3 are kept).
# The review copy fits the film's shape at 720p: 1280x720 landscape, 720x1280 portrait, 720x720 square, never enlarged.
set -euo pipefail
IN="${1:?rendered film}"; OUT="${2:?output name without extension}"
# shellcheck source=../film/lib/safe.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../film/lib/safe.sh"
NEW="$(dirname "$OUT")/.$(basename "$OUT").partial-$$.mp4"; NEWP="$(dirname "$OUT")/.$(basename "$OUT")-preview.partial-$$.mp4"
trap 'rm -f "$NEW" "$NEWP"' EXIT
FF="${FFMPEG:-/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg}"; [ -x "$FF" ] || FF=ffmpeg
TARGET=-14; PEAK=-1; RANGE=11
# The limiter works on sample peaks; the AAC encode and the peaks between samples add a little on top, so it sits
# 0.5 dB under the true-peak ceiling (0.84 = -1.5 dBFS). At 0.89 (-1.0 dBFS) a film came out at -0.92 dBTP.
LIMIT=0.84
mkdir -p "$(dirname "$OUT")"

measure() {  # prints the loudnorm JSON for a file
  "$FF" -hide_banner -nostats -i "$1" -af "loudnorm=I=$TARGET:TP=$PEAK:LRA=$RANGE:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p'
}
field() { python3 -c "import sys,json; print(json.load(sys.stdin)['$1'])"; }

J=$(measure "$IN")
[ -n "$J" ] || { echo "Could not measure the sound of $IN. Does it have an audio track?"; exit 1; }
mi=$(echo "$J" | field input_i); mtp=$(echo "$J" | field input_tp); mlra=$(echo "$J" | field input_lra)
mth=$(echo "$J" | field input_thresh); off=$(echo "$J" | field target_offset)
echo "before: $mi LUFS, peak $mtp dBTP"

"$FF" -v error -y -i "$IN" -c:v copy \
  -af "loudnorm=I=$TARGET:TP=$PEAK:LRA=$RANGE:measured_I=$mi:measured_TP=$mtp:measured_LRA=$mlra:measured_thresh=$mth:offset=$off:linear=true,alimiter=limit=$LIMIT:attack=2:release=60:level=false,aresample=48000" \
  -c:a aac -b:a 320k -movflags +faststart "$NEW"
[ -s "$NEW" ] || { echo "The mastered file was not written. The previous master is unchanged."; exit 1; }

J2=$(measure "$NEW"); oi=$(echo "$J2" | field input_i); otp=$(echo "$J2" | field input_tp)
echo "after:  $oi LUFS, peak $otp dBTP"
python3 - "$oi" "$otp" <<'PY'
import sys
i, tp = float(sys.argv[1]), float(sys.argv[2])
bad = []
if abs(i - (-14)) > 1.0: bad.append(f"loudness {i} LUFS is more than 1 away from -14")
if tp > -1.0: bad.append(f"peak {tp} dBTP is above the -1 dBTP ceiling")
if bad:
    print("OFF TARGET: " + "; ".join(bad) + ". The previous master is unchanged."); sys.exit(1)
print("on target")
PY

din=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN"); dout=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$NEW")
python3 -c "import sys; a,b=float('$din'),float('$dout'); sys.exit(0 if abs(a-b)<0.1 else print(f'Length changed: {a:.2f} s -> {b:.2f} s') or 1)"

replace_keeping "$NEW" "$OUT.mp4"

read -r W H < <(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "$OUT.mp4" | tr x ' ')
if [ "$W" -gt "$H" ]; then BOX="1280:720"; elif [ "$H" -gt "$W" ]; then BOX="720:1280"; else BOX="720:720"; fi
BW="${BOX%:*}"; BH="${BOX#*:}"
"$FF" -v error -y -i "$OUT.mp4" -vf "scale='min($BW,iw)':'min($BH,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2" \
  -c:v libx264 -crf 24 -preset medium -c:a aac -b:a 160k -movflags +faststart "$NEWP"
[ -s "$NEWP" ] || { echo "The preview was not written."; exit 1; }
replace_keeping "$NEWP" "$OUT-preview-720p.mp4" 0
echo "wrote $OUT.mp4 and $OUT-preview-720p.mp4"
