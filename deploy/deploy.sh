#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# TienDo — Deploy / Update script
# Dùng cho lần deploy đầu tiên VÀ mọi lần update sau
# Chạy: sudo bash deploy/deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DEPLOY_PATH="/var/www/tiendo"
PHP="php8.2"
ARTISAN="$PHP $DEPLOY_PATH/artisan"

cd "$DEPLOY_PATH"

echo "╔══════════════════════════════════════════╗"
echo "║  TienDo Deploy — $(date '+%Y-%m-%d %H:%M:%S')   ║"
echo "╚══════════════════════════════════════════╝"

# ── 1. Pull code ──────────────────────────────────────────────────────────────
echo ""
echo "▶ [1/9] Pull code từ git..."
git pull origin main
echo "  HEAD: $(git rev-parse --short HEAD) — $(git log -1 --format='%s')"

# ── 2. Maintenance mode ON ────────────────────────────────────────────────────
echo ""
echo "▶ [2/9] Maintenance mode ON..."
$ARTISAN down --render="errors/503" --secret="tiendo-bypass-$(date +%s)" 2>/dev/null || true

# ── 3. Composer install ───────────────────────────────────────────────────────
echo ""
echo "▶ [3/9] Composer install (production)..."
composer install \
    --no-dev \
    --optimize-autoloader \
    --no-interaction \
    --quiet

# ── 4. Frontend build ─────────────────────────────────────────────────────────
echo ""
echo "▶ [4/9] npm build..."
cd frontend
npm ci --silent
npm run build
cd ..
# Copy dist → public/assets (SPA)
cp frontend/dist/index.html public/index.html
rsync -a --delete frontend/dist/assets/ public/assets/

# ── 5. .env check ─────────────────────────────────────────────────────────────
echo ""
echo "▶ [5/9] Kiểm tra .env..."
if [ ! -f ".env" ]; then
    echo "  ERROR: file .env không tồn tại!"
    echo "  Copy deploy/.env.production thành .env và điền giá trị."
    $ARTISAN up 2>/dev/null || true
    exit 1
fi

# ── 6. Artisan commands ───────────────────────────────────────────────────────
echo ""
echo "▶ [6/9] Artisan optimize..."
# key:generate chỉ chạy nếu APP_KEY chưa có (không overwrite khi đã có — tránh invalidate tokens)
grep -q '^APP_KEY=base64:' .env || $ARTISAN key:generate --no-interaction --force
$ARTISAN migrate --force --no-interaction
$ARTISAN db:seed --class=AdminUserSeeder --force --no-interaction 2>/dev/null || true
$ARTISAN config:cache
$ARTISAN route:cache
$ARTISAN view:cache
$ARTISAN event:cache
$ARTISAN optimize

# ── 7. Storage & permissions ──────────────────────────────────────────────────
echo ""
echo "▶ [7/9] Permissions..."
$ARTISAN storage:link --force 2>/dev/null || true
chown -R www-data:www-data storage bootstrap/cache
chmod -R 775 storage bootstrap/cache
# Cho www-data viết vào storage/app (tiles, uploads)
setfacl -R -m u:www-data:rwx storage/ 2>/dev/null || true

# ── 8. Restart services ───────────────────────────────────────────────────────
echo ""
echo "▶ [8/9] Restart PHP-FPM + Supervisor worker..."
systemctl reload php8.2-fpm
supervisorctl restart tiendo-worker
supervisorctl status tiendo-worker

# ── 9. Maintenance mode OFF ───────────────────────────────────────────────────
echo ""
echo "▶ [9/9] Maintenance mode OFF..."
$ARTISAN up

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  ✅ DEPLOY THÀNH CÔNG                        ║"
echo "║  Commit: $(git rev-parse --short HEAD)                         ║"
echo "╚══════════════════════════════════════════════╝"
