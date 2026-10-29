#!/usr/bin/env bash
set -Eeuo pipefail

stage=${1:?stage directory required}
release=${2:?release name required}
gateway_dir=/opt/kalam-design-gateway
web_root=/var/www/kalam-design-studio
web_release="$web_root/releases/$release"
backup="$gateway_dir/backups/$release"
old_web=$(readlink -f "$web_root/current" 2>/dev/null || true)
frontend_archive="$stage/kalam-studio-dist.tar.gz"
[[ -f "$frontend_archive" ]] || frontend_archive="$stage/kalam-studio-dist-20260830-215242.tar.gz"

rollback() {
  if [[ -f "$backup/app.py" ]]; then
    cp -a "$backup/app.py" "$gateway_dir/app.py"
    cp -a "$backup/worker.py" "$gateway_dir/worker.py"
    cp -a "$backup/video_worker.py" "$gateway_dir/video_worker.py"
    cp -a "$backup/video_prompt.py" "$gateway_dir/video_prompt.py"
  fi
  if [[ -f "$backup/image-base.txt" ]]; then
    install -o kalam-design -g kalam-design -m 0640 "$backup/image-base.txt" /var/lib/kalam-design/prompts/image-base.txt
  fi
  if [[ -f "$backup/news_story.txt" ]]; then
    install -o kalam-design -g kalam-design -m 0640 "$backup/news_story.txt" /var/lib/kalam-design/prompts/templates/news_story.txt
  fi
  if [[ -f "$backup/news_post.txt" ]]; then
    install -o kalam-design -g kalam-design -m 0640 "$backup/news_post.txt" /var/lib/kalam-design/prompts/templates/news_post.txt
  fi
  if [[ -f "$backup/poster.txt" ]]; then
    install -o kalam-design -g kalam-design -m 0640 "$backup/poster.txt" /var/lib/kalam-design/prompts/templates/poster.txt
  fi
  if [[ -f "$backup/video-assets-registry.json" ]]; then
    install -o kalam-design -g kalam-design -m 0640 "$backup/video-assets-registry.json" /var/lib/kalam-design/video-assets/registry.json
  fi
  if [[ -n "$old_web" && -d "$old_web" ]]; then
    ln -sfn "$old_web" "$web_root/current.rollback"
    mv -Tf "$web_root/current.rollback" "$web_root/current"
  fi
  systemctl restart kalam-design-gateway kalam-design-worker kalam-video-worker || true
}
trap rollback ERR

python3 -m py_compile \
  "$stage/kalam-design-gateway.app.py" \
  "$stage/kalam-design-worker.py" \
  "$stage/kalam-video-worker.py" \
  "$stage/kalam-video-prompt.py"
nginx -t

mkdir -p "$backup" "$web_release"
cp -a "$gateway_dir/app.py" "$backup/app.py"
cp -a "$gateway_dir/worker.py" "$backup/worker.py"
cp -a "$gateway_dir/video_worker.py" "$backup/video_worker.py"
cp -a "$gateway_dir/video_prompt.py" "$backup/video_prompt.py"
cp -a /var/lib/kalam-design/prompts/image-base.txt "$backup/image-base.txt"
cp -a /var/lib/kalam-design/prompts/templates/news_story.txt "$backup/news_story.txt"
if [[ -f /var/lib/kalam-design/prompts/templates/news_post.txt ]]; then
  cp -a /var/lib/kalam-design/prompts/templates/news_post.txt "$backup/news_post.txt"
fi
cp -a /var/lib/kalam-design/prompts/templates/poster.txt "$backup/poster.txt"
cp -a /var/lib/kalam-design/video-assets/registry.json "$backup/video-assets-registry.json"

tar -xzf "$frontend_archive" -C "$web_release"
chown -R www-data:www-data "$web_release"
find "$web_release" -type d -exec chmod 0755 {} +
find "$web_release" -type f -exec chmod 0644 {} +

install -o root -g root -m 0755 "$stage/kalam-design-gateway.app.py" "$gateway_dir/app.py"
install -o root -g root -m 0755 "$stage/kalam-design-worker.py" "$gateway_dir/worker.py"
install -o root -g kalam-design -m 0640 "$stage/kalam-video-worker.py" "$gateway_dir/video_worker.py"
install -o root -g kalam-design -m 0640 "$stage/kalam-video-prompt.py" "$gateway_dir/video_prompt.py"
install -o kalam-design -g kalam-design -m 0640 "$stage/image-base.production.fa.txt" /var/lib/kalam-design/prompts/image-base.txt
install -o kalam-design -g kalam-design -m 0640 "$stage/news_story.master.fa.txt" /var/lib/kalam-design/prompts/templates/news_story.txt
install -o kalam-design -g kalam-design -m 0640 "$stage/news_post.master.fa.txt" /var/lib/kalam-design/prompts/templates/news_post.txt
install -o kalam-design -g kalam-design -m 0640 "$stage/poster.production.fa.txt" /var/lib/kalam-design/prompts/templates/poster.txt

if [[ -f "$stage/kalam-newsroom-assets-v1.tar.gz" && -f "$stage/register-newsroom-reference-assets.py" ]]; then
  newsroom_stage="$stage/newsroom-assets"
  mkdir -p "$newsroom_stage"
  tar -xzf "$stage/kalam-newsroom-assets-v1.tar.gz" -C "$newsroom_stage"
  python3 "$stage/register-newsroom-reference-assets.py" "$newsroom_stage" /var/lib/kalam-design/video-assets
fi
if [[ -f "$stage/approved-reference-assets-20260831.tar.gz" ]]; then
  approved_stage="$stage/approved-reference-assets"
  mkdir -p "$approved_stage"
  tar -xzf "$stage/approved-reference-assets-20260831.tar.gz" -C "$approved_stage"
  python3 "$stage/register-approved-reference-assets-20260831.py" "$approved_stage" /var/lib/kalam-design/video-assets
fi
chown -R kalam-design:kalam-design /var/lib/kalam-design/video-assets

ln -sfn "$web_release" "$web_root/current.next"
mv -Tf "$web_root/current.next" "$web_root/current"
systemctl restart kalam-design-gateway kalam-design-worker kalam-video-worker
sleep 2
systemctl is-active --quiet kalam-design-gateway
systemctl is-active --quiet kalam-design-worker
systemctl is-active --quiet kalam-video-worker
curl -fsS http://127.0.0.1:8091/healthz >/dev/null

trap - ERR
printf '%s\n' "deployed=$release" "frontend=$web_release"
sha256sum "$gateway_dir/app.py" "$gateway_dir/worker.py" "$gateway_dir/video_worker.py" "$gateway_dir/video_prompt.py"
