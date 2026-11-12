#!/usr/bin/env bash
# Compare every "onboarding-deploy-people" capture-match still with its live reference.
#   src/products/tulvo/screens/onboarding-deploy-people/tools/compare-all.sh [id-substring]
# Needs the @2x stills (SCALE=2 render-stills.sh ... with OUT_DIR=$ST). Writes $CO/<id>.png (+ -diff, -blend)
# and, when a region is given, $CO/<id>-region.png (the area that differs most from other screens: the
# artwork panel / sidebar are excluded so the score reflects the rebuilt content).
# References without a screenshot (deploy gallery, editor modes, people at 1512) are renders of the
# captured DOM + CSS (refs/). TEST ARTEFACTS ONLY: live references show AI sample data / the account e-mail.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STUDIO="$(cd "$HERE/../../../../../.." && pwd)"
ROOT="${TULVO_UI_RESEARCH:?set TULVO_UI_RESEARCH to the folder with the 20 Oct 2026 Tulvo research}"
ST=${ST:-$ROOT/ui-rebuild/stills/onboarding-deploy-people}
CO=${CO:-$ROOT/ui-rebuild/compare/onboarding-deploy-people}
L=$ROOT/research/ui-live
R=${REFS:-$ROOT/ui-rebuild/compare/onboarding-deploy-people/refs}
CMP="$STUDIO/src/products/tulvo/tools/compare.sh"
mkdir -p "$CO"

# id | reference | region crop (w:h:x:y at 1512x805) or "-"
PAIRS=(
  "Onboarding-Basic|$L/day1/01-mcp-claude-in-chrome-blob-1792511736381-i73i6f.jpg|760:805:0:0"
  "Onboarding-AiActive|$L/day2/12-onboarding-use-tulvo-ai.jpg|760:805:0:0"
  "Onboarding-Named|$L/day1/03-mcp-claude-in-chrome-blob-1792511774758-9b82mx.jpg|760:805:0:0"
  "Onboarding-Filled|$L/day1/04-mcp-claude-in-chrome-blob-1792511786129-nn6bhy.jpg|760:805:0:0"
  "Onboarding-Progress-12|$L/day1/08-mcp-claude-in-chrome-blob-1792511819639-tz03nu.jpg|760:805:0:0"
  "Onboarding-Progress-44|$L/day1/07-mcp-claude-in-chrome-blob-1792511819639-nzno0c.jpg|760:805:0:0"
  "Onboarding-Progress-73|$L/day1/06-mcp-claude-in-chrome-blob-1792511819639-lfuadp.jpg|760:805:0:0"
  "Onboarding-Progress-97|$L/day1/10-mcp-claude-in-chrome-blob-1792511847938-rsh9nw.jpg|760:805:0:0"
  "Onboarding-Progress-99|$L/day1/09-mcp-claude-in-chrome-blob-1792511847939-3dh0qy.jpg|760:805:0:0"
  "Deploy-Gallery-Capture|$R/deploy-gallery@2x.png|1264:805:248:0"
  "Deploy-Editor-Preview-Capture|$R/deploy-editor-preview@2x.png|1264:805:248:0"
  "Deploy-Editor-Edit-Capture|$R/deploy-editor-edit-mode@2x.png|1264:805:248:0"
  "Deploy-Editor-Selected-Capture|$L/day2/11-deploy-visual-editor-heading-selected.jpg|1264:805:248:0"
  "Deploy-CustomDomain-Capture|$L/day2/01-deploy-custom-domain-dialog.jpg|660:200:430:308"
  "Deploy-ConnectData-Capture|$R/deploy-database-panel@2x.png|1140:690:186:56"
  "People-Capture|$R/people-members@2x.png|1264:805:248:0"
  "People-Pending-Capture|-|-"
  "Integration-Slack-Capture|$L/day2/04-integrations-slack-connect.jpg|1264:805:248:0"
  "Integration-Notion-Capture|$L/day2/05-integrations-notion-connect.jpg|1264:805:248:0"
)

for row in "${PAIRS[@]}"; do
  IFS="|" read -r id ref region <<<"$row"
  [ -n "${1:-}" ] && [[ "$id" != *"$1"* ]] && continue
  [ "$ref" = "-" ] && continue
  still="$ST/TulvoUi-$id@2x.png"
  [ -f "$still" ] || { echo "skip $id (no still)"; continue; }
  SIZE=1512x805 "$CMP" "$still" "$ref" "$CO/$id.png"
  if [ "$region" != "-" ]; then SIZE=1512x805 CROP="$region" "$CMP" "$still" "$ref" "$CO/$id-region.png"; fi
done
