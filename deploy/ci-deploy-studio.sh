#!/usr/bin/env bash
set -Eeuo pipefail

stage=${1:?stage directory required}
release=${2:?release name required}
deploy_host=${DEPLOY_HOST:?DEPLOY_HOST is required}
deploy_port=${DEPLOY_PORT:-2244}
deploy_user=${DEPLOY_USER:-root}
deploy_key=${DEPLOY_KEY_FILE:?DEPLOY_KEY_FILE is required}
remote_stage="/tmp/kalam-studio-release-$release"
ssh_opts=(-i "$deploy_key" -p "$deploy_port" -o BatchMode=yes -o StrictHostKeyChecking=yes)

ssh "${ssh_opts[@]}" "$deploy_user@$deploy_host" "rm -rf '$remote_stage' && mkdir -p '$remote_stage'"
rsync -az --delete --partial --delay-updates \
  -e "ssh ${ssh_opts[*]}" \
  "$stage/" "$deploy_user@$deploy_host:$remote_stage/"
ssh "${ssh_opts[@]}" "$deploy_user@$deploy_host" \
  "chmod 0755 '$remote_stage/deploy-studio-release.sh' && bash '$remote_stage/deploy-studio-release.sh' '$remote_stage' '$release'"

printf '%s\n' "deployed=$release" "host=$deploy_host" "remote_stage=$remote_stage"
