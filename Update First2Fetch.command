#!/bin/zsh -l
set -euo pipefail

PROJECT_DIR="${0:A:h}"
cd "$PROJECT_DIR"

fail() {
  print -u2 "Update stopped: $1"
  exit 1
}

[[ "$(uname -s)" == Darwin ]] || fail 'This updater runs on macOS only.'
[[ "$(git branch --show-current)" == codex/jd-analytics ]] || fail 'Open the codex/jd-analytics checkout before updating.'
[[ -z "$(git status --porcelain)" ]] || fail 'This checkout has local changes. Save or commit them before updating.'
[[ -s apps/desktopProbe/.env ]] || fail 'Desktop configuration is missing.'

if [[ -f "$HOME/.nvm/nvm.sh" ]]; then
  source "$HOME/.nvm/nvm.sh"
  nvm use 22 >/dev/null || fail 'Node.js 22 is not installed in nvm.'
fi
[[ "$(node -p 'process.versions.node.split(".")[0]')" == 22 ]] || fail 'Node.js 22 is required.'
command -v pnpm >/dev/null || fail 'pnpm is not installed.'

node - <<'JS'
const fs = require('fs');
const dotenv = require('dotenv');
const env = dotenv.parse(fs.readFileSync('apps/desktopProbe/.env'));
for (const key of ['APP_BUNDLE_ID', 'SUPABASE_URL']) {
  if (!env[key]) throw new Error(`Desktop configuration is missing ${key}`);
}
if (!env.SUPABASE_PUBLISHABLE_KEY && !env.SUPABASE_KEY) {
  throw new Error('Desktop configuration is missing a public Supabase key');
}
JS

print 'Fetching the latest saved changes...'
git fetch origin codex/jd-analytics
git merge --ff-only FETCH_HEAD

print 'Building the desktop app...'
pnpm install --frozen-lockfile
pnpm --filter first2fetch-desktop build
if [[ "$(uname -m)" == arm64 ]]; then
  ARCH=arm64
else
  ARCH=x64
fi
(
  cd apps/desktopProbe
  pnpm exec electron-forge package --arch "$ARCH"
)

BUILT_APP="$PROJECT_DIR/apps/desktopProbe/out/First 2 Fetch-darwin-$ARCH/First 2 Fetch.app"
INSTALLED_APP='/Applications/First 2 Fetch.app'
[[ -d "$BUILT_APP" ]] || fail 'The packaged app was not created.'

# This local signature lets the app run on this Mac. It is not an Apple Developer ID signature.
codesign --force --deep --sign - "$BUILT_APP"
codesign --verify --deep --strict "$BUILT_APP"

STAGING_DIR=$(mktemp -d '/Applications/.first2fetch-update.XXXXXX')
STAGED_APP="$STAGING_DIR/First 2 Fetch.app"
BACKUP_APP="$STAGING_DIR/previous.app"
ditto "$BUILT_APP" "$STAGED_APP"
codesign --verify --deep --strict "$STAGED_APP"

# Keep the current app until the replacement is complete.
if [[ -d "$INSTALLED_APP" ]]; then
  osascript -e 'tell application "First 2 Fetch" to quit' >/dev/null 2>&1 || true
  for (( attempt = 0; attempt < 30; attempt++ )); do
    pgrep -f '^/Applications/First 2 Fetch.app/Contents/MacOS/First 2 Fetch$' >/dev/null || break
    sleep 1
  done
  pgrep -f '^/Applications/First 2 Fetch.app/Contents/MacOS/First 2 Fetch$' >/dev/null && fail 'The running app did not quit.'
  mv "$INSTALLED_APP" "$BACKUP_APP"
fi

if ! mv "$STAGED_APP" "$INSTALLED_APP"; then
  [[ ! -d "$BACKUP_APP" ]] || mv "$BACKUP_APP" "$INSTALLED_APP"
  fail 'Could not install the new app. The previous app was restored.'
fi
if ! codesign --verify --deep --strict "$INSTALLED_APP"; then
  mv "$INSTALLED_APP" "$STAGED_APP"
  [[ ! -d "$BACKUP_APP" ]] || mv "$BACKUP_APP" "$INSTALLED_APP"
  fail 'The new app failed signature verification. The previous app was restored.'
fi

open "$INSTALLED_APP"
print 'First 2 Fetch is installed and opening from Applications.'
print 'You can use it from Applications or the Dock each day.'
rm -rf "$STAGING_DIR"
