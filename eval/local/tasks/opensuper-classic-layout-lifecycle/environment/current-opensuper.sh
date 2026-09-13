#!/usr/bin/env bash
set -euo pipefail

snapshot="/workspace/_eval_current_opensuper"
if [[ ! -f "$snapshot/bin/opensuper.js" || ! -d "$snapshot/dist" || ! -f "$snapshot/assets/manifest.json" ]]; then
    echo "Current OpenSuper CLI snapshot is unavailable" >&2
    exit 2
fi

runtime="$(mktemp -d)"
trap 'rm -rf "$runtime"' EXIT
cp -a "$snapshot/." "$runtime/"
ln -s /opt/opensuper-cli/node_modules "$runtime/node_modules"
node "$runtime/bin/opensuper.js" "$@"
