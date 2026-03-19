# TienDo — Final MVP Spec v1.0

**Ngày:** 2026-03-18
**Trạng thái:** Dev-ready — giao cho AI coding agent
**Stack:** Laravel 11 (PHP 8.2) + PostgreSQL 14 + React 18 (Vite) + Fabric.js 5.x + PDF.js + Tailwind CSS + shadcn/ui + Python worker (pdf2image)
**Server:** Ubuntu 22.04, PHP 8.2 FPM (song song PHP 7.4 cho projects cũ), PostgreSQL 14.22

---

## 1. One-Line Summary

Upload PDF mặt bằng → khoanh vùng khu vực (zone) → đội hiện trường tô màu đã thi công đến đâu (mark) + comment ảnh → quản lý mở lên thấy ngay tình hình → export Excel.

---

## 2. Problem & Users

### Vấn đề

Quản lý thi công dự án xây dựng lớn (>100 tỷ, hàng trăm người) cần nhìn trực quan tiến độ trên mặt bằng. Mỗi tầng có nhiều hệ thi công (kiến trúc, điện, cơ, nước), mỗi hệ có bản vẽ riêng, đội riêng, tiến độ riêng.

Hiện tại: đọc Excel → tưởng tượng trên mặt bằng → hỏi miệng → mỗi ngày mất 1-2 tiếng tổng hợp, vẫn bỏ sót.

### First User

Dương Thế Huấn — quản lý thi công, dự án >100 tỷ.

### Validation Target

Huấn dùng thật trên dự án đang chạy trong 2 tuần. Dùng hàng ngày → expand. Không → kill.

### Users

| Vai trò | Hành vi | Device chính |
|---|---|---|
| Project Manager (PM) | Setup zone, gán info, quản lý team, xem tổng quan, export | Desktop |
| Field Team | Tô mark, comment + ảnh, cập nhật status/% | Desktop (trailer/văn phòng công trường) |
| Viewer / Lãnh đạo | Mở link, nhìn tổng quan | Desktop / Tablet / Mobile |
| Admin | Quản lý user, project | Desktop |

---

## 3. MVP Scope

### Sprint 1 (Ngày 1–7): Foundation + Canvas Core

1. Database migrations toàn bộ schema
2. Auth: email+password (Laravel Sanctum), RBAC 2 tầng
3. CRUD User (admin tạo, PM tạo trong scope project)
4. CRUD Project + MasterLayer + Layer
5. Upload PDF → Queue → Python pdf2image → image tiles
6. Hiển thị bản vẽ: PDF.js background + Fabric.js overlay
7. Vẽ Zone: rect/circle/polygon trên Fabric.js
8. Zone CRUD: name, status (5), %, assignee, deadline, tasks, notes
9. Zone color-coded theo trạng thái
10. Zone detail panel (click to view/edit)
11. Activity logs (insert on every change)
12. Usage analytics (login + page_view tracking)

**Deliverable:** Login → tạo project → upload PDF → vẽ zone → gán trạng thái → thấy màu trên bản vẽ.

### Sprint 2 (Ngày 8–14): Mark + Dashboard + Deploy

1. Mark (tô tiến độ): tô polygon cam/xanh bên trong zone
2. Dashboard: stats bar, filter theo trạng thái, progress tổng
3. Navigation: Project → MasterLayer → Layer (dropdown/tabs)
4. Export Excel per layer + per project
5. Comment + ảnh per zone (max 5 ảnh, 10MB/ảnh)
6. In-app notification: deadline trong 3 ngày
7. Zone/Mark activity history UI (tab trong detail panel)
8. Polling sync 30s
9. Deploy VPS
10. Responsive polish (tablet view, mobile read-only)

**Deliverable:** Đội tô tiến độ + comment ảnh → quản lý xem dashboard + nhận notification + export → MVP hoàn chỉnh.

### Sprint 3 (Ngày 15–21, nếu kịp): Import + Share

1. Import Excel: upload → normalize zone_code → preview → apply
2. Share link: token + expiry + role (editor/viewer)
3. AI auto-detect zone (bản kiến trúc) — nếu kịp
4. Responsive tablet edit

---

## 4. Core Workflows

### WF-1: Đăng nhập & Setup account

```
Admin tạo tài khoản đầu tiên (seed migration).
Admin login → tạo project → mời PM (tạo user hoặc gán user có sẵn).
PM login → vào project → tab Thành viên → thêm field_team:
  → Nhập email. Nếu chưa có account → tạo luôn với password tạm
  → Password tạm hiện 1 lần trên màn hình → PM gửi cho thợ qua Zalo/chat
  → Gán role: field_team hoặc viewer
Field team login bằng email + password tạm → đổi password lần đầu (optional MVP).
```

**Auth details:**
- Login: POST email+password → Sanctum token, expires 7 ngày
- Multi-device: mỗi device 1 token, không giới hạn
- Quên mật khẩu: MVP không có flow — admin/PM reset thủ công
- Logout: revoke token

### WF-2: Upload bản vẽ

```
PM mở project → chọn MasterLayer → click "Thêm bản vẽ"
→ Nhập: tên ("Kiến trúc"), code ("KT"), type (architecture/electrical/mechanical/plumbing/other)
→ Chọn file PDF (≤ 50MB)
→ API POST /master-layers/{id}/layers (multipart)
→ Backend: validate → lưu PDF → tạo Layer record (status=processing)
→ Dispatch ProcessPdfJob vào queue
→ Frontend: hiện "Đang xử lý..."

Python worker (ProcessPdfJob):
→ pdf2image: PDF page 1 → PNG (DPI 150) → cắt tiles 1024x1024
→ Thành công: Layer status=ready, lưu width_px/height_px/tile_path
→ Thất bại: retry 3 lần (backoff 30/60/120s) → status=failed + error_message

Frontend polling layer status → ready → render canvas
```

### WF-3: Vẽ Zone (Editor page)

```
PM mở canvas (/projects/{id}/layers/{layerId}/editor)
→ Layer status phải = ready
→ Chọn tool: Rect / Circle / Polygon
→ Vẽ trên Fabric.js
  - Rect: click + drag
  - Circle: click + drag → convert thành polygon 24 cạnh
  - Polygon: click đặt điểm → double-click kết thúc (min 3 điểm)
→ Popup nhập zone info: tên (bắt buộc), assignee, deadline, tasks, notes
→ Save → API POST /layers/{layerId}/zones
→ Backend: validate geometry, generate zone_code, compute area → lưu
→ Log: activity_logs (action=created, snapshot_before=NULL)
→ Zone hiện trên canvas: not_started = chỉ viền xám, không fill

Edit zone polygon:
→ Double-click zone → enter edit mode
→ Kéo vertex (đỏ), kéo midpoint (xanh) → insert vertex
→ Right-click vertex → xóa (min 3)
→ Undo/Redo (local, Ctrl+Z/Ctrl+Shift+Z)
→ Save → API PUT /zones/{id}
→ Log: activity_logs (action=updated, snapshot_before=full zone state, changes={geometry_pct})

Delete zone:
→ Confirm dialog → API DELETE /zones/{id}
→ Log: activity_logs (action=deleted, snapshot_before=full zone + all marks)
→ Cascade delete marks + comments
```

### WF-4: Cập nhật trạng thái & tiến độ zone

```
PM hoặc Field team mở canvas (Editor hoặc Progress page)
→ Click zone → detail panel mở
→ Đổi status dropdown → API PATCH /zones/{id}/status {status, note}
  → Backend validate state machine transition
  → Log: activity_logs (action=status_changed)
→ Đổi completion_pct slider → API PUT /zones/{id} {completion_pct}
  → Log: activity_logs (action=updated, changes={completion_pct: {from, to}})
→ Đổi assignee/deadline/tasks/notes → API PUT /zones/{id}
  → Log: activity_logs per field changed
→ Canvas: zone fill + border đổi màu ngay (optimistic update, rollback nếu API fail)
```

### WF-5: Tô Mark (Progress page)

```
Field team mở canvas (/projects/{id}/layers/{layerId}/progress)
→ Zone mình assigned: sáng bình thường. Zone khác: mờ (opacity thấp)
→ Chọn zone → Click "Tô tiến độ"
→ Toolbar: chọn trạng thái mark TRƯỚC (cam=đang thi công / xanh=hoàn thành)
→ Vẽ polygon bên trong zone (rect hoặc polygon)
→ API POST /zones/{zoneId}/marks {geometry_pct, status}
→ Log: activity_logs (action=created)
→ Canvas: tô vùng với màu tương ứng, opacity 0.5

Đổi mark status:
→ Click mark → popup → chọn status mới
→ API PATCH /marks/{id}/status {status}
→ Log: activity_logs (action=status_changed, snapshot_before)

Xóa mark:
→ Click mark → xóa (confirm)
→ API DELETE /marks/{id}
→ Log: activity_logs (action=deleted, snapshot_before=full mark state)
```

### WF-6: Comment + ảnh

```
PM hoặc Field team mở zone detail panel → tab Comments
→ Nhập text + đính kèm ảnh (max 5, max 10MB/ảnh, JPEG/PNG/WebP)
→ API POST /zones/{zoneId}/comments (multipart)
→ Comment hiện theo thời gian mới nhất trước
→ Xóa: người tạo xóa comment mình. PM/admin xóa comment bất kỳ.
```

### WF-7: Dashboard & Export

```
PM mở dashboard
→ Chọn MasterLayer (dropdown) → chọn Layer (tabs)
→ Bản vẽ hiện: zone viền theo status + mark fill cam/xanh bên trong
→ Stats bar: tổng zone + count per status + progress bar tổng
→ Click chip status → filter: chỉ hiện zone trạng thái đó, zone khác dim
→ Click zone → detail panel
→ Export Excel → API GET /layers/{id}/export/excel → download .xlsx
```

### WF-8: Import Excel (Sprint 3)

```
PM mở layer → click "Import Excel"
→ Upload file .xlsx (format template chuẩn)
→ API POST /layers/{id}/import (multipart + column mapping)
→ Backend: đọc file → normalize zone_code → match với zones hiện có
→ Response: preview [{row, zone_code, found, match_type, current_status, new_status}]
→ PM review preview → click "Áp dụng"
→ API POST /excel-imports/{jobId}/apply
→ Backend: batch update matched zones → response {success_count, not_found_count}
→ Zones chưa có → skip (báo not_found) — KHÔNG tạo zone mới từ Excel
```

### WF-9: Share Link (Sprint 3)

```
PM mở project → click "Chia sẻ"
→ Chọn role: Editor (tô mark + comment) hoặc Viewer (chỉ xem)
→ Chọn thời hạn: 1 ngày / 7 ngày / 30 ngày
→ API POST /projects/{id}/share-links → {token, url}
→ Copy URL → gửi qua Zalo/email

Người nhận mở link:
→ GET /share/{token} → validate token active + not expired
→ Nếu hết hạn / revoked → 410 Gone
→ Nếu OK → load project data read-only hoặc editor tùy role
→ Truy cập anonymous — hiện prompt nhập tên (lưu localStorage) cho comment attribution
→ Thấy TẤT CẢ zones (không filter per zone)
```

### WF-10: Rollback từ Activity Log

```
PM mở zone detail → tab "Lịch sử"
→ Thấy timeline:
  16:00 — Nguyễn Văn A — Đổi trạng thái: Đang thi công → Hoàn thành
  15:45 — Nguyễn Văn A — Cập nhật: Tiến độ 80% → 20%  ← đáng ngờ
→ PM click "Hoàn tác" trên entry 15:45
→ API POST /activity-logs/{id}/rollback
→ Backend: đọc snapshot_before → restore zone về state cũ
→ Tạo activity_log mới: action='restored', snapshot_before=current state
→ Chỉ PM/admin được rollback
```

---

## 5. Roles & Permissions

### RBAC 2 tầng

**Tầng 1 — Global role** (`users.role`): chỉ `admin` là toàn cục. Admin toàn quyền mọi project không cần gán.

**Tầng 2 — Project role** (`project_members.role`): user gán vào project với role cụ thể. User chỉ thấy project mình được gán.

```
if user.role == 'admin' → toàn quyền mọi project
else → check project_members:
  - không có → 403
  - project_manager → quản lý project
  - field_team → tô mark + comment + update zone status/%
  - viewer → chỉ xem + export
```

### Ma trận phân quyền

| Quyền | admin | project_manager | field_team | viewer |
|---|---|---|---|---|
| **Project** | | | | |
| Tạo project | ✓ | — | — | — |
| Sửa/xóa project | ✓ | ✓ (project mình) | — | — |
| **User management** | | | | |
| Quản lý user toàn cục | ✓ | — | — | — |
| Tạo user (trong project) | ✓ | ✓ | — | — |
| Edit/deactivate user (trong project) | ✓ | ✓ | — | — |
| Gán user vào project | ✓ | ✓ | — | — |
| Đổi role user trong project | ✓ | ✓ (không tạo PM) | — | — |
| **Bản vẽ** | | | | |
| CRUD MasterLayer / Layer | ✓ | ✓ | — | — |
| Upload PDF | ✓ | ✓ | — | — |
| **Zone** | | | | |
| Tạo / sửa / xóa zone | ✓ | ✓ | — | — |
| Chuyển trạng thái zone (bất kỳ) | ✓ | ✓ | — | — |
| Cập nhật zone status + % | ✓ | ✓ | ✓ | — |
| Mở lại zone completed | ✓ | ✓ | — | — |
| **Mark** | | | | |
| Tô mark (tạo / sửa / xóa) | ✓ | ✓ | ✓ | — |
| **Comment** | | | | |
| Tạo comment + ảnh | ✓ | ✓ | ✓ | — |
| Xóa comment mình tạo | ✓ | ✓ | ✓ | — |
| Xóa comment người khác | ✓ | ✓ | — | — |
| **View & Export** | | | | |
| Xem bản vẽ + zone + mark | ✓ | ✓ | ✓ | ✓ |
| Đọc comment | ✓ | ✓ | ✓ | ✓ |
| Export Excel | ✓ | ✓ | ✓ | ✓ |
| **Share** | | | | |
| Tạo / xóa share link | ✓ | ✓ | — | — |
| **Activity** | | | | |
| Xem lịch sử zone/mark | ✓ | ✓ | ✓ | ✓ |
| Rollback (hoàn tác) | ✓ | ✓ | — | — |

**Ghi chú:**
- PM tạo user mới → user mặc định global role = 'viewer', project role = field_team
- PM KHÔNG tạo được PM khác — chỉ admin
- Deactivate user trong project = remove khỏi project_members, KHÔNG xóa user toàn cục
- Field team mở Progress page: zone mình assigned sáng, zone khác mờ (vẫn thấy, không filter)

---

## 6. Data Model

### Entity Relationship Tree

