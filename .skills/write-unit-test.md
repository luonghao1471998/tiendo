# Skill: Viết Unit Test

## Khi nào dùng
Viết test cho critical paths: auth, state transitions, permissions.

## Prompt Template

```
@CLAUDE.md

Viết Feature Test cho [tên feature] trong tests/Feature/[Name]Test.php.

Test cases cần cover:
1. Happy path: [mô tả]
2. Unauthorized: user không có token → 401
3. Forbidden: user không đủ role → 403
4. Validation: thiếu field bắt buộc → 422
5. Edge case: [mô tả]

Setup:
- Dùng RefreshDatabase trait
- Seed admin user trước mỗi test
- Dùng Sanctum::actingAs() để authenticate

Assert:
- Status code đúng
- Response format: {"success": true/false, "data/error": {...}}
- DB state sau action
```

## Critical Paths Phải Có Test
- [ ] Auth: login đúng/sai, token expired
- [ ] Zone status transition: valid/invalid transitions
- [ ] Permission: field_team chỉ update zone assigned cho mình
- [ ] File upload: PDF > 50MB reject, non-PDF reject
- [ ] Activity log: mọi change đều có log
- [ ] Geometry validation: tọa độ ngoài [0,1] reject
