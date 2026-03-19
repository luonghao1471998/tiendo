# SESSION-LOG.md — TienDo

## Current Session
<!-- Ghi trong lúc làm việc. Cleared sau mỗi git commit. -->

---

### Session: Sprint 2 wrap-up + Sprint 3 full

**Tasks hoàn thành (theo thứ tự):**

1. **`GET /layers/{id}/history`** — Layer-scope activity log, bao gồm cả zone/mark đã deleted (đọc `snapshot_before` để tìm lại `layer_id`/`zone_id`). Thêm `listByLayerScope()` vào `ActivityLogRepository`, `getLayerHistory()` vào `ActivityLogService`, action `layerHistory` vào `ActivityLogController`.

2. **`POST /projects/{id}/members/invite`** (PATCH-06) — Member onboarding: email chưa có → tạo user + trả `temporary_password` 1 lần; email đã có → gán vào project. PM chỉ tạo được `field_team`/`viewer`. Tạo: `ProjectMemberRole` enum, `InviteMemberRequest`, `ProjectMemberResource`, `ProjectMemberService`, `ProjectMemberController`. Thêm `invite`/`listMembers`/`removeMember` policy vào `ProjectPolicy`. Endpoint: `GET/POST /projects/{id}/members`, `DELETE /projects/{id}/members/{userId}`.

3. **Sprint 3 — Excel Import**: Upload .xlsx → parse → preview (không ghi zone) → apply (batch update zones found). `ExcelImportService` parse theo template export (col mapping mặc định, có thể override). Dùng `Storage::disk('local')->path()` thay `storage_path('app/')` để tương thích với test. Ghi `activity_logs` khi apply. Endpoint: `POST /layers/{id}/import`, `POST /excel-imports/{id}/apply`.

4. **Sprint 3 — Share Link**: MVP viewer-only (không có role column — PATCH-04). Token random 48 chars, expires 1/7/30 ngày. Public endpoint `GET /share/{token}` trả project + layers + zones + marks không cần auth; 410 nếu hết hạn hoặc revoked. `ShareLinkService`, `ShareLinkController`, `ShareLinkResource`, `CreateShareLinkRequest`. Endpoint: `GET/POST /projects/{id}/share-links`, `DELETE /share-links/{id}`, `GET /share/{token}` (public).

---

**Files changed (session này):**

| File | Thay đổi |
|---|---|
| `app/Repositories/ActivityLogRepository.php` | + `listByLayerScope()` |
| `app/Services/ActivityLogService.php` | + `getLayerOrFail()`, `getLayerHistory()` |
| `app/Http/Controllers/Api/ActivityLogController.php` | + `layerHistory()` |
| `app/Enums/ProjectMemberRole.php` | **new** — enum field_team\|viewer\|project_manager |
| `app/Http/Requests/InviteMemberRequest.php` | **new** |
| `app/Http/Resources/ProjectMemberResource.php` | **new** |
| `app/Policies/ProjectPolicy.php` | + `invite`, `listMembers`, `removeMember`, `createShareLink`, `revokeShareLink` |
| `app/Services/ProjectMemberService.php` | **new** — invite + listMembers + removeMember |
| `app/Http/Controllers/Api/ProjectMemberController.php` | **new** |
| `app/Models/ExcelImport.php` | **new** |
| `app/Http/Requests/ImportExcelRequest.php` | **new** |
| `app/Http/Resources/ExcelImportResource.php` | **new** |
| `app/Policies/LayerPolicy.php` | + `import()` |
| `app/Services/ExcelImportService.php` | **new** — preview + apply |
| `app/Http/Controllers/Api/ExcelImportController.php` | **new** |
| `app/Models/ShareLink.php` | **new** |
| `app/Http/Requests/CreateShareLinkRequest.php` | **new** |
| `app/Http/Resources/ShareLinkResource.php` | **new** |
| `app/Services/ShareLinkService.php` | **new** — create + list + revoke + resolveToken |
| `app/Http/Controllers/Api/ShareLinkController.php` | **new** — index + store + revoke + resolve (public) |
| `routes/api.php` | + 10 routes mới |
| `tests/Feature/LayerHistoryTest.php` | **new** — 4 cases |
| `tests/Feature/ProjectMemberInviteTest.php` | **new** — 9 cases |
| `tests/Feature/ExcelImportTest.php` | **new** — 6 cases |
| `tests/Feature/ShareLinkTest.php` | **new** — 8 cases |