```
Project (1)
├── code, name, description, address
├── ProjectMember (*) ──→ User
│   └── role: project_manager | field_team | viewer
├── MasterLayer (*)
│   ├── code, name, sort_order
│   └── Layer (*)
│       ├── code, name, type, status (processing states)
│       ├── PDF file → tiles (Python worker)
│       └── Zone (*)
│           ├── zone_code (unique: TCB_T1_KT_001)
│           ├── name, name_full, geometry_pct
│           ├── status (5), completion_pct, assignee
│           ├── assigned_user_id? → User (optional FK)
│           ├── deadline, tasks, notes
│           ├── Mark (*) — sub-polygon cam/xanh
│           │   ├── geometry_pct, status (2)
│           │   └── painted_by → User
│           ├── ZoneComment (*)
│           │   ├── content, images (JSON array paths)
│           │   └── user_id → User
│           └── ActivityLog (*) — append-only audit trail
│               ├── action, snapshot_before, changes
│               └── user_id → User
├── ShareLink (*) — token + expiry + role
└── ExcelImport (*) — per layer, lifecycle: pending→preview→applied

User (1)
├── email, password, role (admin|viewer global)
├── ProjectMember (*) → Projects
├── Notification (*) — in-app, deadline warnings
└── UsageLog (*) — append-only analytics
```

### Full Database Schema

```sql
-- =============================================
-- USERS & AUTH
-- =============================================

CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password        VARCHAR(255) NOT NULL,
    role            VARCHAR(50) NOT NULL DEFAULT 'viewer'
                    CHECK (role IN ('admin', 'viewer')),
                    -- Global role: chỉ admin là toàn cục
                    -- Các role khác gán per project qua project_members
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    remember_token  VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Laravel Sanctum tokens
CREATE TABLE personal_access_tokens (
    id              BIGSERIAL PRIMARY KEY,
    tokenable_type  VARCHAR(255) NOT NULL,
    tokenable_id    BIGINT NOT NULL,
    name            VARCHAR(255) NOT NULL,
    token           VARCHAR(64) NOT NULL UNIQUE,
    abilities       TEXT,
    last_used_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pat_tokenable ON personal_access_tokens(tokenable_type, tokenable_id);

-- =============================================
-- PROJECTS
-- =============================================

CREATE TABLE projects (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    code            VARCHAR(50) NOT NULL UNIQUE,   -- VD: "TCB" — dùng cho zone_code
    description     TEXT,
    address         VARCHAR(500),
    created_by      BIGINT NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE project_members (
    id              BIGSERIAL PRIMARY KEY,
    project_id      BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(50) NOT NULL DEFAULT 'viewer'
                    CHECK (role IN ('project_manager', 'field_team', 'viewer')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, user_id)
);
CREATE INDEX idx_pm_project ON project_members(project_id);
CREATE INDEX idx_pm_user ON project_members(user_id);

-- =============================================
-- MASTER LAYERS (Mặt bằng / Tầng)
-- =============================================

CREATE TABLE master_layers (
    id              BIGSERIAL PRIMARY KEY,
    project_id      BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,   -- "Tầng 1"
    code            VARCHAR(50) NOT NULL,    -- "T1"
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, code)
);
CREATE INDEX idx_ml_project ON master_layers(project_id);

-- =============================================
-- LAYERS (Bản vẽ)
-- =============================================

CREATE TABLE layers (
    id                  BIGSERIAL PRIMARY KEY,
    master_layer_id     BIGINT NOT NULL REFERENCES master_layers(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,   -- "Kiến trúc", "Hệ điện"
    code                VARCHAR(50) NOT NULL,    -- "KT", "DI"
    type                VARCHAR(50) NOT NULL DEFAULT 'architecture'
                        CHECK (type IN ('architecture','electrical','mechanical','plumbing','other')),
    status              VARCHAR(50) NOT NULL DEFAULT 'uploading'
                        CHECK (status IN ('uploading','processing','ready','failed')),
    sort_order          INTEGER NOT NULL DEFAULT 0,
    -- File info
    original_filename   VARCHAR(500) NOT NULL,
    file_path           VARCHAR(500) NOT NULL,
    tile_path           VARCHAR(500),
    file_size           BIGINT NOT NULL,
    -- Dimensions (after processing)
    width_px            INTEGER,
    height_px           INTEGER,
    -- Processing
    retry_count         INTEGER NOT NULL DEFAULT 0,
    error_message       TEXT,
    processed_at        TIMESTAMPTZ,
    -- Audit
    uploaded_by         BIGINT NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (master_layer_id, code)
);
CREATE INDEX idx_layers_ml ON layers(master_layer_id);
CREATE INDEX idx_layers_status ON layers(status);

-- =============================================
-- ZONES (Khu vực — Lớp 1)
-- =============================================

CREATE TABLE zones (
    id              BIGSERIAL PRIMARY KEY,
    layer_id        BIGINT NOT NULL REFERENCES layers(id) ON DELETE CASCADE,
    zone_code       VARCHAR(100) NOT NULL UNIQUE,  -- "TCB_T1_KT_001"
    name            VARCHAR(255) NOT NULL,
    name_full       VARCHAR(500),
    -- Geometry: tọa độ % (0.0–1.0) relative to layer width/height
    geometry_pct    JSONB NOT NULL,
    -- Status
    status          VARCHAR(50) NOT NULL DEFAULT 'not_started'
                    CHECK (status IN ('not_started','in_progress','completed','delayed','paused')),
    completion_pct  SMALLINT NOT NULL DEFAULT 0
                    CHECK (completion_pct >= 0 AND completion_pct <= 100),
    -- Assignment
    assignee        VARCHAR(255),              -- free text: tên đội/người
    assigned_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,  -- optional FK
    deadline        DATE,
    tasks           TEXT,
    notes           TEXT,
    -- Computed
    area_px         DOUBLE PRECISION,
    auto_detected   BOOLEAN NOT NULL DEFAULT FALSE,
    -- Audit
    created_by      BIGINT NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_zones_layer ON zones(layer_id);
CREATE INDEX idx_zones_status ON zones(status);
CREATE INDEX idx_zones_deadline ON zones(deadline) WHERE deadline IS NOT NULL;
CREATE INDEX idx_zones_code ON zones(zone_code);
CREATE INDEX idx_zones_assigned ON zones(assigned_user_id) WHERE assigned_user_id IS NOT NULL;

-- =============================================
-- MARKS (Vùng tô tiến độ — Lớp 2)
-- =============================================

CREATE TABLE marks (
    id              BIGSERIAL PRIMARY KEY,
    zone_id         BIGINT NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    geometry_pct    JSONB NOT NULL,
    status          VARCHAR(50) NOT NULL DEFAULT 'in_progress'
                    CHECK (status IN ('in_progress','completed')),
    note            TEXT,
    painted_by      BIGINT NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_marks_zone ON marks(zone_id);

-- =============================================
-- ACTIVITY LOGS — Append-only audit trail + rollback support
-- =============================================

CREATE TABLE activity_logs (
    id              BIGSERIAL PRIMARY KEY,
    -- Polymorphic target
    target_type     VARCHAR(50) NOT NULL,    -- 'zone', 'mark', 'comment'
    target_id       BIGINT NOT NULL,
    -- Action
    action          VARCHAR(50) NOT NULL,
                    -- 'created','updated','status_changed','deleted','restored'
    -- Full entity state TRƯỚC khi sửa — đủ để rollback
    snapshot_before JSONB,
                    -- NULL khi action='created'
                    -- Full zone/mark/comment state khi updated/deleted
                    -- Khi zone deleted: includes marks array
    -- Chỉ fields thay đổi — để hiển thị nhanh
    changes         JSONB,
                    -- {"status":{"from":"not_started","to":"in_progress"}}
                    -- {"completion_pct":{"from":30,"to":55}}
                    -- NULL khi action='created' hoặc 'deleted'
    -- Nếu action='restored', ghi ID log gốc
    restored_from_log_id BIGINT REFERENCES activity_logs(id),
    -- Who + When
    user_id         BIGINT NOT NULL REFERENCES users(id),
    user_name       VARCHAR(255) NOT NULL,   -- denormalize để query nhanh
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_al_target ON activity_logs(target_type, target_id);
CREATE INDEX idx_al_user ON activity_logs(user_id);
CREATE INDEX idx_al_created ON activity_logs(created_at);

-- =============================================
-- COMMENTS
-- =============================================

CREATE TABLE zone_comments (
    id              BIGSERIAL PRIMARY KEY,
    zone_id         BIGINT NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    content         TEXT NOT NULL,
    images          JSONB DEFAULT '[]',      -- ["comments/1/img1.jpg", ...]
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_zc_zone ON zone_comments(zone_id);

-- =============================================
-- NOTIFICATIONS (in-app)
-- =============================================

CREATE TABLE notifications (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(100) NOT NULL,   -- 'deadline_approaching'
    title           VARCHAR(500) NOT NULL,
    body            TEXT,
    data            JSONB DEFAULT '{}',      -- {"zone_id":1,"layer_id":5,"project_id":2}
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notif_user ON notifications(user_id);
CREATE INDEX idx_notif_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;

-- =============================================
-- USAGE LOGS — Append-only analytics cho product validation
-- =============================================

CREATE TABLE usage_logs (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT REFERENCES users(id),  -- NULL cho anonymous share link
    session_token   VARCHAR(100),
    event_type      VARCHAR(50) NOT NULL,
                    -- 'login','page_view','canvas_view','zone_click',
                    -- 'mark_created','status_changed','comment_created',
                    -- 'export_excel','share_link_accessed'
    project_id      BIGINT,
    layer_id        BIGINT,
    metadata        JSONB DEFAULT '{}',
                    -- {"page":"/projects/1/layers/5/progress",
                    --  "device":"desktop","user_agent":"..."}
    ip_address      VARCHAR(45),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ul_user ON usage_logs(user_id);
CREATE INDEX idx_ul_event ON usage_logs(event_type);
CREATE INDEX idx_ul_created ON usage_logs(created_at);
CREATE INDEX idx_ul_project ON usage_logs(project_id);

-- =============================================
-- SHARE LINKS (Sprint 3)
-- =============================================

CREATE TABLE share_links (
    id              BIGSERIAL PRIMARY KEY,
    project_id      BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    token           VARCHAR(64) NOT NULL UNIQUE,
    role            VARCHAR(50) NOT NULL DEFAULT 'viewer'
                    CHECK (role IN ('editor','viewer')),
    created_by      BIGINT NOT NULL REFERENCES users(id),
    expires_at      TIMESTAMPTZ NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sl_token ON share_links(token);

-- =============================================
-- EXCEL IMPORTS (Sprint 3)
-- =============================================

CREATE TABLE excel_imports (
    id              BIGSERIAL PRIMARY KEY,
    layer_id        BIGINT NOT NULL REFERENCES layers(id),
    filename        VARCHAR(255) NOT NULL,
    file_path       VARCHAR(500),
    status          VARCHAR(50) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','preview_ready','applied','failed')),
    column_mapping  JSONB,
    preview_data    JSONB,
    result_data     JSONB,
    imported_by     BIGINT NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_at      TIMESTAMPTZ
);
CREATE INDEX idx_ei_layer ON excel_imports(layer_id);

-- =============================================
-- LARAVEL INFRASTRUCTURE
-- =============================================

CREATE TABLE jobs (
    id              BIGSERIAL PRIMARY KEY,
    queue           VARCHAR(255) NOT NULL,
    payload         TEXT NOT NULL,
    attempts        SMALLINT NOT NULL,
    reserved_at     INTEGER,
    available_at    INTEGER NOT NULL,
    created_at      INTEGER NOT NULL
);
CREATE INDEX idx_jobs_queue ON jobs(queue, reserved_at);

CREATE TABLE failed_jobs (
    id              BIGSERIAL PRIMARY KEY,
    uuid            VARCHAR(255) NOT NULL UNIQUE,
    connection      TEXT NOT NULL,
    queue           TEXT NOT NULL,
    payload         TEXT NOT NULL,
    exception       TEXT NOT NULL,
    failed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sessions (
    id              VARCHAR(255) PRIMARY KEY,
    user_id         BIGINT,
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    payload         TEXT NOT NULL,
    last_activity   INTEGER NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
```

### Geometry JSON Format

Tất cả tọa độ lưu dạng **% (0.0–1.0)** relative to layer width/height. Portable qua mọi zoom level.

```json
// Polygon (zone hoặc mark)
{
  "type": "polygon",
  "points": [{"x": 0.15, "y": 0.20}, {"x": 0.55, "y": 0.20},
             {"x": 0.55, "y": 0.60}, {"x": 0.15, "y": 0.60}]
}

// Rect (zone only — lưu dạng rect, render convert thành polygon)
{
  "type": "rect",
  "x": 0.15, "y": 0.20,
  "width": 0.40, "height": 0.40
}
```

**Coordinate conversion (frontend):**
```javascript
// pixel → %
const toPercent = (px, layerW, layerH) => ({ x: px.x / layerW, y: px.y / layerH });
// % → pixel
const fromPercent = (pct, layerW, layerH) => ({ x: pct.x * layerW, y: pct.y * layerH });
```

### Zone Code Format

`{project.code}_{master_layer.code}_{layer.code}_{sequence_3digit}`

Ví dụ: `TCB_T1_KT_001`, `TCB_T1_DI_002`

Auto-generated server-side. Sequence auto-increment per layer.

---

## 7. State Transitions

### 7.1 Zone Status (5 trạng thái)

**Bảng màu:**

| INT | Code | Label VN | Hex | Zone fill | Zone border |
|---|---|---|---|---|---|
| 1 | not_started | Chưa bắt đầu | #9CA3AF | không fill | 2px #9CA3AF |
| 2 | in_progress | Đang thi công | #F59E0B | 0.15 opacity | 2px #F59E0B |
| 3 | completed | Hoàn thành | #10B981 | 0.15 opacity | 2px #10B981 |
| 4 | delayed | Chậm tiến độ | #EF4444 | 0.15 opacity | 2px #EF4444 |
| 5 | paused | Tạm dừng | #8B5CF6 | 0.15 opacity | 2px #8B5CF6 |

**Transition matrix:**

| From → To | not_started | in_progress | completed | delayed | paused |
|---|---|---|---|---|---|
| **not_started** | — | ✓ | ✗ | ✓ (PM/admin) | ✗ |
| **in_progress** | ✗ | — | ✓ (PM/admin) | ✓ (PM/admin) | ✓ |
| **completed** | ✗ | ✓ reopen (PM/admin) | — | ✗ | ✗ |
| **delayed** | ✗ | ✓ | ✓ (PM/admin) | — | ✗ |
| **paused** | ✗ | ✓ | ✗ | ✓ (PM/admin) | — |

**Invalid transitions (reject 422 INVALID_STATE_TRANSITION):**
- not_started → completed (phải qua in_progress)
- not_started → paused (chưa bắt đầu)
- paused → completed (phải resume trước)
- completed → not_started / delayed / paused

**Side effects:**
- Mọi transition → INSERT activity_logs (snapshot_before + changes)
- complete → PM/admin xác nhận thủ công (không tự chuyển khi mark đạt 100%)

### 7.2 Mark Status (2 trạng thái)

