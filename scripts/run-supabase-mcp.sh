#!/usr/bin/env bash
# Wrapper for Supabase MCP: loads SUPABASE_ACCESS_TOKEN from .env so the token
# is never stored in .cursor/mcp.json. Requires .env in project root with:
#   SUPABASE_ACCESS_TOKEN=sbp_...
set -e
cd "$(dirname "$0")/.."
set -a
[ -f .env ] && . .env
set +a
exec npx -y @supabase/mcp-server-supabase@latest
