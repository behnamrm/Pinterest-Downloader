#!/usr/bin/env bash
# Builds the ZIP you upload to the Chrome Web Store: dist/clipnest-<version>.zip
set -euo pipefail
cd "$(dirname "$0")/.."

version=$(python3 -c "import json;print(json.load(open('extension/manifest.json'))['version'])")
out="dist/clipnest-${version}.zip"
mkdir -p dist
rm -f "$out"
(cd extension && zip -r -X -q "../$out" . -x '.*' -x '*/.*' -x '__MACOSX/*')
echo "Built $out"
unzip -l "$out"
