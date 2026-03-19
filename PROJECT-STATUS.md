# PROJECT-STATUS.md — TienDo
> File này dùng để upload lên Claude AI Web / Project để AI giữ context xuyên phiên.
> Cập nhật sau mỗi session. Source of truth: SPEC.md + CLAUDE.md.
> **Ngày cập nhật:** 2026-03-19

---

## 1. Tổng quan dự án

**TienDo** — Quản lý tiến độ thi công trực quan trên bản vẽ PDF.

- PM khoanh zone trên bản vẽ → field team tô mark tiến độ → dashboard real-time
- Stack: Laravel 11 (PHP 8.2) + PostgreSQL 14 + React 18 + TypeScript + Vite + Fabric.js 5.x
- Server: Ubuntu 22.04 + Nginx + Supervisor (queue) + Certbot SSL

---

## 2. Trạng thái hiện tại

### ✅ Backend API — HOÀN TẤT 100%

**66 feature tests / 300 assertions — tất cả pass** (PostgreSQL `tiendo_test`)

#### Toàn bộ API endpoints đã có:

```
AUTH
  POST   /api/v1/auth/login
  POST   /api/v1/auth/logout
  GET    /api/v1/auth/me

PROJECT
  GET    /api/v1/projects
  POST   /api/v1/projects                          (admin only)
  GET    /api/v1/projects/{id}                     (+ stats summary)
  PUT    /api/v1/projects/{id}
  DELETE /api/v1/projects/{id}

MEMBERS
  GET    /api/v1/projects/{id}/members
  POST   /api/v1/projects/{id}/members/invite      (tạo user mới → temporary_password 1 lần)
  DELETE /api/v1/projects/{id}/members/{userId}

MASTER LAYER / LAYER
  GET    /api/v1/projects/{id}/master-layers
  POST   /api/v1/projects/{id}/master-layers
  PUT    /api/v1/master-layers/{id}
  DELETE /api/v1/master-layers/{id}
  POST   /api/v1/master-layers/{id}/layers         (upload PDF → ProcessPdfJob → tiles)
  GET    /api/v1/layers/{id}
  DELETE /api/v1/layers/{id}
  GET    /api/v1/layers/{id}/tiles/{z}/{x}/{y}     (auth, Cache-Control: max-age=86400)
  POST   /api/v1/layers/{id}/retry

ZONE
  GET    /api/v1/layers/{id}/zones
  POST   /api/v1/layers/{id}/zones
  GET    /api/v1/zones/{id}
  PUT    /api/v1/zones/{id}
  PATCH  /api/v1/zones/{id}/status                 (state machine, PATCH-03)
  DELETE /api/v1/zones/{id}

MARK
  GET    /api/v1/zones/{id}/marks
  POST   /api/v1/zones/{id}/marks
  PATCH  /api/v1/marks/{id}/status
  DELETE /api/v1/marks/{id}

COMMENT + ẢNH
  GET    /api/v1/zones/{id}/comments
  POST   /api/v1/zones/{id}/comments               (multipart, max 5 ảnh/10MB)
  DELETE /api/v1/comments/{id}
  GET    /api/v1/comments/{id}/images/{filename}   (auth)

SYNC
  GET    /api/v1/layers/{id}/sync?since=ISO8601    (polling 30s)

ACTIVITY LOG + ROLLBACK
  GET    /api/v1/layers/{id}/history               (kể cả deleted entities)
  GET    /api/v1/zones/{id}/history
  POST   /api/v1/activity-logs/{id}/rollback       (PM/admin only)

EXPORT
  GET    /api/v1/layers/{id}/export/excel
  GET    /api/v1/projects/{id}/export/excel

EXCEL IMPORT (Sprint 3)
  POST   /api/v1/layers/{id}/import                (preview — không ghi DB)
  POST   /api/v1/excel-imports/{id}/apply          (batch update zones, 1 lần)

SHARE LINK (Sprint 3 — viewer-only)
  GET    /api/v1/projects/{id}/share-links
  POST   /api/v1/projects/{id}/share-links         {expires_in_days: 1|7|30}
  DELETE /api/v1/share-links/{id}
  GET    /api/v1/share/{token}                     ← PUBLIC, không cần auth; 410 nếu hết hạn

NOTIFICATION
  GET    /api/v1/notifications
  GET    /api/v1/notifications/unread-count
  PATCH  /api/v1/notifications/{id}/read
  PATCH  /api/v1/notifications/read-all

ANALYTICS
  POST   /api/v1/analytics/events
```

