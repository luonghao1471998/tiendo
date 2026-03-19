# Skill: Tạo API Endpoint Mới

## Khi nào dùng
Tạo endpoint CRUD mới theo pattern chuẩn của TienDo.

## Prompt Template

```
@CLAUDE.md

Tạo endpoint [METHOD] /api/v1/[path] cho [tên feature].

Files cần tạo:
1. app/Http/Controllers/Api/[Name]Controller.php — method [tên method]
2. app/Http/Requests/[Store|Update][Name]Request.php — validation rules
3. app/Http/Resources/[Name]Resource.php — nếu chưa có
4. app/Services/[Name]Service.php — method [tên method]
5. app/Repositories/[Name]Repository.php — query method
6. app/Policies/[Name]Policy.php — authorize rule
7. routes/api.php — thêm route mới

Pattern bắt buộc:
Controller → FormRequest → Policy → Service → Repository → Resource

Business logic:
- [Mô tả logic]
- [Edge cases cần handle]
- [Validation rules]

Response format:
{"success": true, "data": {...}}
{"success": false, "error": {"code": "ERROR_CODE", "message": "..."}}
```

## Checklist Sau Khi Tạo
- [ ] Route đã đăng ký trong routes/api.php
- [ ] FormRequest validate đúng fields
- [ ] Policy check đúng role/ownership
- [ ] Service không có DB query trực tiếp
- [ ] Repository chỉ có Eloquent query
- [ ] Resource serialize đúng fields
- [ ] Error codes đúng theo CLAUDE.md
- [ ] Test bằng curl hoặc Postman
