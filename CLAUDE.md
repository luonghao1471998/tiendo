# TienDo — CLAUDE.md
> File context cho AI coding agent (Cursor / Claude Code).
> Đọc file này trước mỗi task. KHÔNG tự suy luận ngoài những gì ghi ở đây.
> Khi có xung đột giữa file này và SPEC: **SPEC là source of truth**.

---

## Tech Stack

**Backend**
- Framework: Laravel 11
- Runtime: PHP 8.2 (FPM) — KHÔNG dùng PHP 7.4 cho project này
- Database: PostgreSQL 14
- Queue: Laravel Queue driver=database (bảng `jobs`, `failed_jobs`)
- Auth: Laravel Sanctum — Bearer token, expires 7 ngày (10080 phút)
- Scheduler: Laravel `php artisan schedule:run` — cron mỗi phút

**Frontend**
- Framework: React 18 + TypeScript + Vite
- UI: Tailwind CSS 3.x + shadcn/ui
- State: Zustand (3 stores: authStore, projectStore, canvasStore)
- HTTP: Axios (instance tại `src/api/client.ts` với auth interceptor)
- Canvas: Fabric.js 5.x — vẽ zone + mark overlay
- PDF render: **TILES ONLY** — KHÔNG dùng PDF.js (đã bỏ theo PATCH-01)
- Tọa độ: % (0.0–1.0) — độc lập zoom/resolution

**External**
- Python 3.x + pdf2image + Pillow + poppler-utils + ezdxf + matplotlib: PDF/DXF/DWG → tiles
- PhpSpreadsheet: export/import Excel
- Local disk storage: `storage/app/` — KHÔNG dùng S3 trong MVP

**Server**
- Ubuntu 22.04, Nginx, Supervisor (queue worker), Certbot SSL
- VPS chạy song song PHP 7.4 (projects cũ) + PHP 8.2 (TienDo) — pool riêng

---

## Architecture Overview

TienDo là REST API (Laravel) + React SPA. PM khoanh vùng Zone trên bản vẽ PDF (đã convert thành tiles), field team tô Mark tiến độ bên trong Zone. Mọi thay đổi ghi `activity_logs` để rollback. Canvas zoom/pan qua CSS transform, không dùng zoom API của Fabric.js.

---

## Architecture Patterns

**Luồng xử lý bắt buộc:**
```
Request → Controller (validate FormRequest + authorize Policy)
        → Service (business logic + gọi Repository)
        → Repository (Eloquent queries)
        → Resource (serialize response)
        → Response JSON
```

**Lý do từng layer:**

| Layer | Vai trò | Lý do tách riêng |
|---|---|---|
| Controller | Validate input, authorize, gọi Service | Không chứa logic — dễ test Service độc lập |
| Service | Business logic, gọi Repository, ghi ActivityLog | Reusable, testable, không phụ thuộc HTTP |
| Repository | Eloquent queries only | Mock dễ trong test; thay đổi ORM không ảnh hưởng Service |
| Model | Relationships, casts, scopes | Không bị phình to với logic |
| Resource | Serialize JSON trả về | Tách presentation khỏi data model |
| Policy | Authorization rules | Tập trung permission logic, không rải rác |
| Job | Background task (PDF processing) | Không block request, retry tự động |

**Canvas Architecture (Frontend):**
```
CanvasWrapper (CSS transform zoom/pan)
├── TileLayer       — render <img> tiles từ server (KHÔNG dùng PDF.js)
├── PolygonLayer    — Fabric.js: render zones (fill 0.15) + marks (fill 0.50)
├── PolygonDrawLayer — Fabric.js: vẽ zone mới (Editor only)
└── MarkDrawLayer   — Fabric.js: vẽ mark (Progress only)
```

**Render order trên canvas (quan trọng — không đổi thứ tự):**
```
Layer 1 (đáy): Tile images (bản vẽ PDF)
Layer 2:       Zone fill — status color, opacity 0.15 (not_started: không fill)
Layer 3:       Mark fill — cam/xanh, opacity 0.50
Layer 4:       Zone border — stroke 2px, status color, opacity 1.0
Layer 5 (trên): Labels + badges (zone name, %, assignee khi zoom sâu)
```

