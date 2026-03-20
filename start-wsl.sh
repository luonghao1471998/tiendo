#!/usr/bin/env bash
# ============================================================
# TienDo — WSL Dev Startup Script
# Chạy: bash start-wsl.sh [stop]
# Backend Laravel nằm trong ./backend/
# ============================================================
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
PID_DIR="$SCRIPT_DIR/.dev-pids"
mkdir -p "$PID_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
info() { echo -e "${BLUE}→${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }

# ── STOP mode ───────────────────────────────────────────────
if [[ "$1" == "stop" ]]; then
  echo "Dừng các process..."
  for f in "$PID_DIR"/*.pid; do
    [[ -f "$f" ]] || continue
    pid=$(cat "$f")
    name=$(basename "$f" .pid)
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null && ok "Đã dừng $name (pid $pid)" || warn "Không dừng được $name"
    fi
    rm -f "$f"
  done
  exit 0
fi

echo ""
echo -e "${BLUE}╔══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        TienDo — WSL Dev Mode         ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════╝${NC}"
echo ""

# ── 1. PostgreSQL ────────────────────────────────────────────
info "Khởi động PostgreSQL..."
if sudo service postgresql start 2>/dev/null; then
  ok "PostgreSQL đang chạy"
else
  warn "Không start được PostgreSQL (có thể đã chạy rồi)"
fi
sleep 1

# ── 2. Kiểm tra kết nối DB ───────────────────────────────────
cd "$BACKEND_DIR"
if ! php artisan db:show --json >/dev/null 2>&1; then
  warn "Kết nối DB thất bại — thử tạo DB..."
  sudo -u postgres psql -c "CREATE USER tiendo WITH PASSWORD 'Tiendo@2026';" 2>/dev/null || true
  sudo -u postgres psql -c "CREATE DATABASE tiendo OWNER tiendo;" 2>/dev/null || true
  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE tiendo TO tiendo;" 2>/dev/null || true
  ok "Tạo DB tiendo xong"
fi
ok "Kết nối PostgreSQL OK"

# ── 3. Migrations ────────────────────────────────────────────
info "Chạy migrations..."
php artisan migrate --no-interaction --force 2>&1 | tail -5
ok "Migrations done"

# ── 4. Storage link ──────────────────────────────────────────
if [[ ! -L "$BACKEND_DIR/public/storage" ]]; then
  php artisan storage:link 2>/dev/null && ok "Storage link created" || true
fi

# ── 5. Queue worker (background) ─────────────────────────────────────────────
QUEUE_PID_FILE="$PID_DIR/queue.pid"
if [[ -f "$QUEUE_PID_FILE" ]] && kill -0 "$(cat "$QUEUE_PID_FILE")" 2>/dev/null; then
  ok "Queue worker đã chạy (pid $(cat "$QUEUE_PID_FILE"))"
else
  info "Khởi động queue worker..."
  nohup php artisan queue:work database \
    --queue=pdf-processing,default \
    --sleep=3 --tries=3 --timeout=300 \
    >> "$BACKEND_DIR/storage/logs/queue.log" 2>&1 &
  echo $! > "$QUEUE_PID_FILE"
  ok "Queue worker started (pid $!)"
fi

# ── 6. Laravel backend (php artisan serve) ───────────────────────────────────
SERVE_PID_FILE="$PID_DIR/serve.pid"
if [[ -f "$SERVE_PID_FILE" ]] && kill -0 "$(cat "$SERVE_PID_FILE")" 2>/dev/null; then
  ok "Laravel serve đã chạy (pid $(cat "$SERVE_PID_FILE"))"
else
  info "Khởi động Laravel backend port 8000..."
  nohup php artisan serve --host=0.0.0.0 --port=8000 \
    >> "$BACKEND_DIR/storage/logs/serve.log" 2>&1 &
  echo $! > "$SERVE_PID_FILE"
  ok "Laravel serve started (pid $!)"
fi

sleep 2

# ── 7. Seed admin nếu chưa có ───────────────────────────────────────────────
ADMIN_EXISTS=$(php artisan tinker --execute="echo \App\Models\User::where('role','admin')->count();" 2>/dev/null | tr -d '[:space:]')
if [[ "$ADMIN_EXISTS" == "0" ]]; then
  info "Tạo tài khoản admin mặc định..."
  ADMIN_PASS="${ADMIN_PASSWORD:-Admin@2026}"
  php artisan tinker --execute="
    \App\Models\User::create([
      'name'=>'Admin','email'=>'admin@tiendo.vn',
      'password'=>\Illuminate\Support\Facades\Hash::make('$ADMIN_PASS'),
      'role'=>'admin','is_active'=>true
    ]); echo 'done';
  " 2>/dev/null && ok "Admin created (admin@tiendo.vn / $ADMIN_PASS)" || warn "Tạo admin thất bại"
fi

# ── Summary ──────────────────────────────────────────────────
echo ""
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo -e "${GREEN}  TienDo đang chạy! 🚀${NC}"
echo -e "${GREEN}══════════════════════════════════════════${NC}"
echo ""
echo -e "  ${YELLOW}Backend API${NC}  → http://localhost:8000/api/v1"
echo -e "  ${YELLOW}Frontend Dev${NC} → http://localhost:5173  (chạy: npm run dev)"
echo ""
echo -e "  ${BLUE}Log queue:${NC}   tail -f $BACKEND_DIR/storage/logs/queue.log"
echo -e "  ${BLUE}Log serve:${NC}   tail -f $BACKEND_DIR/storage/logs/serve.log"
echo ""
echo -e "  ${YELLOW}Dừng tất cả:${NC} bash start-wsl.sh stop"
echo ""
echo -e "${BLUE}Bước tiếp theo — mở terminal mới và chạy:${NC}"
echo -e "  ${GREEN}cd /var/www/tiendo/frontend && npm run dev${NC}"
echo ""
