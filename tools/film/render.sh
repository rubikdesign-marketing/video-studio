#!/bin/bash
# Render a job's film, or one scene of it.
#
#   render.sh <job_dir> preview                   whole film, half size, lower quality  -> out/preview.mp4
#   render.sh <job_dir> master [--no-captions]    whole film, full quality              -> out/raw.mp4, then
#                                                 tools/audio/master.sh                 -> out/<job>.mp4 + 720p preview
#   render.sh <job_dir> scene <id>                one scene, full quality (id like S02) -> out/scenes/<id>.mp4
#   render.sh <job_dir> scene <id> --splice       one scene at preview quality, swapped into out/preview.mp4
#
# --no-captions renders the version without captions; the master then goes to out/<job>-no-captions.mp4.
# --splice is for review rounds: after a change to one scene, only that scene is rendered again and put back into
#   the preview in its place. The scenes around it and the sound are not touched. It needs a preview made by this
#   tool after the last change to the voice or the shot list, and it stops if another render is running.
# Each run first refreshes the film skeleton (tools/film/scaffold.mjs), so times always match the voice.
# Only one render runs at a time: a second one waits, because two bundles at once crash the bundler. A lock left by a
#   render that was killed is cleared on its own.
# The last good file is never lost: each render is written beside its destination, checked (a picture, the right number
#   of frames), and only then put in place; the file it replaces moves to versions/ beside it (the last 3 are kept).
# Every run is timed into the job's runs.jsonl (tools/film/costs.mjs reads it).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STUDIO="$(cd "$HERE/../.." && pwd)"
# shellcheck source=lib/safe.sh
source "$HERE/lib/safe.sh"
usage() { sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

[ $# -gt 0 ] || usage
[ -d "$1" ] || { echo "Not a job folder: $1"; exit 1; }
JOB="$(cd "$1" && pwd)"; MODE="${2:-}"; shift; shift || true
SCENE=""; SUFFIX=""; SPLICE=""; PROPS=()
for arg in "$@"; do
  case "$arg" in
    --no-captions) SUFFIX="-no-captions"; PROPS=(--props '{"captions":false}') ;;
    --splice) SPLICE=1 ;;
    -*) echo "Unknown option: $arg"; usage 2 ;;
    *) SCENE="$arg" ;;
  esac
done
case "$MODE" in
  preview|master) ;;
  scene) [ -n "$SCENE" ] || { echo "Which scene? For example: render.sh $JOB scene S02"; exit 2; } ;;
  *) usage 2 ;;
esac
[ -z "$SPLICE" ] || [ "$MODE" = scene ] || { echo "--splice only works with one scene, for example: render.sh $JOB scene S02 --splice"; exit 2; }

NAME="$(basename "$JOB")"
SLUG="$(node "$HERE/scaffold.mjs" --slug "$JOB")"
OUT="$JOB/out"
FILM_JSON="$STUDIO/engine/src/jobs/$SLUG/film.json"
PREVIEW="$OUT/preview$SUFFIX.mp4"
PREVIEW_FROM="$OUT/preview$SUFFIX.film.json"   # the film.json the preview was rendered from, so a splice can check it
PREVIEW_LOOK=(--scale 0.5 --crf 28 --jpeg-quality 70)

if [ -n "$SPLICE" ] && [ ! -s "$PREVIEW" ]; then
  echo "There is no preview to put the scene into yet ($PREVIEW). Render the whole preview first: render.sh $JOB preview"
  exit 1
fi

# One render at a time, shared by every render tool (tools/film/storyboard.mjs uses the same lock). The lock is a
# folder (making one either works or fails, never half) holding our process id.
LOCK="$STUDIO/engine/out/.render.lock"
if [ -n "$SPLICE" ]; then
  if ! NO_WAIT=1 take_render_lock "$LOCK" "render.sh scene $SCENE --splice" "$NAME"; then
    echo "Another render is running (process $(cat "$LOCK/pid" 2>/dev/null || echo unknown)), so the scene was not swapped in. Try again when it has finished."
    exit 1
  fi
else
  take_render_lock "$LOCK" "render.sh $MODE${SCENE:+ $SCENE}" "$NAME"
