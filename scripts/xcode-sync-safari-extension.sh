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
if [ -z "${NODE}" ]; then
  echo "error: node is required to sync Safari extension resources" >&2
  echo "Install Node.js (https://nodejs.org) or ensure node is on PATH for Xcode builds." >&2
  echo "Common locations: /opt/homebrew/bin/node, /usr/local/bin/node" >&2
  exit 1
fi

"${NODE}" scripts/sync-safari-extension.js
