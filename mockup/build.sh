#!/usr/bin/env bash
# Assemble the self-contained visualization mock by inlining D3 (the Artifact
# CSP and file:// usage both forbid CDN scripts). Edit src/top.html and
# src/app.js, then run this to regenerate index.html.
set -euo pipefail
cd "$(dirname "$0")"

D3="../node_modules/.pnpm/d3@7.9.0/node_modules/d3/dist/d3.min.js"
OUT="index.html"

if [[ ! -f "$D3" ]]; then
  echo "d3 not found at $D3 — run 'pnpm install' in the project root first." >&2
  exit 1
fi

# inline the Oswald @font-face (data URI) at the /*__OSWALD__*/ marker
{
  awk '/__OSWALD__/ { while ((getline l < "src/oswald-face.css") > 0) print l; next } { print }' src/top.html
  printf '<script>\n'; cat "$D3"; printf '\n</script>\n'
  printf '<script>\n'; cat src/app.js; printf '\n</script>\n'
} > "$OUT"

echo "wrote $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)"
