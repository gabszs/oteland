#!/bin/sh
set -eu

strip_quotes() {
  value="$1"
  value="${value#\"}"
  value="${value%\"}"
  value="${value#\'}"
  value="${value%\'}"
  printf '%s' "$value"
}

escape_js() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

FARO_WEB_URL_RAW="${FARO_WEB_URL:-}"

FARO_WEB_URL="$(escape_js "$(strip_quotes "$FARO_WEB_URL_RAW")")"

cat > /app/public/env.js <<EOF
window.__APP_ENV__ = {
  FARO_WEB_URL: "${FARO_WEB_URL}"
};
EOF

exec pnpm dev
