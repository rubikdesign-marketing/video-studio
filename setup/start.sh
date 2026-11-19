#!/bin/bash
# One step from an unzipped download to a ready studio, on a Mac or Linux. No admin rights. Safe to run again.
#   bash setup/start.sh                              get ready
#   bash setup/start.sh --import-from <old folder>   also bring your brands, videos, key and sign-ins from an older copy
#
# 1. On a Mac, clears the "downloaded from the internet" mark from this folder, so macOS does not block its programs.
# 2. Finds Node 22.13+ (or 24+). If there is none, downloads the official portable Node into .runtime/node (checked
#    against nodejs.org's published SHA-256 list) and uses that. Nothing is installed system-wide.
# 3. Hands over to setup/runtime/start.mjs: hidden files, core install, quick check.
set -u
cd "$(dirname "$0")/.." || exit 1
ROOT="$PWD"
NODE_VERSION="22.23.1"

if [ "$(uname -s)" = "Darwin" ]; then
  xattr -dr com.apple.quarantine "$ROOT" 2>/dev/null || true
fi

node_ok() { "$1" -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit((a===22&&b>=13)||a>=24?0:1)' 2>/dev/null; }

NODE=""
if [ -x "$ROOT/.runtime/node/bin/node" ] && node_ok "$ROOT/.runtime/node/bin/node"; then NODE="$ROOT/.runtime/node/bin/node"
elif command -v node >/dev/null 2>&1 && node_ok "$(command -v node)"; then NODE="$(command -v node)"
fi

if [ -z "$NODE" ]; then
  case "$(uname -s)" in Darwin) OS=darwin ;; Linux) OS=linux ;; *) echo "This script is for a Mac or Linux. On Windows run: powershell -ExecutionPolicy Bypass -File setup\\start.ps1"; exit 1 ;; esac
  case "$(uname -m)" in arm64|aarch64) ARCH=arm64 ;; x86_64|amd64) ARCH=x64 ;; *) echo "No portable Node for this processor ($(uname -m)). Install Node 22 LTS from https://nodejs.org, then run this again."; exit 1 ;; esac
  NAME="node-v$NODE_VERSION-$OS-$ARCH"
  BASE="https://nodejs.org/dist/v$NODE_VERSION"
  echo "Node 22.13 or newer was not found. Downloading the portable Node $NODE_VERSION into this folder (about 50 MB, no admin)..."
  mkdir -p "$ROOT/.runtime"
  TMP="$ROOT/.runtime/download"
  rm -rf "$TMP" && mkdir -p "$TMP"
  if ! curl -fL --progress-bar -o "$TMP/$NAME.tar.gz" "$BASE/$NAME.tar.gz" || ! curl -fsL -o "$TMP/SHASUMS256.txt" "$BASE/SHASUMS256.txt"; then
    echo "The download did not work. Check the internet connection and run this again, or install Node 22 LTS from https://nodejs.org."
    rm -rf "$TMP"; exit 1
  fi
  WANT="$(grep " $NAME.tar.gz\$" "$TMP/SHASUMS256.txt" | cut -d' ' -f1)"
  if command -v shasum >/dev/null 2>&1; then GOT="$(shasum -a 256 "$TMP/$NAME.tar.gz" | cut -d' ' -f1)"; else GOT="$(sha256sum "$TMP/$NAME.tar.gz" | cut -d' ' -f1)"; fi
  if [ -z "$WANT" ] || [ "$WANT" != "$GOT" ]; then
    echo "The downloaded Node did not match nodejs.org's checksum, so it was not used. Run this again."
    rm -rf "$TMP"; exit 1
  fi
  tar -xzf "$TMP/$NAME.tar.gz" -C "$TMP" && rm -rf "$ROOT/.runtime/node" && mv "$TMP/$NAME" "$ROOT/.runtime/node" || { echo "Could not unpack Node."; rm -rf "$TMP"; exit 1; }
  rm -rf "$TMP"
  NODE="$ROOT/.runtime/node/bin/node"
fi

# npx and package scripts start programs with "#!/usr/bin/env node", so this Node must be first on PATH.
export PATH="$(dirname "$NODE"):$PATH"
exec "$NODE" "$ROOT/setup/runtime/start.mjs" "$@"
