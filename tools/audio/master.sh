#!/bin/bash
# Kept so existing callers still work. The mastering tool is tools/audio/master.mjs:
#   node tools/audio/master.mjs <rendered.mp4> <out_base>
exec node "$(dirname "$0")/master.mjs" "$@"