---

**Decisions quan trọng:**

- **`listByLayerScope`**: Không join với zones (đã bị xóa) — scan `activity_logs` bằng `snapshot_before` để tìm zone_id/layer_id của deleted entities. Cách này đảm bảo log tồn tại sau khi entity bị xóa (intentional — PATCH-05).
- **PM không tạo PM**: Enforce trong `ProjectMemberService.invite()` — check `$actor->role !== 'admin' && $role === ProjectMemberRole::ProjectManager` → reject 422.
- **`temporary_password`** chỉ trả trong response khi `$user === null` (tạo mới), không trả khi gán user có sẵn. Field không có trong DB.
- **Excel Import**: Dùng `Storage::disk('local')->path($storedPath)` thay `storage_path('app/')` → tương thích cả khi test dùng Storage::fake(). PhpSpreadsheet 5.x: `getCell([$col, $row])` thay `getCellByColumnAndRow()` (deprecated).
- **activity_logs columns**: `user_id` + `user_name` (không phải `actor_id`) — phát hiện khi test apply fail 500.
- **Share Link public endpoint**: Route `GET /share/{token}` đặt **ngoài** `auth:sanctum` middleware group. Trả 410 bằng `GoneHttpException` → catch trong controller → JSON response chuẩn.
- **Share Link MVP viewer-only**: Không có `role` column trong `share_links` table (PATCH-04) — hardcode `'role' => 'viewer'` trong response.

**Fails đã xử lý:**
- Test `createProjectWithPm()` dùng API POST /projects bị 403 vì `ProjectPolicy::create` chỉ cho admin → sửa thành tạo trực tiếp qua `Project::query()->create()`.
- PhpSpreadsheet 5.5 bỏ `getCellByColumnAndRow()` → chuyển sang `getCell([$col, $row])`.
- Test ExcelImport dùng `Storage::fake('local')` nhưng service đọc `storage_path()` → file không tồn tại → fix dùng `Storage::disk('local')->path()` trong service.

**Tool kia cần biết:**
- Backend API **HOÀN TẤT** tất cả Sprint 1 + 2 + 3. Tổng: **66 tests, 300 assertions** — 100% pass.
- Bước tiếp theo: **Frontend React SPA** (chưa bắt đầu) và **Deploy VPS**.
- Public route `GET /api/v1/share/{token}` không cần auth — cần cấu hình nginx không block nó.
- `temporary_password` trong response invite chỉ xuất hiện khi tạo user mới — frontend cần hiển thị 1 lần và không lưu lại.
- Excel import column mapping mặc định giống template export: col 1=zone_code, 3=status, 4=%, 6=deadline, 8=notes.

---

### Session: Frontend SPA — Sprint 1 deliverable hoàn chỉnh

**Tasks hoàn thành (theo thứ tự):**

1. **Skill templates** — Tạo 5 SKILL.md trong `.cursor/skills/`: `create-endpoint`, `create-migration`, `write-unit-test`, `debug-api-error`, `code-review`. Bám theo stack TienDo (Laravel Controller→FormRequest→Policy→Service→Repository→Resource).

2. **Backend review + bổ sung 3 endpoint còn thiếu:**
   - `GET /health` — public health check (`HealthController`)
   - `GET /users` + `PUT /users/{id}` — admin-only user management (`UserController`, `UserPolicy`, `UserRepository`, `UserService`, `UserResource`, `UpdateUserRequest`)
   - `ProjectPolicy` + `LayerRepository/Service/Controller`: thêm `viewMasterLayers`, `manageMasterLayers`, `GET /master-layers/{id}/layers` trả `zones_count`