fi
WORK=""; PARTIAL=""; STARTED=$(date +%s); RESULT="failed"
finish() {
  # The lock is removed only if it is still ours (another render may have cleared and retaken a lock it judged stale).
  [ "$(cat "$LOCK/pid" 2>/dev/null)" = "$$" ] && rm -rf "$LOCK"
  rm -rf ${WORK:+"$WORK"} ${PARTIAL:+"$PARTIAL"}
  node "$HERE/lib/runlog.mjs" add "$JOB" tool=render mode="$MODE" scene="$SCENE" splice="${SPLICE:-}" captions="${SUFFIX:+off}" \
    seconds="$(( $(date +%s) - STARTED ))" ok="$([ "$RESULT" = ok ] && echo true || echo false)" 2>/dev/null || true
}
trap finish EXIT

node "$HERE/scaffold.mjs" "$JOB"
echo

# render <composition> <output file> <expected frames> [remotion options]: renders beside the output, checks the
# picture and its length in frames, then puts it in place, keeping the file it replaces in versions/.
render() {
  local composition="$1" file="$2" want="$3"; shift 3
  mkdir -p "$(dirname "$file")"
  PARTIAL="$(dirname "$file")/.$(basename "${file%.*}").partial-$$.mp4"; rm -f "$PARTIAL"
  (cd "$STUDIO/engine" && npx remotion render "$composition" "$PARTIAL" ${PROPS[@]+"${PROPS[@]}"} "$@")
  check_video "$PARTIAL" "$want" || { echo "Nothing was replaced: the previous $(basename "$file") is unchanged."; exit 1; }
  replace_keeping "$PARTIAL" "$file"; PARTIAL=""
  echo "wrote $file: $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$file") s"
}
FULL=(--crf 16 --jpeg-quality 95 --audio-bitrate 320k)

# film <what>: reads film.json. "total" = the film's frame count; "starts" = the first frame of every scene but the first; "scene" = the scene's first
# frame, the frame after its last, and the film's frame count. Frames are counted the way engine/src/jobs/_film.tsx does.
film() {
  node -e '
    const film = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const frame = (seconds) => Math.round(seconds * film.fps);
    if (process.argv[2] === "starts") { console.log(film.scenes.slice(1).map((s) => frame(s.start)).join(",")); process.exit(0); }
    if (process.argv[2] === "total") { console.log(frame(film.duration)); process.exit(0); }
    const scene = film.scenes.find((s) => s.id === process.argv[3]);
    if (!scene) { console.error(`The film has no scene ${process.argv[3]}. Its scenes are ${film.scenes.map((s) => s.id).join(", ")}.`); process.exit(1); }
    console.log(frame(scene.start), frame(scene.end), frame(film.duration), film.fps);
  ' "$FILM_JSON" "$@"
}

# The picture settings a spliced scene must share with the preview, one line per setting.
picture() { ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,profile,level,pix_fmt,width,height,r_frame_rate,has_b_frames -of default=nw=1 "$1"; }
# How many frames a file's picture has.
frames() { ffprobe -v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets -of csv=p=0 "$1"; }

