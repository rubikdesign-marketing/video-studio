#!/bin/bash
# One-step setup for the Video Studio on a Mac.
#   bash setup/install.sh
# Safe to run again: it only adds what is missing. It never touches your key once .env exists.
set -u
cd "$(dirname "$0")/.." || exit 1
say() { printf "\n== %s\n" "$1"; }
have() { command -v "$1" >/dev/null 2>&1; }

say "1 of 5  Programs"
if ! have brew; then
  echo "Homebrew is not installed. It is the Mac installer the other programs come from."
  echo "Install it yourself first (it asks for your Mac password), then run this script again:"
  echo '  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
  exit 1
fi
need=()
have node || need+=(node)
[ -x /opt/homebrew/opt/ffmpeg-full/bin/ffmpeg ] || need+=(ffmpeg-full)
have python3 || need+=(python)
have whisper-cli || need+=(whisper-cpp)
have yt-dlp || need+=(yt-dlp)
have tesseract || need+=(tesseract)
have gh || need+=(gh)
if [ ${#need[@]} -gt 0 ]; then
  echo "Installing: ${need[*]}"
  brew install "${need[@]}" || echo "Some programs did not install. The health check at the end will say which."
else
  echo "All programs are already installed."
fi

say "2 of 5  Transcription model"
MODEL_DIR="$HOME/.cache/hyperframes/whisper/models"; MODEL="$MODEL_DIR/ggml-small.en.bin"
if [ -f "$MODEL" ]; then echo "Already present."
else
  mkdir -p "$MODEL_DIR"
  echo "Downloading the speech-to-text model (about 490 MB), used to check every voice line..."
  curl -L --fail -o "$MODEL.part" "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin" \
    && mv "$MODEL.part" "$MODEL" || { rm -f "$MODEL.part"; echo "Download failed. Voice checks will skip the word comparison until it is present."; }
fi

say "3 of 5  Engine packages"
if [ -f engine/package.json ]; then
  if [ -f engine/package-lock.json ]; then (cd engine && npm ci --no-audit --no-fund); else (cd engine && npm install --no-audit --no-fund); fi \
    || echo "Package install failed. The health check at the end will say so."
  echo "Fetching the browser the renderer uses (one time)..."
  (cd engine && npx remotion browser ensure) || echo "The render browser did not download. The first render will try again."
else
  echo "The engine folder is missing. Pull the latest studio from GitHub."
fi
# The capture tool records the product in the Google Chrome already on this Mac (playwright-core, no extra browser).
if [ -f tools/capture/package.json ]; then
  echo "Installing the capture tool..."
  (cd tools/capture && npm ci --no-audit --no-fund) || echo "The capture tool did not install. The health check at the end will say so."
  [ -d "/Applications/Google Chrome.app" ] || echo "Google Chrome is not installed. The capture tool needs it: install it from google.com/chrome"
fi

echo "Fetching the skills that are not kept in the repository (Remotion's), and any others missing..."
bash setup/update-skills.sh --missing || echo "Some skills did not download. The health check at the end will say which."

say "4 of 5  Your key file"
if [ -f .env ]; then
  echo ".env already exists; left as it is."
else
  cp .env.example .env
  echo "Created .env. Open it and paste the team's ElevenLabs key after ELEVENLABS_API_KEY="
  echo "Ask the studio owner for the key. Never share the file or put it in GitHub."
fi
chmod +x tools/study/*.sh tools/study/*.py tools/audio/*.py tools/checks/*.py setup/*.sh 2>/dev/null

say "5 of 5  Health check"
bash setup/doctor.sh
status=$?
echo
if [ $status -eq 0 ]; then echo "The studio is ready. In Claude, say: make a video."
else echo "Fix the lines marked NEED above, then run: bash setup/doctor.sh"; fi
exit $status
