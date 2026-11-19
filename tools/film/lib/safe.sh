# Shared by the render and finishing scripts: keep the last good file, and the render lock. Source it; do not run it.
#
#   replace_keeping <new file> <destination> [how many old versions to keep, default 3]
#       Moves the destination (if any) into versions/ beside it, stamped with the time, then moves the new file into
#       place. Only call it after the new file has been checked. Older versions beyond the limit are deleted.
#   video_frames <file>        how many picture frames a file has (empty if it cannot be read)
#   check_video <file> [frames] fails with a plain message unless the file has a picture and, if given, that many frames
#   take_render_lock <lock dir> <tool> <job>   waits for (or clears a stale) lock, then holds it; same format as lib/lock.mjs

replace_keeping() {
  local new="$1" dest="$2" keep="${3:-3}"
  if [ -e "$dest" ] && [ "$keep" -gt 0 ]; then
    local dir base stem ext
    dir="$(dirname "$dest")/versions"; base="$(basename "$dest")"; stem="${base%.*}"; ext="${base##*.}"
    mkdir -p "$dir"
    mv "$dest" "$dir/$stem.$(date +%Y%m%d-%H%M%S).$ext"
    # newest first; delete everything after the first $keep
    ls -1t "$dir/$stem".2*."$ext" 2>/dev/null | tail -n +"$((keep + 1))" | while IFS= read -r old; do rm -f "$old"; done
  fi
  mv "$new" "$dest"
}

video_frames() { ffprobe -v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets -of csv=p=0 "$1" 2>/dev/null || true; }

check_video() {
  local file="$1" want="${2:-}" got
  [ -s "$file" ] || { echo "The render did not write $file."; return 1; }
  got="$(video_frames "$file")"
  [ -n "$got" ] && [ "$got" -gt 0 ] 2>/dev/null || { echo "$file has no readable picture."; return 1; }
  if [ -n "$want" ] && [ "$got" != "$want" ]; then echo "$file has $got frames, $want expected."; return 1; fi
}

# Moves a stale lock aside and deletes it, unless it was taken afresh in the meantime (then it goes back). Only one of
# several waiting renders can win the move.
clear_stale_lock() {
  local lock="$1" judged="$2" why="$3" tomb="$1.stale.$$" now
  mv "$lock" "$tomb" 2>/dev/null || return 0
  now="$(cat "$tomb/pid" 2>/dev/null || true)"
  if [ "$now" != "$judged" ]; then mv "$tomb" "$lock" 2>/dev/null || true; return 0; fi
  rm -rf "$tomb"; echo "Cleared a render lock left behind ($why)."
}

take_render_lock() {
  local lock="$1" tool="$2" job="$3" owner age waiting=""
  mkdir -p "$(dirname "$lock")"
  until mkdir "$lock" 2>/dev/null; do
    owner="$(cat "$lock/pid" 2>/dev/null || true)"
    age=$(( $(date +%s) - $(stat -f %m "$lock" 2>/dev/null || stat -c %Y "$lock" 2>/dev/null || date +%s) ))
    if [ -n "$owner" ]; then
      case "$(kill -0 "$owner" 2>&1 || true)" in
        *"No such process"*) clear_stale_lock "$lock" "$owner" "process $owner has ended"; continue ;;
      esac
      # A live-looking holder after 6 hours is a reused process id: the render that took the lock is long gone.
      if [ "$age" -gt 21600 ]; then clear_stale_lock "$lock" "$owner" "held for over 6 hours"; continue; fi
    else
      if [ "$age" -gt 30 ]; then clear_stale_lock "$lock" "" "no owner, ${age} s old"; continue; fi
    fi
    if [ -n "${NO_WAIT:-}" ]; then return 1; fi
    [ -n "$waiting" ] || echo "Another render is running (process ${owner:-starting}). Waiting for it to finish."
    waiting=1; sleep 5
  done
  echo $$ > "$lock/pid"
  printf '{"pid":%s,"tool":"%s","job":"%s","started":"%s"}\n' "$$" "$tool" "$job" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$lock/owner.json"
}
