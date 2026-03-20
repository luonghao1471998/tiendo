#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# TienDo — Install script (Ubuntu 22.04 fresh server)
# Chạy: sudo bash install.sh YOUR_DOMAIN
# VD:   sudo bash install.sh app.tiendo.vn
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="${1:-YOUR_DOMAIN}"
DEPLOY_PATH="/var/www/tiendo"
DB_NAME="tiendo_prod"
DB_USER="tiendo_user"
DB_PASS="$(openssl rand -base64 20)"  # random password, sẽ print ở cuối

echo "╔══════════════════════════════════════════════╗"
echo "║  TienDo Install — Ubuntu 22.04               ║"
echo "║  Domain: $DOMAIN"
echo "╚══════════════════════════════════════════════╝"

# ── 1. System packages ────────────────────────────────────────────────────────
echo ""
echo "▶ [1/9] Cài system packages..."
apt-get update -qq
apt-get install -y -qq \
    nginx \
    supervisor \
    curl \
    unzip \
    git \
    acl \
    python3 \
    python3-pip \
    poppler-utils \
    software-properties-common

# ── 2. PHP 8.2 ───────────────────────────────────────────────────────────────
echo ""
echo "▶ [2/9] Cài PHP 8.2..."
add-apt-repository -y ppa:ondrej/php
apt-get update -qq
apt-get install -y -qq \
    php8.2-fpm \
    php8.2-cli \
    php8.2-pgsql \
    php8.2-mbstring \
    php8.2-xml \
    php8.2-zip \
    php8.2-curl \
    php8.2-gd \
    php8.2-bcmath \
    php8.2-intl \
    php8.2-readline

# ── 3. Composer ──────────────────────────────────────────────────────────────
echo ""
echo "▶ [3/9] Cài Composer..."
if ! command -v composer &>/dev/null; then
    EXPECTED_CHECKSUM="$(php -r 'copy("https://composer.github.io/installer.sig", "php://stdout");')"
    php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
    ACTUAL_CHECKSUM="$(php -r "echo hash_file('sha384', 'composer-setup.php');")"
    if [ "$EXPECTED_CHECKSUM" != "$ACTUAL_CHECKSUM" ]; then
        echo "ERROR: Composer installer corrupt" >&2
        rm composer-setup.php
        exit 1
    fi
    php composer-setup.php --install-dir=/usr/local/bin --filename=composer --quiet
    rm composer-setup.php
fi
echo "  Composer $(composer --version --no-ansi | head -1)"

# ── 4. Node.js 20 (để build frontend) ────────────────────────────────────────
echo ""
echo "▶ [4/9] Cài Node.js 20..."
if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
fi
echo "  Node $(node --version), npm $(npm --version)"

# ── 5. PostgreSQL 14 ──────────────────────────────────────────────────────────
echo ""
echo "▶ [5/9] Cài PostgreSQL 14..."
apt-get install -y -qq postgresql-14 postgresql-client-14

# Tạo DB + user
echo "  Tạo database $DB_NAME và user $DB_USER..."
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true

# ── 6. Python dependencies ────────────────────────────────────────────────────
echo ""
echo "▶ [6/9] Cài Python PDF libs..."
pip3 install -q pdf2image Pillow

# ── 7. PHP-FPM pool config ────────────────────────────────────────────────────
echo ""
echo "▶ [7/9] Cấu hình PHP-FPM pool tiendo..."
cp "$DEPLOY_PATH/deploy/php-fpm-tiendo.conf" /etc/php/8.2/fpm/pool.d/tiendo.conf
# Disable pool www mặc định nếu không cần (có thể PHP 7.4 dùng)
# systemctl restart php8.2-fpm

# ── 8. Nginx config ───────────────────────────────────────────────────────────
echo ""
echo "▶ [8/9] Cấu hình Nginx..."
sed "s/YOUR_DOMAIN/$DOMAIN/g" "$DEPLOY_PATH/deploy/nginx.conf" \
    > /etc/nginx/sites-available/tiendo
ln -sf /etc/nginx/sites-available/tiendo /etc/nginx/sites-enabled/tiendo
nginx -t && systemctl reload nginx

# ── 9. Supervisor config ──────────────────────────────────────────────────────
echo ""
echo "▶ [9/9] Cấu hình Supervisor worker..."
cp "$DEPLOY_PATH/deploy/supervisor.conf" /etc/supervisor/conf.d/tiendo-worker.conf
supervisorctl reread
supervisorctl update

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║  ✅ INSTALL HOÀN TẤT                                            ║"
echo "║                                                                  ║"
echo "║  DB_NAME:     $DB_NAME                                    ║"
echo "║  DB_USER:     $DB_USER                                    ║"
echo "║  DB_PASS:     $DB_PASS    (lưu lại!)  ║"
echo "║                                                                  ║"
echo "║  Bước tiếp theo: chạy  deploy/deploy.sh  để deploy code         ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
