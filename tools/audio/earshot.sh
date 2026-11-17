#!/bin/bash
# Runs any earshot command with the studio's settings: its models in tools/audio/.earshot/, offline, telemetry off,
# caches where Claude's command sandbox can write. Use it wherever the earshot skill says "earshot ...":
#
#   bash tools/audio/earshot.sh match candidate.wav "a soft paper whoosh"
#   bash tools/audio/earshot.sh rank candidates/ "a soft paper whoosh"
#   bash tools/audio/earshot.sh ab before.wav after.wav
#   bash tools/audio/earshot.sh realness stems/
#
# For a whole film or mix, tools/audio/listen.mjs runs measure, timeline, sheet and critique in one go with the
# job's cues. Never run `earshot llm` (it uploads audio to Gemini) without the owner's yes.
set -euo pipefail
STUDIO="$(cd "$(dirname "$0")/../.." && pwd)"
export EARSHOT_HOME="$STUDIO/tools/audio/.earshot" EARSHOT_OFFLINE=1 HF_HUB_OFFLINE=1 HF_HUB_DISABLE_TELEMETRY=1 \
  TOKENIZERS_PARALLELISM=false NUMBA_CACHE_DIR="$STUDIO/tools/audio/.earshot/numba" MPLCONFIGDIR="$STUDIO/tools/audio/.earshot/matplotlib"
BIN="$(command -v earshot || echo "$HOME/.local/bin/earshot")"
[ -x "$BIN" ] || { echo "earshot is not installed. Run: bash setup/install.sh"; exit 2; }
if [ "${1:-}" = "llm" ]; then echo "earshot llm uploads audio to Gemini: ask the owner first, then run it by hand."; exit 2; fi
exec "$BIN" "$@"
