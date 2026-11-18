#!/bin/bash
# Copies the proof film's sounds into the engine's public folder (kept out of git, like every job's media), cut and
# named as engine/src/library/motion/proof/LibraryProof.tsx asks for them. Run from the studio folder before a render:
#   bash jobs/2026-11-18-library-proof/prepare.sh [extra public folder, e.g. engine/out/lib-public]
set -euo pipefail
cd "$(dirname "$0")/../.."
L=library/sounds; B=brands/tulvo/sounds
for DEST in engine/public/jobs/library-proof ${1:+"$1/jobs/library-proof"}; do
  mkdir -p "$DEST"
  # The bed from its first beat (0.251 s in, beats.py), so the film's cuts land on the beat grid.
  ffmpeg -y -loglevel error -ss 0.251 -i $L/music/minimal-pulse-01.mp3 -t 16 -c:a libmp3lame -q:a 2 "$DEST/bed.mp3"
  ffmpeg -y -loglevel error -i $L/foley/keyboard-burst-01.mp3 -t 1.0 -af afade=t=out:st=0.85:d=0.15 "$DEST/typing.mp3"
  ffmpeg -y -loglevel error -i $L/foley/keyboard-burst-02.mp3 -t 0.9 -af afade=t=out:st=0.75:d=0.15 "$DEST/retyping.mp3"
  cp $L/impact/punch-03.mp3 "$DEST/impact-hard.mp3"
  cp $L/impact/thud-01.mp3 "$DEST/impact-soft.mp3"
  cp $L/swish/whip-01.mp3 "$DEST/whip.mp3"
  cp $L/swish/paper-soft-01.mp3 "$DEST/text-swish.mp3"
  cp $L/swish/paper-soft-02.mp3 "$DEST/highlight-swish.mp3"
  cp $L/swish/quick-hand-01.mp3 "$DEST/swish-fast.mp3"
  cp $L/whoosh/air-soft-02.mp3 "$DEST/iris-whoosh.mp3"
  cp $L/riser/smooth-swell-01.mp3 "$DEST/riser-into-logo.mp3"
  cp $L/chime/sting-warm-synth-01.mp3 "$DEST/logo-sting.mp3"
  cp $L/pop/pluck-soft-01.mp3 "$DEST/word-pop.mp3"
  # The old way: the brand's own kit only.
  for s in small-whoosh large-whoosh toast-pop success-chime logo-sting; do cp "$B/$s.mp3" "$DEST/brand-$s.mp3"; done
done
echo "Sounds ready."
