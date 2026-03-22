# PROJECT-STATUS.md — TienDo
> File này dùng để upload lên Claude AI Web / Project để AI giữ context xuyên phiên.
> Cập nhật sau mỗi session. Source of truth: SPEC.md + CLAUDE.md.
> **Ngày cập nhật:** 2026-03-23

---

## 0. Tiến độ gần nhất (snapshot)

| Ngày | Nội dung |
|------|-----------|
| **2026-03-23** | **UX — tiêu đề tab:** `document.title` theo route (tiếng Việt ngắn, dạng **`Hành động · TienDo`**). **`frontend/src/lib/documentTitle.ts`:** `APP_TAB_NAME`, `titleForPathname()`, `DocumentTitleSync`; **`App.tsx`:** mount `<DocumentTitleSync />` trong `BrowserRouter`; **`index.html`:** default **TienDo** (thay «frontend»). Không dùng react-helmet. Sprint: `ux: document-title-per-route`. |
| **2026-03-22** | **Docs:** `SESSION-LOG.md` — chuẩn hoá / ghi `## Current Session` theo template; session meta (quy trình log). Sau commit có thể **clear** `## Current Session` (chỉ giữ comment + Sprint History). |
| **2026-03-20** | **CommentsTab (TEST 7.3 / 7.4):** URL ảnh comment = `commentImageBasename` + encode; không set `Content-Type` multipart thủ công; chặn &gt; 5 ảnh với thông báo rõ. **PROJECT-STATUS** § Gotchas đã đồng bộ (phiên 2026-03-20). |
| **2026-03 (QA E2E)** | **CanvasProgress / field_team:** popup tiến độ chỉ **`PATCH /api/v1/zones/{id}/status`** (`status` + `completion_pct`); backend **`transitionInPlace`** (cùng `status`) + **`in_progress` + 100%** → tự chuyển **`completed`**. **`canvasStore`:** `addMark`/`updateMark` bọc **`normalizeMark`**; **`fetchZonesAndMarks`** reset **`filterStatus: null`**. **`parseApiError`:** `FORBIDDEN` / 401 → tiếng Việt. **Share:** `FRONTEND_URL` + redirect `web.php`; **ShareView / CanvasView:** marks theo **`zone_id`** khi lọc chip. **Excel:** preview `new_*`; cột 5 → **assignee**. |

*Chi tiết commit / file: `SESSION-LOG.md` (Sprint Commit History + Current Session).*

---

## 1. Tổng quan dự án

**TienDo** — Quản lý tiến độ thi công trực quan trên bản vẽ PDF.

- PM khoanh zone trên bản vẽ → field team tô mark tiến độ → dashboard real-time
- Stack: Laravel 11 (PHP 8.2) + PostgreSQL 14 + React 18 + TypeScript + Vite + Fabric.js 5.x
- Dev: WSL2 Ubuntu + `php artisan serve` (port 8000) + Vite dev server (port 5173)
- Production target: Ubuntu 22.04 + Nginx + Supervisor (queue) + Certbot SSL

---

## 2. Trạng thái hiện tại

### ✅ Backend API — HOÀN TẤT 100%

**66 feature tests / 300 assertions — tất cả pass** (PostgreSQL `tiendo`)

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
  GET    /api/v1/layers/{id}/tiles/{z}/{x}/{y}     ← PUBLIC (như img tag), Cache-Control: max-age=86400
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
  GET    /api/v1/comments/{id}/images/{filename}   ← PUBLIC (như img tag) — ảnh không cần auth token

SYNC
  GET    /api/v1/layers/{id}/sync?since=ISO8601    (polling 30s)

ACTIVITY LOG + ROLLBACK
  GET    /api/v1/layers/{id}/history               (kể cả deleted entities)
  GET    /api/v1/zones/{id}/history
  POST   /api/v1/activity-logs/{id}/rollback       (PM/admin only)

EXPORT
  GET    /api/v1/layers/{id}/export/excel
  GET    /api/v1/projects/{id}/export/excel

EXCEL IMPORT
  POST   /api/v1/layers/{id}/import                (preview — không ghi DB)
  POST   /api/v1/excel-imports/{id}/apply          (batch update zones, 1 lần)