3. **Frontend foundation** — Auth (`authStore` + Axios interceptors + localStorage token), routing (`BrowserRouter` + `RequireAuth` + `GuestOnly` + `AppShell`), `Login`, `ProjectList`.

4. **ProjectDetail — tab Mặt bằng (S1-A xây khung)**: MasterLayer dropdown, Layer list với status badge + zones_count, navigation links theo role.

5. **ProjectDetail — tab Thành viên (Step 4)**: Invite form (email, name, role), `temporary_password` one-time banner (đúng business rule), bảng members với "Gỡ khỏi project" (không thể tự xóa mình).

6. **AdminUsers page** — `GET /users` table với inline edit row (name, email, is_active checkbox) → `PUT /users/{id}`. Guard redirect nếu không phải admin.

7. **Canvas foundation**: `canvasStore` nâng lên SPEC contract đầy đủ (zones, marks, selectedZoneId, panX/panY, fetchZonesAndMarks, syncSince...). `CanvasWrapper` CSS transform zoom/pan (wheel + alt+drag). `TileLayer` grid `<img>` tiles. `PolygonLayer` Fabric.js (zone fill 0.15 + stroke, mark fill 0.5, labels, filter). `ZoomControls`.

8. **CanvasEditor page** (khung ban đầu) — layout full + sidebar + ZoneDetailPanel (status/pct/deadline/notes/delete).

9. **CanvasProgress page** — own-zone highlight (opacity 0.08 cho zone khác), `StatusPopup` gọn (status chips theo FIELD_TEAM_TRANSITIONS + % slider), polygon mark draw (click→add point→dbl-click finish), `MarkPopup` toggle status/xóa.

10. **CanvasView page** — read-only, `ZoneInfoPopup`, `StatsBar`, filter chips, **Export Excel** (`GET /layers/{id}/export/excel` blob download).

11. **ShareView page** — public route `/share/:token`, `publicClient` (Axios không có Bearer), `GET /share/{token}` → project + layers, layer selector, canvas read-only từ `GET /share/{token}/layers/{id}/zones`.

12. **S1-A: MasterLayer/Layer management** trong tab Mặt bằng:
    - "Thêm mặt bằng": inline form (tên, mã, thứ tự) → `POST /projects/{id}/master-layers`
    - Xóa MasterLayer → `DELETE /master-layers/{id}` (confirm)
    - "Thêm bản vẽ": inline form với file picker → `POST /master-layers/{id}/layers` multipart
    - Delete layer, retry failed layer
    - **S1-B**: Polling 3 giây (useRef Set tracking) — badge "Đang xử lý" tự cập nhật khi ready/failed

13. **S1-C: Zone draw toolbar** trong CanvasEditor:
    - `CanvasToolbar` component: `↖ Chọn` / `⬡ Đa giác` / `▭ Chữ nhật`
    - `PolygonLayer` tái cấu trúc: tách event handlers ra `useEffect` riêng, prop `drawMode`/`drawShape`/`onDrawComplete`
    - Polygon draw: click points → dbl-click finish (pop extra mousedown point trước khi finish)
    - Rect draw: mousedown → mousemove preview → mouseup complete (skip nếu < 10px)
    - `ZoneCreateModal`: tên (required) + assignee/deadline/tasks/notes → `POST /layers/{id}/zones` → `addZone` vào store

---

**Files changed (session này):**

