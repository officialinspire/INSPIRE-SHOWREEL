#!/usr/bin/env bash
# Publishes the rendered showreel as a GitHub release asset (renders are never committed).
# Usage: npm run release -- [tag]      (default tag: showreel-YYYYMMDD-HHMM)
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=$(node -e "const c=require('./scripts/lib/config').load();console.log(c.paths.output)")
REPORT="${OUT%.mp4}.json"
TAG="${1:-showreel-$(date -u +%Y%m%d-%H%M)}"

command -v gh >/dev/null || { echo "gh (GitHub CLI) is required: https://cli.github.com" >&2; exit 1; }
[ -f "$OUT" ] || { echo "No render at $OUT — run npm run produce first." >&2; exit 1; }

gh release create "$TAG" "$OUT" "$REPORT" \
  --title "INSPIRE Showreel $TAG" \
  --notes "Rendered by the INSPIRE-SHOWREEL pipeline. See $(basename "$REPORT") for hashes, duration and segments."
