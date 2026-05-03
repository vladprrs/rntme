#!/usr/bin/env bash
# Verify that the shell environment has the credentials needed to talk to a
# given subsystem. Used by runbooks to fail fast before running mutating commands.
#
# Usage:
#   ./scripts/agent-env-check.sh platform
set -euo pipefail

mode="${1:-}"
case "$mode" in
  platform)
    : "${RNTME_BASE_URL:?RNTME_BASE_URL not set (e.g. https://platform.rntme.com)}"
    : "${RNTME_TOKEN:?RNTME_TOKEN not set (rntme_pat_...)}"
    if [[ ! "$RNTME_TOKEN" =~ ^rntme_pat_[a-zA-Z0-9]{22}$ ]]; then
      echo "RNTME_TOKEN format invalid (expected rntme_pat_<22 base62 chars>)" >&2
      exit 1
    fi
    code=$(curl -sS -o /dev/null -w '%{http_code}' \
      -H "Authorization: Bearer $RNTME_TOKEN" \
      "$RNTME_BASE_URL/v1/auth/me" || true)
    if [[ "$code" != "200" ]]; then
      echo "whoami HTTP $code at $RNTME_BASE_URL/v1/auth/me" >&2
      exit 1
    fi
    echo "✓ platform env ok ($RNTME_BASE_URL)"
    ;;
  '' | help | -h | --help)
    echo "Usage: $0 platform" >&2
    exit 2
    ;;
  *)
    echo "Unknown mode: $mode" >&2
    echo "Usage: $0 platform" >&2
    exit 2
    ;;
esac
