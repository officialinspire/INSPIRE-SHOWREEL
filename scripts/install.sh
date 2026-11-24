#!/usr/bin/env bash
# Installs pipeline dependencies: npm packages, Chromium for Playwright, FFmpeg + fonts.
# Safe to re-run. Pass --no-system to skip apt/brew.
set -euo pipefail
cd "$(dirname "$0")/.."

SYSTEM=1
for a in "$@"; do [ "$a" = "--no-system" ] && SYSTEM=0; done

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

say "1/3 npm packages"
if [ -f package-lock.json ]; then npm ci; else npm install; fi

say "2/3 Chromium for Playwright"
if node -e "require('playwright').chromium.launch().then(b=>b.close()).catch(()=>process.exit(1))" 2>/dev/null; then
  echo "Chromium already launches; skipping download."
else
  npx playwright install chromium
  if [ "$(uname)" = "Linux" ] && [ "$SYSTEM" = 1 ] && [ "$(id -u)" = 0 ]; then npx playwright install-deps chromium; fi
fi

say "3/3 FFmpeg, fonts and the capture environment (Xvfb, PulseAudio)"
NEED=""
for b in ffmpeg ffprobe Xvfb pulseaudio pactl; do command -v "$b" >/dev/null || NEED="$NEED $b"; done
if [ -z "$NEED" ]; then
  echo "present: $(ffmpeg -version | head -1); Xvfb; pulseaudio"
elif [ "$SYSTEM" = 1 ]; then
  if command -v apt-get >/dev/null; then
    SUDO=""; [ "$(id -u)" = 0 ] || SUDO="sudo"
    $SUDO apt-get update && $SUDO apt-get install -y ffmpeg fonts-dejavu-core xvfb pulseaudio pulseaudio-utils
  elif command -v brew >/dev/null; then
    brew install ffmpeg
    echo "macOS: set segments.lowerThird.fontFile in config/trailer.json to e.g. /System/Library/Fonts/Supplemental/Arial Bold.ttf"
    echo "Capture needs Linux (Xvfb + PulseAudio + x11grab); run npm run capture:all on Linux or in a container."
  else
    echo "Install FFmpeg (with libx264, libfreetype) manually: https://ffmpeg.org/download.html" >&2; exit 1
  fi
else
  echo "missing:$NEED (and --no-system given); install them yourself." >&2
fi

say "Verifying"
node scripts/check-deps.js