| File | Thay đổi |
|---|---|
| `frontend/src/stores/authStore.ts` | token từ localStorage, login/logout/initSession, hasProjectRole |
| `frontend/src/api/client.ts` | Axios interceptor Bearer, setAuthToken/getAuthToken |
| `frontend/src/App.tsx` | BrowserRouter, RequireAuth, GuestOnly, AppShell routes |
| `frontend/src/components/layout/AppShell.tsx` | **new** — header, nav, logout |
| `frontend/src/pages/Login.tsx` | Form email/password → authStore.login |
| `frontend/src/pages/ProjectList.tsx` | Cards grid, link to ProjectDetail |
| `frontend/src/pages/ProjectDetail.tsx` | **rewrite** — ML management, layer upload, polling, Members tab, Settings tab |
| `frontend/src/pages/AdminUsers.tsx` | **rewrite** — table + inline edit, GET/PUT /users |
| `frontend/src/pages/CanvasEditor.tsx` | **rewrite** — CanvasToolbar, draw mode, ZoneCreateModal, ZoneDetailPanel |
| `frontend/src/pages/CanvasProgress.tsx` | **new** — own-zone highlight, StatusPopup, mark draw + MarkPopup |
| `frontend/src/pages/CanvasView.tsx` | **new** — read-only, StatsBar, Export Excel |
| `frontend/src/pages/ShareView.tsx` | **new** — public token, publicClient, layer selector, canvas read-only |
| `frontend/src/stores/canvasStore.ts` | **rewrite** — SPEC contract đầy đủ, fetchZonesAndMarks, syncSince, CRUD actions |
| `frontend/src/components/canvas/CanvasWrapper.tsx` | **rewrite** — CSS transform zoom/pan, wheel, alt+drag |
| `frontend/src/components/canvas/TileLayer.tsx` | **rewrite** — grid tiles `0_{x}_{y}.jpg` |
| `frontend/src/components/canvas/PolygonLayer.tsx` | **rewrite** — 4 useEffects (init/render/handlers/cursor), drawMode support |
| `frontend/src/components/canvas/CanvasToolbar.tsx` | **new** — Select/DrawPolygon/DrawRect |
| `frontend/src/components/canvas/ZoomControls.tsx` | **rewrite** — +/–/Fit/% display |
| `frontend/src/lib/constants.ts` | ZONE_STATUS_COLOR, MARK_STATUS_COLOR |
| `backend/app/Http/Controllers/Api/HealthController.php` | **new** — GET /health |
| `backend/app/Http/Controllers/Api/UserController.php` | **new** — index, update |
| `backend/app/Policies/UserPolicy.php` | **new** — admin-only |
| `backend/app/Repositories/UserRepository.php` | **new** |
| `backend/app/Services/UserService.php` | **new** |
| `backend/app/Http/Resources/UserResource.php` | **new** |
| `backend/app/Http/Requests/UpdateUserRequest.php` | **new** |
| `backend/app/Policies/ProjectPolicy.php` | + viewMasterLayers, manageMasterLayers |
| `backend/app/Repositories/LayerRepository.php` | + listForMasterLayer (zones_count) |
| `backend/app/Services/LayerService.php` | + listForMasterLayer |
| `backend/app/Http/Resources/LayerResource.php` | + zones_count |
| `backend/app/Http/Controllers/Api/LayerController.php` | + index |
| `backend/routes/api.php` | + health, users, layers index |
| `frontend/src/index.css` | Xóa @import tw-animate-css / shadcn/tailwind.css (CSS warning fix) |
| `frontend/src/components/canvas/CanvasProgress.tsx` → `pages/` | moved + full impl |

---

**Decisions quan trọng:**

- **PolygonLayer 4 useEffects**: Tách init / render / event-handlers / cursor để event handlers có thể re-run khi `drawMode` thay đổi mà không dispose canvas. Nếu gộp vào init effect, handlers sẽ là stale closure.
- **Polygon dblclick: pop last point**: Fabric dblclick fires AFTER second `mouse:down` (which adds an unwanted point). Solution: `drawPts.pop()` trong `mouse:dblclick` handler trước khi finish.
- **Polling với useRef**: Dùng `processingLayerIdsRef` (Set) để polling interval không cần `layers` trong dependency array → tránh infinite re-render loop.
- **CanvasWrapper CSS transform vs Fabric zoom**: Zoom/pan qua CSS transform trên container. `fabric.Canvas.getPointer()` tự tính `cssScale = canvas.width / getBoundingClientRect().width` nên pointer coordinates vẫn đúng dù CSS scale thay đổi.
- **publicClient** cho ShareView: Tạo Axios instance mới KHÔNG có auth interceptor, tránh gửi Bearer token trên public endpoint.
- **Module-level helpers trong CanvasProgress**: `clearPreview()` / `renderPreview()` được move ra module level nhận refs làm parameter để tránh ESLint `react-hooks/immutability` error (không access ref inside effect before declaration).