#### Background tasks:
- **Queue worker:** `php artisan queue:work --queue=pdf-processing` (Supervisor, 1 process, timeout 120s, tries 3)
- **Cron:** `tiendo:check-deadlines` chạy `dailyAt('06:00')` — tìm zone deadline ≤ 3 ngày, notify PM + assignee, có dedupe

---

### 🚧 Frontend React SPA — SCAFFOLD TRỐNG

Files đã được tạo nhưng chỉ là placeholder (return `<div>...</div>`):

```
frontend/src/
├── api/client.ts          ← Axios instance + Bearer interceptor (CÓ nội dung)
├── stores/
│   ├── authStore.ts       ← Zustand, có skeleton login/logout (CÓ nội dung)
│   ├── projectStore.ts    ← Zustand, scaffold
│   └── canvasStore.ts     ← Zustand, scaffold
├── lib/
│   ├── geometry.ts        ← toPercent/fromPercent (scaffold)
│   ├── constants.ts       ← status colors (scaffold)
│   └── utils.ts
├── pages/
│   ├── Login.tsx          ← TRỐNG (return <div>Login</div>)
│   ├── ProjectList.tsx    ← TRỐNG
│   ├── ProjectDetail.tsx  ← TRỐNG
│   ├── CanvasEditor.tsx   ← TRỐNG
│   ├── CanvasProgress.tsx ← TRỐNG
│   ├── CanvasView.tsx     ← TRỐNG
│   ├── Notifications.tsx  ← TRỐNG
│   ├── AdminUsers.tsx     ← TRỐNG
│   └── ShareView.tsx      ← TRỐNG
└── components/canvas/
    ├── CanvasWrapper.tsx  ← TRỐNG (chưa có CSS transform zoom/pan)
    ├── TileLayer.tsx      ← TRỐNG
    ├── PolygonLayer.tsx   ← TRỐNG
    ├── PolygonDrawLayer.tsx ← TRỐNG
    ├── MarkDrawLayer.tsx  ← TRỐNG
    ├── StatusPopup.tsx    ← TRỐNG
    └── ZoomControls.tsx   ← TRỐNG
```

**Chưa làm gì frontend** — toàn bộ UI cần implement từ đầu.

---

### ❌ Deploy VPS — CHƯA LÀM

Cần:
- Nginx config (PHP 8.2 FPM pool riêng, song song PHP 7.4 cho projects cũ)
- Supervisor config (queue worker `pdf-processing`)
- Cron (`* * * * * php artisan schedule:run`)
- `.env` production
- Certbot SSL

---

## 3. Kiến trúc Backend (đã build)

### Pattern bắt buộc:
```
Request → Controller (FormRequest + authorize Policy)
        → Service (business logic)
        → Repository (Eloquent queries)
        → Resource (JSON response)
```

### Key constraints cần nhớ khi làm frontend:
- Tọa độ zone/mark lưu **% (0.0–1.0)** — KHÔNG phải pixel
- Zoom/pan qua **CSS transform** trên CanvasWrapper — KHÔNG dùng Fabric.js zoom API
- Render order: tiles → zone fill → mark fill → zone border → labels
- **KHÔNG dùng PDF.js** — tiles serve từ `/layers/{id}/tiles/{z}/{x}/{y}`
- Polling sync mỗi **30 giây** khi đang mở canvas
- Public route `/api/v1/share/{token}` — nginx không được block

### Zone status colors:
```
not_started → #9CA3AF  (chỉ viền, không fill)
in_progress → #F59E0B  (fill opacity 0.15)
completed   → #10B981  (fill opacity 0.15)
delayed     → #EF4444  (fill opacity 0.15)
paused      → #8B5CF6  (fill opacity 0.15)
```

### Response format chuẩn:
```json
// Success
{ "success": true, "data": {...} }
{ "success": true, "data": [...], "meta": { "current_page": 1, "per_page": 20, "total": 45 } }

// Error
{ "success": false, "error": { "code": "ERROR_CODE", "message": "...", "details": {} } }
```