**Anti-patterns — PHẢI TRÁNH:**
- KHÔNG query DB từ Controller — luôn qua Repository
- KHÔNG business logic trong Controller — luôn qua Service
- KHÔNG business logic trong Model — chỉ relationships/casts/scopes
- KHÔNG return Eloquent Model từ API — luôn qua Resource
- KHÔNG hardcode file path — dùng `Storage::disk('local')`
- KHÔNG gọi Python script từ Controller — luôn qua Queue Job
- KHÔNG validate geometry chỉ ở frontend — backend PHẢI validate
- KHÔNG dùng PDF.js — đã bỏ, dùng TileLayer render `<img>`
- KHÔNG dùng zoom API của Fabric.js — zoom qua CSS transform trên CanvasWrapper
- KHÔNG query bên trong JSON column `geometry_pct` — chỉ lưu/đọc nguyên block

---

## File Structure

```
tiendo/
├── CLAUDE.md
├── SPEC.md
├── .env / .env.example
│
├── app/
│   ├── Http/
│   │   ├── Controllers/Api/
│   │   │   ├── AuthController.php
│   │   │   ├── UserController.php
│   │   │   ├── ProjectController.php
│   │   │   ├── ProjectMemberController.php
│   │   │   ├── MasterLayerController.php
│   │   │   ├── LayerController.php
│   │   │   ├── ZoneController.php
│   │   │   ├── MarkController.php
│   │   │   ├── ZoneCommentController.php
│   │   │   ├── NotificationController.php
│   │   │   ├── ExportController.php
│   │   │   ├── ActivityLogController.php
│   │   │   ├── AnalyticsController.php
│   │   │   ├── ExcelImportController.php   # Sprint 3
│   │   │   └── ShareLinkController.php     # Sprint 3
│   │   ├── Requests/                       # FormRequest per endpoint
│   │   ├── Resources/                      # API Resource per model
│   │   └── Middleware/
│   │       ├── CheckProjectAccess.php      # Kiểm tra user thuộc project
│   │       └── TrackUsage.php              # Ghi usage_logs
│   │
│   ├── Models/
│   │   ├── User.php / Project.php / ProjectMember.php
│   │   ├── MasterLayer.php / Layer.php
│   │   ├── Zone.php / Mark.php
│   │   ├── ZoneComment.php / ActivityLog.php
│   │   ├── Notification.php / UsageLog.php
│   │   ├── ShareLink.php / ExcelImport.php
│   │
│   ├── Services/
│   │   ├── AuthService.php
│   │   ├── UserService.php
│   │   ├── ProjectService.php
│   │   ├── MasterLayerService.php
│   │   ├── LayerService.php
│   │   ├── ZoneService.php          # CRITICAL — state machine, zone_code gen
│   │   ├── MarkService.php
│   │   ├── CommentService.php
│   │   ├── ActivityLogService.php   # Ghi log + rollback
│   │   ├── NotificationService.php
│   │   ├── ExportService.php
│   │   ├── PdfProcessingService.php
│   │   ├── ExcelImportService.php   # Sprint 3
│   │   └── ShareLinkService.php     # Sprint 3
│   │
│   ├── Repositories/
│   │   ├── ProjectRepository.php
│   │   ├── MasterLayerRepository.php
│   │   ├── LayerRepository.php
│   │   ├── ZoneRepository.php
│   │   ├── MarkRepository.php
│   │   ├── CommentRepository.php
│   │   ├── NotificationRepository.php
│   │   └── ActivityLogRepository.php
│   │
│   ├── Jobs/
│   │   └── ProcessPdfJob.php        # Queue: pdf-processing, timeout=120s, tries=3
│   │
│   ├── Console/Commands/
│   │   └── CheckDeadlinesCommand.php  # Cron daily 06:00 — deadline notifications
│   │
│   ├── Policies/
│   │   ├── ProjectPolicy.php
│   │   ├── LayerPolicy.php
│   │   ├── ZonePolicy.php
│   │   ├── MarkPolicy.php
│   │   └── CommentPolicy.php
│   │
│   └── Enums/
│       ├── ZoneStatus.php     # not_started|in_progress|completed|delayed|paused
│       ├── MarkStatus.php     # in_progress|completed
│       ├── LayerStatus.php    # uploading|processing|ready|failed
│       ├── LayerType.php      # architecture|electrical|mechanical|plumbing|other
│       └── ProjectMemberRole.php  # project_manager|field_team|viewer
│
├── database/
│   ├── migrations/            # Mỗi bảng 1 migration file, đánh số theo thứ tự
│   └── seeders/
│       └── AdminUserSeeder.php  # 1 admin: admin@tiendo.vn
│
├── routes/
│   ├── api.php                # Tất cả API routes (prefix: /api/v1)
│   └── web.php                # Redirect → React SPA
│
├── scripts/
│   ├── drawing_processor.py   # Python: PDF/DXF/DWG → raster → tiles 1024×1024
│   ├── pdf_processor.py       # (legacy) chỉ PDF — ưu tiên drawing_processor.py
│   └── requirements-drawing.txt
│
├── storage/app/
│   ├── layers/{layer_id}/
│   │   ├── original.pdf | original.dxf | original.dwg
│   │   └── tiles/0_{x}_{y}.jpg
│   └── comments/{comment_id}/{uuid}.{ext}
│
└── frontend/src/
    ├── api/client.ts           # Axios instance + Bearer interceptor
    ├── stores/
    │   ├── authStore.ts        # user, token, login/logout, hasProjectRole()
    │   ├── projectStore.ts     # projects, currentProject, masterLayer, layer
    │   └── canvasStore.ts      # zones, marks, mode, filter, zoom, pan, sync
    ├── pages/
    │   ├── Login.tsx / ProjectList.tsx / ProjectDetail.tsx
    │   ├── CanvasEditor.tsx    # Vẽ zone (PM/admin)
    │   ├── CanvasProgress.tsx  # Tô mark (field_team)
    │   ├── CanvasView.tsx      # Read-only (all roles)
    │   ├── Notifications.tsx / AdminUsers.tsx
    │   └── ShareView.tsx       # Sprint 3
    ├── components/canvas/
    │   ├── CanvasWrapper.tsx   # CSS transform zoom/pan
    │   ├── TileLayer.tsx       # Render <img> tiles (KHÔNG PDF.js)
    │   ├── PolygonLayer.tsx    # Zones + marks (Fabric.js)
    │   ├── PolygonDrawLayer.tsx # Draw tools zone (Editor)
    │   ├── MarkDrawLayer.tsx   # Draw tools mark (Progress)
    │   ├── StatusPopup.tsx     # Quick status + % (Progress)
    │   └── ZoomControls.tsx
    └── lib/
        ├── geometry.ts         # toPercent() / fromPercent()
        ├── constants.ts        # Status colors, labels
        └── utils.ts
```