| INT | Code | Label VN | Hex | Fill opacity |
|---|---|---|---|---|
| 1 | in_progress | Đang thi công | #F59E0B | 0.50 |
| 2 | completed | Đã hoàn thành | #10B981 | 0.50 |

Transitions: in_progress ↔ completed (bidirectional, field_team trở lên).

**Mark KHÔNG ảnh hưởng zone completion_pct.** Mark là visual indicator. % zone do PM set thủ công.

### 7.3 Layer Processing Status

| From | Event | To | Side Effects | Guard |
|---|---|---|---|---|
| uploading | upload_complete | processing | Dispatch ProcessPdfJob | file ≤50MB, PDF |
| processing | success | ready | Lưu tiles, width/height | — |
| processing | fail | failed | Log error, retry_count++ | — |
| failed | retry | processing | Re-dispatch job | retry_count < 3 |
| failed | delete | (deleted) | Xóa file + DB | PM/admin |
| ready | delete | (deleted) | Cascade delete zones/marks | PM/admin |

### 7.4 Excel Import Status (Sprint 3)

| From | Event | To | Side Effects |
|---|---|---|---|
| pending | parse success | preview_ready | preview_data saved |
| pending | parse fail | failed | error saved |
| preview_ready | apply success | applied | batch update zones |
| preview_ready | apply fail | failed | rollback |

### 7.5 Share Link Status (Sprint 3)

| State | Condition | Response |
|---|---|---|
| active | is_active=true AND expires_at > NOW() | 200 + data |
| expired | expires_at ≤ NOW() | 410 Gone |
| revoked | is_active=false | 410 Gone |

---

## 8. API Contract

Base: `/api/v1` | Auth: `Authorization: Bearer {token}` | Format: JSON
Success: `{"success": true, "data": {...}}` | Error: `{"success": false, "error": {"code": "...", "message": "...", "details": {...}}}`

### Auth
```
POST   /auth/login               {email, password} → {token, expires_at, user:{id,name,email,role}}
POST   /auth/logout              → revoke token
GET    /auth/me                  → {id, name, email, role, projects:[{id,name,role}]}
```

### Users
```
GET    /users                    → list (admin: all, PM: project scope)
POST   /users                    {name, email, password}    — admin tạo global, PM tạo + gán project
PUT    /users/{id}               {name, email, is_active}
```

### Projects
```
GET    /projects                 → list (filtered by user access)
POST   /projects                 {name, code, description, address}    — admin only
GET    /projects/{id}            → project + stats summary
PUT    /projects/{id}            {name, description, address}
DELETE /projects/{id}            — admin only
```

### Project Members
```
GET    /projects/{id}/members
POST   /projects/{id}/members              {user_id, role}
PUT    /projects/{id}/members/{userId}     {role}
DELETE /projects/{id}/members/{userId}     — remove from project (keep user)
```

### MasterLayers
```
GET    /projects/{projectId}/master-layers
POST   /projects/{projectId}/master-layers   {name, code, sort_order}
PUT    /master-layers/{id}                   {name, sort_order}
DELETE /master-layers/{id}                   — cascade layers/zones/marks
```

### Layers
```
GET    /master-layers/{mlId}/layers
POST   /master-layers/{mlId}/layers          multipart: file + {name, code, type}
GET    /layers/{id}                          → layer info + processing status
DELETE /layers/{id}                          — cascade zones/marks
POST   /layers/{id}/retry                    — retry failed processing
GET    /layers/{id}/tiles/{z}/{x}/{y}.jpg    — serve tile image
```

### Zones
```
GET    /layers/{layerId}/zones               → all zones with marks count
POST   /layers/{layerId}/zones               {name, name_full?, geometry_pct, assignee?,
                                              assigned_user_id?, deadline?, tasks?, notes?}
GET    /zones/{id}                           → zone + marks + latest comments
PUT    /zones/{id}                           {name?, geometry_pct?, assignee?, assigned_user_id?,
                                              deadline?, tasks?, notes?, completion_pct?}
PATCH  /zones/{id}/status                    {status, note?}
DELETE /zones/{id}                           — cascade marks + comments + logs
```

### Marks
```
GET    /zones/{zoneId}/marks
POST   /zones/{zoneId}/marks                 {geometry_pct, status, note?}
PATCH  /marks/{id}/status                    {status}
DELETE /marks/{id}
```

### Sync
```
GET    /layers/{id}/sync?since={ISO8601}
       → {zones:[...changed], marks:[...changed], server_time:"ISO8601"}
```

### Comments
```
GET    /zones/{zoneId}/comments              → sorted by created_at DESC
POST   /zones/{zoneId}/comments              multipart: content + images[] (max 5, max 10MB each)
DELETE /comments/{id}
```

### Activity Logs
```
GET    /zones/{id}/history                   → activity_logs for zone + its marks
POST   /activity-logs/{id}/rollback          — PM/admin only
```

### Notifications
```
GET    /notifications                        → paginated, unread first
GET    /notifications/unread-count           → {count: N}
PATCH  /notifications/{id}/read
PATCH  /notifications/read-all
```

### Export
```
GET    /projects/{id}/export/excel           → download .xlsx (all layers)
GET    /layers/{id}/export/excel             → download .xlsx (single layer)
```

### Analytics
```
POST   /analytics/events                     {event_type, project_id?, layer_id?, metadata?}
                                             — fire-and-forget, async
```

### Excel Import (Sprint 3)
```
POST   /layers/{id}/import                   multipart: file + {zone_code_column?, status_column?,
                                             pct_column?, start_row?}
                                             → {job_id, preview:[{row,zone_code,found,match_type,
                                                current_status,new_status}]}
POST   /excel-imports/{jobId}/apply          → {success_count, not_found_count, errors:[]}
```

### Share Links (Sprint 3)
```
POST   /projects/{id}/share-links            {role, expires_hours}
GET    /projects/{id}/share-links
DELETE /share-links/{id}                     — revoke
GET    /share/{token}                        → public, no auth: project data + role
```

---

## 9. UI Modules / Screens

### Site Map

```
/login                              ← Login page
/                                   ← Redirect → /projects
/projects                           ← Project list (cards)
/projects/{id}                      ← Project detail
  ├── Tab: Mặt bằng                ← MasterLayer list + Layer list
  ├── Tab: Thành viên              ← Member management (PM/admin)
  └── Tab: Cài đặt                 ← Edit project info (PM/admin)
/projects/{id}/layers/{layerId}/editor    ← Canvas: vẽ zone (PM/admin)
/projects/{id}/layers/{layerId}/progress  ← Canvas: tô mark (field team)
/projects/{id}/layers/{layerId}/view      ← Canvas: read-only (all)
/notifications                      ← Notification list
/admin/users                        ← User management (admin only)
/share/{token}                      ← Public share view (Sprint 3)
```

### Screen Descriptions

**Login** (`/login`)
- Email + password form
- "Đăng nhập" button
- Error: "Email hoặc mật khẩu không đúng"
- Redirect → /projects after login

**Project List** (`/projects`)
- Card grid: tên, mô tả, stats (total zones, % progress)
- Button "Tạo dự án" (admin only)
- Click card → project detail

**Project Detail** (`/projects/{id}`)
- Header: tên project, mô tả, địa chỉ
- Tab Mặt bằng:
  - Left: MasterLayer list (sortable)
  - Right: Layer list per selected MasterLayer
  - Mỗi layer: tên, type badge, status badge (processing/ready/failed), zone count
  - Click layer → canvas (editor hoặc progress tùy role)
  - Button "Thêm mặt bằng" / "Thêm bản vẽ" (PM/admin)
- Tab Thành viên (PM/admin):
  - User list: tên, email, role, actions
  - Button "Thêm thành viên" → form email + role
  - Edit role dropdown, deactivate button
- Tab Cài đặt (PM/admin):
  - Edit form: tên, mô tả, địa chỉ
  - Export Excel buttons
  - Share link management (Sprint 3)

**Canvas — Editor** (`/projects/{id}/layers/{layerId}/editor`)
- Layout: full-width canvas + right sidebar (320px)
- Canvas area:
  - PDF background (PDF.js)
  - Zone polygons overlay (Fabric.js)
  - Toolbar top-left: mode buttons (Select / Draw)
  - Draw sub-toolbar: Rect / Circle / Polygon
  - Context bar: Undo / Redo / Cancel / Save (khi đang edit polygon)
  - Zoom bar bottom-left: +, −, Fit
  - Legend bar bottom-right: 5 status colors
- Sidebar:
  - Top: "Khu vực" count
  - Zone list: scrollable, click to select, color dot + name + % badge
  - Zone detail panel (bottom half): status dropdown, % slider, assignee, deadline, tasks, notes, delete button
  - Tab "Lịch sử": activity timeline

**Canvas — Progress** (`/projects/{id}/layers/{layerId}/progress`)
- Same layout nhưng:
  - KHÔNG có draw zone tools
  - Zone mình assigned: sáng. Zone khác: mờ (opacity 0.08)
  - Click zone mình → StatusPopup: status dropdown + % slider (1 bước, gọn)
  - Button "Tô tiến độ" → enter mark draw mode
  - Mark toolbar: status selector (Cam đang thi công / Xanh hoàn thành) → draw polygon
  - Click mark → popup: đổi status, xóa
- Sidebar: zone list + detail + comments tab + history tab

**Canvas — View** (`/projects/{id}/layers/{layerId}/view`)
- Read-only: no edit tools, no status change
- Click zone → info popup (read-only)
- Stats bar + filter chips
- Export Excel button

### Responsive Strategy

| Breakpoint | Features |
|---|---|
| Desktop ≥1024px | FULL — tất cả features, canvas editor, tô mark |
| Tablet 768–1023px | VIEW + LIGHT EDIT — xem bản vẽ, đổi status, comment, KHÔNG vẽ zone/mark mới |
| Mobile <768px | VIEW ONLY — xem dashboard, đọc comment, xem bản vẽ (zoom/pan), KHÔNG edit |

### Canvas Render Order (giải quyết zone vs mark overlap)

```
Layer 1 (bottom):  PDF background tiles
Layer 2:           Zone fill — status color, opacity 0.15 (not_started: không fill)
Layer 3:           Mark fill — cam/xanh, opacity 0.50 (đậm hơn zone rõ rệt)
Layer 4:           Zone border — stroke 2px, status color, opacity 1.0
Layer 5 (top):     Labels (zone name) + badges (%, assignee, deadline khi zoom sâu)
```

Nguyên tắc: zone chỉ tô nhẹ + viền rõ. Mark tô đậm hơn hẳn. Mắt nhìn → viền = ranh giới khu vực, fill đậm = đã thi công.

---

## 10. Validation Rules

### Upload PDF
- MIME: `application/pdf` only
- Max size: 50MB (reject 413)
- Chỉ PM/admin

### Zone
- `name`: required, max 255 chars
- `geometry_pct`: required, valid JSON
  - `polygon.points`: min 3, each x,y in [0.0, 1.0]
  - `rect`: x,y,width,height numbers; x+width ≤ 1.0, y+height ≤ 1.0
- `status`: must be in enum (5 values)
- `completion_pct`: integer 0–100
- `deadline`: valid date or null
- Status transition: validate per state machine → reject 422 INVALID_STATE_TRANSITION

### Mark
- `geometry_pct`: required, valid polygon, min 3 points, coords in [0.0, 1.0]
- `status`: `in_progress` or `completed` only
- Parent zone must exist, zone's layer must be status=ready

### Comment
- `content`: required, max 5000 chars
- `images`: max 5 files, max 10MB each, JPEG/PNG/WebP only

### User
- `email`: required, valid email, unique
- `password`: required, min 8 chars
- `name`: required, max 255 chars

### Project
- `code`: required, max 50 chars, alphanumeric + underscore, unique
- `name`: required, max 255 chars

---

## 11. Error Cases / Edge Cases

| # | Scenario | Handling |
|---|---|---|
| 1 | PDF processing fails | Retry 3× (backoff 30/60/120s) → status=failed → user retry/re-upload |
| 2 | Concurrent zone edit | Last-write-wins. Polling 30s detect changes. No merge UI (MVP) |
| 3 | Zone polygon overlap | Cho phép. Mark thuộc zone nó được tạo trong |
| 4 | Delete zone có marks | Cascade delete (ON DELETE CASCADE). snapshot_before lưu full state |
| 5 | Delete layer có zones | Cascade delete layers → zones → marks |
| 6 | User removed from project | Giữ data (zones, marks, comments). User mất access |
| 7 | Upload PDF mới cho layer đã có zone | Block — xóa layer và tạo lại (MVP simplification) |
| 8 | PDF quá lớn render | PDF.js render page 1 only. Tiles 1024×1024 |
| 9 | Slow network | Optimistic update cho status/mark. Rollback nếu API fail |
| 10 | Invalid state transition | Backend reject 422 + INVALID_STATE_TRANSITION + details |
| 11 | Comment quá 5 ảnh | Backend reject 422 + COMMENT_TOO_MANY_IMAGES |
| 12 | Rollback entry đã rollback | Block — mỗi log chỉ rollback 1 lần (check restored_from_log_id) |
| 13 | Rollback tạo zone (action=created) | Xóa zone (tương đương delete) |
| 14 | Rollback xóa zone (action=deleted) | Re-create zone + marks từ snapshot_before |
| 15 | Share link expired | 410 Gone + message "Link đã hết hạn" |
| 16 | Token Sanctum expired | 401 → frontend redirect /login |
| 17 | Canvas >200 zones | Hiện warning "Nhiều khu vực, có thể chậm". Không block |
| 18 | Excel import zone_code not found | Skip row, report in not_found_count. Không tạo zone mới |

### Error Codes

```
INVALID_STATE_TRANSITION    — chuyển trạng thái zone không hợp lệ
DRAWING_NOT_READY           — layer đang processing
DRAWING_PROCESSING_FAILED   — xử lý PDF thất bại
MAX_RETRY_EXCEEDED          — retry > 3 lần
GEOMETRY_INVALID            — JSON geometry sai format
COORDINATE_OUT_OF_RANGE     — tọa độ ngoài [0.0, 1.0]
FILE_TOO_LARGE              — PDF > 50MB hoặc ảnh > 10MB
UNSUPPORTED_FILE_TYPE       — không phải PDF (upload) hoặc không phải ảnh (comment)
NOT_PROJECT_MEMBER          — user chưa gán vào project
INSUFFICIENT_ROLE           — role không đủ quyền
COMMENT_TOO_MANY_IMAGES     — > 5 ảnh/comment
ZONE_CODE_DUPLICATE         — zone_code trùng (should not happen with auto-generate)
USER_ALREADY_MEMBER         — user đã trong project
INVALID_ROLLBACK            — log đã rollback hoặc không có snapshot
IMPORT_JOB_ALREADY_APPLIED  — Excel import đã apply rồi
SHARE_LINK_EXPIRED          — link hết hạn hoặc bị revoke
```

---

## 12. Non-Goals

