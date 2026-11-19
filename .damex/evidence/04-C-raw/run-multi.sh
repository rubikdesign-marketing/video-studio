#!/bin/bash
# usage: run-multi.sh <copy dir name>  e.g. old, new, new-r2. Copies whose name starts with "new" get the
# project settings explicitly (stands in for a trusted workspace).
S=/private/tmp/claude-501/damex-verify
cd "$S/$1"
BRIEF='A 30 second 16:9 promo for the demo brand announcing a new feature: saved replies for the support inbox. Five scenes. Voice-over in the brand voice. Take it through the idea and the script: treat your recommended idea as approved by me, then write the script and the scene list. Do not generate or play any audio. Stop at the script approval.'
EXTRA=(); [[ "$1" == new* ]] && EXTRA=(--settings .claude/settings.json)
start=$(date +%s)
claude -p "$BRIEF" --model sonnet --output-format json --max-budget-usd 3 --permission-mode acceptEdits "${EXTRA[@]}" > $S/multi-$1.json 2> $S/multi-$1.err
echo "exit=$? wall=$(( $(date +%s) - start ))s" > $S/multi-$1.status