---

## Coding Conventions

**Naming:**
- PHP classes: `PascalCase` (ZoneService, MarkRepository)
- PHP methods/variables: `camelCase` (transitionStatus, zoneCode)
- DB columns: `snake_case` (assigned_user_id, completion_pct)
- Enums: string-backed PHP Enum (`ZoneStatus::InProgress`)
- TypeScript: PascalCase components, camelCase functions/variables
- Routes: kebab-case (`/master-layers`, `/zone-comments`)
- API prefix: `/api/v1/`

**Response format:**
```php
// Success
{"success": true, "data": {...}}
{"success": true, "data": [...], "meta": {"current_page":1,"per_page":20,"total":45}}

// Error
{"success": false, "error": {"code": "ERROR_CODE", "message": "...", "details": {...}}}
```

**HTTP status codes:**
```
200 OK          — GET/PATCH thành công
201 Created     — POST tạo mới thành công
400 Bad Request — request malformed (sai format JSON)
401 Unauth      — không có token hoặc token expired
403 Forbidden   — có token nhưng không đủ role/ownership
404 Not Found   — resource không tồn tại
409 Conflict    — duplicate (user đã trong project)
410 Gone        — share link expired hoặc revoked
413 Too Large   — file vượt giới hạn
422 Unprocessable — validation lỗi hoặc business rule vi phạm
500 Server Error — crash không xử lý được
```

**DB conventions:**
- Dùng transaction cho mọi operation write nhiều bảng
- Mọi thay đổi zone/mark/comment → INSERT `activity_logs` trong cùng transaction
- `activity_logs.target_id` KHÔNG có FK constraint (intentional — logs tồn tại sau khi entity bị xóa)
- `sync_deletions`: insert mỗi khi zone/mark bị xóa (dùng cho sync API)

**Queue:**
- Queue name: `pdf-processing`
- Worker: Supervisor, 1 process
- Job timeout: 120s, tries: 3, backoff: [30, 60, 120] giây

**Scheduler:**
```php
$schedule->command('tiendo:check-deadlines')->dailyAt('06:00');
// Tìm zones: deadline trong 3 ngày, status != completed → notify PM + assignee
```