SHARE LINK (viewer-only)
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
- **Queue worker:** `php artisan queue:work --queue=pdf-processing,default` (Supervisor / nohup dev, timeout 300s, tries 3)
- **Cron:** `tiendo:check-deadlines` chạy `dailyAt('06:00')` — tìm zone deadline ≤ 3 ngày, notify PM + assignee, có dedupe

---

### ✅ Frontend React SPA — SPRINT 1 + 2 + 3 HOÀN TẤT + BRAND DESIGN + BUG FIXES + UI REDESIGN

**Lint + Build: 0 error, 0 warning** (`npm run lint && npm run build` pass clean)

#### Pages đã implement đầy đủ:

| Page | Route | Sprint | Trạng thái |
|---|---|---|---|
| `Login.tsx` | `/login` | 1 | ✅ Full-screen centered; radial gradient bg; logo icon T + "TienDo" cam; card rounded-2xl; inputs focus ring cam; button rounded-xl; local `loading` state (authStore.login không set loading → tránh mất thông báo lỗi sai mật khẩu) |
| `ProjectList.tsx` | `/` | 1 | ✅ Lucide MapPin/Plus/Building2/FolderOpen; skeleton loading; card rounded-2xl hover border cam; empty state đẹp |
| `ProjectDetail.tsx` | `/projects/:id` | 1+3 | ✅ Bento grid stats với Lucide icons (Layers/CheckCircle2/HardHat/AlertTriangle/PauseCircle/TrendingUp); project header Building2 + MapPin; ChevronLeft breadcrumb; Tab Mặt bằng + Thành viên + Cài đặt |
| `AdminUsers.tsx` | `/admin/users` | 1 | ✅ Table + inline edit (GET/PUT /users), admin-only guard |
| `CanvasEditor.tsx` | `/projects/:id/layers/:id/editor` | 1+2 | ✅ ChevronLeft breadcrumb; sidebar zone items rounded-lg; ZoneDetailPanel: dropdown "Giao cho"; CommentsTab: FormData multipart đúng + URL ảnh `commentImageBasename` + encode; ZoneCreateModal overlay brand; lưu zone: toast portal + min delay "Đang lưu..." |
| `CanvasProgress.tsx` | `/projects/:id/layers/:id/progress` | 1+2 | ✅ Own-zone highlight, StatusPopup (**lưu** qua `PATCH .../zones/{id}/status` + `completion_pct`, không `PUT` field_team), mark draw, MarkPopup — responsive drawer sidebar; `toAbsPoints` / polygon an toàn |
| `CanvasView.tsx` | `/projects/:id/layers/:id/view` | 1+2 | ✅ Read-only, StatsBar, filter chips, Export Excel; `onZoneClick` = `useCallback` (tránh mất zone khi mở popup) |
| `ShareView.tsx` | `/share/:token` | 1 | ✅ Public (no auth), layer selector, canvas read-only |
| `Notifications.tsx` | `/notifications` | 2 | ✅ BellOff empty state; icon per type (Bell/Clock); unread bg-[#FFF3E8] border cam; "Đọc tất cả" CheckCheck icon |

#### Canvas components:

| Component | Trạng thái | Ghi chú |
|---|---|---|
| `CanvasWrapper.tsx` | ✅ | CSS transform zoom/pan, wheel + alt+drag |
| `TileLayer.tsx` | ✅ | Grid `<img>` tiles `/0/{x}/{y}` (slash-separated, no extension) |
| `PolygonLayer.tsx` | ✅ | 4 useEffects (init/render/handlers/cursor), Fabric.js |
| `CanvasToolbar.tsx` | ✅ | Lucide MousePointer2/Pentagon/RectangleHorizontal; h-9 w-9 buttons rounded-lg; container rounded-xl |
| `ZoomControls.tsx` | ✅ | Lucide Minus/Plus/Maximize2; compact h-8 w-8 buttons; panel rounded-xl |

#### Stores:

| Store | Trạng thái |
|---|---|
| `authStore.ts` | ✅ login/logout/initSession/hasProjectRole, token localStorage |
| `canvasStore.ts` | ✅ zones/marks, selectedZoneId, panX/panY, fetchZonesAndMarks, syncSince, CRUD actions |

#### Sprint 2 — Tính năng bổ sung:

- **CommentsTab** (trong ZoneDetailPanel): fetch/add/delete; PM có thể xóa mọi comment; max 5 ảnh + 10MB/file; **không** set `Content-Type` multipart thủ công (axios tự boundary); URL thumbnail: `commentImageBasename()` + `encodeURIComponent`; reset list khi đổi zone
- **HistoryTab** (trong ZoneDetailPanel): timeline activity log; Rollback button cho PM/admin (`isPM` prop); sau rollback gọi `fetchZonesAndMarks(layerId)` để refresh canvas; reset list khi đổi zone
- **ZoneDetailPanel tabbed**: 3 tabs — Chi tiết / Bình luận / Lịch sử; nhận `layerId` prop để pass cho HistoryTab
- **Notifications page**: bell icon, unread badge polling 60s (`useUnreadCount` hook), mark read/all
- **AppShell responsive**: hamburger menu mobile, notification badge, `MainNavLink`/`MobileNavLink`
- **ZoneDetailPanel "Giao cho"**: dropdown `assigned_user_id` → `GET /projects/{id}/members`; PM/admin có thể giao zone cho thành viên; field_team xem read-only; payload `PUT /zones/{id}` có `assigned_user_id`

#### Bug fixes P1 (blocking):

- **B1 `CanvasProgress` tiến độ / quyền field_team**: `PUT /zones/{id}` cho đội hiện trường → **403** (policy). **Fix hiện tại:** `StatusPopup` chỉ gọi **`PATCH /zones/{id}/status`** với `status` (giữ nguyên) + `completion_pct`; backend **`ZoneService::transitionInPlace`** cho phép cập nhật % cùng trạng thái; **`in_progress` + 100%** → chuyển **`completed`**. (PM/admin vẫn có thể `PUT /zones/{id}` khi policy cho phép — ví dụ CanvasEditor.)
- **B2 `CanvasProgress` marks 422**: geometry_pct gửi `[x,y][]` tuple → backend expect `{x,y}[]` → thêm `toApiGeometry()` helper, dùng trước khi POST `/zones/{id}/marks`
- **B3 `ShareView` flatMap crash**: `master_layers` / `ml.layers` có thể undefined từ API → thêm `?? []` guard ở 2 chỗ. Bonus: fix tile URL `0_x_y.jpg` → `0/x/y`
- **B4 `ExcelImportModal` length crash**: `applyResult.errors` từ API có thể `null` → `(applyResult.errors ?? []).length` và `.map()`
- **B5 comment image URL + multipart**: URL sai nhiều segment sau `/images/` → 404; + gửi `Content-Type: multipart/form-data` không boundary → server không nhận file. Fix: `commentImageBasename()` + `encodeURIComponent`; bỏ header Content-Type trên FormData (CommentsTab + Excel import + upload PDF trong ProjectDetail)
- **B6 backend comment nullable**: `StoreZoneCommentRequest.content` đổi `required` → `nullable` + `withValidator` enforce "must have content OR images"; migration `make_zone_comments_content_nullable` đã chạy
- **Responsive polish**: tất cả pages dùng Tailwind breakpoints, sidebar = fixed drawer trên mobile/tablet

#### Sprint 3 — Tính năng bổ sung:

- **SettingsTab** (ProjectDetail): form edit project info (name/description/address), Share Link management (create/copy/revoke), Export Excel qua Axios blob download (auth header được gửi đúng — không dùng `<a href>`)
- **ExcelImportModal**: 3-stage workflow (Upload → Preview → Applied); khi đóng từ stage Applied gọi `fetchZonesAndMarks(layerId)` để refresh canvas nếu đang mở layer đó; bảng preview đọc `new_completion_pct`, `new_deadline`, `new_notes`, `new_assignee` từ API (không dùng tên field cũ). **Import**: cột 5 «Phụ trách» → `zones.assignee` (UI «Giao cho»). **`fetchZonesAndMarks`** reset `filterStatus` để chip lọc canvas không kẹt trạng thái cũ sau import / vào layer

#### Bug fixes (post-brand):

- **Stats bar "undefined%"**: Backend `ProjectDashboardRepository` trả `progress_pct` / `completed` / `in_progress` / `delayed` / `paused` / `not_started` — frontend type cũ dùng sai tên (`completion_pct`, `done_zones`, `in_progress_zones`...). Fix: cập nhật `ProjectStats` type + render để match đúng field names. Thêm `Math.round()` cho `progress_pct` (float từ DB `AVG()`).

#### Bug fixes / QA (2026-03 — E2E):

- **`parseApiError.ts`**: API Laravel trả `error.code: VALIDATION_ERROR` (không phải `VALIDATION_FAILED`) + `details` — gom message từng field; duplicate project code → hiển thị đúng message từ `details`
- **`App.tsx`**: route `/share/:token` render ngay, không chặn bởi `authStore.loading` (tab ẩn danh)
- **`ShareView.tsx`**: cấu trúc `data.layers[]` (không `master_layers`); không gọi endpoint zones/marks riêng; Fabric nền trong suốt + tiles sibling; **tile `<img>`** dùng `tileUrl()` cùng `API_BASE` / `VITE_API_BASE_URL` như `publicClient` (tránh ẩn danh trắng khi API tách domain); geometry null-safe + fallback `width_px`/`height_px`; layout flex `1 1 0%` + `min-h-0` + canvas `absolute inset-0`
- **Share link URL**: `ShareLinkResource` dùng `FRONTEND_URL` (config `app.frontend_url`); dev WSL: `APP_URL=:8000` + `FRONTEND_URL=http://localhost:5173`. Nếu mở nhầm `:8000/share/...`, `routes/web.php` redirect sang SPA khi hai URL khác nhau
- **ShareView / CanvasView**: chip lọc theo trạng thái zone — **vùng tô (marks)** chỉ hiện khi thuộc zone đang được lọc (cùng `zone_id`), tránh chồng mark cam/xanh lên zone trạng thái khác
- **`ProjectList` CreateProjectModal**: validation message từ API qua `parseApiError`
- **`ZoneCreateModal`**: overlay + card brand (TEST 5.7)
- **Tiêu đề tab trình duyệt**: `DocumentTitleSync` + `titleForPathname(pathname)` — mỗi route một title ngắn (Đăng nhập, Dự án, Chi tiết dự án, Soạn bản vẽ, Tiến độ, Xem bản vẽ, Thông báo, Người dùng, Xem chia sẻ); route không khớp → **TienDo**

#### Brand Design — Ánh Dương (#FF7F29):

- **`index.css`**: `--primary: 24 100% 58%` (orange), `--primary-foreground: white`; Inter font; brand CSS vars `--color-primary*`
- **`tailwind.config.js`**: thêm `brand.{DEFAULT, hover, light}` colors
- **AppShell header**: `bg-[#FF7F29]` + white text cho tất cả children; nav active `bg-white/20`; mobile menu `bg-[#E5691D]`
- **Login**: logo `text-[#FF7F29] font-bold text-4xl`; card `shadow-lg border-[#E2E8F0]`
- **ProjectList**: code badge `bg-[#FFF3E8] text-[#FF7F29] rounded-full`; card hover `border-[#FF7F29]`
- **ProjectDetail**: `Stat` surface `bg-[#F8FAFC]`, Tiến độ `highlight` → `text-[#FF7F29]`; `TabButton` → underline `border-b-2 border-[#FF7F29]`; code badge cam; layer card `bg-[#F8FAFC]`
- **CanvasEditor**: zone selected `border-l-2 border-l-[#FF7F29] bg-[#FFF3E8]`; tab active `text-[#FF7F29]`; Lưu button `bg-[#FF7F29]`

#### UI Redesign — Bento Box + Soft UI + Flat Design (2026-03-17):

- **Style direction**: Bento Box Grid (stats), Soft UI Evolution (cards/panels/sidebar), Flat Design (toolbar/badges/chips); Lucide icons xuyên suốt; NO emoji làm icon
- **`Login.tsx`**: radial gradient bg `#F8FAFC`; logo icon T trong ô cam rounded-2xl; card `rounded-2xl shadow-lg`; inputs `focus:ring-2 focus:ring-[#FF7F29]/30 focus:border-[#FF7F29] rounded-lg`; button `rounded-xl font-semibold`
- **`AppShell.tsx`**: header `h-14` fixed; Avatar circle với initials (bg-white/25 ring-white/30); Lucide `Bell` thay emoji; hamburger `Menu/X` Lucide; logout `LogOut` Lucide; `cursor-pointer` trên tất cả buttons
- **`ProjectList.tsx`**: Lucide `Plus/MapPin/Building2/FolderOpen`; skeleton loading animated; card `rounded-2xl`; CreateProjectModal inputs focus ring cam; empty state BollsFolderOpen icon + message
- **`ProjectDetail.tsx`**: `Stat` bento card với icon prop (Lucide icons theo loại); "Tiến độ" card `border-[#FF7F29]/30 bg-[#FFF3E8]`; project header Building2 icon + MapPin; `ChevronLeft` back link; skeleton loading
- **`CanvasEditor.tsx`**: context bar `ChevronLeft` breadcrumb; sidebar header với count badge `rounded-full bg-[#F1F5F9]`; zone items `rounded-lg` no `border-b`, % badge `rounded-full`; filter chips border màu status khi inactive; ZoneDetailPanel `fieldCls` với focus ring cam; Lưu/Xóa buttons `rounded-xl`; `accent-[#FF7F29]` cho range input
- **`CanvasToolbar.tsx`**: Lucide `MousePointer2/Pentagon/RectangleHorizontal`; buttons `h-9 w-9 rounded-lg`; container `rounded-xl border-[#E2E8F0] bg-white`
- **`ZoomControls.tsx`**: Lucide `Minus/Plus/Maximize2`; buttons `h-8 w-8 rounded-lg`; container `rounded-xl border-[#E2E8F0] bg-white`
- **`Notifications.tsx`**: `BellOff` empty state với message đẹp; icon per type (Bell cam / Clock amber cho deadline); unread item `bg-[#FFF3E8] border-[#FF7F29]/30`; "Đọc tất cả" button với `CheckCheck` icon `text-[#FF7F29]`

---

### ✅ Deploy files — HOÀN TẤT (chờ VPS thực tế)

| File | Mô tả |
|---|---|
| `deploy/nginx.conf` | Nginx config: HTTP→HTTPS redirect, SSL placeholder, SPA fallback, PHP-FPM 8.2 socket |
| `deploy/php-fpm-tiendo.conf` | PHP-FPM pool riêng socket `/run/php/php8.2-fpm-tiendo.sock` |
| `deploy/supervisor.conf` | Supervisor queue worker `pdf-processing,default` |
| `deploy/.env.production` | Template `.env` production với placeholders |
| `deploy/install.sh` | Fresh Ubuntu 22.04 setup: PHP 8.2, Composer, Node 20, PostgreSQL 14, Python deps |
| `deploy/deploy.sh` | CI/CD script: git pull, migrate, npm build, seed, restart services |
| `DEPLOY.md` | Hướng dẫn deploy step-by-step đầy đủ |
| `start-wsl.sh` | WSL dev startup: PostgreSQL + migrate + queue worker + artisan serve (chạy từ `./backend/`) |

---

### ⏳ Deploy VPS — CHỜ SERVER THỰC TẾ

Đã có đủ config files trong `deploy/`. Chỉ cần khi có VPS + domain:
1. Clone repo lên server
2. Chạy `bash deploy/install.sh`
3. Cấu hình `.env` production
4. Chạy `bash deploy/deploy.sh`
5. Certbot SSL: `certbot --nginx -d yourdomain.com`

---

## 3. Kiến trúc Backend (đã build)

### Pattern bắt buộc:
```
Request → Controller (FormRequest + authorize Policy)
        → Service (business logic)
        → Repository (Eloquent queries)
        → Resource (JSON response)
```

### Stats field names (backend → frontend):
| Backend (`ProjectDashboardRepository`) | Frontend (`ProjectStats` type) |
|---|---|
| `progress_pct` (float, AVG) | `progress_pct` → hiển thị `Math.round(progress_pct)%` |
| `completed` | `completed` |
| `in_progress` | `in_progress` |
| `delayed` | `delayed` |
| `paused` | `paused` |
| `not_started` | `not_started` |
| `total_zones` | `total_zones` |

### Key constraints:
- Tọa độ zone/mark lưu **% (0.0–1.0)** dưới dạng `{type: 'polygon', points: [{x,y}]}` trên API; frontend normalize về `[number, number][]` nội bộ
- Zoom/pan qua **CSS transform** trên CanvasWrapper — KHÔNG dùng Fabric.js zoom API
- `fabric.Canvas.getPointer()` tự tính `cssScale` → pointer coordinates đúng dù CSS scale thay đổi
- Render order: tiles → zone fill → mark fill → zone border → labels
- **KHÔNG dùng PDF.js** — tiles serve từ `/layers/{id}/tiles/0/{x}/{y}` (slash-separated, z=0 fixed)
- Tile route + comment image route đều **PUBLIC** (ngoài auth middleware) — `<img>` tags không gửi được Bearer token
- Polling sync mỗi **30 giây** khi đang mở canvas
- Public route `/api/v1/share/{token}` — nginx không được block
- `GET /api/v1/health` — public health check
- Export Excel dùng **Axios blob download** (`responseType: 'blob'`) — không dùng `<a href>` trực tiếp vì cần auth header

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
{ "success": true, "data": {...} }
{ "success": true, "data": [...], "meta": { "current_page": 1, "per_page": 20, "total": 45 } }
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
project_manager → CRUD zone, quản lý members, mọi transition, export, rollback, xóa mọi comment
field_team     → update status/% + tô mark CHỈ trên zone assigned cho mình
viewer         → read-only + export
```

**Member invite:**
- `POST /projects/{id}/members/invite {email, name?, role}`
- Email chưa có → tạo user + response có `temporary_password` (chỉ 1 lần, không lưu DB)
- PM chỉ tạo được `field_team` / `viewer`

**Zone transitions theo role:**
- `field_team`: chỉ tự mình (`assignee_id === user.id`) + chỉ `not_started→in_progress`, `in_progress→completed`, `in_progress→paused`
- `project_manager` / `admin`: mọi transition

**Comment delete:**
- Author có thể xóa comment của mình
- PM/admin có thể xóa mọi comment

---

## 5. Kiến trúc Frontend (đã build)

### Cấu trúc thư mục:
```
frontend/src/
├── App.tsx                    ← BrowserRouter + `<DocumentTitleSync />` + Routes; share route không chặn bởi `authStore.loading`
├── api/
│   └── client.ts              ← Axios instance + Bearer interceptor + setAuthToken/getAuthToken
├── stores/
│   ├── authStore.ts           ← Zustand: token, user, login/logout/initSession/hasProjectRole
│   └── canvasStore.ts         ← Zustand: zones/marks, viewport, selectedZoneId, CRUD actions
├── lib/
│   ├── geometry.ts            ← toPercent/fromPercent helpers
│   ├── constants.ts           ← ZONE_STATUS_COLOR, MARK_STATUS_COLOR
│   ├── parseApiError.ts       ← VALIDATION_ERROR + details; INVALID_STATE_TRANSITION → tiếng Việt
│   ├── documentTitle.ts      ← `titleForPathname`, `DocumentTitleSync` → `document.title` theo route
│   └── utils.ts               ← cn()
├── pages/
│   ├── Login.tsx
│   ├── ProjectList.tsx
│   ├── ProjectDetail.tsx      ← Tab Mặt bằng + Thành viên + Cài đặt (Settings + ExcelImportModal + ExportButton)
│   ├── CanvasEditor.tsx       ← Zone draw toolbar + ZoneCreateModal + ZoneDetailPanel (3 tabs)
│   ├── CanvasProgress.tsx     ← Mark draw + StatusPopup + MarkPopup, responsive drawer
│   ├── CanvasView.tsx         ← Read-only + Export Excel, responsive drawer
│   ├── Notifications.tsx      ← List, mark read/all, unread badge
│   ├── AdminUsers.tsx         ← GET/PUT /users
│   └── ShareView.tsx          ← Public, publicClient (no Bearer)
└── components/
    ├── layout/
    │   └── AppShell.tsx       ← Header cam #FF7F29 h-14; Avatar initials circle; Lucide Bell badge; hamburger Menu/X; nav responsive
    ├── canvas/
    │   ├── CanvasWrapper.tsx  ← CSS transform zoom/pan
    │   ├── TileLayer.tsx      ← Grid <img> tiles `/0/{x}/{y}` (public route)
    │   ├── PolygonLayer.tsx   ← Fabric.js (4 useEffects: init/render/handlers/cursor)
    │   ├── CanvasToolbar.tsx  ← Select/Polygon/Rect mode (export type CanvasDrawMode)
    │   └── ZoomControls.tsx   ← +/–/Fit/%
    └── ui/                    ← shadcn/ui components
```

### Gotchas quan trọng:
- **PolygonLayer 4 useEffects**: init / render / event-handlers / cursor — tách riêng để handlers có `drawMode` mới nhất không dispose canvas
- **Polygon dblclick**: Fabric fires `mouse:down` TRƯỚC `dblclick` → `drawPts.pop()` trong `mouse:dblclick` handler
- **Layer polling**: `processingLayerIdsRef` (useRef Set) để `setInterval` không cần `layers` trong deps
- **publicClient**: Separate Axios instance KHÔNG có auth interceptor — dùng trong `ShareView.tsx`
- **Tile URL format**: `/api/v1/layers/{id}/tiles/0/{x}/{y}` (slash-separated, z=0 fixed, NO `.jpg` extension, public route)
- **Comment image URL**: GET `/api/v1/comments/{id}/images/{filename}` (public — `<img>` không cần token); `{filename}` là **basename** (vd. `uuid.png`), không ghép cả path `comments/...`
- **geometry_pct**: API nhận/trả `{type: 'polygon', points: [{x,y}]}`; frontend dùng `toApiGeometry()` khi gửi, `normalizeGeometry()` khi nhận
- **Laravel 422 validation**: `bootstrap/app.php` trả `error.code: VALIDATION_ERROR` (không phải `VALIDATION_FAILED`) + `details: { field: ["msg"] }`; `parseApiError()` phải gom tất cả message trong `details` — không chỉ đọc `error.message` ("Validation failed.")
- **ZoneDetailPanel lưu**: sau API thành công chờ thêm tối thiểu ~550ms rồi mới tắt "Đang lưu..."; toast "Đã lưu thành công" render qua `createPortal(..., document.body)` + `z-[10050]` để luôn nổi trên canvas; `INVALID_STATE_TRANSITION` hiển thị câu tiếng Việt đầy đủ (không hiện token cho end user)
- **Export Excel**: dùng `client.get(..., { responseType: 'blob' })` + `URL.createObjectURL` — KHÔNG dùng `<a href>` trực tiếp
- **CommentsTab**: multipart `FormData` cho ảnh — **không** set `Content-Type: multipart/form-data` thủ công (thiếu boundary → server không nhận file); URL ảnh: basename file + `encodeURIComponent` trong path `/api/v1/comments/{id}/images/{filename}`; PM có quyền xóa; reset `comments` khi `zone.id` đổi
- **HistoryTab**: `isPM` + `layerId` prop; sau rollback gọi `fetchZonesAndMarks(layerId)`; reset `entries` khi `zone.id` đổi
- **ZoneDetailPanel "Giao cho"**: nhận `projectId` prop; fetch `GET /projects/{id}/members` khi mount; `assigned_user_id` (number|null) trong PUT payload; PM/admin thấy dropdown chọn; field_team thấy read-only text; reset cùng với form khi `zone.id` đổi
- **CanvasProgress mark geometry**: `handleMarkDrawn` nhận `Geometry` với `points: [number,number][]` (internal) → phải dùng `toApiGeometry()` convert sang `{x,y}[]` trước khi POST marks (giống CanvasEditor)
- **Comment content nullable**: DB column `zone_comments.content` đã được `nullable()` qua migration. Backend validate: phải có `content` OR ít nhất 1 `images` file
- **useUnreadCount hook**: `poll` async function đặt *bên trong* `useEffect` để tránh ESLint `react-hooks/set-state-in-effect`
- **Responsive drawer**: sidebar = `fixed inset-y-0 right-0 z-20` trên mobile/tablet, `lg:relative lg:w-80` trên desktop
- **SettingsTab**: `clipboard.writeText()` cho copy share link, `window.location.origin` để build full URL
- **Primary color**: CSS var `--primary: 24 100% 58%` = `hsl(24, 100%, 58%)` ≈ #FF7F29 Ánh Dương orange; `--primary-foreground: white`
- **Login + global loading**: `authStore.login()` không set `loading: true` — nếu set, `App.tsx` unmount trang Login trong lúc request → `setError` sau khi fail có thể không hiển thị; Login.tsx dùng local `loading` riêng
- **`App.tsx`**: regex `\/share\/[^/?#]+` trên `pathname` → bỏ qua màn hình "Đang khởi tạo phiên làm việc..." để ShareView mount ngay (tab ẩn danh; hỗ trợ base path)
- **Tiêu đề tab (`document.title`)**: thêm/sửa route trong React → cập nhật **`titleForPathname()`** (`lib/documentTitle.ts`). Vite **`base`** khác `/` thì có thể cần strip prefix trước khi regex

---

## 6. Environment — WSL Dev

### Cách chạy:
```bash
# Terminal 1 — khởi động backend + DB + queue
bash /var/www/tiendo/start-wsl.sh

# Terminal 2 — frontend dev server
cd /var/www/tiendo/frontend && npm run dev

# Mở trình duyệt: http://localhost:5173
# Dừng: bash /var/www/tiendo/start-wsl.sh stop
```

### .env hiện tại (dev WSL):
```
APP_ENV=local
APP_URL=http://localhost:8000
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=tiendo
DB_USERNAME=tiendo
DB_PASSWORD=Tiendo@2026
QUEUE_CONNECTION=database
SANCTUM_TOKEN_EXPIRATION=10080   (7 ngày)
ADMIN_PASSWORD=Admin@2026
PYTHON_BIN=/usr/bin/python3
UPLOAD_MAX_PDF_SIZE=52428800     (50MB)
UPLOAD_MAX_IMAGE_SIZE=10485760   (10MB)
UPLOAD_MAX_IMAGES_PER_COMMENT=5
FRONTEND_URL=http://localhost:5173
```

### Tài khoản admin:
```
Email:    admin@tiendo.vn
Password: Admin@2026
Role:     admin
```

### Database:
- **18/18 migrations** tất cả DONE (bộ `1000xx` cũ đã xóa, giữ `1200xx`; +1 `make_zone_comments_content_nullable`)
- DB name: `tiendo` (không phải `tiendo_test`)
- Seeded: 1 admin user (tạo qua `php artisan tinker` trong `start-wsl.sh`)

### Vite proxy (dev):
- `/api/*` → `http://localhost:8000` (không cần CORS config riêng)
- `/storage/*` → `http://localhost:8000`

---

## 7. Git log gần nhất

```
75578d5  feat: hoàn thành toàn bộ backend API — Sprint 1+2+3
526253e  khởi tạo dự án tiendo: backend laravel + cấu trúc ban đầu
```

*(Frontend + WSL scripts chưa commit — đang phát triển local)*

---

## 8. Việc còn lại

| # | Việc | Trạng thái |
|---|---|---|
| 1 | E2E test thực tế trên browser (WSL) | ✅ Done — flow: login → tạo project → ML → upload PDF → ready → zone → status amber verified |
| 2 | Stats bar "undefined%" bug | ✅ Fixed — field name mismatch `progress_pct`/`completed`/... đã khớp |
| 3 | Brand design Ánh Dương (#FF7F29) | ✅ Done — Inter font, orange primary, header cam, cards, tabs, badges |
| 4.5 | UI Redesign toàn bộ — Bento Box + Soft UI + Flat Design | ✅ Done — Lucide icons, Login/AppShell/ProjectList/ProjectDetail/CanvasEditor/Toolbar/ZoomControls/Notifications redesigned |
| 4.6 | ZoneDetailPanel: dropdown "Giao cho" (`assigned_user_id`) | ✅ Done — fetch members, PM dropdown, field_team read-only, PUT payload |
| 4.7 | Fix 6 P1 bugs (B1–B6) chặn sử dụng | ✅ Done — 405/422 CanvasProgress, ShareView flatMap, ExcelImport null, image URL, comment nullable |
| 4 | Comments/History/Notifications/AppShell bell | ✅ Done + verified đầy đủ |
| 4.8 | E2E QA: login error, VALIDATION_ERROR, CanvasView zones, zone toast, ShareView, comments multipart/URL (TEST 7.x) | ✅ Done — xem `SESSION-LOG.md` Sprint Commit History |
| 5 | Deploy VPS thực tế (cần có server + domain) | ⏳ Chờ server |
| 6 | Certbot SSL | ⏳ Chờ domain |
| 7 | Cron setup trên VPS (`* * * * * php artisan schedule:run`) | ⏳ Chờ server |
| 8 | Git commit toàn bộ frontend (lint + build pass) | ⏳ Chưa commit |
