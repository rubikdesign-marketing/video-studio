#!/bin/bash
# Kept so existing callers still work. The tool is tools/audio/earshot.mjs:
#   node tools/audio/earshot.mjs match|rank|ab|realness ...
exec node "$(dirname "$0")/earshot.mjs" "$@"
