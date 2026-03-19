# SESSION-LOG.md — TienDo

## Current Session
<!-- Ghi trong lúc làm việc. Cleared sau mỗi git commit. -->

**Task:** Reference Implementation — Auth + Project CRUD

**Files changed:**
- `app/Http/Controllers/Api/AuthController.php`
- `app/Services/AuthService.php`
- `app/Http/Controllers/Api/ProjectController.php`
- `app/Services/ProjectService.php`
- `app/Repositories/ProjectRepository.php`
- `app/Http/Controllers/Controller.php` (thêm AuthorizesRequests trait)
- `database/migrations/` (13 bảng đầy đủ)
- `routes/api.php`

**Decisions:**
- Base Controller cần AuthorizesRequests + ValidatesRequests trait
- Migration thứ tự: master_layers phải trước layers, zones trước marks
- SESSION_DRIVER=file (không phải database) để API không redirect

**Result:** done — login/me/project CRUD hoạt động

---

## Sprint Commit History
<!-- Tóm tắt sau mỗi commit. Cleared sau sprint checkpoint. -->

| Commit | Decisions / Approach | Vấn đề còn lại |
|--------|----------------------|----------------|
| chore: initial setup | Laravel 11 + PostgreSQL 14 + Sanctum + PhpSpreadsheet. Migrations 13 bảng chạy thành công. | Chưa có seed, chưa có auth API |
| feat: auth + project CRUD (reference) | Controller + FormRequest + Policy + Service + Repository + Resource; Base Controller dùng AuthorizesRequests/ValidatesRequests; migrations đúng thứ tự; SESSION_DRIVER=file cho API. | — |
