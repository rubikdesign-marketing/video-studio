#!/bin/bash
# Kept so existing callers still work. The renderer is tools/film/render.mjs (macOS, Linux and Windows):
#   node tools/film/render.mjs <job_dir> preview | master [--no-captions] | scene <id> [--splice]
exec node "$(dirname "$0")/render.mjs" "$@"
