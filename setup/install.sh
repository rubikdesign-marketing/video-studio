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
have uv || need+=(uv)
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

# The footage tool (FOOTAGE-PLAN.md): transcripts precise enough to cut on, and its own Python 3.12 (the Mac's newer
# Python has no face, video and sound packages yet). Both live outside the repository.
FMODEL="$MODEL_DIR/ggml-large-v3-turbo-q5_0.bin"
if [ -f "$FMODEL" ]; then echo "Footage transcription model already present."
else
  echo "Downloading the footage transcription model (about 570 MB), used to cut raw footage by its words..."
  curl -L --fail -o "$FMODEL.part" "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin" \
    && mv "$FMODEL.part" "$FMODEL" || { rm -f "$FMODEL.part"; echo "Download failed. Editing raw footage needs it; run this script again later."; }
fi
if have uv; then
  echo "Setting up the footage tool's Python..."
  { [ -x tools/footage/.venv/bin/python ] || uv venv --quiet --python 3.12 tools/footage/.venv; } \
    && uv pip install --quiet --python tools/footage/.venv/bin/python -r tools/footage/requirements.txt \
    || echo "The footage tool's Python did not install. The health check at the end will say so."
else
  echo "uv is missing, so the footage tool's Python was not set up. The health check at the end will say so."
fi

# Sound repair for footage (FOOTAGE-PLAN.md phase 3): DeepFilterNet's noise removal (MIT or Apache 2.0, one program,
# its model inside) and Microsoft's DNSMOS speech-quality models (CC BY 4.0). Demucs (MIT; separates music from a voice;
# about 1-2 GB with PyTorch) only with: bash setup/install.sh --extras
DF="tools/footage/bin/deep-filter"
if [ ! -x "$DF" ]; then
  arch="$(uname -m)"; [ "$arch" = "arm64" ] && arch="aarch64"
  mkdir -p tools/footage/bin
  echo "Fetching DeepFilterNet (noise removal, about 28 MB)..."
  curl -sL --fail -o "$DF" "https://github.com/Rikorose/DeepFilterNet/releases/download/v0.5.6/deep-filter-0.5.6-$arch-apple-darwin" && chmod +x "$DF" \
    || { rm -f "$DF"; echo "DeepFilterNet did not download. The health check at the end will say so."; }
fi
# Face tracking for framing (FOOTAGE-PLAN.md phase 4): MediaPipe's face landmarker (Apache 2.0). Positions only.
FL="tools/footage/models/face_landmarker.task"
[ -f "$FL" ] || { mkdir -p tools/footage/models; curl -sL --fail -o "$FL" "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task" \
  || { rm -f "$FL"; echo "The face model did not download. The health check at the end will say so."; }; }
mkdir -p tools/footage/models/dnsmos
for f in sig_bak_ovr.onnx model_v8.onnx; do
  [ -f "tools/footage/models/dnsmos/$f" ] || curl -sL --fail -o "tools/footage/models/dnsmos/$f" "https://raw.githubusercontent.com/microsoft/DNS-Challenge/master/DNSMOS/DNSMOS/$f" \
    || echo "The speech-quality model $f did not download. The health check at the end will say so."
done
if [ "${1:-}" = "--extras" ] && have uv && [ ! -x "$HOME/.local/bin/demucs" ]; then
  echo "Installing Demucs (separates music from a voice; about 1-2 GB)..."
  HF_HUB_DISABLE_TELEMETRY=1 uv tool install --quiet --python 3.12 "demucs==4.1.0" --with numpy --with soundfile || echo "Demucs did not install."
fi

# earshot (github.com/Leonxlnx/earshot): Claude's ears for every sound judgement (tools/audio/listen.mjs). Its own Python,
# pinned to the version the studio was tested with; its listening models (about 1.1 GB) in tools/audio/.earshot/.
EARSHOT_REF="4ac3d2a"
if have uv; then
  if ! have earshot && [ ! -x "$HOME/.local/bin/earshot" ]; then
    echo "Installing earshot (it hears sound for Claude; about 1 GB with its models)..."
    uv tool install --quiet --python 3.12 "earshot @ git+https://github.com/Leonxlnx/earshot@$EARSHOT_REF" || echo "earshot did not install. The health check at the end will say so."
  fi
  if [ ! -d tools/audio/.earshot/hf ] || [ -z "$(ls -A tools/audio/.earshot/hf 2>/dev/null)" ]; then
    echo "Fetching earshot's listening models (one time)..."
    mkdir -p tools/audio/.earshot
    EARSHOT_HOME="$PWD/tools/audio/.earshot" HF_HUB_DISABLE_TELEMETRY=1 "$HOME/.local/bin/earshot" doctor --fetch >/dev/null 2>&1 \
      || echo "earshot's models did not download. Run this script again later."
  fi
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

echo "Preparing each video's engine files (they are made on this Mac, never kept in the repository)..."
for j in jobs/*/; do
  [ -f "$j/shots.json" ] && { node tools/film/scaffold.mjs "$j" >/dev/null 2>&1 || echo "Could not prepare $j; the health check will say more."; }
done
node tools/capture/capture.mjs relist >/dev/null 2>&1 || true

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
