#!/bin/bash
# Health check for the Video Studio. Changes nothing; only reports.
#   bash setup/doctor.sh          check everything
#   bash setup/doctor.sh --quick  skip the test render
# Exit code 0 = ready, 1 = something needs attention.
cd "$(dirname "$0")/.." || exit 1
QUICK=0; [ "${1:-}" = "--quick" ] && QUICK=1
ok=0; bad=0; warn=0
pass() { printf "  ok    %s\n" "$1"; ok=$((ok+1)); }
fail() { printf "  NEED  %s\n        -> %s\n" "$1" "$2"; bad=$((bad+1)); }
note() { printf "  note  %s\n        -> %s\n" "$1" "$2"; warn=$((warn+1)); }
have() { command -v "$1" >/dev/null 2>&1; }

echo "Programs"
if have node; then
  v=$(node -v | sed 's/v//'); major=${v%%.*}
  [ "$major" -ge 22 ] && pass "Node $v" || fail "Node $v is too old" "needs Node 22 or newer: brew install node"
else fail "Node is not installed" "brew install node"; fi

FF="/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg"; [ -x "$FF" ] || FF="$(command -v ffmpeg || true)"
if [ -n "$FF" ]; then
  pass "ffmpeg ($FF)"
  for f in drawtext loudnorm ebur128 signalstats tblend showspectrumpic sidechaincompress; do
    "$FF" -hide_banner -filters 2>/dev/null | grep -q " $f " || fail "ffmpeg lacks the '$f' filter" "brew install ffmpeg-full"
  done
else fail "ffmpeg is not installed" "brew install ffmpeg-full"; fi
have ffprobe && pass "ffprobe" || fail "ffprobe is not installed" "it comes with ffmpeg"
have python3 && pass "Python $(python3 -V 2>&1 | cut -d' ' -f2)" || fail "Python 3 is not installed" "brew install python"
have whisper-cli && pass "whisper-cli (transcription)" || fail "whisper-cli is not installed" "brew install whisper-cpp"
MODEL="${WHISPER_MODEL:-$HOME/.cache/hyperframes/whisper/models/ggml-small.en.bin}"
[ -f "$MODEL" ] && pass "transcription model" || fail "transcription model is missing" "bash setup/install.sh downloads it"
have git && pass "git" || fail "git is not installed" "xcode-select --install"
have yt-dlp && pass "yt-dlp (reference downloads)" || note "yt-dlp is not installed" "only needed to download reference links: brew install yt-dlp"
have tesseract && pass "tesseract (on-screen text check)" || note "tesseract is not installed" "needed for the on-screen wording check: brew install tesseract"

echo "Engine"
if [ -f engine/package.json ]; then
  [ -d engine/node_modules/remotion ] && pass "Remotion installed ($(node -p "require('./engine/node_modules/remotion/package.json').version" 2>/dev/null))" \
    || fail "engine packages are not installed" "bash setup/install.sh"
else fail "the engine folder is missing" "pull the latest studio from GitHub"; fi
[ -f engine/src/brands/index.ts ] && pass "the engine's brand list (engine/src/brands/index.ts)" || fail "the engine has no brand list yet" "node tools/brand/sync.mjs"
[ -f studio/fonts/InstrumentSans-var.woff2 ] && pass "the review page's font (studio/fonts/)" || fail "studio/fonts/InstrumentSans-var.woff2 is missing" "pull the latest studio from GitHub"
if [ -f engine/node_modules/hyperframes/package.json ]; then pass "HyperFrames installed ($(node -p "require('./engine/node_modules/hyperframes/package.json').version" 2>/dev/null))"
else fail "HyperFrames is not installed" "cd engine && npm ci"; fi
SKILL_ROWS=$(bash setup/update-skills.sh --list 2>/dev/null | awk '{print $1}')
MISSING=""; for s in $SKILL_ROWS; do n=$(grep -m1 '^name:' ".claude/skills/$s/SKILL.md" 2>/dev/null | sed 's/name: *//'); [ "$n" = "$s" ] || MISSING="$MISSING $s"; done
if [ -z "$MISSING" ] && [ -n "$SKILL_ROWS" ]; then pass "bundled skills: $(echo $SKILL_ROWS | wc -w | tr -d ' ') present (.claude/skills/THIRD-PARTY.md)"
else fail "bundled skills missing or misnamed:$MISSING" "bash setup/update-skills.sh --missing"; fi

