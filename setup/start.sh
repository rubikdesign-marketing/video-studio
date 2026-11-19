#!/usr/bin/env bash
# Opens Claude Code with the video menu as the first thing you see.
#   setup/start.sh                 starts:  claude "/video-menu"
#   setup/start.sh <extra args>    passes them on to claude
#   setup/start.sh --print-command prints the command instead of running it
set -euo pipefail
cd "$(dirname "$0")/.."

if [ "${1:-}" = "--print-command" ]; then
  shift
  printf 'claude "/video-menu"'
  for a in "$@"; do printf ' %q' "$a"; done
  printf '\n'
  exit 0
fi

exec claude "/video-menu" "$@"
