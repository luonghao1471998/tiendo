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

## Sprint Commit History
<!-- Tóm tắt sau mỗi commit. Cleared sau sprint checkpoint. -->

| Commit | Decisions / Approach | Vấn đề còn lại |
|--------|----------------------|----------------|
| chore: initial setup | Laravel 11 + PostgreSQL 14 + Sanctum + PhpSpreadsheet. Migrations 13 bảng chạy thành công. | Chưa có seed, chưa có auth API |
| feat: auth + project CRUD (reference) | Controller + FormRequest + Policy + Service + Repository + Resource; Base Controller dùng AuthorizesRequests/ValidatesRequests; migrations đúng thứ tự; SESSION_DRIVER=file cho API. | — |
| feat: sprint2-wrap + sprint3-full | Layer history (kể cả deleted), member invite PATCH-06 (temporary_password), Excel Import (preview+apply, PhpSpreadsheet 5.x), Share Link (viewer-only, public endpoint 410). 66 tests / 300 assertions pass. Backend API hoàn tất 100%. | Frontend React SPA + Deploy VPS chưa làm |
