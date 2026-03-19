# PROJECT-STATUS.md — TienDo
> File này dùng để upload lên Claude AI Web / Project để AI giữ context xuyên phiên.
> Cập nhật sau mỗi session. Source of truth: SPEC.md + CLAUDE.md.
> **Ngày cập nhật:** 2026-03-17

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

USERS (admin only)
  GET    /api/v1/users
  PUT    /api/v1/users/{id}

MASTER LAYER / LAYER
  GET    /api/v1/projects/{id}/master-layers
  POST   /api/v1/projects/{id}/master-layers
  PUT    /api/v1/master-layers/{id}
  DELETE /api/v1/master-layers/{id}
  GET    /api/v1/master-layers/{id}/layers         (trả zones_count)
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

HEALTH
  GET    /api/v1/health                            ← PUBLIC
```

#### Background tasks:
- **Queue worker:** `php artisan queue:work --queue=pdf-processing` (Supervisor, 1 process, timeout 120s, tries 3)
- **Cron:** `tiendo:check-deadlines` chạy `dailyAt('06:00')` — tìm zone deadline ≤ 3 ngày, notify PM + assignee, có dedupe

---

### 🟡 Frontend React SPA — SPRINT 1 HOÀN TẤT

**Lint + Build: 0 error, 0 warning** (`npm run lint && npm run build` pass clean)

#### Pages đã implement đầy đủ:

| Page | Route | Trạng thái |
|---|---|---|
| `Login.tsx` | `/login` | ✅ Form email/password + authStore |
| `ProjectList.tsx` | `/` | ✅ Cards grid, filter, link |
| `ProjectDetail.tsx` | `/projects/:id` | ✅ Tab Mặt bằng (ML+Layer CRUD + PDF upload + polling) + Tab Thành viên (invite + remove) + Tab Cài đặt |
| `AdminUsers.tsx` | `/admin/users` | ✅ Table + inline edit (GET/PUT /users), admin-only guard |
| `CanvasEditor.tsx` | `/layers/:id/editor` | ✅ CanvasToolbar (select/polygon/rect), ZoneCreateModal, ZoneDetailPanel, sync polling |
| `CanvasProgress.tsx` | `/layers/:id/progress` | ✅ Own-zone highlight, StatusPopup, mark polygon draw, MarkPopup |
| `CanvasView.tsx` | `/layers/:id/view` | ✅ Read-only, StatsBar, filter chips, Export Excel (blob) |
| `ShareView.tsx` | `/share/:token` | ✅ Public (no auth), layer selector, canvas read-only |
| `Notifications.tsx` | `/notifications` | 🚧 Placeholder |

#### Canvas components đã implement:

| Component | Trạng thái | Ghi chú |
|---|---|---|
| `CanvasWrapper.tsx` | ✅ | CSS transform zoom/pan, wheel + alt+drag |
| `TileLayer.tsx` | ✅ | Grid `<img>` tiles `0_{x}_{y}.jpg` |
| `PolygonLayer.tsx` | ✅ | 4 useEffects (init/render/handlers/cursor), Fabric.js |
| `CanvasToolbar.tsx` | ✅ | Select / Draw Polygon / Draw Rect |
| `ZoomControls.tsx` | ✅ | +/–/Fit/% display |

#### Stores:

| Store | Trạng thái |
|---|---|
| `authStore.ts` | ✅ login/logout/initSession/hasProjectRole, token localStorage |
| `canvasStore.ts` | ✅ zones/marks, selectedZoneId, panX/panY, fetchZonesAndMarks, syncSince, CRUD actions |
| `projectStore.ts` | 🚧 Scaffold (data fetch inline trong pages) |

#### Chức năng nổi bật đã hoạt động:
- Login → token Bearer trong Axios interceptor → các route protected
- Upload PDF multipart → polling 3s (useRef Set) → badge "Đang xử lý" tự cập nhật khi ready/failed
- Vẽ zone polygon (click đặt điểm → dbl-click finish) + rect (mousedown→drag→mouseup) trên Fabric.js
- ZoneCreateModal sau khi vẽ xong → POST /layers/{id}/zones → hiện trên canvas ngay
- Zone color-coded theo status (5 màu), filter chips, legend
- Mark draw polygon bên trong zone (own-zone highlight opacity 0.08 cho zone khác)
- Export Excel: `GET /layers/{id}/export/excel` với Axios responseType: 'blob' → browser download
- ShareView: `publicClient` Axios không có Bearer, public route hoạt động độc lập

---

### ❌ Frontend — CÒN THIẾU (Sprint 2 + 3)

| Tính năng | Sprint | Endpoint cần |
|---|---|---|
| Comments tab trong ZoneDetailPanel | 2 | `GET/POST /zones/{id}/comments`, `DELETE /comments/{id}` |
| Zone History tab + Rollback button | 2 | `GET /zones/{id}/history`, `POST /activity-logs/{id}/rollback` |
| Notifications page (bell icon, unread count) | 2 | `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/{id}/read` |
| AppShell notification badge | 2 | `GET /notifications/unread-count` (polling) |
| Responsive polish (tablet/mobile) | 2 | — |
| Settings tab — edit project info | 3 | `PUT /projects/{id}` |
| Settings tab — Share Link management UI | 3 | `GET/POST/DELETE /projects/{id}/share-links` |
| Excel Import UI (upload → preview → apply) | 3 | `POST /layers/{id}/import`, `POST /excel-imports/{id}/apply` |

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
- Tọa độ zone/mark lưu **% (0.0–1.0)** dưới dạng `[number, number][]` (array of [x,y]) — KHÔNG phải pixel, KHÔNG phải `{x,y}[]`
- Zoom/pan qua **CSS transform** trên CanvasWrapper — KHÔNG dùng Fabric.js zoom API
- `fabric.Canvas.getPointer()` tự tính `cssScale` nên pointer coordinates vẫn đúng dù CSS scale thay đổi
- Render order: tiles → zone fill → mark fill → zone border → labels
- **KHÔNG dùng PDF.js** — tiles serve từ `/layers/{id}/tiles/0_{x}_{y}.jpg` (format `{z}_{x}_{y}`)
- Polling sync mỗi **30 giây** khi đang mở canvas (`setInterval` trong CanvasEditor)
- Public route `/api/v1/share/{token}` — nginx không được block
- `GET /api/v1/health` — public health check

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
- Email chưa có → tạo user + response có `temporary_password` (chỉ 1 lần, không lưu DB) — frontend hiển thị 1 lần, không lưu lại
- PM chỉ tạo được `field_team` / `viewer` — không tạo `project_manager`

**Zone transitions theo role:**
- `field_team`: chỉ tự mình (`assignee_id === user.id`) + chỉ `not_started→in_progress`, `in_progress→completed`, `in_progress→paused`
- `project_manager` / `admin`: mọi transition

---

## 5. Kiến trúc Frontend (đã build)

### Cấu trúc thư mục:
```
frontend/src/
├── api/
│   └── client.ts              ← Axios instance + Bearer interceptor + setAuthToken/getAuthToken
├── stores/
│   ├── authStore.ts           ← Zustand: token, user, login/logout/initSession/hasProjectRole
│   └── canvasStore.ts         ← Zustand: zones/marks, viewport, selectedZoneId, CRUD actions
├── lib/
│   ├── geometry.ts            ← toPercent/fromPercent helpers
│   ├── constants.ts           ← ZONE_STATUS_COLOR, MARK_STATUS_COLOR
│   └── utils.ts               ← cn()
├── pages/
│   ├── Login.tsx
│   ├── ProjectList.tsx
│   ├── ProjectDetail.tsx      ← Tab Mặt bằng + Thành viên + Cài đặt
│   ├── CanvasEditor.tsx       ← Zone draw toolbar + ZoneCreateModal + ZoneDetailPanel
│   ├── CanvasProgress.tsx     ← Mark draw + StatusPopup + MarkPopup
│   ├── CanvasView.tsx         ← Read-only + Export Excel
│   ├── Notifications.tsx      ← Placeholder
│   ├── AdminUsers.tsx         ← GET/PUT /users
│   └── ShareView.tsx          ← Public, publicClient (no Bearer)
└── components/
    ├── layout/
    │   └── AppShell.tsx       ← Header, nav, logout
    ├── canvas/
    │   ├── CanvasWrapper.tsx  ← CSS transform zoom/pan
    │   ├── TileLayer.tsx      ← Grid <img> tiles
    │   ├── PolygonLayer.tsx   ← Fabric.js (4 useEffects: init/render/handlers/cursor)
    │   ├── CanvasToolbar.tsx  ← Select/Polygon/Rect mode
    │   └── ZoomControls.tsx   ← +/–/Fit/%
    └── ui/                    ← shadcn/ui components
