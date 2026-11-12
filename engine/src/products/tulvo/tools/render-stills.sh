#!/usr/bin/env bash
# Render TulvoUi-* compositions to PNG stills.
#
# From engine/:
#   src/products/tulvo/tools/render-stills.sh                 # every TulvoUi-* composition
#   src/products/tulvo/tools/render-stills.sh TulvoUi-Shell   # one or more ids ("Shell" also works)
#
# Env:
#   OUT_DIR   output folder (default: engine/out/tulvo-ui/stills)
#   SCALE     device scale factor (default 1 = 1512x805 px; 2 matches the captures' DPR)
#   FRAME     frame to render (default 0)
#   PROPS     JSON string or path passed to --props (optional)
# Output: $OUT_DIR/<id>.png   (with SCALE != 1: <id>@<SCALE>x.png)
set -euo pipefail

STUDIO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
OUT_DIR="${OUT_DIR:-$STUDIO_DIR/out/tulvo-ui/stills}"
SCALE="${SCALE:-1}"
FRAME="${FRAME:-0}"
mkdir -p "$OUT_DIR"
cd "$STUDIO_DIR"

# One render at a time: the engine's render lock (out/.render.lock) is held while this runs.
LOCK="$STUDIO_DIR/out/.render.lock"
if [ -e "$LOCK" ]; then echo "render-stills: another render is running ($LOCK exists); try again when it is gone" >&2; exit 1; fi
mkdir -p "$STUDIO_DIR/out"; touch "$LOCK"

BUNDLE=""
trap '[ -n "$BUNDLE" ] && rm -rf "$BUNDLE"; rm -f "$LOCK"' EXIT

ids=()
if [ "$#" -gt 0 ]; then
  for a in "$@"; do
    case "$a" in TulvoUi-*) ids+=("$a") ;; *) ids+=("TulvoUi-$a") ;; esac
  done
else
  while IFS= read -r line; do ids+=("$line"); done < <(
    npx remotion compositions src/index.ts --quiet 2>/dev/null | tr ' ' '\n' | grep '^TulvoUi-' | sort -u
  )
fi
if [ "${#ids[@]}" -eq 0 ]; then echo "render-stills: no TulvoUi-* compositions found" >&2; exit 1; fi

# Bundle once, render every still from the same bundle.
BUNDLE="$(mktemp -d "${TMPDIR:-/tmp}/tulvo-ui-bundle.XXXXXX")"
npx remotion bundle src/index.ts --out-dir "$BUNDLE" --log=error >/dev/null

for id in "${ids[@]}"; do
  suffix=""; [ "$SCALE" != "1" ] && suffix="@${SCALE}x"
  out="$OUT_DIR/${id}${suffix}.png"
  args=(still "$BUNDLE" "$id" "$out" --frame="$FRAME" --scale="$SCALE" --image-format=png --log=error)
  [ -n "${PROPS:-}" ] && args+=(--props="$PROPS")
  npx remotion "${args[@]}"
  echo "render-stills: $out"
done
