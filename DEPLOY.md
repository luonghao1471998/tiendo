# DEPLOY.md — TienDo
> Hướng dẫn deploy lên VPS Ubuntu 22.04 từ đầu đến cuối.
> Đọc từng bước, không bỏ qua.

---

## Yêu cầu VPS

| Thông số | Tối thiểu | Khuyến nghị |
|---|---|---|
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| RAM | 2GB | 4GB |
| CPU | 1 vCPU | 2 vCPU |
| Disk | 20GB | 50GB (PDF files) |
| Domain | Cần trỏ A record về IP VPS | — |

---

## Bước 0 — Chuẩn bị DNS

Vào nhà cung cấp domain, thêm A record:

```
Type: A
Name: @ (hoặc app, tùy subdomain bạn muốn)
Value: <IP VPS>
TTL: 300
```

Đợi DNS propagate (5–30 phút), kiểm tra bằng `nslookup YOUR_DOMAIN`.

---

## Bước 1 — Clone code lên server

SSH vào server:

```bash
ssh root@YOUR_VPS_IP
```

Clone repo:

```bash
cd /var/www
git clone https://github.com/YOUR_USERNAME/tiendo.git tiendo
# Hoặc nếu không có git remote, upload bằng scp/rsync:
# scp -r /var/www/tiendo root@YOUR_VPS_IP:/var/www/tiendo
```

---

## Bước 2 — Chạy install.sh

Script này cài toàn bộ dependencies từ đầu (PHP 8.2, PostgreSQL, Nginx, Supervisor, Python libs):

```bash
cd /var/www/tiendo
chmod +x deploy/install.sh deploy/deploy.sh
sudo bash deploy/install.sh YOUR_DOMAIN
```

**Lưu lại DB_PASS** từ output cuối script — cần dùng trong bước tiếp.

---

## Bước 3 — Tạo file .env

```bash
cd /var/www/tiendo
cp deploy/.env.production .env
nano .env   # hoặc vim .env
```

Điền các giá trị:

```env
APP_URL=https://YOUR_DOMAIN
DB_DATABASE=tiendo_prod
DB_USERNAME=tiendo_user
DB_PASSWORD=<DB_PASS từ bước 2>
FRONTEND_URL=https://YOUR_DOMAIN
```

---

## Bước 4 — Chạy deploy.sh (lần đầu)

```bash
sudo bash deploy/deploy.sh
```

Script sẽ:
1. Build frontend React (`npm ci && npm run build`)
2. `composer install --no-dev`
3. `php artisan migrate` — tạo toàn bộ tables
4. `php artisan db:seed --class=AdminUserSeeder` — tạo user admin@tiendo.vn
5. Cache config/route/view
6. Set permissions storage/
7. Restart PHP-FPM + Supervisor worker

---

## Bước 5 — Cài SSL (Let's Encrypt)

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d YOUR_DOMAIN -d www.YOUR_DOMAIN
```

Certbot tự sửa nginx.conf để thêm SSL config. Kiểm tra auto-renewal:

```bash
certbot renew --dry-run
```

---

## Bước 6 — Kiểm tra

```bash
# Health check API
curl https://YOUR_DOMAIN/api/v1/health

# Queue worker đang chạy
sudo supervisorctl status tiendo-worker

# PHP-FPM pool tiendo
sudo systemctl status php8.2-fpm

# Nginx
sudo nginx -t && sudo systemctl status nginx

# Logs
tail -f /var/log/supervisor/tiendo-worker.log
tail -f /var/log/nginx/tiendo-error.log
```

---

## Bước 7 — Login lần đầu

Tài khoản admin mặc định (tạo bởi AdminUserSeeder):

```
Email:    admin@tiendo.vn
Password: admin123   ← ĐỔI NGAY sau khi login
```

Đổi password qua Admin → Quản lý người dùng hoặc trực tiếp DB:

```bash
cd /var/www/tiendo
php8.2 artisan tinker
>>> \App\Models\User::where('email','admin@tiendo.vn')->first()->update(['password' => bcrypt('NEW_PASS')]);
```

---

## Deploy update (lần sau)

Mỗi khi có code mới:

```bash
cd /var/www/tiendo
sudo bash deploy/deploy.sh
```

Script tự xử lý: pull → build → migrate → cache → restart.

---

## Cấu hình Cron (Scheduler)

```bash
crontab -e -u www-data
```

Thêm dòng:

```cron
* * * * * cd /var/www/tiendo && /usr/bin/php8.2 artisan schedule:run >> /dev/null 2>&1
```

Scheduler chạy `tiendo:check-deadlines` lúc 06:00 hàng ngày (deadline notifications).

---

## Chạy song song PHP 7.4 (nếu có projects cũ)

TienDo dùng pool PHP-FPM riêng (`tiendo.conf` → socket `php8.2-fpm-tiendo.sock`).
Projects PHP 7.4 dùng pool khác (socket `php7.4-fpm.sock`).
Nginx phân biệt qua `server_name` → không đụng nhau.

Kiểm tra PHP 7.4 còn chạy:

```bash
systemctl status php7.4-fpm
```

---

## Cấu trúc storage trên server

```
/var/www/tiendo/storage/app/
├── layers/
│   └── {layer_id}/
│       ├── original.pdf
│       └── tiles/
│           ├── 0_0_0.jpg
│           ├── 0_1_0.jpg
│           └── ...
└── comments/
    └── {comment_id}/
        └── {uuid}.jpg
```

Backup định kỳ thư mục này — đây là dữ liệu quan trọng nhất.

---

## Troubleshooting

### PDF processing thất bại (layer status = failed)

```bash
# Kiểm tra Python + poppler
python3 /var/www/tiendo/scripts/pdf_processor.py --help
which pdftoppm    # phải có (từ poppler-utils)
pip3 show pdf2image Pillow

# Log queue worker
tail -100 /var/log/supervisor/tiendo-worker.log
```

### 502 Bad Gateway

```bash
# PHP-FPM socket có tồn tại không?
ls /run/php/php8.2-fpm-tiendo.sock
sudo systemctl restart php8.2-fpm
```

### 413 Request Entity Too Large khi upload PDF

```bash
# Kiểm tra nginx client_max_body_size (phải >= 60M)
grep client_max_body_size /etc/nginx/sites-available/tiendo

# Kiểm tra PHP upload limit
php8.2 -r "echo ini_get('upload_max_filesize');"
```

### Queue worker không restart sau deploy

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl restart tiendo-worker
```

---

## Backup

```bash
# Backup database
sudo -u postgres pg_dump tiendo_prod > /backup/tiendo-$(date +%Y%m%d).sql

# Backup storage (tiles + uploads)
tar -czf /backup/tiendo-storage-$(date +%Y%m%d).tar.gz /var/www/tiendo/storage/app/
```

Nên setup cron backup hàng ngày vào lúc 03:00.
