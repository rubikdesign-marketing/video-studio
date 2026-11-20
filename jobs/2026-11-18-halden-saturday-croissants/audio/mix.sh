#!/bin/bash
# The example's sound: CC0 sounds from library/sounds (credits in library/sounds/CREDITS.md), placed on the shots' cues
# from engine/src/jobs/2026-11-18-halden-launch/film.json. Writes audio/mix.wav; tools/audio/master.sh levels it.
set -euo pipefail
cd "$(dirname "$0")"; L=../../../library/sounds
ffmpeg -v error -y \
  -i $L/ambience/room-house-01.mp3 \
  -i $L/click/micro-tick-01.mp3 \
  -i $L/foley/book-flip-01.mp3 \
  -i $L/chime/small-bell-01.mp3 \
  -i $L/chime/sting-warm-synth-01.mp3 \
  -filter_complex "\
[0]atrim=0:12,afade=t=in:d=0.6,afade=t=out:st=11:d=1,volume=0.35[a];\
[1]adelay=3050|3050,volume=0.9[b];\
[2]adelay=7000|7000,volume=0.5[c];\
[3]adelay=8450|8450,volume=0.45[d];\
[4]adelay=10200|10200,volume=0.6[e];\
[a][b][c][d][e]amix=inputs=5:normalize=0,atrim=0:12,aresample=48000[out]" \
  -map "[out]" -ac 2 mix.wav
echo "wrote audio/mix.wav"