---

## State Machines

### Zone Status — CRITICAL

| Trạng thái | Hex màu | Fill | Border |
|---|---|---|---|
| not_started | #9CA3AF | không fill | 2px |
| in_progress | #F59E0B | opacity 0.15 | 2px |
| completed | #10B981 | opacity 0.15 | 2px |
| delayed | #EF4444 | opacity 0.15 | 2px |
| paused | #8B5CF6 | opacity 0.15 | 2px |

**Transition hợp lệ:**
```
not_started → in_progress (tất cả roles)
not_started → delayed     (PM/admin only)
in_progress → completed   (PM/admin only)
in_progress → delayed     (PM/admin only)
in_progress → paused      (tất cả roles)
completed   → in_progress (PM/admin only — reopen)
delayed     → in_progress (tất cả roles)
delayed     → completed   (PM/admin only)
paused      → in_progress (tất cả roles)
paused      → delayed     (PM/admin only)
```

**Transition không hợp lệ → reject 422 INVALID_STATE_TRANSITION:**
```
not_started → completed / paused
paused → completed
completed → not_started / delayed / paused
```

**completion_pct invariants (PATCH-03):**
```
not_started → auto = 0    (ignore giá trị client gửi)
completed   → auto = 100  (ignore giá trị client gửi)
in_progress → 1–99        (reject nếu gửi 0 hoặc 100)
delayed     → 0–99        (giữ nguyên từ trước)
paused      → 0–99        (giữ nguyên từ trước)
```

**Field_team chỉ được transition trên zone có `assigned_user_id = current_user.id`:**
```
not_started → in_progress ✓
in_progress → paused ✓
paused/delayed → in_progress ✓
completed → không được reopen
delayed/completed → không được tự chuyển (PM/admin only)
```

### Mark Status

```
in_progress ↔ completed   (bidirectional, field_team trở lên)
Mark KHÔNG ảnh hưởng zone completion_pct
```

### Layer Processing Status

```
uploading → processing (khi upload xong, dispatch ProcessPdfJob)
processing → ready     (Python script thành công)
processing → failed    (Python script thất bại, retry_count++)
failed → processing    (retry, guard: retry_count < 3)
```

---

## External Integrations

### Python Drawing Processor (PDF / DXF / DWG)

```
Script: scripts/drawing_processor.py
Chạy qua: ProcessPdfJob → PdfProcessingService::processToTiles()
Input: --input {file_path} --output-dir {tiles_dir} --tile-size 1024 --dpi 150
  • PDF: pdf2image (trang 1)
  • DXF: ezdxf + matplotlib (modelspace → raster)
  • DWG nhị phân: thử ezdxf.readfile; nếu thất bại → ezdxf.addons.odafc (ODA File Converter
    chuyển tạm DWG→DXF). Cài ODA từ Open Design Alliance; Linux đặt `ODAFileConverter` trong PATH
    hoặc `TIENDO_ODA_FILE_CONVERTER` = đường dẫn tuyệt đối tới executable/AppImage.
    ODA (bản thường gặp) hỗ trợ tới khoảng R2018 — DWG rất mới có thể cần xuất DXF/PDF trong AutoCAD.
    Headless Linux: có thể cần `xvfb` nếu ODA mở GUI.

Output stdout (JSON):
  Success: {"success": true, "width_px": N, "height_px": N, "tiles_generated": N}
  Failure: {"success": false, "error": "message"}

Exit code: 0=success, 1=handled error (JSON stdout), 2+=crash (parse stderr)

Dependencies cần cài trên server:
  sudo apt-get install -y poppler-utils
  pip3 install -r scripts/requirements-drawing.txt

Tile naming: {z}_{x}_{y}.jpg (MVP: z=0 only)
Ví dụ 4096×2048 → 8 tiles: 0_0_0.jpg, 0_1_0.jpg, ..., 0_3_1.jpg
```

**Biến môi trường:**
```
PYTHON_BIN=/usr/bin/python3
PDF_TILE_SIZE=1024
PDF_DPI=150
TIENDO_ODA_FILE_CONVERTER=   # optional: path to ODAFileConverter (when not in PATH)
```

### PhpSpreadsheet (Export/Import Excel)

