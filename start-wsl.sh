#!/usr/bin/env bash
# =============================================================================
# start-wsl.sh — TienDo WSL dev starter
# =============================================================================

set -euo pipefail

PROJECT_ROOT="/var/www/tiendo"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
PID_DIR="$PROJECT_ROOT/.dev-pids"
LOG_DIR="$BACKEND_DIR/storage/logs"
BACKEND_PORT=8000
FRONTEND_PORT=5173

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'

log()     { echo -e "${CYAN}[tiendo]${RESET} $*"; }
ok()      { echo -e "${GREEN}[tiendo]${RESET} ✓ $*"; }
warn()    { echo -e "${YELLOW}[tiendo]${RESET} ⚠ $*"; }
err()     { echo -e "${RED}[tiendo]${RESET} ✗ $*"; }
section() { echo -e "\n${BOLD}${BLUE}━━ $* ━━${RESET}"; }

mkdir -p "$PID_DIR" "$LOG_DIR"

pid_save()  { echo "$2" > "$PID_DIR/$1.pid"; }
pid_read()  { cat "$PID_DIR/$1.pid" 2>/dev/null || echo ""; }
pid_alive() { local p; p=$(pid_read "$1"); [ -n "$p" ] && kill -0 "$p" 2>/dev/null; }
pid_kill()  {
    local name=$1
    local pid; pid=$(pid_read "$name")
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null && ok "Đã dừng $name (PID $pid)"
    fi
    rm -f "$PID_DIR/$name.pid"
}

cmd_stop() {
    section "Dừng tất cả services"
    pid_kill "artisan"
    pid_kill "vite"
    pid_kill "queue"
    pid_kill "cron"
    # Kill thêm phòng trường hợp pid file không có
    fuser -k ${BACKEND_PORT}/tcp 2>/dev/null || true
    ok "Tất cả đã dừng."
}

cmd_status() {
    section "Trạng thái TienDo Dev"
    for svc in artisan queue vite cron; do
        if pid_alive "$svc"; then
            ok "$svc   đang chạy (PID $(pid_read $svc))"
        else
            warn "$svc   không chạy"
        fi
    done
    echo ""
    ss -tlnp | grep -E "5173|8000" && echo "" || warn "Không có port nào đang listen"
}

