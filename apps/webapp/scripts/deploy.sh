#!/usr/bin/env bash
set -euo pipefail

app_dir=${1:?Provide the existing deployment directory}
image=${2:?Provide the tested image tag or digest}
cd "$app_dir"
test -f .env && test -f docker-compose.yml
previous_image=''
if [[ -f .deployed-image ]]; then previous_image=$(<.deployed-image); fi
export WEBAPP_IMAGE="$image"
docker compose config --quiet
docker compose pull
if ! docker compose up -d --wait --wait-timeout 90; then
  if [[ -n "$previous_image" ]]; then
    export WEBAPP_IMAGE="$previous_image"
    docker compose up -d --wait --wait-timeout 90
  fi
  exit 1
fi
printf '%s\n' "$image" > .deployed-image
printf 'Healthy web companion: %s\n' "$image"