echo "Footage editing"
FMODEL="$HOME/.cache/hyperframes/whisper/models/ggml-large-v3-turbo-q5_0.bin"
[ -f "$FMODEL" ] && pass "footage transcription model (whisper large-v3-turbo)" || fail "the footage transcription model is missing" "bash setup/install.sh downloads it"
if [ -x tools/footage/.venv/bin/python ] && tools/footage/.venv/bin/python -I -c "import cv2, scenedetect, numpy, scipy, PIL" >/dev/null 2>&1; then
  pass "the footage tool's Python ($(tools/footage/.venv/bin/python -V 2>&1 | cut -d' ' -f2), OpenCV, PySceneDetect)"
else fail "the footage tool's Python is not set up" "bash setup/install.sh   (needs uv: brew install uv)"; fi
for f in zscale tonemap scdet; do "$FF" -hide_banner -filters 2>/dev/null | grep -q " $f " || fail "ffmpeg lacks the '$f' filter (HDR footage needs it)" "brew install ffmpeg-full"; done
node --test tools/footage/tests/*.test.mjs >/dev/null 2>&1 && pass "the footage tool's tests pass" || fail "the footage tool's tests fail" "run: node --test tools/footage/tests/*.test.mjs"
[ -d "$HOME/.cache/hyperframes/parakeet" ] && pass "Parakeet (a second transcriber, for comparing)" \
  || note "Parakeet is not installed" "only needed to compare transcribers (footage.mjs compare): cd engine && npx hyperframes models install parakeet"

echo "Product capture"
if [ -d tools/capture/node_modules/playwright-core ]; then
  pass "capture tool installed (playwright-core $(node -p "require('./tools/capture/node_modules/playwright-core/package.json').version" 2>/dev/null))"
else fail "the capture tool is not installed" "bash setup/install.sh   (or: cd tools/capture && npm ci)"; fi
if [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ] || have google-chrome; then pass "Google Chrome (the capture tool records in it)"
else fail "Google Chrome is not installed" "the capture tool needs it: install it from google.com/chrome"; fi
# Recording through your own Chrome (Playwright Extension). Only the studio's side is checked: the studio never
# looks inside your Chrome (its extensions, profiles or settings), so whether the extension is installed is not known here.
if [ -f tools/capture/yourchrome.mjs ] && node -e "if(!require('./tools/capture/node_modules/playwright-core/lib/utilsBundle').wsServer)process.exit(1)" >/dev/null 2>&1; then
  note "recording through your own Chrome: the studio's side is ready; whether the Playwright Extension is installed in your Chrome is not checked (the studio does not look inside your Chrome)" "to check: open chrome://extensions in Chrome and look for \"Playwright Extension\", or run: node tools/capture/capture.mjs connect   (install it once from https://chromewebstore.google.com/detail/playwright-extension/mmlmfjhmonkocbjadbfplnigmagldckm; without it, record with --browser studio)"
else fail "recording through your own Chrome is not ready (tools/capture/yourchrome.mjs or its connection part is missing)" "bash setup/install.sh   (or: cd tools/capture && npm ci)"; fi
if node tools/capture/capture.mjs relist >/dev/null 2>&1; then pass "captures listed for the engine (tools/capture/capture.mjs relist)"
else note "could not list the captures for the engine" "run: node tools/capture/capture.mjs relist"; fi
if [ -n "$(ls .capture 2>/dev/null | grep -v '^npm-cache$')" ]; then pass "signed in for capture: $(ls .capture | grep -v '^npm-cache$' | tr '\n' ' ')"
else note "no brand is signed in for capture yet" "only needed to record a product: node tools/capture/capture.mjs signin <brand>"; fi
git check-ignore -q .capture 2>/dev/null && pass ".capture/ (sign-ins) is kept out of GitHub" || note ".capture/ is not ignored by git yet" "this folder is not a git repository, or .gitignore is missing"
# Which of the other product recorders can run on this Mac (capture plan phase 6, part B). Each is checked without
# starting anything: no demo site is built, no app or simulator is opened.
if command -v npx >/dev/null 2>&1 && [ -f tools/capture/site.mjs ]; then
  if ls .capture/npm-cache/_npx/*/node_modules/@wp-playground/cli >/dev/null 2>&1; then pass "WordPress demo sites: ready (WordPress Playground is on this Mac; a site takes under a minute to build)"
  else note "WordPress demo sites: ready to use; WordPress Playground is fetched the first time a brand with a blueprint records (about 1 GB, once, into .capture/npm-cache)" "nothing to do now; it happens by itself on the first WordPress take (needs the internet that once)"; fi
