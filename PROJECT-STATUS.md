# PROJECT-STATUS.md — TienDo
**Cập nhật:** 2026-03-19
**Sprint:** Sprint 1 — Ngày 3/7

## Đã Hoàn Thành
- [x] Migrations 13 bảng
- [x] Auth API (login/logout/me)
- [x] Project CRUD
- [x] MasterLayer CRUD
- [x] Layer upload PDF + Python processor
- [x] Code review CRITICAL: Auth, Project, Layer

## Đang Dở
- [ ] Zone CRUD + state machine
- [ ] React scaffold + Canvas
- [ ] Automated tests

## Token Admin
admin@tiendo.vn / Admin@2026

## Quyết Định Session Này
- SESSION_DRIVER=file (không phải database)
- Gate::define('upload') cho MasterLayer
- Policy đăng ký qua Gate::policy()
