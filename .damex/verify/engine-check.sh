#!/bin/bash
# Conductor on a real engine job, with scripted stand-in workers (no model calls, no usage).
# Usage: engine-check.sh <studio root>   Works on a copy of jobs/2026-11-18-halden-launch; the real job is untouched.
set -u
ROOT="$1"; cd "$ROOT"
T=$(mktemp -d "${TMPDIR:-/tmp}/conductor-engine.XXXXXX") || exit 1
[ -n "$T" ] && [ -d "$T" ] || { echo "no temp folder"; exit 1; }
J="$T/jobs/halden-launch"; mkdir -p "$T/jobs" && cp -R jobs/2026-11-18-halden-launch "$J" || { echo "copy failed"; exit 1; }
SC=engine/src/jobs/2026-11-18-halden-launch/scenes
export CONDUCTOR_SETTINGS_FILES=""
step() { echo; echo "## $1"; }
run() { echo "\$ ${*/#$ROOT\//}" | sed "s#$T/#<tmp>/#g"; "$@" 2>&1 | sed "s#$T/#<tmp>/#g"; echo "  -> exit ${PIPESTATUS[0]}"; }
G="node tools/conductor/gate.mjs"; D="node tools/conductor/dispatch.mjs"; R="node tools/conductor/route.mjs"
claim() { local task=$1 writes=$2; shift 2; run $D claim "$J" --stage animation --task "$task" --worker scene-builder --model sonnet --writes "$writes" "$@"; }

step "1. Routing: who does what"
for t in scene_code render critique lookup idea_and_direction; do run $R "$t"; done

step "2. Fresh session on the real job: resume reads its gates"
run $D resume "$J"

step "3. Approvals recorded against the job's real files"
run $G approve "$J" idea --inputs brief.json
run $G approve "$J" script_and_voice --inputs audio
run $G approve "$J" moodboard --inputs jobs/halden-launch/brief.json
run $G approve "$J" storyboard --inputs shots.json,storyboard
run $G status "$J"

step "4. Changing an approved file makes that approval stale"
cp "$J/shots.json" "$T/shots.bak"; echo " " >> "$J/shots.json"
run $G check "$J" storyboard
cp "$T/shots.bak" "$J/shots.json"; run $G check "$J" storyboard

step "5. Two scene-builders on disjoint scene files; a third is refused"
claim s01 $SC/S01.tsx
claim s02 $SC/S02.tsx
claim s03 $SC/S03.tsx

step "6. A helper may not write a file another active helper holds"
run $D release "$J" c2 --status done --tokens 38000
claim scenes-all $SC

step "7. Bounded retries"
claim s03 $SC/S03.tsx
run $D release "$J" c3 --status failed
claim s03 $SC/S03.tsx
run $D release "$J" c4 --status failed
claim s03 $SC/S03.tsx

step "8. A model the settings do not allow is refused, never swapped"
S="$T/settings.json"; echo '{"availableModels":["sonnet","haiku"]}' > "$S"
CONDUCTOR_SETTINGS_FILES="$S" run $D claim "$J" --stage animation --task s04 --worker scene-builder --model opus --writes $SC/S04.tsx

step "9. Paid work needs a recorded approval"
run $D claim "$J" --stage animation --task kling-bg --worker capture-runner --model sonnet --writes jobs/halden-launch/gen --paid

step "10. Interrupted helper: the session dies with S04 claimed; a restart keeps its work"
run $D release "$J" c1 --status done --tokens 41000
claim s04 $SC/S04.tsx
run $D resume "$J"

step "11. What each stage and model used"
run $D usage "$J"
rm -rf "$T"