else note "WordPress demo sites are not ready (npx or tools/capture/site.mjs is missing)" "install Node.js 22 or later (it brings npx): bash setup/install.sh"; fi
if node -e "import('./tools/capture/node_modules/playwright-core/index.mjs').then(m=>{if(!m._electron)process.exit(1)})" >/dev/null 2>&1; then pass "desktop apps built with Electron: ready (launched from the path in the brand's capture.json)"
else note "desktop apps (Electron): not ready" "bash setup/install.sh   (or: cd tools/capture && npm ci)"; fi
if [ -d tools/capture/node_modules/@xterm/xterm ] && [ -x /usr/bin/script ]; then pass "command-line tools: ready (the studio draws the terminal itself; VHS is not needed)"
else note "command-line tools: not ready (xterm.js or macOS's script command is missing)" "bash setup/install.sh   (or: cd tools/capture && npm ci)"; fi
if xcrun --find simctl >/dev/null 2>&1; then
  if command -v idb >/dev/null 2>&1; then pass "phone apps on iOS: ready (iOS Simulator and idb for taps)"
  else note "phone apps on iOS: the iOS Simulator is here, but taps, typing and swipes need idb (Meta's free tool)" "brew tap facebook/fb && brew install idb-companion, then: pip3 install fb-idb"; fi
else note "phone apps on iOS: not on this Mac (the iOS Simulator comes with Xcode; this Mac has only the command line tools)" "only for phone app videos: install Xcode from the Mac App Store (about 15 GB), open it once, then: sudo xcode-select -s /Applications/Xcode.app"; fi
if command -v adb >/dev/null 2>&1 || [ -x "$HOME/Library/Android/sdk/platform-tools/adb" ]; then pass "phone apps on Android: adb is here (start an emulator in Android Studio before a take)"
else note "phone apps on Android: not on this Mac (the Android emulator comes with Android Studio)" "only for Android app videos: install Android Studio from developer.android.com/studio and make a virtual device"; fi

echo "Brands"
BRAND=""
if [ -f studio.json ] && have node; then BRAND=$(node -p "require('./studio.json').default_brand || ''" 2>/dev/null); fi
if [ -z "$BRAND" ]; then fail "studio.json does not name a default brand" 'it should read { "default_brand": "<a folder in brands/>" }'
else
  pass "default brand: $BRAND (studio.json)"
  for f in brand.json brand.md voices.json pronunciation.md heard-as.json; do
    [ -f "brands/$BRAND/$f" ] && pass "brands/$BRAND/$f" || fail "brands/$BRAND/$f is missing" "pull the latest studio from GitHub, or copy it from brands/_template/"
  done
  # The brand's own check: every value and file is there, and its colours have enough contrast.
  if node tools/brand/check.mjs "$BRAND" >/dev/null 2>&1; then pass "brand check passed for $BRAND (tools/brand/check.mjs)"
  else fail "the brand check found problems in brands/$BRAND" "node tools/brand/check.mjs $BRAND"; fi
  if [ -d "engine/public/brands/$BRAND" ]; then pass "the engine has $BRAND's fonts and logos"
  else fail "the engine does not have $BRAND's fonts and logos yet" "node tools/brand/sync.mjs"; fi
fi
[ -d brands/_template ] && pass "brands/_template (the starting point for a new brand)" || fail "brands/_template is missing" "pull the latest studio from GitHub"
others=$(ls brands 2>/dev/null | grep -v '^_' | grep -vx "$BRAND" | tr '\n' ' ')
[ -n "$others" ] && pass "other brands: $others"

echo "Keys"
if [ -f .env ] && grep -Eq '^ELEVENLABS_API_KEY=.+' .env; then pass "ElevenLabs key is set in .env"
elif [ -f .env ]; then fail "ElevenLabs key is empty" "open .env and paste the team key after ELEVENLABS_API_KEY="
else fail ".env does not exist" "bash setup/install.sh creates it; then paste the team key"; fi
git check-ignore -q .env 2>/dev/null && pass ".env is kept out of GitHub" || note ".env is not ignored by git yet" "this folder is not a git repository, or .gitignore is missing"

