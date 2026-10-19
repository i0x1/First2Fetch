#!/bin/zsh -l

set -u
cd "${0:A:h}"

fail() {
  print -u2 "\nFirst 2 Fetch could not start: $1"
  print -u2 "Press Return to close this window."
  read -r _
  exit 1
}

# Use the Node release tested with this Electron app when nvm is installed.
if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
  source "$HOME/.nvm/nvm.sh"
  nvm use 22 >/dev/null 2>&1 || fail "Node.js 22 is not installed in nvm. Install Node.js 22, then run this file again."
fi

command -v node >/dev/null 2>&1 || fail "Node.js is not installed. Install Node.js 22, then run this file again."
[[ "$(node -p 'process.versions.node.split(`.`)[0]')" == "22" ]] || fail "This app needs Node.js 22. The active version is $(node --version). Install Node.js 22 or enable it with nvm."
command -v pnpm >/dev/null 2>&1 || fail "pnpm is not installed. Install pnpm 10, then run this file again."
[[ -f apps/desktopProbe/.env ]] || fail "apps/desktopProbe/.env is missing. Restore the local app configuration before starting."
[[ -d node_modules ]] || fail "Dependencies are missing. From this folder, run: pnpm install"
if pgrep -f '/Applications/First 2 Fetch.app/Contents/MacOS/First 2 Fetch' >/dev/null 2>&1; then
  fail "The packaged app is still open. Quit First 2 Fetch, then run this launcher again. Both copies share sign-in and settings, so only one can run at a time."
fi

# Polling avoids macOS file watcher exhaustion (EMFILE) in this large workspace.
export WATCHPACK_POLLING=true
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--dns-result-order=ipv4first"
pnpm --filter first2fetch-desktop start
exit_code=$?
if (( exit_code != 0 )); then
  print -u2 "\nFirst 2 Fetch stopped with exit code $exit_code. Review the messages above."
  print -u2 "Press Return to close this window."
  read -r _
fi
exit $exit_code
