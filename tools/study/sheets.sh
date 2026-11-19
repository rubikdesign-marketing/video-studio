#!/bin/bash
# Kept so existing callers still work. The tool is tools/study/sheets.mjs:
#   node tools/study/sheets.mjs overview <video> <out_dir> [fps] [cols] [rows]
#   node tools/study/sheets.mjs window <video> <out.jpg> <start_s> <end_s> [cols]
exec node "$(dirname "$0")/sheets.mjs" "$@"
