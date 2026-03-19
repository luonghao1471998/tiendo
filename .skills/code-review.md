# Skill: Code Review

## Khi nào dùng
Review feature trước khi commit, đặc biệt CRITICAL features.

## Prompt Template — Review Trong Cursor (STANDARD)

```
@CLAUDE.md

Review code sau theo checklist:

[paste code cần review]

Checklist:
- [ ] Đúng pattern: Controller → Service → Repository?
- [ ] Không có DB query trong Controller?
- [ ] Không có business logic trong Model?
- [ ] FormRequest validate đủ fields?
- [ ] Policy check đúng role/ownership?
- [ ] Resource serialize đúng, không expose sensitive fields?
- [ ] Transaction cho multi-table writes?
- [ ] Activity log được ghi đúng chỗ?
- [ ] Error codes đúng theo CLAUDE.md?
- [ ] Edge cases được handle: null, empty, duplicate?
```

## Khi Nào Escalate Lên claude.ai web (CRITICAL)
Paste code lên claude.ai web để review khi:
- Auth flow (login, token, RBAC)
- Zone state machine transitions
- Activity log + rollback logic
- Permission matrix (field_team vs PM)
- PDF processing pipeline

## Format Feedback
```
✅ [điều tốt]
⚠️ [cần cải thiện — tại sao]
❌ [phải fix — sẽ gây bug gì]
```
