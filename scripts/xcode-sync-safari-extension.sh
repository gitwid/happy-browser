#!/bin/sh
set -eu

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${REPO_ROOT}"

if [ "${CONFIGURATION:-Debug}" = "Debug" ]; then
  export HAPPY_BROWSER_DEV=1
fi

resolve_node() {
  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi

  for candidate in \
    /opt/homebrew/bin/node \
    /usr/local/bin/node \
    "${HOME}/.volta/bin/node" \
    "${HOME}/.fnm/current/bin/node"; do
    if [ -x "${candidate}" ]; then
      echo "${candidate}"
      return 0
    fi
  done

  if [ -d "${HOME}/.nvm/versions/node" ]; then
    for candidate in "${HOME}"/.nvm/versions/node/*/bin/node; do
      if [ -x "${candidate}" ]; then
        echo "${candidate}"
        return 0
      fi
    done
  fi

  return 1
}

NODE="$(resolve_node || true)"
if [ -n "${NODE}" ]; then
  "${NODE}" scripts/sync-safari-extension.js
  exit 0
fi

if command -v python3 >/dev/null 2>&1; then
  python3 scripts/sync-safari-extension.py
  exit 0
fi

if [ -f "safari/Happy Browser/Happy Browser Extension/Resources/manifest.json" ] && \
   [ -d "safari/Happy Browser/Happy Browser Extension/Resources/src" ]; then
  echo "warning: neither node nor python3 is available; using committed Safari extension resources." >&2
  exit 0
fi

echo "error: node or python3 is required to sync Safari extension resources" >&2
echo "Install Node.js (https://nodejs.org), install Python 3, or ensure one is on PATH for Xcode builds." >&2
echo "Common Node locations: /opt/homebrew/bin/node, /usr/local/bin/node" >&2
exit 1