```

### Gotchas quan trọng:
- **PolygonLayer 4 useEffects**: init / render / event-handlers / cursor phải tách riêng để handlers có `drawMode` mới nhất mà không dispose canvas
- **Polygon dblclick**: Fabric fires `mouse:down` TRƯỚC `dblclick` → cần `drawPts.pop()` trong handler `mouse:dblclick` để loại điểm thừa
- **Layer polling**: `processingLayerIdsRef` (useRef Set) để `setInterval` không cần `layers` trong deps → tránh infinite re-render
- **publicClient**: Separate Axios instance KHÔNG có auth interceptor — dùng trong `ShareView.tsx`
- **Tile URL format**: `/api/v1/layers/{id}/tiles/0_{x}_{y}.jpg` (underscore, z=0 fixed)

---

## 6. Việc cần làm tiếp theo

### Ưu tiên 1 — Frontend Sprint 2

**Comments trong ZoneDetailPanel:**
- Tab "Bình luận" bên trong ZoneDetailPanel (CanvasEditor + CanvasProgress)
- `GET /zones/{id}/comments` → list với ảnh thumbnails
- `POST /zones/{id}/comments` multipart (text + tối đa 5 ảnh)
- `DELETE /comments/{id}` (chỉ author)

**Zone History + Rollback:**
- Tab "Lịch sử" trong ZoneDetailPanel
- `GET /zones/{id}/history` → timeline (actor, action, before/after)
- `POST /activity-logs/{id}/rollback` → button Rollback (PM/admin)

**Notifications:**
- `Notifications.tsx` page — list với đánh dấu đã đọc
- AppShell bell icon + unread badge (polling 60s `GET /notifications/unread-count`)

### Ưu tiên 2 — Frontend Sprint 3

**Share Link Management UI** (Settings tab trong ProjectDetail):
- List share links (còn hạn / hết hạn)
- Tạo link mới (chọn expires_in_days: 1/7/30)
- Revoke link

**Excel Import UI:**
- Upload .xlsx → gọi `POST /layers/{id}/import` → hiển thị preview table (zones sẽ được cập nhật gì)
- "Apply" button → `POST /excel-imports/{id}/apply` → done

### Ưu tiên 3 — Deploy VPS

Sau khi frontend end-to-end ổn:
- Nginx config PHP 8.2 FPM (song song PHP 7.4)
- Supervisor queue worker
- Certbot SSL
- `.env` production

---

## 7. Environment hiện tại

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

## 8. Git log gần nhất

```
75578d5  feat: hoàn thành toàn bộ backend API — Sprint 1+2+3
526253e  khởi tạo dự án tiendo: backend laravel + cấu trúc ban đầu
b07e3df  sửa lỗi: đăng ký policy và fix các vấn đề từ code review
5a9a0e5  tính năng: upload bản vẽ PDF + xử lý tạo tiles
bf72389  feat: master layer CRUD
d9c9adc  feat: reference implementation — auth + project CRUD
```

*(Frontend chưa commit riêng — đang phát triển local)*
