#!/usr/bin/env bash
# Build the static site into dist/ for GitHub Pages (or any static host).
#
#   ./build.sh                       # site served from the domain root
#   BASE_PATH=/phil-this/ ./build.sh # project site under a sub-path
set -euo pipefail

cd "$(dirname "$0")"

BASE_PATH="${BASE_PATH:-/}"
if [[ "$BASE_PATH" != /*/ && "$BASE_PATH" != "/" ]]; then
  echo "BASE_PATH must start and end with '/', got: $BASE_PATH" >&2
  exit 1
fi

rm -rf dist
mkdir dist

# Copy the app, leaving out tests, generator scripts and leftover server state.
rsync -a \
  --exclude 'tests/' \
  --exclude 'generate_*.py' \
  --exclude '__pycache__/' \
  --exclude 'data.sqlite*' \
  --exclude '*.py' \
  --exclude 'store.json' \
  app/ dist/

# The app fetches transcripts at <site root>/transcripts/<file>.
cp -r transcripts dist/transcripts

# Point <base href> at the sub-path the site is served from.
if ! grep -q '<base href="/" />' dist/index.html; then
  echo 'build.sh: could not find <base href="/" /> in app/index.html' >&2
  exit 1
fi
sed -i "s|<base href=\"/\" />|<base href=\"$BASE_PATH\" />|" dist/index.html

# GitHub Pages serves 404.html for unknown paths, which is what makes SPA deep
# links such as /phil-this/episode/94 resolve to the app.
cp dist/index.html dist/404.html

# Tell Pages not to run Jekyll (it would otherwise skip files like _*).
touch dist/.nojekyll

echo "Built dist/ with base path $BASE_PATH"
du -sh dist