```
Package: phpoffice/phpspreadsheet
Dùng trong: ExportService (export .xlsx), ExcelImportService (Sprint 3)

Export per-layer: 1 sheet "Zones"
  Columns: Mã khu vực | Tên | Trạng thái | Tiến độ (%) | Phụ trách | Deadline | Hạng mục | Ghi chú
  Sort: zone_code ASC
  Status label: tiếng Việt (Chưa bắt đầu / Đang thi công / Hoàn thành / Chậm tiến độ / Tạm dừng)

Export per-project: 1 sheet per layer, sheet name = {ML.code}_{L.code} (max 31 chars)
```

**Biến môi trường:**
```
UPLOAD_MAX_PDF_SIZE=52428800     # 50MB
UPLOAD_MAX_IMAGE_SIZE=10485760   # 10MB
UPLOAD_MAX_IMAGES_PER_COMMENT=5
```

### Laravel Sanctum

```
Token expiration: 10080 phút (7 ngày)
Multi-device: mỗi device 1 token riêng, không giới hạn số device
Stateful config: FRONTEND_URL

Biến môi trường:
  SANCTUM_TOKEN_EXPIRATION=10080
  FRONTEND_URL=http://localhost:5173
```

### Polling Sync (Frontend)

```
GET /api/v1/layers/{id}/sync?since={ISO8601}
Interval: 30 giây
Query: zones + marks có updated_at > since (strict)
Response: {zones:[...], marks:[...], deleted_zone_ids:[...], deleted_mark_ids:[...], server_time}

Tracking deletes: bảng sync_deletions (insert khi zone/mark bị xóa)
Cleanup: cron weekly xóa sync_deletions > 7 ngày
```

---

## RBAC — Phân Quyền

**Tầng 1 — Global role** (`users.role`): chỉ `admin` là global.

**Tầng 2 — Project role** (`project_members.role`): gán per project.

```
admin           → toàn quyền mọi project (không cần gán vào project_members)
project_manager → CRUD zone, quản lý members, mọi transition, rollback
field_team      → update status/% + tô mark CHỈ trên zone assigned cho mình
viewer          → read-only + export
```

**Kiểm tra trong Policy (KHÔNG trong Controller):**
```php
// Luôn dùng Policy, không kiểm tra role thủ công trong Controller
$this->authorize('updateStatus', $zone);
```

**PM tạo user trong project (PATCH-06):**
```
POST /projects/{id}/members/invite {email, name, role}
→ Nếu email chưa có account: tạo user + gán + trả temporary_password (1 lần)
→ Nếu đã có: gán vào project
→ PM chỉ tạo role: field_team, viewer (KHÔNG tạo project_manager)
```

---

## Activity Log & Rollback

**Mọi write operation trên zone/mark/comment → INSERT activity_logs trong cùng transaction:**

```php
// action values:
'created'       — snapshot_before = NULL
'updated'       — snapshot_before = full entity state trước khi sửa
'status_changed' — snapshot_before + changes = {field: {from, to}}
'deleted'       — snapshot_before = full zone + all marks (marks không restore comments)
'restored'      — snapshot_before = state trước rollback, restored_from_log_id set
```

**Rollback rules:**
```
action=created      → xóa entity (nếu zone có marks → cảnh báo trước)
action=updated      → restore từ snapshot_before
action=status_changed → restore status + completion_pct
action=deleted      → re-create zone + marks từ snapshot_before
action=restored     → KHÔNG cho rollback (tránh infinite loop)
```

**activity_logs.target_id KHÔNG CÓ FK** — intentional, logs tồn tại sau khi entity bị xóa.

---

## Known Constraints

**Canvas & Geometry:**
- Tọa độ polygon lưu % (0.0–1.0) relative to layer width_px/height_px
- KHÔNG lưu pixel coordinates — sẽ sai khi zoom thay đổi
- Zoom/pan qua CSS transform trên CanvasWrapper container, KHÔNG qua Fabric.js zoom
- PDF chỉ render page 1 (MVP) — page 2+ không hỗ trợ
- Mark KHÔNG validate containment trong zone boundary — vẽ tự do

**File & Upload:**
- PDF max 50MB. Ảnh comment max 10MB/ảnh, tối đa 5 ảnh/comment
- Upload PDF mới cho layer đã có zones → BLOCK (phải xóa layer tạo lại)
- Tile serving cần auth (check project access) + Cache-Control: max-age=86400

**Immutable fields (silently ignore nếu client gửi trong PUT):**
- `project.code`, `master_layer.code`, `layer.code`, `zone.zone_code`
- Layer KHÔNG CÓ PUT endpoint — sai metadata thì xóa tạo lại

