#!/bin/sh
# Packages the plugin into an installable .xpi
set -e
cd "$(dirname "$0")"
VERSION=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' manifest.json | head -1)
mkdir -p dist
OUT="dist/zotero-auto-translate-$VERSION.xpi"
rm -f "$OUT"
zip -q -r "$OUT" manifest.json bootstrap.js auto-translate.js prefs.js preferences.xhtml
echo "Built $OUT"
