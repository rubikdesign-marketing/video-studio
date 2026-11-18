#!/usr/bin/env bash
# Refreshes the third-party skills bundled in .claude/skills/ from their public sources, to their latest versions.
# The studio's own skill (video-studio) is never touched. Run from the studio folder:
#
#   bash setup/update-skills.sh            fetch the latest of every bundled skill
#   bash setup/update-skills.sh --list     only print what is bundled and where it comes from
#   bash setup/update-skills.sh --missing  only fetch skills not in this folder yet (the installer runs this: some skills,
#                                          like Remotion's, are not kept in the public repository and come from their source)
#
# Afterwards: read what changed (git diff --stat .claude/skills), open a new Claude session in this folder to load
# them, and commit with a summary. Sources, versions and licences are recorded in .claude/skills/THIRD-PARTY.md.
set -euo pipefail
cd "$(dirname "$0")/.."
DEST=".claude/skills"

# repository | path of the skill inside it | name in this studio | licence file to copy (if the skill has none)
SKILLS=(
  "remotion-dev/skills|skills/remotion-best-practices|remotion-best-practices|"
  "remotion-dev/skills|skills/remotion-captions|remotion-captions|"
  "remotion-dev/skills|skills/remotion-create|remotion-create|"
  "remotion-dev/skills|skills/remotion-docs|remotion-docs|"
  "remotion-dev/skills|skills/remotion-interactivity|remotion-interactivity|"
  "remotion-dev/skills|skills/remotion-license|remotion-license|"
  "remotion-dev/skills|skills/remotion-maps|remotion-maps|"
  "remotion-dev/skills|skills/remotion-markup|remotion-markup|"
  "remotion-dev/skills|skills/remotion-multimedia|remotion-multimedia|"
  "remotion-dev/skills|skills/remotion-render|remotion-render|"
  "remotion-dev/skills|skills/remotion-saas|remotion-saas|"
  "remotion-dev/skills|skills/remotion-studio|remotion-studio|"
  "remotion-dev/skills|skills/remotion-upgrade|remotion-upgrade|"
  "heygen-com/hyperframes|skills/hyperframes|hyperframes|LICENSE"
  "heygen-com/hyperframes|skills/hyperframes-cli|hyperframes-cli|LICENSE"
  "heygen-com/hyperframes|skills/hyperframes-registry|hyperframes-registry|LICENSE"
  "heygen-com/hyperframes|skills/media-use|media-use|LICENSE"
  "heygen-com/hyperframes|skills/remotion-to-hyperframes|remotion-to-hyperframes|LICENSE"
  "heygen-com/hyperframes|skills/reverse-any-video|reverse-any-video|LICENSE"
  "heygen-com/hyperframes|skills/slideshow|slideshow|LICENSE"
  "heygen-com/hyperframes|skills/style-sampling|style-sampling|LICENSE"
  "heygen-com/hyperframes|skills/figma|figma|LICENSE"
  "heygen-com/hyperframes|.claude/skills/motion-doctrine|motion-doctrine|LICENSE"
  "heygen-com/hyperframes|.claude/skills/cut-the-curve|cut-the-curve|LICENSE"
  "heygen-com/hyperframes|.claude/skills/seam-craft|seam-craft|LICENSE"
  "heygen-com/hyperframes|.claude/skills/captions-overlay|captions-overlay|LICENSE"
  "heygen-com/hyperframes|.claude/skills/oversized-cursor|oversized-cursor|LICENSE"
  "heygen-com/hyperframes|.claude/skills/changelog-video|changelog-video|LICENSE"
  "lottiefiles/motion-design-skill|skills/motion-design|motion-design|LICENSE"
  "affaan-m/ecc|skills/motion-foundations|motion-foundations|LICENSE"
  "affaan-m/ecc|skills/motion-advanced|motion-advanced|LICENSE"
  "affaan-m/ecc|skills/motion-patterns|motion-patterns|LICENSE"
  "ibelick/ui-skills|skills/fixing-motion-performance|fixing-motion-performance|LICENSE"
  "nutlope/hallmark|skills/hallmark|hallmark|LICENSE"
  "pbakaus/impeccable|.claude/skills/impeccable|impeccable|LICENSE"
  "Leonxlnx/taste-skill|skills/taste-skill|design-taste-frontend|LICENSE"
  "Tejashmakwana/motionmaxxing|.|motionmaxxing|LICENSE"
  "manavmishra/ZeroSlop|skills/zero-slop|zero-slop|LICENSE"
  "juliusbrussee/caveman|skills/caveman|caveman|LICENSE"
  "mbfinotti/advertising-skills|skills/*|*|LICENSE"
  "bangtutorial/bang-motion|.|bang-motion|LICENSE"
  "vyralcontent/content-skills|skills/viral-hooks|viral-hooks|LICENSE"
  "Leonxlnx/earshot|skills/earshot|earshot|LICENSE"
  "maximilianfeix/plinkfx|skills/plinkfx|plinkfx|LICENSE"
  "whystrohm/shotkit|skills/storyboard-architect|storyboard-architect|LICENSE"
  "vyralcontent/content-skills|skills/viral-short-form|viral-short-form|LICENSE"
  "calesthio/generative-media-skills|skills/production/post-production/title-kinetic-typography|title-kinetic-typography|LICENSE"
  "greensock/gsap-skills|skills/gsap-core|gsap-core|LICENSE"
  "greensock/gsap-skills|skills/gsap-timeline|gsap-timeline|LICENSE"
  "greensock/gsap-skills|skills/gsap-plugins|gsap-plugins|LICENSE"
  "Leonxlnx/earshot|skills/real-sound|real-sound|LICENSE"
  # Clipwing's skills state no licence for their instructions, so, like Remotion's, they are fetched on each Mac and
  # never kept in the public repository (.gitignore).
  "Clipwing/skills|skills/real-sfx|real-sfx|"
  "Clipwing/skills|skills/hyperframes-to-after-effects|hyperframes-to-after-effects|"
)