**Zone Code generation (PATCH-15 — race-safe):**
```php
// Dùng DB transaction + lockForUpdate() trên layers.next_zone_seq
// Format: {project.code}_{master_layer.code}_{layer.code}_{seq:03d}
// Ví dụ: TCB_T1_KT_001
```

**completion_pct:**
- `in_progress` reject nếu gửi 0 hoặc 100
- `not_started`/`completed` auto-set, ignore client value
- % tổng dashboard = AVG(completion_pct) tất cả zones trong layer

**Concurrency:**
- Last-write-wins cho zone/mark edits (MVP)
- Polling 30s detect thay đổi — không có merge UI

**Share Link (PATCH-04):**
- MVP: viewer-only, không có editor share
- Anonymous user KHÔNG comment qua share link

**Rollback:**
- Mỗi activity_log chỉ rollback 1 lần (check `restored_from_log_id IS NULL`)
- Rollback `action=created` của zone có marks → cảnh báo user, confirm trước khi xóa

---

## DO

**Backend:**
- Luôn validate geometry ở backend (KHÔNG tin frontend)
- Dùng DB transaction cho mọi write nhiều bảng
- Ghi `activity_logs` trong cùng transaction với data change
- Insert vào `sync_deletions` khi xóa zone/mark
- Dùng `Storage::disk('local')` — không hardcode path
- Dispatch `ProcessPdfJob` qua queue — không chạy Python trực tiếp
- Luôn dùng `Policy` để authorize — không check role trong Controller
- Test file: `ZoneStatusTransitionTest`, `AuthorizationTest`, `GeometryValidationTest`, `LayerUploadTest`, `MarkCrudTest`, `ActivityLogRollbackTest`

**Frontend:**
- Optimistic update cho status change + mark creation — rollback nếu API fail
- Polling sync mỗi 30s khi đang mở canvas
- Tọa độ luôn convert qua `geometry.ts` (toPercent/fromPercent)
- Zoom/pan qua CSS transform — không gọi Fabric.js zoom
- Render order canvas: tiles → zone fill → mark fill → zone border → labels

---

## DON'T

**Backend:**
- KHÔNG query DB từ Controller
- KHÔNG gọi Python từ Controller — luôn qua Job
- KHÔNG return Eloquent Model từ API — luôn Resource
- KHÔNG hardcode credentials hay file path
- KHÔNG validate geometry chỉ ở frontend
- KHÔNG thêm `ON DELETE CASCADE` vào `activity_logs.target_id`
- KHÔNG modify DB schema không qua migration file
- KHÔNG bỏ qua edge case: file không phải PDF, geometry < 3 điểm, tọa độ ngoài [0,1]

**Frontend:**
- KHÔNG dùng PDF.js (đã bỏ — dùng TileLayer)
- KHÔNG dùng Fabric.js zoom/pan API
- KHÔNG lưu pixel coordinates — chỉ lưu %
- KHÔNG update canvas mà không cập nhật canvasStore
- KHÔNG gọi API trực tiếp trong component — luôn qua store action

---

## Current Sprint

**Sprint 1 (Ngày 1–7): Foundation + Canvas Core**

Đang build:
1. Laravel scaffold + PostgreSQL + migrations toàn bộ schema
2. Auth: Sanctum login/logout/me + RBAC middleware
3. CRUD User + Project + MasterLayer + Layer
4. Upload PDF/DXF/DWG → ProcessPdfJob → Python drawing_processor → tiles
5. Serve tiles: `GET /layers/{id}/tiles/{z}/{x}/{y}.jpg`
6. React: Login, ProjectList, ProjectDetail (tabs: Mặt bằng, Thành viên)
7. CanvasWrapper + TileLayer + PolygonLayer (render zones)
8. PolygonDrawLayer: vẽ rect/circle/polygon trên Fabric.js
9. Zone CRUD API + zone_code auto-generate (race-safe)
10. Zone status transition API + ZoneService + activity_logs
11. Zone detail panel: status, %, assignee, deadline, tasks, notes

**Deliverable Sprint 1:** Login → tạo project → upload PDF → vẽ zone → đổi trạng thái → thấy màu.

**Sprint 2 (Ngày 8–14):** Mark, Dashboard, Comment, Rollback, Sync, Deploy
**Sprint 3 (Ngày 15–21):** Excel Import, Share Link, AI zone detect (nếu kịp)
