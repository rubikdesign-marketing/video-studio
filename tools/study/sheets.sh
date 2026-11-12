#!/bin/bash
# Contact sheets for studying a video.
#
#   sheets.sh overview <video> <out_dir> [frames_per_second=2] [cols=6] [rows=4]
#       The whole film as numbered sheets, each frame stamped with its time.
#   sheets.sh window <video> <out.jpg> <start_s> <end_s> [cols=6]
#       Every frame between two times on one sheet: use it on a transition.
#
# Needs an ffmpeg with drawtext (Homebrew "ffmpeg-full"). Set FFMPEG to override.
set -euo pipefail
FF="${FFMPEG:-/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg}"; [ -x "$FF" ] || FF=ffmpeg
STAMP="drawtext=text='%{pts\:hms}':x=6:y=6:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=4"
mode="${1:?overview|window}"; video="${2:?video}"

case "$mode" in
  overview)
    out="${3:?out_dir}"; fps="${4:-2}"; cols="${5:-6}"; rows="${6:-4}"
    mkdir -p "$out"
    "$FF" -v error -y -i "$video" -an -vf "fps=$fps,scale=400:-2,$STAMP,tile=${cols}x${rows}:padding=4:color=white" \
      -q:v 4 "$out/sheet_%02d.jpg"
    ls "$out"/sheet_*.jpg | wc -l | xargs echo "sheets written:"
    ;;
  window)
    out="${3:?out.jpg}"; a="${4:?start}"; b="${5:?end}"; cols="${6:-6}"
    fps=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$video")
    n=$(python3 -c "import math;a,b=$a,$b;f=$fps;print(max(1,math.ceil((b-a)*f)))")
    rows=$(python3 -c "import math;print(math.ceil($n/$cols))")
    mkdir -p "$(dirname "$out")"
    "$FF" -v error -y -ss "$a" -t "$(python3 -c "print($b-$a)")" -i "$video" -an \
      -vf "scale=400:-2,$STAMP,tile=${cols}x${rows}:padding=4:color=white" -frames:v 1 -q:v 4 "$out"
    echo "$out ($n frames, starts at ${a}s)"
    ;;
  *) echo "unknown mode $mode"; exit 1;;
esac