# Puts the scene into the preview in its place. Every frame outside the scene is copied as it is, never re-encoded:
# the preview is rendered with a fresh starting frame where each scene begins, so the cut falls exactly there.
splice() {
  [ -s "$PREVIEW_FROM" ] || { echo "The preview was not made by this version of the tool, so it cannot take a single scene. Render the whole preview again: render.sh $JOB preview"; exit 1; }
  if ! cmp -s "$FILM_JSON" "$PREVIEW_FROM"; then
    echo "The film has changed since the preview was rendered (the voice, the shot list or the scene times moved),"
    echo "so a single scene would no longer line up. Render the whole preview again: render.sh $JOB preview"
    exit 1
  fi
  local start end total fps
  read -r start end total fps < <(film scene "$SCENE")
  [ "$(frames "$PREVIEW")" = "$total" ] || { echo "The preview is not the length film.json says. Render the whole preview again: render.sh $JOB preview"; exit 1; }
  local starts; starts="$(ffprobe -v error -select_streams v:0 -show_entries packet=pts_time,flags -of csv=p=0 "$PREVIEW" \
    | awk -F, -v fps="$fps" '$2 ~ /K/ { printf "%d\n", $1 * fps + 0.5 }')"
  for f in $start $end; do
    [ "$f" = "$total" ] || grep -qx "$f" <<<"$starts" \
      || { echo "The preview has no clean cut where $SCENE begins or ends (frame $f). Render the whole preview again: render.sh $JOB preview"; exit 1; }
  done

  WORK="$(mktemp -d "$OUT/.splice.XXXXXX")"
  render "$SLUG-$SCENE" "$WORK/scene.mp4" "$((end - start))" "${PREVIEW_LOOK[@]}"
  [ "$(picture "$WORK/scene.mp4")" = "$(picture "$PREVIEW")" ] \
    || { echo "The new $SCENE does not match the preview's picture settings, so it was not swapped in. The preview is unchanged."; exit 1; }
  [ "$(frames "$WORK/scene.mp4")" = "$((end - start))" ] \
    || { echo "The new $SCENE is not $((end - start)) frames long, so it was not swapped in. The preview is unchanged."; exit 1; }

  # Cut the preview's picture into before, scene, after (stream copy, at the scene's starting frames), then join
  # before + new scene + after, and lay the preview's own sound track back on unchanged.
  local cuts; cuts="$(printf '%s\n' "$start" "$end" | awk -v t="$total" '$1 > 0 && $1 < t' | paste -sd, -)"
  if [ -n "$cuts" ]; then
    ffmpeg -v error -i "$PREVIEW" -map 0:v:0 -c copy -f segment -segment_frames "$cuts" -reset_timestamps 1 "$WORK/part%d.mp4"
  else
    ffmpeg -v error -i "$PREVIEW" -map 0:v:0 -c copy "$WORK/part0.mp4"
  fi
  # The scene's own sound runs a little past its last frame, so only its picture is joined, and every piece is given
  # its exact length in frames: otherwise the scenes after it would slide late.
  ffmpeg -v error -i "$WORK/scene.mp4" -map 0:v:0 -c copy "$WORK/scene-picture.mp4"
  seconds() { awk -v f="$1" -v fps="$fps" 'BEGIN { printf "%.6f", f / fps }'; }
  local n=0
  : > "$WORK/join.txt"
  if [ "$start" -gt 0 ]; then printf "file 'part0.mp4'\nduration %s\n" "$(seconds "$start")" >> "$WORK/join.txt"; n=1; fi
  printf "file 'scene-picture.mp4'\nduration %s\n" "$(seconds $((end - start)))" >> "$WORK/join.txt"
  if [ "$end" -lt "$total" ]; then echo "file 'part$((n + 1)).mp4'" >> "$WORK/join.txt"; fi
  ffmpeg -v error -f concat -safe 0 -i "$WORK/join.txt" -i "$PREVIEW" -map 0:v:0 -map 1:a:0? -c copy \
    -video_track_timescale 90000 -movflags +faststart "$WORK/spliced.mp4"

  [ "$(frames "$WORK/spliced.mp4")" = "$total" ] \
    || { echo "The joined preview came out the wrong length, so it was not kept. The preview is unchanged."; exit 1; }
  replace_keeping "$WORK/spliced.mp4" "$PREVIEW"
  echo "Swapped the new $SCENE into $PREVIEW (frames $start to $((end - 1)) of $total). Everything else in the preview, and the sound, is unchanged."
}

TOTAL="$(film total)"
case "$MODE" in
  preview) export KEYFRAMES_AT; KEYFRAMES_AT="$(film starts)"   # fresh frames where scenes begin, for --splice
           render "$SLUG" "$PREVIEW" "$TOTAL" "${PREVIEW_LOOK[@]}"
           cp "$FILM_JSON" "$PREVIEW_FROM" ;;
  scene)   if [ -n "$SPLICE" ]; then splice
           else read -r s e _ _ < <(film scene "$SCENE"); render "$SLUG-$SCENE" "$OUT/scenes/$SCENE$SUFFIX.mp4" "$((e - s))" "${FULL[@]}"; fi ;;
  master)  render "$SLUG" "$OUT/raw$SUFFIX.mp4" "$TOTAL" "${FULL[@]}"
           bash "$STUDIO/tools/audio/master.sh" "$OUT/raw$SUFFIX.mp4" "$OUT/$NAME$SUFFIX" ;;
esac
RESULT=ok
