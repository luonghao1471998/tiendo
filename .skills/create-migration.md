# Skill: Tạo Migration

## Khi nào dùng
Thêm bảng mới hoặc thêm cột vào bảng đã có.

## Prompt Template

```
@CLAUDE.md

Tạo migration [tên migration] cho PostgreSQL.

Schema:
- [tên cột]: [kiểu dữ liệu] — [mô tả]
- [tên cột]: [kiểu dữ liệu] nullable — [mô tả]
- FK: [cột] → [bảng].id (cascade delete)

Lưu ý:
- Dùng timestampsTz() không phải timestamps()
- Dùng jsonb() cho JSON columns
- Dùng unsignedBigInteger() cho FK không có constraint (như activity_logs.target_id)
- Indexes: [list columns cần index]
```

## Checklist
- [ ] Dùng PostgreSQL types (bigIncrements, timestampsTz, jsonb)
- [ ] FK đúng — có constrained() hoặc không tùy theo design
- [ ] Indexes cho columns hay query
- [ ] Chạy php artisan migrate để verify
- [ ] Chạy php artisan db:show để confirm bảng đã tạo