**Fails đã xử lý:**

- `fabric.IEvent<MouseEvent>` không assignable với Fabric 5 `fc.on()` → đổi sang `fabric.IEvent<Event>` + cast `e.e as MouseEvent` bên trong handler.
- `isPanning.current` accessed during render (ESLint error) → thêm state `panningCursor` riêng chỉ để update cursor class.
- `STATUS_LABELS` declared twice trong CanvasEditor → xóa duplicate ở cuối file.
- `useEffect` conditional hooks trong AdminUsers (early return trước hooks) → chuyển guard thành `if (user?.role !== 'admin') return` bên trong effect, keep JSX guard ở cuối.
- Fabric canvas `skipTargetFind` phụ thuộc `canvasMode` → thêm vào init effect deps.

**Tool kia cần biết:**

- **Frontend Sprint 1 deliverable HOÀN CHỈNH**: Login → tạo project → upload PDF → polling → ready → vẽ zone (polygon/rect) → lưu → thấy màu trên canvas.
- **Sprint 2 còn lại** (theo SPEC thứ tự): Comments tab trong ZoneDetailPanel (`GET/POST /zones/{id}/comments`), Zone History tab (`GET /zones/{id}/history` + rollback), Notifications page + AppShell badge.
- **Sprint 3 còn lại**: Settings tab (edit project + share link management UI), Excel Import UI (upload → preview → apply).
- `CanvasToolbar` export cả type `CanvasDrawMode` — import type riêng khi dùng ở nơi khác.
- Layer polling chạy ngay từ khi mount ProjectDetail (interval 3s) — không cần manual trigger.
- Zone `geometry_pct` lưu dưới dạng `[number, number][]` (array of [x,y]) theo SPEC, không phải `{x,y}[]`.

---

## Sprint Commit History
<!-- Tóm tắt sau mỗi commit. Cleared sau sprint checkpoint. -->

| Commit | Decisions / Approach | Vấn đề còn lại |
|--------|----------------------|----------------|
| chore: initial setup | Laravel 11 + PostgreSQL 14 + Sanctum + PhpSpreadsheet. Migrations 13 bảng chạy thành công. | Chưa có seed, chưa có auth API |
| feat: auth + project CRUD (reference) | Controller + FormRequest + Policy + Service + Repository + Resource; Base Controller dùng AuthorizesRequests/ValidatesRequests; migrations đúng thứ tự; SESSION_DRIVER=file cho API. | — |
| feat: sprint2-wrap + sprint3-full | Layer history (kể cả deleted), member invite PATCH-06 (temporary_password), Excel Import (preview+apply, PhpSpreadsheet 5.x), Share Link (viewer-only, public endpoint 410). 66 tests / 300 assertions pass. Backend API hoàn tất 100%. | Frontend React SPA + Deploy VPS chưa làm |
| feat: frontend-sprint1-deliverable | Frontend SPA hoàn chỉnh Sprint 1: Auth + routing, AdminUsers, ProjectDetail (ML/Layer/Member), Canvas foundation (tile+zone+mark Fabric.js, zoom/pan CSS transform), CanvasEditor (polygon/rect draw toolbar, ZoneCreateModal), CanvasProgress (own-zone highlight, mark draw, StatusPopup), CanvasView (read-only + Export Excel), ShareView (public token). Lint + build 0 error. | Sprint 2: Comments, Zone History, Notifications; Sprint 3: Settings UI, Excel Import UI |
