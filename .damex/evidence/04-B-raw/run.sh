#!/bin/bash
# usage: run.sh <old|new>
cd "$(dirname "$0")/$1"
BRIEF='A 12 second vertical reel for the demo brand announcing that orders now ship the same day. No voice, library music only, ends on the logo. Take it as far as the first approval and stop there.'
start=$(date +%s)
claude -p "$BRIEF" --model sonnet --output-format json --max-budget-usd 1.50 --permission-mode acceptEdits > ../$1.json 2> ../$1.err
echo "exit=$? wall=$(( $(date +%s) - start ))s" > ../$1.status