KHÔNG build trong MVP:
- Mobile native app
- Offline mode
- Gantt chart / timeline view
- QA checklist / inspection workflow
- Nghiệm thu workflow
- Integration P6 / MS Project / ERP
- Email notification (chỉ in-app)
- Push notification
- BI dashboard nâng cao
- Permission per-layer / per-zone
- Subscription billing tự động
- Multi-project dashboard tổng hợp
- Construction system dependency / cascade
- Incident management
- Real-time WebSocket (dùng polling 30s)
- Freeform brush painting (chỉ polygon mark)
- Multi-language
- Dark mode (light theme only)
- PDF multi-page support (page 1 only)
- Mark containment validation (mark không bắt buộc nằm trong zone boundary)
- Auto-calculate zone % từ mark area

---

## 13. Acceptance Criteria

### AC-01: Auth & User Management
- [ ] Admin login email+password → token → access /projects
- [ ] Wrong password → 401 "Email hoặc mật khẩu không đúng"
- [ ] PM tạo user mới trong project → password tạm hiện trên màn hình
- [ ] PM gán role cho user trong project
- [ ] PM deactivate user → user mất access nhưng data giữ nguyên
- [ ] User chỉ thấy project mình được gán

### AC-02: Project & Hierarchy
- [ ] CRUD project: tên, code (unique), mô tả, địa chỉ
- [ ] CRUD MasterLayer trong project: tên, code, sort_order
- [ ] CRUD Layer trong MasterLayer: tên, code, type
- [ ] Navigation: Project list → Project detail → MasterLayer → Layer → Canvas

### AC-03: Upload & Display PDF
- [ ] Upload PDF ≤50MB → processing → ready → hiển thị trên canvas
- [ ] Zoom smooth (scroll wheel + buttons +/−/fit)
- [ ] Pan (drag canvas)
- [ ] Upload non-PDF → reject 422
- [ ] Upload >50MB → reject 413
- [ ] Processing fail → retry → fail → status=failed, error message hiển thị

### AC-04: Zone Management
- [ ] Vẽ zone: rect, circle, polygon (click points, double-click finish)
- [ ] Zone hiện: not_started=chỉ viền xám, others=fill nhẹ 0.15 + viền 2px
- [ ] Click zone → detail panel hiện đúng info
- [ ] Edit zone polygon: kéo vertex, midpoint insert, undo/redo
- [ ] Delete zone → confirm → cascade delete marks + comments
- [ ] Zone code auto-generate đúng format (TCB_T1_KT_001)

### AC-05: Zone Status
- [ ] Valid transition → success + log + canvas màu đổi
- [ ] Invalid transition → reject 422 + error message
- [ ] Field team: cập nhật status + % (nhưng KHÔNG tạo/xóa zone)
- [ ] PM/admin: mở lại zone completed
- [ ] Mọi transition ghi activity_logs với snapshot_before

### AC-06: Mark (Tô tiến độ)
- [ ] Field team chọn zone → "Tô tiến độ" → chọn status (cam/xanh)
- [ ] Vẽ polygon → save → hiện đúng màu opacity 0.50
- [ ] Đổi mark status: cam ↔ xanh
- [ ] Xóa mark (confirm)
- [ ] Mark KHÔNG thay đổi zone completion_pct
- [ ] Viewer KHÔNG tô được
- [ ] Mark render đè lên zone fill (render order đúng)

### AC-07: Dashboard & Filter
- [ ] Stats bar: tổng + count per status + progress bar
- [ ] Click chip → filter zones by status (canvas + list)
- [ ] Zones không match filter → dim (mờ)
- [ ] Progress % = AVG(completion_pct) tất cả zones

### AC-08: Comments
- [ ] Tạo comment + upload ảnh (max 5, max 10MB each)
- [ ] Comment hiện sorted by created_at DESC
- [ ] Xóa comment mình. PM/admin xóa comment bất kỳ

### AC-09: Export Excel
- [ ] Download .xlsx per layer
- [ ] Download .xlsx per project (all layers)
- [ ] Columns: zone_code, name, status_vn, completion_pct, assignee, deadline, tasks, notes

### AC-10: Activity Log & Rollback
- [ ] Mọi change zone/mark → activity_logs entry với snapshot_before
- [ ] Zone detail → tab Lịch sử → timeline list
- [ ] PM/admin click "Hoàn tác" → entity restored về snapshot_before
- [ ] Rollback tạo activity_log mới (action=restored)
- [ ] Delete zone → snapshot_before chứa zone + all marks

### AC-11: Notifications
- [ ] Zone deadline trong 3 ngày + chưa completed → notification cho PM
- [ ] Badge unread count trên nav bar
- [ ] Mark as read / mark all read

### AC-12: Sync
- [ ] Polling 30s: zones + marks changed since last sync
- [ ] Canvas cập nhật không cần refresh

### AC-13: Responsive
- [ ] Desktop ≥1024px: full features
- [ ] Tablet 768–1023px: xem + đổi status + comment, KHÔNG vẽ zone/mark
- [ ] Mobile <768px: xem only, KHÔNG edit

### AC-14: Usage Analytics
- [ ] Login event tracked
- [ ] Page view events tracked
- [ ] Mark created events tracked
- [ ] Data queryable qua SQL (no UI needed MVP)

---

## 14. Build Order / Implementation Order

### Sprint 1 — Chi tiết ngày

**Ngày 1–2: Foundation**
```
1. Laravel project scaffold + PostgreSQL connection
2. Tailwind CSS + shadcn/ui + React (Vite) setup
3. Database migrations: users, personal_access_tokens, sessions,
   projects, project_members, master_layers, layers, zones, marks,
   activity_logs, usage_logs, zone_comments, notifications, jobs, failed_jobs
4. Seed: admin user (admin@tiendo.vn / password tạm)
5. Auth: login/logout/me endpoints (Sanctum)
6. RBAC middleware: CheckProjectAccess
7. Usage log middleware: track login + page_view
```

**Ngày 3–4: CRUD + Upload**
```
8. User CRUD API (admin + PM scope)
9. Project CRUD API + project_members API
10. MasterLayer CRUD API
11. Layer upload API (multipart PDF) + ProcessPdfJob
12. Python script: pdf2image → tiles
13. Layer retry/delete API
14. React pages: Login, ProjectList, ProjectDetail (tabs: Mặt bằng, Thành viên)
```

**Ngày 5–7: Canvas + Zone**
```
15. React CanvasWrapper: PDF.js background + Fabric.js overlay + CSS transform zoom/pan
16. Zone CRUD API + zone_code auto-generate
17. Zone status transition API + validation + activity_logs
18. React Editor page: PolygonDrawLayer (rect/circle/polygon), zone list, detail panel
19. React zone rendering: PolygonLayer (color by status, render order)
20. Zone edit: vertex drag, midpoint insert, undo/redo
21. Activity logs: INSERT on every zone change (snapshot_before)
```

**Sprint 1 Deliverable test:** Login → create project → add MasterLayer → upload PDF → draw zones → assign status → see colors.

### Sprint 2 — Chi tiết ngày

**Ngày 8–9: Mark + Progress**
```
22. Mark CRUD API + activity_logs
23. React Progress page: mark draw mode, status selector, StatusPopup
24. Canvas render order: zone fill (0.15) → mark fill (0.50) → zone border → labels
25. Field team UX: own-zones highlight, other-zones dim
```

**Ngày 10–11: Dashboard + Comments**
```
26. Stats bar component: counts per status, progress bar, filter chips
27. Export Excel API (per layer + per project) — PhpSpreadsheet
28. Comment API: create (multipart), list, delete
29. Comment UI: thread in zone detail panel
30. Navigation polish: MasterLayer dropdown, Layer tabs
```

**Ngày 12–13: Notifications + History + Sync**
```
31. Deadline notification: Laravel scheduled command daily 06:00
32. Notification API: list, unread-count, mark-read
33. Notification UI: bell icon + badge + dropdown
34. Zone/Mark history UI: timeline tab in detail panel
35. Rollback API + UI button
36. Polling sync: GET /layers/{id}/sync?since=
```

**Ngày 14: Deploy + Polish**
```
37. VPS setup: PHP 8.2, PostgreSQL, Python, poppler-utils, Nginx, Supervisor
38. Deploy script + rollback procedure
39. Responsive tablet/mobile breakpoints
40. Smoke test with real PDF (Techcombank floor plan)
```

**Sprint 2 Deliverable test:** Field team tô mark + comment ảnh → PM xem dashboard + filter + export Excel + xem history + rollback → notifications hiển thị.

### Sprint 3 (nếu kịp)
```
41. Excel import: upload → normalize → preview → apply
42. Share links: create/revoke/access
43. AI auto-detect zone (PyMuPDF extract text labels) — nếu kịp
```

---

## 15. Import/Export Excel Format

### Template Excel (cung cấp sẵn cho download)

Sheet "Zones":

| Column | Header | Type | Mô tả |
|---|---|---|---|
| A | zone_code | string | Mã zone duy nhất. VD: TCB_T1_KT_001 |
| B | label | string | Tên khu vực |
| C | status | string | 1 trong 5: not_started, in_progress, completed, delayed, paused |
| D | assignee | string | Người/đội phụ trách |
| E | deadline | date | YYYY-MM-DD |
| F | tasks | string | Hạng mục thi công (\\n xuống dòng) |
| G | notes | string | Ghi chú |
| H | progress_pct | integer | 0–100 |

Sheet "Hướng dẫn Status": bảng tra cứu 5 status values + label VN + màu.

Sheet "Hướng dẫn": text hướng dẫn sử dụng file.

### Import Rules (Sprint 3)
- Match zone_code: exact match → update. Not found → skip (báo not_found)
- Normalize: trim + lowercase + remove spaces trước khi match
- Match types: `exact` (zone_code y hệt) | `normalized` (match sau normalize) | `not_found`
- Preview trước khi apply — user confirm
- KHÔNG tạo zone mới từ import — chỉ update zones đã có
- KHÔNG cascade side effects khi import

### Export Rules
- Per layer: tất cả zones của layer đó
- Per project: tất cả zones, grouped by MasterLayer + Layer (mỗi layer 1 sheet hoặc 1 section)
- Status column: label tiếng Việt (Chưa bắt đầu, Đang thi công, Hoàn thành, Chậm tiến độ, Tạm dừng)
- Date format: YYYY-MM-DD

---

## 16. Design Tokens — Ánh Dương Brand

### Color Palette

```
-- Brand (UI chrome: header, buttons, nav, links)
Primary:           #FF7F29  (cam Ánh Dương — từ logo)
Primary hover:     #E5691D  (cam đậm hơn)
Primary light:     #FFF3E8  (cam nhạt background)

-- Neutral
Background:        #FFFFFF
Surface:           #F8FAFC  (slate-50) — cards, panels
Border:            #E2E8F0  (slate-200)
Text primary:      #0F172A  (slate-900)
Text secondary:    #64748B  (slate-500)

-- Zone status (canvas only — KHÁC brand cam, tránh xung đột visual)
not_started:       #9CA3AF  (xám)       fill: none    border: 2px
in_progress:       #F59E0B  (amber)     fill: 0.15    border: 2px
completed:         #10B981  (emerald)   fill: 0.15    border: 2px
delayed:           #EF4444  (red)       fill: 0.15    border: 2px
paused:            #8B5CF6  (violet)    fill: 0.15    border: 2px

-- Mark status (canvas only)
mark in_progress:  #F59E0B  opacity 0.50
mark completed:    #10B981  opacity 0.50

-- Feedback
Success:           #10B981
Danger:            #EF4444
Warning:           #F59E0B
Info:              #3B82F6
```

### Typography
- Font family: Inter (fallback: -apple-system, BlinkMacSystemFont, sans-serif)
- Base size: 14px
- Headings: 600 weight

