#!/bin/zsh -l
set -e
cd "${0:A:h}"
exec pnpm --filter first2fetch-desktop start