if [ "${1:-}" = "--list" ]; then
  for row in "${SKILLS[@]}"; do
    IFS='|' read -r repo sub name _ <<<"$row"
    if [ "$name" = "*" ]; then
      # A whole set: list what is installed from it (recorded in .claude/skills/.sets/).
      for s in $(cat ".claude/skills/.sets/${repo//\//__}" 2>/dev/null); do printf "%-28s %s/%s\n" "$s" "$repo" "${sub%/*}/$s"; done
    else printf "%-28s %s/%s\n" "$name" "$repo" "$sub"; fi
  done
  exit 0
fi

MISSING_ONLY=0; [ "${1:-}" = "--missing" ] && MISSING_ONLY=1
WORK="$(mktemp -d)"
trap 'rm -rf "${WORK:?}"' EXIT

for row in "${SKILLS[@]}"; do
  IFS='|' read -r repo sub name lic <<<"$row"
  if [ "$MISSING_ONLY" = 1 ]; then
    if [ "$name" = "*" ]; then [ -s "$DEST/.sets/${repo//\//__}" ] && continue
    else [ -f "$DEST/$name/SKILL.md" ] && continue; fi
  fi
  dir="$WORK/${repo//\//__}"
  if [ ! -d "$dir" ]; then
    echo "Fetching $repo"
    git clone -q --depth 1 "https://github.com/$repo.git" "$dir"
  fi
  at="$(git -C "$dir" rev-parse --short HEAD) $(git -C "$dir" log -1 --format=%cs)"
  if [ "$name" = "*" ]; then
    # Every skill in a folder of the repository; the names installed are recorded for --list and the health check.
    mkdir -p "$DEST/.sets"
    : > "$DEST/.sets/${repo//\//__}"
    for sk in "$dir/${sub%/*}"/*/; do
      [ -f "$sk/SKILL.md" ] || continue
      s="$(basename "$sk")"
      rsync -a --delete --exclude .git --exclude node_modules --exclude .DS_Store "$sk" "${DEST:?}/${s:?}/"
      if [ -n "$lic" ] && [ ! -f "$DEST/$s/LICENSE" ] && [ -f "$dir/$lic" ]; then cp "$dir/$lic" "$DEST/$s/LICENSE"; fi
      echo "$s" >> "$DEST/.sets/${repo//\//__}"
    done
    echo "  $(wc -l < "$DEST/.sets/${repo//\//__}" | tr -d ' ') skills from $repo ($at)"
    continue
  fi
  if [ ! -f "$dir/$sub/SKILL.md" ]; then
    echo "  NOT FOUND: $repo has no $sub any more. $name is left as it was; check the repository and update this list."
    continue
  fi
  rsync -a --delete --exclude .git --exclude node_modules --exclude .DS_Store "$dir/$sub/" "${DEST:?}/${name:?}/"
  if [ -n "$lic" ] && [ ! -f "$DEST/$name/LICENSE" ] && [ -f "$dir/$lic" ]; then cp "$dir/$lic" "$DEST/$name/LICENSE"; fi
  got="$(grep -m1 '^name:' "$DEST/$name/SKILL.md" | sed 's/name: *//')"
  [ "$got" = "$name" ] || echo "  WARNING: $name now calls itself \"$got\"; the folder name and the skill name must match."
  echo "  $name  ($repo $at)"
done

echo
echo "Done. Review with: git diff --stat .claude/skills"
echo "Then update the versions in .claude/skills/THIRD-PARTY.md and commit."