### Error codes hay gặp:
| Code | HTTP | Tình huống |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Input sai, business rule vi phạm |
| `FORBIDDEN` | 403 | Không đủ quyền |
| `NOT_FOUND` | 404 | Resource không tồn tại |
| `INVALID_STATE_TRANSITION` | 422 | Zone status transition không hợp lệ |
| `INVALID_ROLLBACK` | 422 | Đã rollback rồi hoặc action=restored |
| `SHARE_LINK_INVALID` | 410 | Share link hết hạn hoặc bị revoked |

---

## 4. RBAC

```
Global role (users.role):  admin
Project role (project_members.role): project_manager | field_team | viewer

admin          → toàn quyền mọi project (không cần gán vào project_members)
project_manager → CRUD zone, quản lý members, mọi transition, export, rollback
field_team     → update status/% + tô mark CHỈ trên zone assigned cho mình
viewer         → read-only + export
```

**Member invite:**
- `POST /projects/{id}/members/invite {email, name?, role}`
- Email chưa có → tạo user + response có `temporary_password` (chỉ 1 lần, không lưu DB)
- PM chỉ tạo được `field_team` / `viewer` — không tạo `project_manager`

---

## 5. Việc cần làm tiếp theo

### Ưu tiên 1 — Frontend React SPA
Thứ tự implement đề xuất:

**Batch 1 — Auth + Navigation:**
1. `Login.tsx` — form email/password → POST /auth/login → lưu token vào authStore
2. `authStore.ts` — hoàn thiện: login, logout, me, hasProjectRole()
3. `App.tsx` + routing — protected routes
4. `ProjectList.tsx` — list projects, click → ProjectDetail

**Batch 2 — Canvas core:**
5. `projectStore.ts` — load project + masterLayers + layers
6. `CanvasWrapper.tsx` — CSS transform zoom/pan (wheel + drag)
7. `TileLayer.tsx` — render `<img>` tiles từ `/layers/{id}/tiles/0/{x}/{y}`
8. `PolygonLayer.tsx` — Fabric.js: render zones (màu theo status) + marks (cam/xanh)
9. `PolygonDrawLayer.tsx` — draw tool: rect/circle/polygon → POST /layers/{id}/zones
10. `ZoneDetailPanel` — click zone → status, %, assignee, deadline, notes

**Batch 3 — Mark + Progress:**
11. `MarkDrawLayer.tsx` — draw mark trên Progress page
12. `StatusPopup.tsx` — quick status change + % slider
13. `canvasStore.ts` — sync polling 30s, optimistic update

**Batch 4 — Dashboard + Notifications:**
14. `ProjectDetail.tsx` — tabs: Mặt bằng, Thành viên, Dashboard
15. Stats bar (count per status, progress bar)
16. `Notifications.tsx` — bell icon, unread count, list

**Batch 5 — Sprint 3 UI:**
17. `ShareView.tsx` — public canvas viewer (no auth)
18. Excel Import UI (upload → preview table → apply)

### Ưu tiên 2 — Deploy VPS
Sau khi frontend có thể chạy end-to-end locally.

### Ưu tiên 3 — AI auto-detect zone (nếu kịp)
Optional, Sprint 3 SPEC item 3.

---

## 6. Environment hiện tại

```
DB_CONNECTION=pgsql
DB_DATABASE=tiendo_test        ← dùng cho cả dev + test (đổi production sau)
SANCTUM_TOKEN_EXPIRATION=10080 (7 ngày)
PYTHON_BIN=/usr/bin/python3
UPLOAD_MAX_PDF_SIZE=52428800   (50MB)
UPLOAD_MAX_IMAGE_SIZE=10485760 (10MB)
UPLOAD_MAX_IMAGES_PER_COMMENT=5
FRONTEND_URL=http://localhost:5173
```

---

## 7. Git log gần nhất

```
75578d5  feat: hoàn thành toàn bộ backend API — Sprint 1+2+3
526253e  khởi tạo dự án tiendo: backend laravel + cấu trúc ban đầu
b07e3df  sửa lỗi: đăng ký policy và fix các vấn đề từ code review
5a9a0e5  tính năng: upload bản vẽ PDF + xử lý tạo tiles
bf72389  feat: master layer CRUD
d9c9adc  feat: reference implementation — auth + project CRUD
```
