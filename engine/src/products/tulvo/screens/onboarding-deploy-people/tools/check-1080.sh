#!/usr/bin/env bash
# Placement check for the 9:16 ad: every screen of this group must render identically inside a 1080 px wide
# composition (a Tailwind v4 build would evaluate its own copies of app classes against the composition width; the engine
# has none, so this now checks the viewport-unit rewrite only).
# Renders each TulvoUi-<id> natively (1512x805) and in a 1080x1920 viewport, then diffs the visible 1080x805 area.
#   src/products/tulvo/screens/onboarding-deploy-people/tools/check-1080.sh [id ...]
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE/../../../../../.."
OUT="${OUT:-${TMPDIR:-/tmp}/odp-1080}"
mkdir -p "$OUT"
ids=("$@")
if [ "${#ids[@]}" -eq 0 ]; then
  while IFS= read -r l; do ids+=("$l"); done < <(npx remotion compositions src/index.ts --quiet 2>/dev/null | tr ' ' '\n' | grep -E '^TulvoUi-(Onboarding|Deploy|People|Integration)' | sed 's/^TulvoUi-//' | sort -u)
fi
B="$(mktemp -d "${TMPDIR:-/tmp}/odp-bundle.XXXXXX")"
trap 'rm -rf "$B"' EXIT
npx remotion bundle src/index.ts --out-dir "$B" --log=error >/dev/null
for id in "${ids[@]}"; do
  npx remotion still "$B" "TulvoUi-$id" "$OUT/$id-1512.png" --log=error
  npx remotion still "$B" "TulvoUi-$id" "$OUT/$id-1080.png" --width=1080 --height=1920 --log=error
  d=$(ffmpeg -v error -i "$OUT/$id-1080.png" -i "$OUT/$id-1512.png" -filter_complex \
    "[0]crop=1080:805:0:0,format=rgb24[a];[1]crop=1080:805:0:0,format=rgb24[b];[a][b]blend=all_mode=difference,format=gray,signalstats,metadata=print:key=lavfi.signalstats.YMAX:file=-" \
    -f null - 2>&1 | grep -o 'YMAX=[0-9.]*' | head -1 | cut -d= -f2)
  echo "check-1080: $id  max |diff| = ${d:-?}"
done
