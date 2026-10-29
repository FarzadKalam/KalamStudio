#!/usr/bin/env bash
set -Eeuo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
frontend_dir="$repo_root/kalam-design-studio/apps/admin-miniapp"
club_portal_dir="$repo_root/kalam-design-studio/apps/club-portal"
release="${RELEASE_NAME:-studio-${GITHUB_SHA:-local-$(date -u +%Y%m%d%H%M%S)}}"
stage="${1:-$repo_root/.release/$release}"

rm -rf "$stage"
mkdir -p "$stage"

if [[ ! -f "$frontend_dir/.env.production" ]]; then
  cp "$frontend_dir/.env.example" "$frontend_dir/.env.production"
fi

npm ci --prefix "$frontend_dir"
npm ci --prefix "$club_portal_dir"
npm run build --prefix "$frontend_dir"

cp "$repo_root/deploy/kalam-design-gateway.app.py" "$stage/"
cp "$repo_root/deploy/kalam-design-worker.py" "$stage/"
cp "$repo_root/deploy/kalam-video-worker.py" "$stage/"
cp "$repo_root/deploy/kalam-video-prompt.py" "$stage/"
cp "$repo_root/deploy/deploy-studio-release.sh" "$stage/"
cp "$repo_root/deploy/prompts/image-base.production.fa.txt" "$stage/"
cp "$repo_root/deploy/prompts/news_story.master.fa.txt" "$stage/"
cp "$repo_root/deploy/prompts/news_post.master.fa.txt" "$stage/"
cp "$repo_root/deploy/prompts/poster.production.fa.txt" "$stage/"

tar -czf "$stage/kalam-studio-dist.tar.gz" -C "$frontend_dir/dist" .
python3 -m py_compile "$stage/kalam-design-gateway.app.py" "$stage/kalam-design-worker.py" "$stage/kalam-video-worker.py" "$stage/kalam-video-prompt.py"

printf '%s\n' "release=$release" "stage=$stage" "frontend_archive=$stage/kalam-studio-dist.tar.gz"