### Logo
- File: Ánh Dương SVG logo (cam #FF7F29, text trắng)
- Header: chiều cao 28px, top-left
- Login page: chiều cao 48px, centered
- Favicon: extract icon portion → 32×32 .ico

### CSS Framework
- **Tailwind CSS 3.x** — utility-first
- **shadcn/ui** — form elements, dialog, dropdown, toast, tabs
- Canvas area: custom CSS (không dùng Tailwind cho Fabric.js internals)

### Theme
- **Light theme only** (MVP) — dễ đọc outdoor tại công trường
- Brand cam `#FF7F29` cho UI elements (header, buttons)
- Status cam `#F59E0B` cho canvas zones/marks (amber, khác brand cam)

---

## 17. Open Questions

### Must-answer trước Sprint 1

1. **VPS specs**: RAM bao nhiêu? (`free -h`). Cần tối thiểu 2GB, khuyến nghị 4GB cho PHP 7.4 FPM + PHP 8.2 FPM + PostgreSQL + Python + Nginx chạy song song
2. **Domain + SSL**: Đã có domain cho TienDo chưa? Certbot Let's Encrypt cần domain trỏ sẵn
3. **VPS root access**: Cần sudo để cài PHP 8.2, poppler-utils, supervisor. Có quyền không?

### Đã chốt (không cần hỏi lại)

- **PHP 8.2 song song 7.4**: OK — dùng PHP-FPM pools riêng, Nginx route theo domain
- **PostgreSQL 14**: OK — Laravel 11 hỗ trợ
- **Logo**: Ánh Dương SVG, cam #FF7F29
- **Project code**: Admin/PM nhập thủ công
- **Field team permission**: có thể đổi status + %, KHÔNG tạo/xóa zone
- **PDF multi-page**: page 1 only (MVP)
- **Mark containment**: không validate, vẽ tự do
- **CSS**: Tailwind + shadcn/ui
- **Theme**: Light only

### Có thể decide later

7. Session timeout: giữ 7 ngày hay ngắn hơn?
8. Backup strategy chi tiết (ngoài deploy.sh pg_dump)?

---

## 18. Implementation Guide

Phần này dành cho AI coding agent — chi tiết đủ để generate code đúng architecture, không tự đoán.

### 18.1 Laravel File Structure

```
tiendo/
├── CLAUDE.md                          # AI agent context file
├── SPEC.md                            # This file
├── .env                               # Environment config (see 18.8)
├── .env.example
│
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── Api/
│   │   │   │   ├── AuthController.php
│   │   │   │   ├── UserController.php
│   │   │   │   ├── ProjectController.php
│   │   │   │   ├── ProjectMemberController.php
│   │   │   │   ├── MasterLayerController.php
│   │   │   │   ├── LayerController.php
│   │   │   │   ├── ZoneController.php
│   │   │   │   ├── MarkController.php
│   │   │   │   ├── ZoneCommentController.php
│   │   │   │   ├── NotificationController.php
│   │   │   │   ├── ExportController.php
│   │   │   │   ├── ActivityLogController.php
│   │   │   │   ├── AnalyticsController.php
│   │   │   │   ├── ExcelImportController.php      # Sprint 3
│   │   │   │   └── ShareLinkController.php         # Sprint 3
│   │   │   └── Controller.php                      # Base
│   │   ├── Requests/
│   │   │   ├── Auth/LoginRequest.php
│   │   │   ├── StoreProjectRequest.php
│   │   │   ├── StoreMasterLayerRequest.php
│   │   │   ├── StoreLayerRequest.php
│   │   │   ├── StoreZoneRequest.php
│   │   │   ├── UpdateZoneRequest.php
│   │   │   ├── UpdateZoneStatusRequest.php
│   │   │   ├── StoreMarkRequest.php
│   │   │   ├── StoreCommentRequest.php
│   │   │   └── StoreProjectMemberRequest.php
│   │   ├── Resources/
│   │   │   ├── ProjectResource.php
│   │   │   ├── MasterLayerResource.php
│   │   │   ├── LayerResource.php
│   │   │   ├── ZoneResource.php
│   │   │   ├── MarkResource.php
│   │   │   ├── CommentResource.php
│   │   │   └── NotificationResource.php
│   │   └── Middleware/
│   │       ├── CheckProjectAccess.php              # Verify user belongs to project
│   │       └── TrackUsage.php                      # Log usage_logs per request
│   │
│   ├── Models/
│   │   ├── User.php
│   │   ├── Project.php
│   │   ├── ProjectMember.php
│   │   ├── MasterLayer.php
│   │   ├── Layer.php
│   │   ├── Zone.php
│   │   ├── Mark.php
│   │   ├── ZoneComment.php
│   │   ├── ActivityLog.php
│   │   ├── UsageLog.php
│   │   ├── Notification.php
│   │   ├── ShareLink.php                           # Sprint 3
│   │   └── ExcelImport.php                         # Sprint 3
│   │
│   ├── Services/
│   │   ├── AuthService.php
│   │   ├── UserService.php
│   │   ├── ProjectService.php
│   │   ├── MasterLayerService.php
│   │   ├── LayerService.php
│   │   ├── ZoneService.php
│   │   ├── MarkService.php
│   │   ├── CommentService.php
│   │   ├── NotificationService.php
│   │   ├── ExportService.php
│   │   ├── ActivityLogService.php
│   │   ├── PdfProcessingService.php
│   │   ├── ExcelImportService.php                  # Sprint 3
│   │   └── ShareLinkService.php                    # Sprint 3
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
│   │   └── ProcessPdfJob.php
│   │
│   ├── Console/
│   │   └── Commands/
│   │       └── CheckDeadlinesCommand.php           # Cron hàng ngày 06:00
│   │
│   ├── Policies/
│   │   ├── ProjectPolicy.php
│   │   ├── LayerPolicy.php
│   │   ├── ZonePolicy.php
│   │   ├── MarkPolicy.php
│   │   └── CommentPolicy.php
│   │
│   └── Enums/
│       ├── ZoneStatus.php
│       ├── MarkStatus.php
│       ├── LayerStatus.php
│       ├── LayerType.php
│       └── ProjectMemberRole.php
│
├── database/
│   ├── migrations/
│   │   ├── 0001_01_01_000000_create_users_table.php
│   │   ├── 0001_01_01_000001_create_personal_access_tokens_table.php
│   │   ├── 0001_01_01_000002_create_sessions_table.php
│   │   ├── 2026_03_18_000003_create_projects_table.php
│   │   ├── 2026_03_18_000004_create_project_members_table.php
│   │   ├── 2026_03_18_000005_create_master_layers_table.php
│   │   ├── 2026_03_18_000006_create_layers_table.php
│   │   ├── 2026_03_18_000007_create_zones_table.php
│   │   ├── 2026_03_18_000008_create_marks_table.php
│   │   ├── 2026_03_18_000009_create_activity_logs_table.php
│   │   ├── 2026_03_18_000010_create_zone_comments_table.php
│   │   ├── 2026_03_18_000011_create_notifications_table.php
│   │   ├── 2026_03_18_000012_create_usage_logs_table.php
│   │   ├── 2026_03_18_000013_create_jobs_table.php
│   │   ├── 2026_03_18_000014_create_share_links_table.php
│   │   └── 2026_03_18_000015_create_excel_imports_table.php
│   └── seeders/
│       └── AdminUserSeeder.php                     # 1 admin: admin@tiendo.vn
│
├── routes/
│   ├── api.php                                     # All API routes
│   └── web.php                                     # Redirect → React SPA
│
├── scripts/
│   └── pdf_processor.py                            # PDF → tiles (Python)
│
├── storage/
│   └── app/
│       ├── layers/                                 # PDF + tiles per layer
│       │   └── {layer_id}/
│       │       ├── original.pdf
│       │       └── tiles/
│       │           └── 0_{x}_{y}.jpg
│       └── comments/                               # Comment images
│           └── {comment_id}/
│               └── {uuid}.{ext}
│
├── tests/
│   └── Feature/
│       ├── ZoneStatusTransitionTest.php
│       ├── AuthorizationTest.php
│       ├── GeometryValidationTest.php
│       ├── LayerUploadTest.php
│       ├── MarkCrudTest.php
│       └── ActivityLogRollbackTest.php
│
├── frontend/                                       # React SPA (Vite)
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/
│       │   └── client.ts                           # Axios instance + interceptors
│       ├── stores/
│       │   ├── authStore.ts                        # Zustand: user, token, login/logout
│       │   ├── projectStore.ts                     # Zustand: current project, members
│       │   └── canvasStore.ts                      # Zustand: zones, marks, selected, mode
│       ├── pages/
│       │   ├── Login.tsx
│       │   ├── ProjectList.tsx
│       │   ├── ProjectDetail.tsx
│       │   ├── CanvasEditor.tsx
│       │   ├── CanvasProgress.tsx
│       │   ├── CanvasView.tsx
│       │   ├── Notifications.tsx
│       │   ├── AdminUsers.tsx
│       │   └── ShareView.tsx                       # Sprint 3
│       ├── components/
│       │   ├── canvas/
│       │   │   ├── CanvasWrapper.tsx                # Container: CSS transform zoom/pan
│       │   │   ├── PDFLayer.tsx                     # PDF.js render background
│       │   │   ├── PolygonLayer.tsx                 # Render zones + marks (Fabric.js)
│       │   │   ├── PolygonDrawLayer.tsx             # Draw tools (Editor only)
│       │   │   ├── MarkDrawLayer.tsx                # Mark tools (Progress only)
│       │   │   ├── CanvasToolbar.tsx                # Mode buttons, draw tools
│       │   │   ├── StatusPopup.tsx                  # Quick status + % (Progress)
│       │   │   └── ZoomControls.tsx
│       │   ├── zones/
│       │   │   ├── ZoneList.tsx
│       │   │   ├── ZoneDetailPanel.tsx
│       │   │   ├── ZoneStatusBadge.tsx
│       │   │   └── ZoneHistoryTab.tsx               # Activity log timeline
│       │   ├── dashboard/
│       │   │   ├── StatsBar.tsx                     # Status chips + progress bar
│       │   │   └── FilterChips.tsx
│       │   ├── comments/
│       │   │   ├── CommentThread.tsx
│       │   │   └── CommentForm.tsx
│       │   ├── project/
│       │   │   ├── MasterLayerList.tsx
│       │   │   ├── LayerTabs.tsx
│       │   │   └── MemberManager.tsx
│       │   └── ui/                                  # shadcn/ui components
│       │       └── (button, dialog, dropdown, input, toast, tabs, badge...)
│       └── lib/
│           ├── geometry.ts                          # toPercent/fromPercent conversion
│           ├── constants.ts                         # Status colors, labels
│           └── utils.ts
│
└── deploy.sh
```

### 18.2 Architecture Rules

```
Controller → validate input (FormRequest) → authorize (Policy) → call Service → return Resource

Service → business logic + call Repository → log ActivityLog → return data

Repository → Eloquent queries only → return Model/Collection

Model → relationships + casts + scopes only → NO business logic
```

**Anti-patterns — AI agent PHẢI TRÁNH:**
- KHÔNG query DB từ Controller — luôn qua Repository
- KHÔNG business logic trong Controller — luôn qua Service
- KHÔNG business logic trong Model — Model chỉ relationships/casts
- KHÔNG return Eloquent Model từ API — luôn qua Resource
- KHÔNG hardcode file path — dùng `Storage::disk('local')`
- KHÔNG gọi Python script từ Controller — luôn qua Queue Job
- KHÔNG validate geometry chỉ ở frontend — backend PHẢI validate

### 18.3 Service Layer Signatures

```php
// AuthService.php
class AuthService {
    public function login(string $email, string $password): array;
        // Returns: ['token' => string, 'user' => User]
        // Throws: AuthenticationException

    public function logout(User $user): void;
        // Revoke current token
}

// UserService.php
class UserService {
    public function create(array $data): User;
        // $data: name, email, password
        // Returns: User with hashed password

    public function update(User $user, array $data): User;
        // $data: name?, email?, is_active?

    public function createInProject(array $data, Project $project, string $role, User $creator): User;
        // Create user + assign to project in one call
        // $data: name, email (password auto-generated)
        // Returns: User (password available via $user->temp_password — not persisted)
}

// ProjectService.php
class ProjectService {
    public function create(array $data, User $creator): Project;
        // $data: name, code, description?, address?
        // Auto-creates ProjectMember(creator, project_manager)

    public function update(Project $project, array $data): Project;
    public function delete(Project $project): void;
    public function getForUser(User $user): Collection;
        // Admin: all projects. Others: only assigned projects
}

// MasterLayerService.php
class MasterLayerService {
    public function create(Project $project, array $data): MasterLayer;
        // $data: name, code, sort_order?

    public function update(MasterLayer $ml, array $data): MasterLayer;
    public function delete(MasterLayer $ml): void;  // cascade layers/zones/marks
}

// LayerService.php
class LayerService {
    public function upload(MasterLayer $ml, UploadedFile $file,
        string $name, string $code, string $type, User $uploader): Layer;
        // Validate PDF → store file → create Layer(status=processing) → dispatch ProcessPdfJob
        // Returns: Layer with status='processing'

    public function retryProcessing(Layer $layer): Layer;
        // Guard: retry_count < 3, status = 'failed'
        // Dispatch ProcessPdfJob again

    public function delete(Layer $layer): void;
        // Cascade delete zones/marks + delete files from disk

    public function getSyncData(Layer $layer, string $since): array;
        // Returns: ['zones' => [...], 'marks' => [...], 'server_time' => string]
}

// ZoneService.php — CRITICAL SERVICE
class ZoneService {
    public function create(Layer $layer, array $data, User $creator): Zone;
        // $data: name, name_full?, geometry_pct, assignee?, assigned_user_id?,
        //        deadline?, tasks?, notes?
        // Auto-generate zone_code
        // Validate geometry
        // Compute area_px
        // Log activity (action=created)

    public function update(Zone $zone, array $data, User $editor): Zone;
        // Log activity (action=updated, snapshot_before=full zone, changes=diff)

    public function transitionStatus(Zone $zone, string $newStatus, User $user, ?string $note): Zone;
        // Validate state machine (see Section 7.1)
        // Throws: InvalidStateTransitionException
        // Log activity (action=status_changed, snapshot_before, changes)

    public function delete(Zone $zone, User $deleter): void;
        // Log activity (action=deleted, snapshot_before=zone + all marks)
        // Cascade delete marks, comments

    public function generateZoneCode(Layer $layer): string;
        // Format: {project.code}_{master_layer.code}_{layer.code}_{seq:03d}
        // Sequence: MAX(seq for this layer) + 1

    public function validateGeometry(array $geometry): bool;
        // Validate type, points count, coordinate ranges [0.0-1.0]
        // Throws: GeometryInvalidException
}

// MarkService.php
class MarkService {
    public function create(Zone $zone, array $data, User $painter): Mark;
        // $data: geometry_pct, status, note?
        // Validate geometry
        // Log activity (action=created)

    public function updateStatus(Mark $mark, string $status, User $user): Mark;
        // Log activity (action=status_changed, snapshot_before)

    public function delete(Mark $mark, User $deleter): void;
        // Log activity (action=deleted, snapshot_before)
}

// CommentService.php
class CommentService {
    public function create(Zone $zone, User $user, string $content, array $images = []): ZoneComment;
        // Store images to disk → save paths in images JSONB
        // Max 5 images, max 10MB each

    public function delete(ZoneComment $comment, User $deleter): void;
        // Delete images from disk
        // Check: owner or PM/admin

    public function getByZone(Zone $zone): Collection;
        // Sorted by created_at DESC
}

// ActivityLogService.php
class ActivityLogService {
    public function log(string $targetType, int $targetId, string $action,
        ?array $snapshotBefore, ?array $changes, User $user): ActivityLog;

    public function getHistory(string $targetType, int $targetId): Collection;
        // Includes related marks history for zones

    public function rollback(ActivityLog $log, User $user): void;
        // Validate: has snapshot_before, not already rolled back
        // Restore entity from snapshot
        // Create new log (action=restored, restored_from_log_id)
        // Throws: InvalidRollbackException
}

// NotificationService.php
class NotificationService {
    public function checkDeadlines(): void;
        // Called by scheduled command daily 06:00
        // Find zones: deadline within 3 days AND status != completed
        // Create notification for PM + zone creator

    public function getForUser(User $user): LengthAwarePaginator;
    public function getUnreadCount(User $user): int;
    public function markRead(Notification $notif): void;
    public function markAllRead(User $user): void;
}

// ExportService.php
class ExportService {
    public function exportLayerExcel(Layer $layer): string;
        // Returns: file path to .xlsx
        // Columns: zone_code, name, status (VN label), completion_pct,
        //          assignee, deadline, tasks, notes

    public function exportProjectExcel(Project $project): string;
        // All layers, one sheet per layer
}

// PdfProcessingService.php
class PdfProcessingService {
    public function processToTiles(Layer $layer): void;
        // Called by ProcessPdfJob
        // Run Python script → parse output → update layer
        // See Section 18.5 for Python interface
}
```

### 18.4 Key API Request/Response Examples

**POST /api/v1/layers/{layerId}/zones — Create zone**
```
Request:
{
  "name": "Sảnh chính",
  "name_full": "SẢNH CHÍNH / Main Lobby",
  "geometry_pct": {
    "type": "polygon",
    "points": [
      {"x": 0.15, "y": 0.20},
      {"x": 0.55, "y": 0.20},
      {"x": 0.55, "y": 0.60},
      {"x": 0.15, "y": 0.60}
    ]
  },
  "assignee": "Đội kiến trúc A",
  "assigned_user_id": 5,
  "deadline": "2026-04-15",
  "tasks": "Thi công sàn đá\nLắp vách kính",
  "notes": "Ưu tiên cao"
}

Response 201:
{
  "success": true,
  "data": {
    "id": 1,
    "zone_code": "TCB_T1_KT_001",
    "name": "Sảnh chính",
    "name_full": "SẢNH CHÍNH / Main Lobby",
    "geometry_pct": { ... },
    "status": "not_started",
    "completion_pct": 0,
    "assignee": "Đội kiến trúc A",
    "assigned_user_id": 5,
    "deadline": "2026-04-15",
    "tasks": "Thi công sàn đá\nLắp vách kính",
    "notes": "Ưu tiên cao",
    "area_px": 160000.0,
    "auto_detected": false,
    "marks_count": 0,
    "created_by": 3,
    "created_at": "2026-03-18T10:00:00+07:00",
    "updated_at": "2026-03-18T10:00:00+07:00"
  }
}
```

**PATCH /api/v1/zones/{id}/status — Change status**
```
Request:
{
  "status": "in_progress",
  "note": "Bắt đầu thi công khu vực sảnh"
}

Response 200:
{
  "success": true,
  "data": {
    "id": 1,
    "zone_code": "TCB_T1_KT_001",
    "status": "in_progress",
    "completion_pct": 0,
    ... (full zone object)
  }
}

Error 422 (invalid transition):
{
  "success": false,
  "error": {
    "code": "INVALID_STATE_TRANSITION",
    "message": "Không thể chuyển từ 'not_started' sang 'completed'",
    "details": {
      "current_status": "not_started",
      "requested_status": "completed",
      "allowed_transitions": ["in_progress", "delayed"]
    }
  }
}
```

**POST /api/v1/zones/{zoneId}/marks — Create mark**
```
Request:
{
  "geometry_pct": {
    "type": "polygon",
    "points": [
      {"x": 0.20, "y": 0.25},
      {"x": 0.35, "y": 0.25},
      {"x": 0.35, "y": 0.40},
      {"x": 0.20, "y": 0.40}
    ]
  },
  "status": "in_progress",
  "note": "Đoạn ống gió A1-A3"
}

Response 201:
{
  "success": true,
  "data": {
    "id": 1,
    "zone_id": 1,
    "geometry_pct": { ... },
    "status": "in_progress",
    "note": "Đoạn ống gió A1-A3",
    "painted_by": 5,
    "painted_by_name": "Nguyễn Văn A",
    "created_at": "2026-03-18T14:30:00+07:00",
    "updated_at": "2026-03-18T14:30:00+07:00"
  }
}
```

**GET /api/v1/layers/{id}/sync?since=2026-03-18T09:00:00+07:00 — Sync**
```
Response 200:
{
  "success": true,
  "data": {
    "zones": [
      {
        "id": 1,
        "zone_code": "TCB_T1_KT_001",
        "status": "in_progress",
        "completion_pct": 45,
        ... (full zone, only those updated since timestamp)
      }
    ],
    "marks": [
      {
        "id": 1,
        "zone_id": 1,
        "status": "in_progress",
        ... (full mark, only those updated since timestamp)
      }
    ],
    "deleted_zone_ids": [5],
    "deleted_mark_ids": [12, 13],
    "server_time": "2026-03-18T14:35:00+07:00"
  }
}
```

**GET /api/v1/zones/{id}/history — Activity log**
```
Response 200:
{
  "success": true,
  "data": [
    {
      "id": 45,
      "target_type": "zone",
      "target_id": 1,
      "action": "status_changed",
      "snapshot_before": {
        "id": 1, "zone_code": "TCB_T1_KT_001", "name": "Sảnh chính",
        "status": "not_started", "completion_pct": 0,
        "geometry_pct": { ... }, "assignee": "Đội A", ...
      },
      "changes": {
        "status": {"from": "not_started", "to": "in_progress"}
      },
      "restored_from_log_id": null,
      "user_id": 3,
      "user_name": "Nguyễn Văn A",
      "created_at": "2026-03-18T14:30:00+07:00",
      "can_rollback": true
    },
    {
      "id": 44,
      "target_type": "mark",
      "target_id": 1,
      "action": "created",
      "snapshot_before": null,
      "changes": null,
      "user_name": "Nguyễn Văn A",
      "created_at": "2026-03-18T14:28:00+07:00",
      "can_rollback": true
    }
  ]
}
```

**Pagination convention (all list endpoints):**
```
Request: GET /api/v1/projects?page=1&per_page=20
Response:
{
  "success": true,
  "data": [...],
  "meta": {
    "current_page": 1,
    "per_page": 20,
    "total": 45,
    "last_page": 3
  }
}

Defaults: page=1, per_page=20, max per_page=100
```

### 18.5 Python PDF Processor — CLI Interface

```bash
# Script: scripts/pdf_processor.py
# Called from Laravel ProcessPdfJob via Process::run()

# Usage:
python3 scripts/pdf_processor.py \
  --input /path/to/original.pdf \
  --output-dir /path/to/tiles/ \
  --tile-size 1024 \
  --dpi 150

# Success output (stdout, JSON):
{
  "success": true,
  "width_px": 4096,
  "height_px": 2048,
  "tiles_generated": 12,
  "tile_path": "/path/to/tiles/"
}

# Failure output (stdout JSON, exit code 1):
{
  "success": false,
  "error": "Poppler not installed"
}
# Possible errors: "Poppler not installed", "Invalid PDF", "Memory exceeded",
#                  "File not found", "Permission denied"

# Dependencies: pdf2image (Python), poppler-utils (system)
# pip install pdf2image Pillow

# Tile naming: {z}_{x}_{y}.jpg
# MVP: z=0 only (single zoom level), tiles 1024x1024
# Example output for 4096x2048 image:
#   0_0_0.jpg  0_1_0.jpg  0_2_0.jpg  0_3_0.jpg
#   0_0_1.jpg  0_1_1.jpg  0_2_1.jpg  0_3_1.jpg

# Process: PDF page 1 → full PNG at DPI 150 → slice into 1024x1024 tiles → save as JPEG quality 85
```

### 18.6 ProcessPdfJob Specification

```php
// app/Jobs/ProcessPdfJob.php

class ProcessPdfJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $layerId;

    // Queue config
    public string $queue = 'pdf-processing';
    public int $timeout = 120;       // seconds
    public int $tries = 3;
    public array $backoff = [30, 60, 120];  // seconds between retries

    public function handle(PdfProcessingService $service): void
    {
        $layer = Layer::findOrFail($this->layerId);

        try {
            $service->processToTiles($layer);
            // On success: layer.status = 'ready', width/height/tile_path updated
        } catch (\Exception $e) {
            $layer->increment('retry_count');
            $layer->update(['error_message' => $e->getMessage()]);

            if ($layer->retry_count >= 3) {
                $layer->update(['status' => 'failed']);
                // Don't rethrow — job complete (permanently failed)
            } else {
                throw $e;  // Rethrow → Laravel retries with backoff
            }
        }
    }
}

// PdfProcessingService::processToTiles()
public function processToTiles(Layer $layer): void
{
    $inputPath = Storage::disk('local')->path("layers/{$layer->id}/original.pdf");
    $outputDir = Storage::disk('local')->path("layers/{$layer->id}/tiles");

    // Ensure output directory exists
    if (!is_dir($outputDir)) mkdir($outputDir, 0755, true);

    // Run Python script
    $result = Process::run([
        'python3', base_path('scripts/pdf_processor.py'),
        '--input', $inputPath,
        '--output-dir', $outputDir,
        '--tile-size', '1024',
        '--dpi', '150'
    ]);

    if (!$result->successful()) {
        throw new \RuntimeException("PDF processing failed: " . $result->errorOutput());
    }

    $output = json_decode($result->output(), true);
    if (!$output || !$output['success']) {
        throw new \RuntimeException("PDF processing error: " . ($output['error'] ?? 'Unknown'));
    }

    // Update layer
    $layer->update([
        'status' => 'ready',
        'width_px' => $output['width_px'],
        'height_px' => $output['height_px'],
        'tile_path' => "layers/{$layer->id}/tiles",
        'processed_at' => now(),
    ]);
}
```

### 18.7 File Storage Paths

```
storage/app/
├── layers/
│   └── {layer_id}/
│       ├── original.pdf                  # Uploaded PDF (kept for re-processing)
│       └── tiles/
│           ├── 0_0_0.jpg                 # z=0, x=0, y=0
│           ├── 0_1_0.jpg                 # z=0, x=1, y=0
│           └── ...
│
└── comments/
    └── {comment_id}/
        ├── {uuid1}.jpg                   # UUID filenames to prevent collision
        ├── {uuid2}.png
        └── ...
```

**Serving tiles:** `GET /api/v1/layers/{id}/tiles/{z}/{x}/{y}.jpg`
- Controller reads from `storage/app/layers/{layer_id}/tiles/{z}_{x}_{y}.jpg`
- Returns image/jpeg with cache headers (Cache-Control: max-age=86400)
- Auth required (check project access)

**Serving comment images:** `GET /api/v1/comments/{id}/images/{filename}`
- Controller reads from `storage/app/comments/{comment_id}/{filename}`
- Returns image with proper MIME type
- Auth required (check project access)

**MVP: local disk only.** No S3/CDN. Files live on VPS.

### 18.8 Environment Configuration

```env
# .env.example

APP_NAME=TienDo
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost:8000
APP_TIMEZONE=Asia/Ho_Chi_Minh

# Database
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=tiendo
DB_USERNAME=tiendo
DB_PASSWORD=secret

# Sanctum
SANCTUM_TOKEN_EXPIRATION=10080    # 7 days in minutes

# Queue
QUEUE_CONNECTION=database

# File limits
UPLOAD_MAX_PDF_SIZE=52428800      # 50MB in bytes
UPLOAD_MAX_IMAGE_SIZE=10485760    # 10MB in bytes
UPLOAD_MAX_IMAGES_PER_COMMENT=5

# Python
PYTHON_BIN=/usr/bin/python3
PDF_TILE_SIZE=1024
PDF_DPI=150

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# Seed admin
ADMIN_EMAIL=admin@tiendo.vn
ADMIN_PASSWORD=changeme123
```

**Laravel config adjustments:**

```php
// config/cors.php
'paths' => ['api/*'],
'allowed_origins' => [env('FRONTEND_URL', 'http://localhost:5173')],
'allowed_methods' => ['*'],
'allowed_headers' => ['*'],
'supports_credentials' => true,

// config/sanctum.php
'expiration' => env('SANCTUM_TOKEN_EXPIRATION', 10080),
'stateful' => [env('FRONTEND_URL', 'http://localhost:5173')],

// app/Console/Kernel.php
$schedule->command('tiendo:check-deadlines')->dailyAt('06:00');
```

### 18.9 React Frontend — Component Tree & Stores

**Zustand Stores:**

```typescript
// stores/authStore.ts
interface AuthStore {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: () => boolean;
  hasProjectRole: (projectId: number, minRole: string) => boolean;
}

// stores/projectStore.ts
interface ProjectStore {
  projects: Project[];
  currentProject: Project | null;
  currentMasterLayer: MasterLayer | null;
  currentLayer: Layer | null;
  members: ProjectMember[];
  fetchProjects: () => Promise<void>;
  setCurrentProject: (id: number) => void;
  setCurrentMasterLayer: (id: number) => void;
  setCurrentLayer: (id: number) => void;
}

// stores/canvasStore.ts — CRITICAL for canvas state
interface CanvasStore {
  // Data
  zones: Zone[];
  marks: Mark[];
  // Selection
  selectedZoneId: number | null;
  selectedMarkId: number | null;
  hoveredZoneId: number | null;
  // Mode
  mode: 'select' | 'draw_zone' | 'draw_mark' | 'edit_zone';
  drawShape: 'polygon' | 'rect' | 'circle';
  markStatus: 'in_progress' | 'completed';
  // Filter
  filterStatus: string | null;
  // Viewport
  zoom: number;
  panX: number;
  panY: number;
  // Actions
  fetchZonesAndMarks: (layerId: number) => Promise<void>;
  selectZone: (id: number | null) => void;
  setMode: (mode: string) => void;
  setFilterStatus: (status: string | null) => void;
  addZone: (zone: Zone) => void;
  updateZone: (zone: Zone) => void;
  removeZone: (id: number) => void;
  addMark: (mark: Mark) => void;
  updateMark: (mark: Mark) => void;
  removeMark: (id: number) => void;
  // Sync
  syncSince: (layerId: number, since: string) => Promise<void>;
}
```

**Canvas Component Hierarchy:**

```
CanvasEditor (page)
├── CanvasWrapper                     # div with CSS transform: scale(zoom) translate(panX, panY)
│   ├── PDFLayer                      # <canvas> rendered by PDF.js (page 1)
│   ├── PolygonLayer (Fabric.js)      # Renders zones + marks
│   │   ├── Zone polygons             # fill 0.15 + stroke 2px per status color
│   │   ├── Mark polygons             # fill 0.50 cam/xanh
│   │   ├── Zone labels               # text overlay
│   │   └── Edit handles              # vertices (red) + midpoints (blue) — editor only
│   └── PolygonDrawLayer              # Active draw state (dashed preview)
├── CanvasToolbar                     # Top-left: mode buttons + draw shape selector
├── ZoomControls                      # Bottom-left: +, −, fit
├── StatsBar                          # Top-right: status chips + progress
├── LegendBar                         # Bottom: color legend
└── Sidebar (320px right)
    ├── ZoneList                      # Scrollable list, click to select
    └── ZoneDetailPanel               # Selected zone info + tabs
        ├── Tab: Thông tin            # Status, %, assignee, deadline, tasks, notes
        ├── Tab: Bình luận            # CommentThread + CommentForm
        └── Tab: Lịch sử             # ZoneHistoryTab — activity timeline + rollback

CanvasProgress (page) — same layout minus:
  - No PolygonDrawLayer (no zone drawing)
  - Add MarkDrawLayer (draw marks within selected zone)
  - Add StatusPopup (click zone → quick status + %)
  - Own-zone highlight: assigned zones opacity 1.0, others opacity 0.08

CanvasView (page) — same layout minus:
  - No draw tools, no status change
  - Click zone → read-only info popup
```

**Fabric.js Event Flow:**

```
// PolygonLayer — zone click
fabricCanvas.on('mouse:down', (e) => {
  if (e.target && e.target.data?.type === 'zone') {
    canvasStore.selectZone(e.target.data.id);
  } else if (e.target && e.target.data?.type === 'mark') {
    canvasStore.selectMark(e.target.data.id);
  }
});

// PolygonDrawLayer — drawing new zone polygon
// mode === 'draw_zone' && drawShape === 'polygon':
fabricCanvas.on('mouse:down', (e) => {
  // Add point to drawPoints[]
  // Render dashed preview
});
fabricCanvas.on('mouse:dblclick', (e) => {
  // Finish polygon → prompt name → POST /zones
});

// CanvasWrapper — zoom/pan (CSS transform, not Fabric.js zoom)
containerRef.on('wheel', (e) => {
  // Adjust canvasStore.zoom
  // Apply CSS transform: scale(zoom) translate(panX, panY)
});
containerRef.on('mousedown' + 'mousemove', (e) => {
  // Pan: update panX, panY
  // Apply CSS transform
});
```

**Polling implementation:**
```typescript
// In canvas pages (Editor/Progress/View)
useEffect(() => {
  const interval = setInterval(() => {
    canvasStore.syncSince(layerId, lastSyncTime);
  }, 30000); // 30 seconds
  return () => clearInterval(interval);
}, [layerId]);
```

### 18.10 Nginx Configuration

```nginx
# /etc/nginx/sites-available/tiendo

server {
    listen 80;
    server_name tiendo.example.com;  # Replace with actual domain

    client_max_body_size 55M;

    # Rate limiting for upload endpoints
    limit_req_zone $binary_remote_addr zone=upload:10m rate=10r/m;

    # React SPA — frontend
    location / {
        root /var/www/tiendo/frontend/dist;
        try_files $uri /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2)$ {
            expires 7d;
            add_header Cache-Control "public, immutable";
        }
    }

    # Laravel API
    location /api/ {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # Rate-limited upload endpoints
    location ~* /api/v1/.*(layers|comments|import) {
        limit_req zone=upload burst=5 nodelay;
        try_files $uri $uri/ /index.php?$query_string;
    }

    # PHP-FPM (8.2 — not 7.4)
    location ~ \.php$ {
        root /var/www/tiendo/backend/public;
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    # Deny dotfiles
    location ~ /\. {
        deny all;
    }
}
```

**Production layout on VPS:**
```
/var/www/tiendo/
├── backend/           # Laravel app (git clone)
│   ├── public/        # Laravel public dir (index.php)
│   ├── storage/       # File storage (writable)
│   └── ...
├── frontend/
│   └── dist/          # Vite build output (static files)
└── scripts/
    └── pdf_processor.py
```

### 18.11 Seed Data

```php
// database/seeders/AdminUserSeeder.php
// Chỉ seed 1 admin user. KHÔNG seed sample project/data.

User::create([
    'name' => 'Admin',
    'email' => env('ADMIN_EMAIL', 'admin@tiendo.vn'),
    'password' => Hash::make(env('ADMIN_PASSWORD', 'changeme123')),
    'role' => 'admin',
    'is_active' => true,
]);
```

### 18.12 Design Tokens (Updated — Ánh Dương brand)

```
-- Brand (UI chrome: header, buttons, nav, links)
Primary:           #FF7F29  (cam Ánh Dương)
Primary hover:     #E5691D
Primary light:     #FFF3E8  (background nhẹ)

-- Neutral
Background:        #FFFFFF
Surface:           #F8FAFC  (slate-50)
Border:            #E2E8F0  (slate-200)
Text primary:      #0F172A  (slate-900)
Text secondary:    #64748B  (slate-500)

-- Zone status (canvas only — KHÔNG dùng cho UI buttons)
not_started:       #9CA3AF  (xám)       fill: none    border: 2px
in_progress:       #F59E0B  (amber)     fill: 0.15    border: 2px
completed:         #10B981  (emerald)   fill: 0.15    border: 2px
delayed:           #EF4444  (red)       fill: 0.15    border: 2px
paused:            #8B5CF6  (violet)    fill: 0.15    border: 2px

-- Mark status (canvas only)
mark in_progress:  #F59E0B  opacity 0.50
mark completed:    #10B981  opacity 0.50

-- Feedback
Success:           #10B981
Danger:            #EF4444
Warning:           #F59E0B
Info:              #3B82F6

-- Typography
Font:              Inter (-apple-system, BlinkMacSystemFont, sans-serif fallback)
Base size:         14px
Heading weight:    600

-- Logo
File:              /public/logo.svg (Ánh Dương logo, cam #FF7F29)
Header:            height 28px, top-left
Login page:        height 48px, centered
Favicon:           extract icon portion, 32x32 .ico
```

### 18.13 Deploy Script

```bash
#!/bin/bash
# deploy.sh — run on VPS
set -e

echo "=== TienDo Deploy ==="

echo "1. Backup DB..."
pg_dump tiendo > ~/backups/tiendo_$(date +%Y%m%d_%H%M%S).sql

echo "2. Pull code..."
cd /var/www/tiendo/backend
git pull origin main

echo "3. Backend dependencies..."
composer install --no-dev --optimize-autoloader

echo "4. Migrations..."
php artisan migrate --force

echo "5. Cache..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

echo "6. Frontend build..."
cd /var/www/tiendo/frontend
npm ci && npm run build

echo "7. Restart workers..."
sudo supervisorctl restart tiendo-worker:*

echo "8. Reload PHP-FPM..."
sudo systemctl reload php8.2-fpm

echo "9. Health check..."
sleep 2
curl -sf http://localhost/api/v1/auth/me > /dev/null && echo "API OK" || echo "API FAILED"

echo "=== Deploy Complete ==="
```

**Rollback:**
```bash
git log --oneline -5              # Find commit to revert to
git revert HEAD                   # Undo last commit
composer install --no-dev --optimize-autoloader
php artisan migrate --force
sudo systemctl reload php8.2-fpm

# If migration corrupted data:
psql tiendo < ~/backups/tiendo_[timestamp].sql
sudo systemctl reload php8.2-fpm
```

**Supervisor config for queue worker:**
```ini
# /etc/supervisor/conf.d/tiendo-worker.conf
[program:tiendo-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/tiendo/backend/artisan queue:work database --queue=pdf-processing --sleep=3 --tries=3 --timeout=120
autostart=true
autorestart=true
user=www-data
numprocs=1
redirect_stderr=true
stdout_logfile=/var/log/tiendo-worker.log
```

**Cron:**
```bash
# /etc/crontab — add:
* * * * * www-data cd /var/www/tiendo/backend && php artisan schedule:run >> /dev/null 2>&1
```

---

## 19. Errata & Overrides (v1.2)

**Mục này override các section trước nếu có xung đột. AI agent đọc mục này CUỐI CÙNG và ưu tiên nội dung ở đây.**

---

### PATCH-01: Render Architecture — TILES ONLY, không dùng PDF.js

**Override:** Section 4 WF-2, Section 9 Canvas, Section 18.1 file structure, Section 18.9 components

**Quyết định:** MVP dùng **tiles-only pipeline**. KHÔNG dùng PDF.js. Lý do: đơn giản hơn, 1 pipeline duy nhất, không sync 2 render engines.

**Pipeline chính thức:**
```
Upload PDF → ProcessPdfJob → Python pdf2image:
  1. Render PDF page 1 → full PNG (DPI 150)
  2. Slice full PNG → tiles 1024x1024 JPEG (quality 85)
  3. Lưu: storage/app/layers/{id}/tiles/0_{x}_{y}.jpg
  4. Lưu: storage/app/layers/{id}/full.png (cho tính area reference)
  5. Update layer: status=ready, width_px, height_px, tile_path

Frontend render:
  1. Fetch layer info (width_px, height_px, tile_path)
  2. Render tiles as <img> elements in grid inside CanvasWrapper
  3. Fabric.js canvas overlay on top (same dimensions)
  4. Zoom/pan via CSS transform on CanvasWrapper container
```

**Xóa khỏi dependencies:** PDF.js. Không cài, không import, không dùng.

**Xóa khỏi file structure:**
- ~~PDFLayer.tsx~~ → thay bằng `TileLayer.tsx`
- ~~PdfRenderer.js~~ → không cần

**Component thay thế:**
```typescript
// TileLayer.tsx — render background tiles
interface TileLayerProps {
  layerId: number;
  widthPx: number;
  heightPx: number;
  tileSize: number; // 1024
}
// Render grid of <img> tags: src="/api/v1/layers/{id}/tiles/0_{x}_{y}.jpg"
// Position absolute, no gap, inside CanvasWrapper
```

---

### PATCH-02: Permissions Matrix v2 — Field_team Rules Chốt Cứng

**Override:** Section 5 ma trận phân quyền + ghi chú

**Rule cứng cho field_team:**

```
field_team CAN:
  1. Cập nhật status + completion_pct trên zone có assigned_user_id = current_user.id
  2. Tạo/xóa mark trên zone có assigned_user_id = current_user.id
  3. Đổi mark status/note trên mark mình tạo (painted_by = current_user.id)
  4. Tạo comment + ảnh trên zone có assigned_user_id = current_user.id
  5. Xóa comment mình tạo
  6. Xem TẤT CẢ zones/marks/comments trong project (read-only)
  7. Export Excel

field_team CANNOT:
  1. Thao tác write trên zone KHÔNG assigned cho mình
  2. Tạo/sửa/xóa zone
  3. Tạo/xóa share link
  4. Quản lý user/members
  5. Rollback
  6. Mở lại zone completed
```

**Zone status transitions cho field_team (CHỈ trên zone assigned cho mình):**

| From | Allowed To | Không được |
|---|---|---|
| not_started | in_progress | completed, delayed, paused |
| in_progress | paused | completed, delayed (chỉ PM/admin) |
| paused | in_progress (resume) | mọi thứ khác |
| delayed | in_progress (resume) | mọi thứ khác |
| completed | — (field_team KHÔNG reopen) | — |

**PM/admin được tất cả transitions** trong Section 7.1 transition matrix, trên MỌI zone.

**Backend enforcement:**
```php
// ZonePolicy.php
public function updateStatus(User $user, Zone $zone): bool
{
    if ($user->role === 'admin') return true;
    $membership = $zone->layer->masterLayer->project->members()
        ->where('user_id', $user->id)->first();
    if (!$membership) return false;
    if ($membership->role === 'project_manager') return true;
    if ($membership->role === 'field_team') {
        return $zone->assigned_user_id === $user->id;
    }
    return false;
}
```

---

### PATCH-03: Status ↔ Completion_pct Invariants

**Override:** Section 7.1, Section 10 validation

**Rules cứng (backend enforced):**

| Status | completion_pct rule |
|---|---|
| not_started | Auto-set = 0. API ignore nếu client gửi giá trị khác |
| in_progress | 1–99. Nếu client gửi 0 → reject. Nếu gửi 100 → reject (phải chuyển completed) |
| completed | Auto-set = 100. API ignore nếu client gửi giá trị khác |
| delayed | 0–99. Giữ nguyên giá trị trước khi delayed |
| paused | 0–99. Giữ nguyên giá trị trước khi paused |

**Side effects khi chuyển status:**
- Bất kỳ → `not_started`: completion_pct = 0
- Bất kỳ → `completed`: completion_pct = 100
- Bất kỳ → `in_progress`: giữ nguyên pct hiện tại (nếu đang 0, vẫn cho — chưa cập nhật %)
- `in_progress` + client gửi `completion_pct` cùng lúc `status`: apply status trước, pct sau

**Reject cases:**
- `PUT /zones/{id} {completion_pct: 100}` khi status = in_progress → reject 422: "Để đặt 100%, chuyển trạng thái sang Hoàn thành"
- `PATCH /zones/{id}/status {status: in_progress}` khi đang completed + pct đang 100 → cho phép (reopen), pct giữ 100 → PM phải tự sửa pct sau

---

### PATCH-04: Share Link — Viewer Only (MVP)

**Override:** Section 4 WF-9, Section 8 Share Links API, Section 6 share_links table

**Quyết định:** MVP share link = **viewer-only**. Không có editor share. Lý do: anonymous editor cần auth scheme riêng, thay đổi schema comment, phức tạp hóa asset serving — không đáng cho MVP.

**Thay đổi:**
- Bỏ `role` column khỏi share_links (hoặc hard-code = 'viewer')
- `GET /share/{token}` → trả data read-only, không có write endpoints
- Không có prompt nhập tên
- Không có comment từ share link
- Share link user thấy: bản vẽ + zones + marks + comments (đọc) + stats
- Share link user KHÔNG thấy: members, settings, export

**API share simplified:**
```
POST   /projects/{id}/share-links       {expires_hours}  — PM/admin
GET    /projects/{id}/share-links       — list active links
DELETE /share-links/{id}                — revoke
GET    /share/{token}                   — public, no auth, read-only data
```

**Nếu V2 cần editor share:** Thiết kế guest user model + share-token auth middleware. Không build bây giờ.

---

### PATCH-05: Activity Logs + Rollback + Delete Model

**Override:** Section 4 WF-10, Section 6 activity_logs, Section 8 Activity Logs API, Section 11 edge cases

**Rules cứng:**

**1. activity_logs KHÔNG BAO GIỜ bị cascade delete.**

```sql
-- Override: zones table FK
-- activity_logs.target_id KHÔNG CÓ FK constraint tới zones/marks
-- Lý do: khi zone bị xóa, logs phải TỒN TẠI để rollback
-- Query logs by target_type + target_id, không dùng FK

CREATE TABLE activity_logs (
    ...
    target_type     VARCHAR(50) NOT NULL,
    target_id       BIGINT NOT NULL,       -- KHÔNG CÓ REFERENCES, KHÔNG CASCADE
    ...
);
```

**2. Zone delete ghi snapshot bao gồm zone + tất cả marks:**
```json
// snapshot_before khi action='deleted' cho zone:
{
  "zone": { "id":1, "zone_code":"TCB_T1_KT_001", "name":"Sảnh", "status":"in_progress",
            "geometry_pct":{...}, "completion_pct":45, ... },
  "marks": [
    { "id":1, "geometry_pct":{...}, "status":"completed", "painted_by":5, ... },
    { "id":2, "geometry_pct":{...}, "status":"in_progress", "painted_by":5, ... }
  ]
}
// Comments KHÔNG lưu trong snapshot — rollback không restore comments
```

**3. Rollback deleted-zone truy cập từ đâu:**
- **Layer history page**: thêm endpoint `GET /layers/{id}/history` → trả activity_logs cho layer + tất cả zones/marks (kể cả deleted)
- UI: Layer detail → tab "Lịch sử" → thấy "Zone TCB_T1_KT_001 đã bị xóa bởi X" → nút "Hoàn tác"
- Rollback delete-zone → re-create zone + marks từ snapshot. Comments KHÔNG restore.

**4. Rollback rules:**
| Action gốc | Rollback behavior |
|---|---|
| created | Xóa entity (soft: ghi activity_log action=restored, xóa record) |
| updated | Restore entity từ snapshot_before |
| status_changed | Restore status + completion_pct từ snapshot_before |
| deleted | Re-create entity từ snapshot_before (zone + marks) |
| restored | KHÔNG cho rollback — tránh infinite loop |

**5. API bổ sung:**
```
GET /layers/{id}/history              → activity_logs cho layer scope (zones + marks, kể cả deleted)
GET /zones/{id}/history               → activity_logs cho zone + marks (existing zone only)
POST /activity-logs/{id}/rollback     → PM/admin only
```

---

### PATCH-06: User Onboarding / Member API

**Override:** Section 4 WF-1, Section 8 Users API + Project Members API

**Xóa API cũ:**
- ~~POST /users {name, email, password}~~ — quá generic, gây nhầm

**API mới cho member onboarding:**
```
POST /projects/{id}/members/invite
Request:
{
  "email": "nguyenvana@gmail.com",
  "name": "Nguyễn Văn A",          // bắt buộc nếu user chưa tồn tại
  "role": "field_team"              // field_team | viewer
}

Response 201 (new user created):
{
  "success": true,
  "data": {
    "user": { "id": 5, "name": "Nguyễn Văn A", "email": "nguyenvana@gmail.com" },
    "membership": { "project_id": 1, "role": "field_team" },
    "is_new_user": true,
    "temporary_password": "Xk9$mP2v"   // Hiện 1 LẦN DUY NHẤT trên response
  }
}

Response 200 (existing user assigned):
{
  "success": true,
  "data": {
    "user": { "id": 5, "name": "Nguyễn Văn A", "email": "nguyenvana@gmail.com" },
    "membership": { "project_id": 1, "role": "field_team" },
    "is_new_user": false
    // KHÔNG có temporary_password — user đã có account
  }
}

Error 409 (already member):
{
  "success": false,
  "error": { "code": "USER_ALREADY_MEMBER", "message": "User đã trong project" }
}
```

**Backend logic:**
```
1. Find user by email
2. If not found:
   a. name required → validate
   b. Generate random password (8 chars, mixed case + digits + special)
   c. Create user (global role = 'viewer', is_active = true)
   d. Return with temporary_password
3. If found:
   a. Check not already in project → 409 if exists
   b. Create project_member record
   c. Return without password
```

**PM chỉ tạo được role:** field_team, viewer. KHÔNG tạo project_manager (admin only).

**Admin user management (giữ nguyên):**
```
GET /users                    — admin only, list all users
PUT /users/{id}               — admin only: {name, email, is_active}
```

**PM "deactivate" user:**
```
DELETE /projects/{id}/members/{userId}   — remove from project (keep user globally)
```
PM KHÔNG có quyền sửa `users.is_active`. Chỉ admin sửa được.

---

### PATCH-07: Assignee Model — Source of Truth

**Override:** Section 6 zones table

**Rules cứng:**

- `assigned_user_id` (FK → users) = **source of truth cho permissions, filter, highlight**
- `assignee` (VARCHAR) = **display label, auto-derived nhưng có thể override**

**Behavior:**
```
Khi set assigned_user_id:
  → assignee auto-populate = user.name (nếu assignee đang trống hoặc = tên user cũ)
  → PM có thể override assignee text thủ công sau đó (VD: "Đội A - Nguyễn Văn A")

Khi clear assigned_user_id (set null):
  → assignee KHÔNG auto-clear (giữ text cũ, PM tự sửa nếu muốn)

Khi check permission (field_team):
  → CHỈ dùng assigned_user_id, KHÔNG dùng assignee text

Khi hiển thị trên UI:
  → Dùng assignee text (đẹp hơn, có thể customized)
  → Nếu assignee trống nhưng assigned_user_id có → hiện user.name
```

**Validation:**
- `assigned_user_id` phải là member của project (hoặc null)
- `assignee` max 255 chars, optional

---

### PATCH-08: CRUD Immutability + Layer Update

**Override:** Section 8 API endpoints

**Immutable fields (KHÔNG sửa sau create):**
- `project.code`
- `master_layer.code`
- `layer.code`
- `zone.zone_code`

Backend: nếu client gửi `code` trong PUT request → **silently ignore**, không reject.

**Layer KHÔNG CÓ PUT endpoint.** Lý do: layer = PDF file, thay đổi file = xóa tạo lại. Metadata (name, type) ít khi cần sửa, nếu sai → xóa tạo mới.

**Project/MasterLayer PUT chỉ cho sửa:**
```
PUT /projects/{id}           {name, description, address}     — KHÔNG có code
PUT /master-layers/{id}      {name, sort_order}               — KHÔNG có code
```

**Delete permissions chốt:**
- Delete project: admin only
- Delete MasterLayer: PM (owner project) + admin
- Delete Layer: PM + admin
- Delete Zone: PM + admin

---

### PATCH-09: Sync Response Contract

**Override:** Section 8 Sync API, Section 18.4 sync example

**Contract chính thức:**
```
GET /layers/{id}/sync?since={ISO8601}

Query: WHERE updated_at > since (strict greater than, không bao gồm bằng)

Response 200:
{
  "success": true,
  "data": {
    "zones": [                    // zones có updated_at > since
      { ...full zone object }
    ],
    "marks": [                    // marks có updated_at > since
      { ...full mark object }
    ],
    "deleted_zone_ids": [5, 12],  // zone IDs đã bị xóa since last sync
    "deleted_mark_ids": [3, 7],   // mark IDs đã bị xóa since last sync
    "server_time": "2026-03-18T14:35:00+07:00"
  }
}
```

**Tracking deletes:** Thêm bảng lightweight:
```sql
CREATE TABLE sync_deletions (
    id          BIGSERIAL PRIMARY KEY,
    layer_id    BIGINT NOT NULL REFERENCES layers(id) ON DELETE CASCADE,
    entity_type VARCHAR(20) NOT NULL,   -- 'zone' | 'mark'
    entity_id   BIGINT NOT NULL,
    deleted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sd_layer ON sync_deletions(layer_id, deleted_at);
```

Insert vào `sync_deletions` mỗi khi zone/mark bị xóa. Sync endpoint query `WHERE layer_id = ? AND deleted_at > since`.

Cleanup: cron weekly xóa sync_deletions > 7 ngày (client không sync > 7 ngày → full refresh).

---

### PATCH-10: Export Excel Format

**Override:** Section 15, Section 18.3 ExportService

**Chốt dứt khoát:**

**Per-layer export:** `GET /layers/{id}/export/excel`
- 1 file .xlsx, 1 sheet tên "Zones"
- Columns theo thứ tự cố định:

| Col | Header | Source |
|---|---|---|
| A | Mã khu vực | zone_code |
| B | Tên | name |
| C | Trạng thái | status label VN |
| D | Tiến độ (%) | completion_pct |
| E | Phụ trách | assignee |
| F | Deadline | deadline (YYYY-MM-DD) |
| G | Hạng mục | tasks |
| H | Ghi chú | notes |

- Sort: theo zone_code ASC
- Status labels: Chưa bắt đầu / Đang thi công / Hoàn thành / Chậm tiến độ / Tạm dừng

**Per-project export:** `GET /projects/{id}/export/excel`
- 1 file .xlsx, **1 sheet per layer**
- Sheet name: `{ML.code}_{L.code}` (VD: "T1_KT", "T1_DI") — max 31 chars (Excel limit)
- Columns giống per-layer export
- Sheet order: theo master_layer.sort_order → layer.sort_order

---

### PATCH-11: Notification Recipient + Dedupe

**Override:** Section 13 AC-11, Section 18.3 NotificationService

**Recipients:** Zone deadline trong 3 ngày + status ≠ completed → notify:
1. `assigned_user_id` (nếu có)
2. PM của project (tất cả project_managers trong project_members)

KHÔNG notify: viewer, field_team không assigned, admin (trừ khi admin cũng là PM).

**Dedupe key:** `(user_id, type, zone_id)`

**Rule:** Mỗi user chỉ có TỐI ĐA 1 unread notification per zone per type. Cron chạy hàng ngày:
```
1. Find zones: deadline BETWEEN today AND today+3 days AND status != 'completed'
2. For each zone, for each recipient:
   a. Check: existing notification WHERE user_id=? AND type='deadline_approaching'
      AND data->>'zone_id'=? AND read_at IS NULL
   b. If exists → skip (đã có unread notification)
   c. If not exists → create notification
```

Không bắn lại notification cho zone đã có unread notification. User đọc xong (read_at set) → ngày hôm sau cron tạo cái mới nếu vẫn còn gần deadline.

---

### PATCH-12: Mark Edit Scope

**Override:** Section 5 permissions, Section 8 Marks API

**Chốt:** "Sửa mark" trong MVP = **đổi status + note CHỈ**. KHÔNG hỗ trợ edit geometry mark.

**API chính thức cho mark:**
```
POST   /zones/{zoneId}/marks          {geometry_pct, status, note?}    — tạo mới
PATCH  /marks/{id}/status             {status, note?}                  — đổi status + note
DELETE /marks/{id}                                                      — xóa
```

Không có `PUT /marks/{id}`. Nếu geometry sai → xóa tạo lại.

---

### PATCH-13: Comment Screens

**Override:** Section 9 UI screens

**Comments có trên CẢ 3 canvas pages:**
- **Editor**: tab Bình luận trong ZoneDetailPanel (đọc + viết)
- **Progress**: tab Bình luận trong ZoneDetailPanel (đọc + viết)
- **View**: tab Bình luận trong ZoneDetailPanel (**đọc only**, không có form tạo)

Sidebar layout giống nhau cả 3 pages:
```
ZoneDetailPanel:
  Tab "Thông tin"    — zone metadata (edit trên Editor/Progress, read-only trên View)
  Tab "Bình luận"    — comment thread (write trên Editor/Progress cho PM/field_team, read trên View)
  Tab "Lịch sử"      — activity timeline (read-only cả 3 pages, rollback button chỉ PM/admin)
```

---

### PATCH-14: Analytics Event Ownership

**Override:** Section 18.8 TrackUsage middleware

**Phân chia rõ:**

**Server-side auto (middleware TrackUsage — không cần client gọi):**
```
login              — khi POST /auth/login thành công
api_mutation       — khi bất kỳ POST/PUT/PATCH/DELETE thành công
                     metadata: {endpoint, method, target_type, target_id}
```

**Client-side explicit (frontend gọi POST /analytics/events):**
```
page_view          — khi navigate tới route mới
                     metadata: {page, referrer}
canvas_view        — khi canvas loaded + rendered thành công
                     metadata: {layer_id, zone_count, mark_count}
zone_click         — khi user click zone trên canvas
                     metadata: {zone_id}
share_link_accessed — khi mở /share/{token} thành công
                     metadata: {token_prefix}  // first 8 chars only, privacy
```

**Không log trùng:** middleware log API calls, frontend log UI interactions. Hai set event KHÁC NHAU, không overlap.

---

### PATCH-15: Zone Code Generation — Race-safe

**Override:** Section 18.3 ZoneService::generateZoneCode

**Implementation:**
```php
public function generateZoneCode(Layer $layer): string
{
    // Thêm next_zone_seq vào layers table
    // DB::transaction + row lock tránh race condition

    return DB::transaction(function () use ($layer) {
        // Lock layer row
        $layer = Layer::where('id', $layer->id)->lockForUpdate()->first();

        $seq = ($layer->next_zone_seq ?? 0) + 1;
        $layer->update(['next_zone_seq' => $seq]);

        $ml = $layer->masterLayer;
        $project = $ml->project;

        return sprintf('%s_%s_%s_%03d',
            $project->code, $ml->code, $layer->code, $seq);
    });
}
```

**Schema change:** Thêm cột vào layers table:
```sql
ALTER TABLE layers ADD COLUMN next_zone_seq INTEGER NOT NULL DEFAULT 0;
```

---

### PATCH-16: PDF Processing Interface — Error Contract

**Override:** Section 18.5, Section 18.6

**Contract chốt:**
```
Python script output:
  - LUÔN viết JSON ra stdout (cả success lẫn failure)
  - stderr: chỉ cho unexpected runtime crashes (Python traceback)
  - exit code 0 = success, exit code 1 = handled error (JSON ở stdout)
  - exit code 2+ = unexpected crash (parse stderr)

Laravel ProcessPdfJob:
  1. Run Python script
  2. Parse stdout as JSON TRƯỚC
  3. Nếu stdout JSON valid + success=true → OK
  4. Nếu stdout JSON valid + success=false → dùng error từ JSON
  5. Nếu stdout KHÔNG parse được JSON → dùng stderr + exit code làm error message
```

**Override pseudo-code trong 18.6:**
```php
$result = Process::run([...]);
$output = json_decode($result->output(), true);

if ($output && isset($output['success'])) {
    if ($output['success']) {
        // Happy path — update layer
    } else {
        throw new \RuntimeException("PDF error: " . $output['error']);
    }
} else {
    // Unexpected crash — no valid JSON output
    throw new \RuntimeException("PDF crash: " . $result->errorOutput());
}
```

---

### PATCH-17: Deploy Fixes

**Override:** Section 18.10 Nginx, Section 18.13 Deploy script

**Health check endpoint** (không cần auth):
```php
// routes/api.php — ngoài auth middleware
Route::get('/health', fn() => response()->json(['status' => 'ok', 'time' => now()]));
```

Deploy script health check:
```bash
# Sửa từ /api/v1/auth/me (cần token) sang /api/v1/health (public)
curl -sf http://localhost/api/v1/health > /dev/null && echo "API OK" || echo "API FAILED"
```

**Nginx config fix — limit_req_zone phải ở http context:**
```nginx
# /etc/nginx/nginx.conf (http block, KHÔNG trong server block)
http {
    limit_req_zone $binary_remote_addr zone=upload:10m rate=10r/m;
    ...
}

# /etc/nginx/sites-available/tiendo (server block)
server {
    listen 80;
    server_name tiendo.example.com;
    client_max_body_size 55M;
    root /var/www/tiendo/backend/public;

    # React SPA
    location / {
        root /var/www/tiendo/frontend/dist;
        try_files $uri /index.html;
    }

    # API
    location /api {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # Rate-limited endpoints
    location ~ ^/api/v1/(layers|comments|import|export) {
        limit_req zone=upload burst=5 nodelay;
        try_files $uri $uri/ /index.php?$query_string;
    }

    # PHP-FPM 8.2
    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\. { deny all; }
}
```

---

### PATCH-18: Schema Additions Summary

Tổng hợp thay đổi schema từ các patches:

```sql
-- PATCH-05: activity_logs.target_id KHÔNG CÓ FK (đã nêu ở PATCH-05)
-- Khi tạo migration, KHÔNG thêm REFERENCES cho target_id

-- PATCH-09: sync_deletions table (mới)
CREATE TABLE sync_deletions (
    id          BIGSERIAL PRIMARY KEY,
    layer_id    BIGINT NOT NULL REFERENCES layers(id) ON DELETE CASCADE,
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('zone', 'mark')),
    entity_id   BIGINT NOT NULL,
    deleted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sd_layer ON sync_deletions(layer_id, deleted_at);

-- PATCH-15: next_zone_seq trên layers
ALTER TABLE layers ADD COLUMN next_zone_seq INTEGER NOT NULL DEFAULT 0;

-- PATCH-04: share_links bỏ role column (hoặc hard-code viewer)
-- Sửa table definition:
CREATE TABLE share_links (
    id              BIGSERIAL PRIMARY KEY,
    project_id      BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    token           VARCHAR(64) NOT NULL UNIQUE,
    -- KHÔNG CÓ role column — MVP luôn là viewer
    created_by      BIGINT NOT NULL REFERENCES users(id),
    expires_at      TIMESTAMPTZ NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

*End of spec. Version 1.2 — 2026-03-18. Patches: render architecture, permissions, status invariants, share-link, rollback model, onboarding API, assignee model, CRUD immutability, sync contract, export format, notification dedupe, mark scope, comment screens, analytics, zone code race-safe, PDF interface, deploy fixes.*
