# Skill: Debug API Error

## Khi nào dùng
Khi API trả về lỗi không mong muốn hoặc behavior sai.

## Prompt Template

```
@CLAUDE.md @SESSION-LOG.md

Debug lỗi API sau:

Endpoint: [METHOD] /api/v1/[path]
Request: [paste curl hoặc request body]
Response nhận được: [paste response]
Response mong đợi: [mô tả]

Files liên quan:
- [Controller]
- [Service]
- [Repository]

Phân tích nguyên nhân và fix.
Chỉ fix vấn đề này, không refactor thêm.
```

## Checklist Debug
- [ ] Kiểm tra routes: php artisan route:list | grep [endpoint]
- [ ] Kiểm tra logs: tail -f storage/logs/laravel.log
- [ ] Kiểm tra DB: psql -U tiendo -d tiendo -c "SELECT..."
- [ ] Kiểm tra request validation có pass không
- [ ] Kiểm tra Policy có return đúng không
- [ ] Kiểm tra Service có throw exception không

## Escalate Sang Claude Code Khi
- Cursor fix đi fix lại cùng 1 chỗ > 3 lần
- Bug span nhiều files, Cursor không thấy toàn bộ
- Root cause cần phân tích sâu