echo "Tools"
for t in tools/study/profile.py tools/study/sheets.sh tools/audio/voice_check.py tools/checks/smoothness.py tools/checks/frame_quality.py tools/checks/onscreen_text.py tools/checks/capture_motion.mjs tools/checks/capture_glue.mjs tools/checks/capture_transitions.mjs tools/checks/capture_relayout.mjs tools/checks/text_size.mjs tools/checks/captions_clear.mjs tools/checks/flashes.py tools/checks/energy_map.py tools/checks/lib/film.mjs tools/checks/lib/capture_place.mjs tools/film/sources.mjs tools/capture/freshness.mjs tools/audio/voice.mjs tools/audio/sound.mjs tools/audio/mix.py tools/audio/master.sh tools/audio/capture_sounds.mjs tools/film/captions.mjs tools/film/scaffold.mjs tools/film/render.sh tools/film/storyboard.mjs tools/film/seen_scroll.mjs tools/brand/lib.mjs tools/brand/sync.mjs tools/brand/check.mjs tools/brand/new.mjs tools/capture/capture.mjs tools/capture/yourchrome.mjs tools/capture/kinds.mjs tools/capture/answers.mjs tools/capture/parts.mjs tools/capture/email.mjs tools/capture/site.mjs tools/capture/terminal.mjs tools/capture/phone.mjs tools/capture/package.json studio/server.mjs studio/review.html studio/paper.html studio/wait-for-notes.mjs; do
  [ -f "$t" ] && pass "$t" || fail "$t is missing" "pull the latest studio from GitHub"
done

# The checks' own tests (phase 7): fast, no browser, no render. The engine-plan tests need the engine's esbuild.
if node --test tools/capture/tests/*.test.mjs tools/checks/tests/film.test.mjs tools/checks/tests/captions_clear.test.mjs tools/checks/tests/text_size.test.mjs tools/film/tests/*.test.mjs >/dev/null 2>&1; then pass "the freshness, captions, text size and proof-of-source tests pass"
else fail "a check's own tests fail" "run: node --test tools/capture/tests/*.test.mjs tools/checks/tests/*.test.mjs tools/film/tests/*.test.mjs"; fi
if [ -d engine/node_modules/esbuild ]; then
  node --test tools/checks/tests/capture_place.test.mjs >/dev/null 2>&1 && pass "the checks read captures through the engine's plan" || fail "the checks cannot read captures through the engine's plan" "run: node --test tools/checks/tests/capture_place.test.mjs"
fi
if python3 -I -m unittest discover -s tools/checks/tests -p 'test_*.py' >/dev/null 2>&1; then pass "the flash and energy-map tests pass"
else fail "the flash or energy-map tests fail" "run: python3 -m unittest discover -s tools/checks/tests -p 'test_*.py' -v"; fi
command -v tesseract >/dev/null && pass "tesseract (reads text in frames for the text size check)" || fail "tesseract is missing (the text size and on-screen wording checks need it)" "brew install tesseract"

if [ $QUICK -eq 0 ] && [ -d engine/node_modules/remotion ]; then
  echo "Test render (six seconds)"
  out="engine/out/doctor-smoke.mp4"; mkdir -p engine/out
  if (cd engine && npx remotion render Smoke out/doctor-smoke.mp4 --log=error >/dev/null 2>&1) && [ -s "$out" ]; then
    d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out")
    pass "rendered $out (${d}s)"
    python3 -I tools/checks/smoothness.py "$out" >/dev/null 2>&1; [ $? -le 1 ] && pass "smoothness check ran" || fail "smoothness check crashed" "run: python3 -I tools/checks/smoothness.py $out"
  else
    fail "the test render did not produce a file" "if Claude ran this check, the render browser cannot start inside Claude's command sandbox: let the render run outside it when asked. Otherwise run it by hand to see why: cd engine && npx remotion render Smoke out/doctor-smoke.mp4"
  fi
fi

echo
echo "Connect these yourself in the Claude desktop app (the script cannot see them):"
echo "  - Figma connector, signed in to the shared Figma account"
echo "  - Tulvo connector, attached to the demo workspace"
echo "  - Tulvo signed in inside the browser pane"
echo "  - GitHub signed in (gh auth login), so lessons sync"
echo
echo "$ok ok, $bad need attention, $warn notes"
[ $bad -eq 0 ]