cmd_start() {

    section "PostgreSQL"
    if pg_isready -q 2>/dev/null; then
        ok "PostgreSQL đang chạy"
    else
        log "Khởi động PostgreSQL (cần sudo)..."
        sudo service postgresql start
        sleep 2
        pg_isready -q && ok "PostgreSQL sẵn sàng" || { err "PostgreSQL không khởi động được"; exit 1; }
    fi

    section "Database"
    cd "$BACKEND_DIR"
    if ! sudo -u postgres psql -lqt 2>/dev/null | cut -d'|' -f1 | grep -qw tiendo; then
        log "Tạo database tiendo..."
        sudo -u postgres psql -c "CREATE USER tiendo WITH PASSWORD 'Tiendo@2026';" 2>/dev/null || true
        sudo -u postgres psql -c "CREATE DATABASE tiendo OWNER tiendo;" 2>/dev/null || true
        ok "Database tiendo đã tạo"
    else
        ok "Database tiendo đã tồn tại"
    fi

    log "Chạy migrations..."
    php artisan migrate --force --no-interaction 2>&1 | tail -3
    ok "Migrations hoàn tất"

    php artisan storage:link --force --no-interaction 2>/dev/null || true

    local admin_exists
    admin_exists=$(php artisan tinker --execute="echo \App\Models\User::where('email','admin@tiendo.vn')->count();" 2>/dev/null | tail -1)
    if [ "$admin_exists" = "0" ]; then
        log "Tạo admin user..."
        php artisan tinker --execute="
            \App\Models\User::create([
                'name'     => 'Admin',
                'email'    => 'admin@tiendo.vn',
                'password' => bcrypt(env('ADMIN_PASSWORD','Admin@2026')),
                'role'     => 'admin',
            ]);
        " 2>/dev/null || true
        ok "Admin user đã tạo"
    else
        ok "Admin user đã tồn tại"
    fi

    section "Queue Worker"
    if pid_alive "queue"; then
        ok "Queue worker đang chạy (PID $(pid_read queue))"
    else
        pid_kill "queue"
        nohup php "$BACKEND_DIR/artisan" queue:work database \
            --queue=pdf-processing,default \
            --sleep=3 --tries=3 --timeout=300 \
            >> "$LOG_DIR/queue.log" 2>&1 &
        pid_save "queue" $!
        sleep 0.5
        pid_alive "queue" && ok "Queue worker đã khởi động (PID $(pid_read queue))" \
                          || warn "Queue worker có thể chưa khởi động"
    fi

    section "Cron Runner (schedule:run mỗi 60s)"
    if pid_alive "cron"; then
        ok "Cron đang chạy (PID $(pid_read cron))"
    else
        pid_kill "cron"
        nohup bash -c "while true; do php '$BACKEND_DIR/artisan' schedule:run --no-interaction >> '$LOG_DIR/cron.log' 2>&1; sleep 60; done" \
            >> "$LOG_DIR/cron.log" 2>&1 &
        pid_save "cron" $!
        sleep 0.5
        pid_alive "cron" && ok "Cron runner đã khởi động (PID $(pid_read cron))" \
                         || warn "Cron runner không khởi động"
    fi

    section "Vite Dev Server (port $FRONTEND_PORT)"
    if pid_alive "vite"; then
        ok "Vite đang chạy (PID $(pid_read vite))"
    else
        pid_kill "vite"
        # Kill port cũ nếu còn bị chiếm
        fuser -k ${FRONTEND_PORT}/tcp 2>/dev/null || true
        sleep 0.5
        cd "$FRONTEND_DIR"
        nohup npm run dev -- --port "$FRONTEND_PORT" \
            >> "$LOG_DIR/vite.log" 2>&1 &
        pid_save "vite" $!
        local tries=0
        while [ $tries -lt 15 ]; do
            sleep 1; tries=$((tries + 1))
            if grep -q "Local:" "$LOG_DIR/vite.log" 2>/dev/null; then
                ok "Vite sẵn sàng (PID $(pid_read vite))"
                break
            fi
        done
        [ $tries -ge 15 ] && warn "Vite chưa phản hồi — kiểm tra $LOG_DIR/vite.log"
    fi

    section "Backend API (port $BACKEND_PORT)"
    # Kill port cũ nếu còn bị chiếm
    fuser -k ${BACKEND_PORT}/tcp 2>/dev/null || true
    sleep 1
    pid_kill "artisan"
    cd "$BACKEND_DIR"
    nohup php artisan serve --host=0.0.0.0 --port="$BACKEND_PORT" \
        >> "$LOG_DIR/artisan.log" 2>&1 &
    pid_save "artisan" $!
    sleep 1
    pid_alive "artisan" && ok "Artisan serve đã khởi động (PID $(pid_read artisan))" \
                         || err "Artisan serve không khởi động — kiểm tra $LOG_DIR/artisan.log"

    echo ""
    echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo -e "${BOLD} TienDo Dev — Sẵn sàng!${RESET}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo ""
    echo -e "  Frontend : ${CYAN}http://localhost:${FRONTEND_PORT}${RESET}"
    echo -e "  API      : ${CYAN}http://localhost:${BACKEND_PORT}/api/v1/health${RESET}"
    echo -e "  Admin    : admin@tiendo.vn / Admin@2026"
    echo -e "  Logs     : $LOG_DIR/"
    echo -e "  Dừng     : bash $0 stop"
    echo ""
}

case "${1:-start}" in
    start)   cmd_start ;;
    stop)    cmd_stop ;;
    restart) cmd_stop; sleep 1; cmd_start ;;
    status)  cmd_status ;;
    *)
        echo "Dùng: bash $0 [start|stop|restart|status]"
        exit 1
        ;;
esac
