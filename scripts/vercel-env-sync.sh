#!/usr/bin/env bash
# Sync selected env vars from .env to Vercel.
# Usage: ./scripts/vercel-env-sync.sh [production|preview|development]
# Requires: vercel link run first, and .env populated.

set -e

ENV_TARGET="${1:-production}"
ENV_FILE=".env"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_PATH="$ROOT_DIR/$ENV_FILE"

cd "$ROOT_DIR"

if [[ ! -f "$ENV_PATH" ]]; then
  echo "Error: $ENV_FILE not found. Copy .env.example to .env and fill in values."
  exit 1
fi

if ! npx vercel --version &>/dev/null; then
  echo "Error: Vercel CLI not found. Run: npm install -g vercel or use npx vercel."
  exit 1
fi

# Vars to sync (must exist in .env)
VARS=(SHOPIFY_APP_URL SHOPIFY_API_KEY SHOPIFY_API_SECRET SCOPES DATABASE_URL NODE_ENV)
SENSITIVE_VARS=(SHOPIFY_API_SECRET DATABASE_URL)

get_value() {
  local name="$1"
  grep -E "^${name}=" "$ENV_PATH" 2>/dev/null | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//" || echo ""
}

is_sensitive() {
  local name="$1"
  for s in "${SENSITIVE_VARS[@]}"; do
    [[ "$s" == "$name" ]] && return 0
  done
  return 1
}

add_var() {
  local name="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    echo "  Skipping $name (empty)"
    return
  fi
  local tmp
  tmp=$(mktemp)
  printf '%s' "$value" > "$tmp"
  if is_sensitive "$name"; then
    npx vercel env add "$name" "$ENV_TARGET" --sensitive --force < "$tmp" 2>/dev/null || true
  else
    npx vercel env add "$name" "$ENV_TARGET" --force < "$tmp" 2>/dev/null || true
  fi
  rm -f "$tmp"
  echo "  Added $name"
}

echo "Syncing env vars to Vercel ($ENV_TARGET)..."
echo "Source: $ENV_PATH"
echo ""

for name in "${VARS[@]}"; do
  value=$(get_value "$name")
  add_var "$name" "$value"
done

echo ""
echo "Done. Run 'npx vercel env ls $ENV_TARGET' to verify."
