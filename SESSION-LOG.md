# SESSION-LOG.md — TienDo

## Current Session

### Session: 2026-03-23 — Activity log: `updated_at` hiển thị gọn

**Task**

- Trường `updated_at` trong `changes` (from→to ISO dài) không còn in hai mốc; hiển thị một dòng: **`Cập nhật: YYYY-MM-DD HH:mm:ss`** (giờ local), lấy mốc **`to`**.

**Files:** `frontend/src/lib/activityLogDisplay.ts` (`fmtDateTimeCompact`, nhánh `updated_at` trong `pushChangeLines`)

**Verify:** `npm run lint && npm run build` — 0 error

---

### Session: 2026-03-23 (bổ sung) — Tab Lịch sử (zone): UI timeline + log chi tiết

**Task**

- Tham chiếu mockup dashboard (Hoạt động / Thành viên): học layout **card**, **avatar chữ cái**, **thời gian tương đối**, **tag phạm vi** (khu vực vs mark), **highlight** trạng thái / %.
- **`activityLogDisplay.ts`:** `describeActivityLog` — câu tóm tắt theo `target_type` + `action`; parse `changes` (status, `completion_pct`, deadline, assignee, geometry, note…); `formatRelativeTimeVi`, `activityUserInitials`, `activityAvatarColor`.
- **`HistoryTab` (`CanvasEditor`):** thẻ trắng viền nhạt, shadow; skeleton loading; empty state; dòng chi tiết có mũi tên cho trạng thái & tiến độ; nút rollback kiểu secondary xanh.
- **Gap so với mockup (chưa làm / backlog):** feed **Hoạt động cấp dự án** (filter mặt bằng / hành động / người), **KPI 24h** trên cùng feed, **thumbnail comment** trong luồng activity, **storage meter** sidebar, **FAB** — hiện MVP chỉ có **lịch sử theo zone** trong panel canvas.

**Files:** `frontend/src/lib/activityLogDisplay.ts`, `frontend/src/pages/CanvasEditor.tsx` (HistoryTab)

**Verify:** `npm run lint && npm run build` — 0 error

---

### Session: 2026-03-22 — WF-3: bỏ “Người phụ trách” tự do ở popup tạo zone; Giao cho đúng SPEC

**Task**

- **SPEC (PATCH-07):** `assigned_user_id` = nguồn sự thật (thành viên dự án); `assignee` = nhãn hiển thị. Popup cũ cho nhập tên tự do → lưu `assignee` nhưng panel “Giao cho” chỉ đọc FK → hiển thị “Chưa giao” — mâu thuẫn.
- **Frontend:** Bỏ ô “Người phụ trách” khỏi `ZoneCreateModal`; không gửi `assignee` lúc POST tạo zone. Gợi ý: giao việc ở panel Chi tiết (dropdown thành viên). `resolveZoneAssigneeDisplay` — ưu tiên `assignee`, sau đó tên từ `assigned_user_id` + danh sách members. `CanvasView` / `ShareView` popup đồng bộ nhãn “Giao cho”.
- **Backend:** `ZoneService::update` chỉ cập nhật các field có trong payload (`array_key_exists`) để PUT từ client không xóa `assignee`/`tasks`/… Khi đổi `assigned_user_id` mà không gửi `assignee` → auto `assignee = user.name` nếu nhãn đang trống hoặc trùng tên user được giao trước (PATCH-07).
- **SPEC.md:** WF-3 + bổ sung dòng trong PATCH-07 (popup không nhập tên tự do).
- **Tests:** `ZoneCrudStateMachineTest` — giữ `assignee` khi PUT bỏ qua field; auto nhãn khi gán `assigned_user_id`.

**Files:** `frontend/src/lib/zoneAssigneeDisplay.ts`, `CanvasEditor.tsx`, `CanvasView.tsx`, `ShareView.tsx`, `backend/app/Services/ZoneService.php`, `SPEC.md`, `ZoneCrudStateMachineTest.php`

**Verify:** `npm run lint && npm run build`; `php artisan test --filter=ZoneCrudStateMachineTest`

---

### Session: 2026-03-17 — Upload bản vẽ: PDF, DXF, DWG

**Task**

- SPEC/CLAUDE: cho phép upload bản vẽ **PDF**, **DXF**, **DWG** (AutoCAD); pipeline tiles giữ nguyên (ProcessPdfJob → Python).
- **Backend:** `StoreLayerRequest` + `LayerService` — validate đuôi + lưu `layers/{id}/original.{pdf|dxf|dwg}`; `PdfProcessingService` gọi `scripts/drawing_processor.py`.
- **Python:** `drawing_processor.py` — PDF qua pdf2image; DXF/DWG qua ezdxf + matplotlib (modelspace); DWG lỗi đọc → thông báo gợi ý xuất DXF/PDF. Dependencies: `scripts/requirements-drawing.txt` (+ poppler cho PDF).
- **Frontend:** `ProjectDetail.tsx` — `accept` + kiểm tra đuôi (vì DWG thường `application/octet-stream`).
- **Docs:** `SPEC.md` (AC-03, WF-2), `CLAUDE.md` (script + deps).
- **Tests:** `LayerUploadFormatsTest` (422 định dạng lạ; DXF/PDF 201 + dispatch job).
- **Migration:** `make_zone_comments_content_nullable` chạy trước `create_zone_comments` → thêm `Schema::hasTable`; `create_zone_comments` dùng `content` nullable cho migrate sạch.

**Files**

| File | Thay đổi |
|------|-----------|
| `backend/scripts/drawing_processor.py` | Mới |
| `backend/scripts/requirements-drawing.txt` | Mới |
| `backend/app/Http/Requests/StoreLayerRequest.php` | pdf/dxf/dwg |
| `backend/app/Services/LayerService.php` | `original.{ext}` |
| `backend/app/Services/PdfProcessingService.php` | `drawing_processor.py` |
| `frontend/src/pages/ProjectDetail.tsx` | UI + validation đuôi |
| `backend/tests/Feature/LayerUploadFormatsTest.php` | Mới |
| `SPEC.md`, `CLAUDE.md` | Đồng bộ |
| `2026_03_17_000001_make_zone_comments_content_nullable.php` | `hasTable` guard |
| `2026_03_19_032342_create_zone_comments_table.php` | `content` nullable |

**Verify**

- `cd backend && ./vendor/bin/pint --test` (hoặc pint) + `php artisan test --filter=LayerUploadFormatsTest`
- `cd frontend && npm run lint && npm run build` — 0 error

---

### Session: 2026-03-21 (bổ sung 2) — WF-3: click nền khi sửa đỉnh không “vô hiệu”

- **Hành vi:** Double-click chấm xanh chèn đỉnh; click ra ngoài polygon **không** chèn đỉnh mới (đúng thiết kế). Trước đây click nền gọi `selectZone(null)` → mất chọn vùng trên sidebar dù vẫn đang sửa đỉnh → dễ hiểu nhầm “không có gì xảy ra”.
- **Sửa:** Khi `vertexEditZoneId != null`, click nền gọi `selectZone(vertexEditZoneId)` để giữ panel đúng vùng. Gợi ý trên thanh **Sửa đỉnh vùng** nêu rõ chỉ **double-click** chấm xanh mới chèn đỉnh.

**Files:** `PolygonLayer.tsx`, `CanvasEditor.tsx`

---

### Session: 2026-03-21 (bổ sung) — WF-3: không mất vùng khi dblclick midpoint rồi click nền

**Task**

- **Lỗi:** Trong chế độ sửa đỉnh, double-click midpoint (xanh) chèn đỉnh rồi click ra ngoài canvas → `selectZone(null)` → effect vẽ lại zones gọi `fc.clear()` → xóa luôn object overlay (`vertex-edit`) trong khi `vertexEditZoneId` vẫn còn; effect overlay không chạy lại → vùng đang sửa **không được vẽ lại** (trông như “mất cả vùng”).
- **Sửa:** Khi `vertexEditZoneId != null`, làm sạch layer bằng cách **chỉ remove object không gắn** `ZONE_VERTEX_EDIT_TAG`; sau khi vẽ zone/mark khác, **`bringToFront`** mọi object overlay. Export `ZONE_VERTEX_EDIT_TAG` từ `zoneVertexOverlay.ts`.

**Files:** `frontend/src/components/canvas/PolygonLayer.tsx`, `frontend/src/components/canvas/zoneVertexOverlay.ts`

**Verify:** `npm run lint && npm run build` — 0 error.

---

### Session: 2026-03-21 — Admin tạo user (1 ô MK); WF-3 overlay khớp zone; kéo vùng + polygon ≥3 đỉnh

**Task**

1. **Admin thêm user:** `POST /api/v1/users` — một trường **Mật khẩu** (bỏ `password_confirmation` / rule `confirmed`); `must_change_password: false` vì admin đặt mật khẩu trực tiếp (khác lời mời / reset MK).
2. **Double-click sửa đỉnh — zone “nhảy” lệch so với chấm:** overlay vẽ viền bằng centroid + `left/top` không khớp cách Fabric vẽ polygon **tọa độ tuyệt đối** như `PolygonLayer` → sửa `zoneVertexOverlay`: polygon đỏ cùng hệ tọa độ với đỉnh; `objectCaching: false` cho viền/handles và **zone trong group** (`PolygonLayer`) để stroke cập nhật khi kéo.
3. **Kéo cả vùng mà cạnh không theo:** vùng hợp lệ là **polygon đóng ≥3 đỉnh**. Chỉ **2 điểm** = đoạn thẳng, không phải miền; hành vi Fabric/render có thể lạ. Editor vẽ polygon yêu cầu **tối thiểu 3 điểm** trước double-click kết thúc; nên dùng **Hình chữ nhật** nếu chỉ cần 2 góc.

**Hướng dẫn QA — WF-3 (Canvas Editor, PM/admin dự án)**

- Chế độ **Chọn**; **double-click** vùng → viền đỏ + chấm **trùng** vùng đang thấy (không lệch).
- **Kéo cả vùng:** fill + viền + label di chuyển cùng nhau; sau debounce PUT 200.
- Sửa đỉnh: đỏ kéo, xanh double-click chèn, chuột phải xóa (≥3 đỉnh), Ctrl+Z, Lưu hình / Hủy / Esc.

**Files changed (cộng dồn 2026-03-21)**

| File | Thay đổi |
|------|-----------|
| `backend/app/Http/Requests/StoreUserRequest.php` | `password` min:8, không `confirmed` |
| `backend/app/Services/UserService.php` | `create`: `must_change_password: false` |
| `backend/tests/Feature/UserManagementTest.php` | POST không gửi `password_confirmation`; assert `must_change_password` false |
| `frontend/src/pages/AdminUsers.tsx` | Một ô mật khẩu; subtitle cập nhật |
| `frontend/src/components/canvas/zoneVertexOverlay.ts` | Polygon tuyệt đối; `objectCaching: false` |
| `frontend/src/components/canvas/PolygonLayer.tsx` | Zone poly `objectCaching: false` |
| (+ trước đó) `fabricZoneGeometry`, `POST /users`, … | |

**Verify**

- `npm run lint && npm run build` — 0 error.
- `php artisan test --filter=UserManagementTest` (DB test migrate sạch).

---

### Session: 2026-03-17 — Bắt buộc đổi MK lần đầu; canvas zone kéo + sửa đỉnh (WF-3) + Undo cục bộ

**Task**

1. **Tài khoản mời / reset MK:** mật khẩu tạm → `must_change_password`; login + `me` trả cờ; sau đổi MK tại `/account/must-change-password` mới vào app (`BlockUntilPasswordChanged`, `GuestOnly`).
2. **Canvas editor (PM/Admin):** kéo **cả vùng** (Fabric `Group` + `object:modified` + debounce PUT `geometry_pct`); **double-click** vùng → overlay sửa đỉnh (`zoneVertexOverlay.ts`: đỏ/xanh, chèn, chuột phải xóa, **Ctrl+Z / Ctrl+Shift+Z**, Esc hủy); thanh **Lưu hình / Hủy**; `geometryToApiPolygon` dùng chung tạo zone / cập nhật.
3. **Undo kéo vùng:** chưa có stack riêng; **Undo/Redo** SPEC §WF-3 áp dụng cho phiên **sửa đỉnh** (overlay).
4. **`App.tsx`:** sửa cấu trúc `<Route>` lồng (`BlockUntilPasswordChanged` → `AppShell`) để JSX hợp lệ.

**Files changed**

| File | Thay đổi |
|------|-----------|
| `backend/database/migrations/2026_03_24_000000_add_must_change_password_to_users_table.php` | Cột `must_change_password` |
| `backend/app/Models/User.php`, `UserResource.php`, `AuthService.php`, `AuthController.php`, `ProjectMemberService.php`, `UserService.php` | Cờ + invite + reset + clear khi đổi MK |
| `frontend/src/stores/authStore.ts` | `must_change_password` trên user |
| `frontend/src/App.tsx` | Route must-change + guard + fix đóng tag |
| `frontend/src/pages/Login.tsx`, `MustChangePasswordPage.tsx` | Redirect / form đổi MK |
| `frontend/src/lib/fabricZoneGeometry.ts`, `frontend/src/components/canvas/zoneVertexOverlay.ts` | Hình học canvas + overlay chỉnh đỉnh |
| `frontend/src/components/canvas/PolygonLayer.tsx` | Group drag, vertex edit, `FabricCanvasHandle` commit/cancel |
| `frontend/src/pages/CanvasEditor.tsx` | `canEditZoneGeometry`, state overlay, PUT zone + UI gợi ý |

**Verify**

- `npm run lint && npm run build` (frontend) — 0 error.
- `php artisan migrate` nếu chưa có cột `must_change_password`.

---

### Session: 2026-03-23 — AdminUsers UX + tìm kiếm; bỏ reset MK tab Thành viên; ProjectList tìm kiếm

**Task**

1. **ProjectDetail / tab Thành viên:** gỡ toàn bộ **đặt lại mật khẩu** (modal, cột Mật khẩu, `isPlatformAdmin`). Chức năng chỉ còn tại **`/admin/users`**.
2. **AdminUsers:** nút **Chỉnh sửa** / **Đặt lại MK** — brand TienDo (`#FF7F29`, `#FFF3E8`, icon `Pencil` / `KeyRound`); bảng viền `#E2E8F0`.
3. **Tìm người dùng / tìm dự án:** query **`search`** + **`per_page`** (tối đa 100) — **Controller → Service → Repository**, filter `name` **`ILIKE`** (PostgreSQL), escape `%` `_`. Frontend: **`useDebouncedValue`** 300ms gọi API.
4. **ProjectList:** empty state khi không khớp; sau **Tạo dự án** → xóa ô tìm + merge list (refetch khi debounce về rỗng).

**Files changed**

| File | Thay đổi |
|------|-----------|
| `frontend/src/pages/ProjectDetail.tsx` | `MembersTab`: bỏ reset password |
| `frontend/src/pages/AdminUsers.tsx` | Nút brand, search + debounce + API |
| `frontend/src/pages/ProjectList.tsx` | Search + debounce + API; `onCreated` clear search |
| `frontend/src/lib/useDebouncedValue.ts` | **Mới** |
| `backend/app/Repositories/UserRepository.php` | `paginate(..., ?nameSearch)` + `ilike` |
| `backend/app/Services/UserService.php` | Truyền `nameSearch` |
| `backend/app/Http/Controllers/Api/UserController.php` | Query `search` (max 100 ký tự) |
| `backend/app/Repositories/ProjectRepository.php` | `paginateForUser(..., ?nameSearch)` |
| `backend/app/Services/ProjectService.php` | Truyền `nameSearch` |
| `backend/app/Http/Controllers/Api/ProjectController.php` | `per_page` + `search` |
| `backend/tests/Feature/UserManagementTest.php` | `test_admin_can_filter_users_by_name_search` |
| `backend/tests/Feature/ProjectListSearchTest.php` | **Mới** |

**Verify**

- `npm run lint && npm run build` — 0 error.
- `php artisan test` (DB `tiendo_test` migrate sạch) — feature search khi CI khả dụng.

---

### Session: 2026-03-23 — DB: cột `users.avatar_path` (fix upload avatar)

**Task**

- Lỗi khi upload avatar: PostgreSQL **`column "avatar_path" ... does not exist`** — migration **`2026_03_23_120000_add_avatar_path_to_users_table`** chưa được chạy trên DB `tiendo`.
- Chạy `php artisan migrate` → migration **DONE**; bỏ `->after('email')` trong file migration (PostgreSQL không dùng `AFTER`; tránh nhầm lẫn khi đọc code).

**Files changed**

| File | Thay đổi |
|------|-----------|
| `backend/database/migrations/2026_03_23_120000_add_avatar_path_to_users_table.php` | Bỏ `after('email')`, ghi chú PG |

**Verify / Ops**

- Môi trường local/staging/production: **`php artisan migrate`** sau khi pull code có migration avatar.
- `npm run lint && npm run build` — 0 error.

---

### Session: 2026-03-17 (bổ sung) — Modal mật khẩu đồng bộ Excel + sửa upload avatar

**Task**

- Form **Đổi mật khẩu** / **Đặt lại mật khẩu** dùng cùng “skin” modal như **Nhập Excel**: backdrop `#0F172A/55` + blur, header `F8FAFC` + gạch cam, body trong khối `rounded-xl` xám nhạt, footer `F8FAFC`, input `border #E2E8F0` + focus cam.
- **Avatar:** sau khi chọn ảnh phải cập nhật ngay trên header — sửa **không** gửi `Content-Type: multipart/form-data` thủ công (thiếu `boundary` → Laravel không nhận file); cập nhật `user` từ JSON trả về `POST /auth/me/avatar` + query cache-bust `_v` trên URL ảnh.

**Files changed**

| File | Thay đổi |
|------|-----------|
| `frontend/src/components/ui/AppFormModal.tsx` | **Mới:** vỏ modal + `appFormInputClass` / `appFormLabelClass` |
| `frontend/src/components/account/ChangePasswordModal.tsx` | Dùng `AppFormModal`, `parseApiError`, style Excel |
| `frontend/src/components/account/AdminSetPasswordModal.tsx` | Dùng `AppFormModal`, style Excel |
| `frontend/src/components/layout/AppShell.tsx` | Upload avatar: bỏ header Content-Type, `setState` từ response, `_v` cache bust |
| `frontend/src/stores/authStore.ts` | `export type AuthUser` (dùng khi parse response avatar) |

**Verify**

- `npm run lint && npm run build` — 0 error.

---

### Session: 2026-03-17 — Avatar, đổi mật khẩu, admin đặt lại MK, nhãn role dự án

**Task**

- **Avatar:** mọi tài khoản upload ảnh đại diện (`POST /auth/me/avatar`); API trả `avatar_url` (`/storage/...`) trên user / thành viên dự án.
- **Menu tài khoản (AppShell):** click avatar → **Đổi mật khẩu** (`PATCH /auth/me/password`), **Đổi ảnh đại diện**, **Đăng xuất** (desktop dropdown + mobile menu).
- **Admin:** trang **Người dùng** — nút **Đặt lại MK** cho user **không** phải `admin` (`PATCH /users/{user}/password`); policy backend chặn reset tài khoản admin khác.
- **Tab Thành viên (dự án):** admin hệ thống thấy cột **Mật khẩu** → **Đặt lại MK** cho thành viên không phải admin; select mời + cột role hiển thị **Field Team / Project Manager / Viewer** (API vẫn snake_case).
- **Admin users table:** cột role hiển thị nhãn tương tự (Admin, Field Team, …); avatar nhỏ nếu có.

**Files changed**

| File | Thay đổi |
|------|-----------|
| `backend/routes/api.php` | `POST /auth/me/avatar`, `PATCH /auth/me/password`, `PATCH /users/{user}/password` |
| `backend/app/Http/Resources/UserResource.php` | `avatar_url` |
| `backend/app/Http/Resources/ProjectMemberResource.php` | nested `user.avatar_url` |
| `backend/app/Http/Controllers/Api/UserController.php` | `resetPassword` |
| `frontend/src/stores/authStore.ts` | `AuthUser.avatar_url` |
| `frontend/src/lib/roleLabels.ts` | **Mới:** `projectMemberRoleLabel`, `platformUserRoleLabel` |
| `frontend/src/components/account/ChangePasswordModal.tsx` | **Mới** |
| `frontend/src/components/account/AdminSetPasswordModal.tsx` | **Mới** |
| `frontend/src/components/layout/AppShell.tsx` | Avatar ảnh, dropdown + mobile, upload + modal đổi MK |
| `frontend/src/pages/AdminUsers.tsx` | Avatar, nhãn role, Đặt lại MK |
| `frontend/src/pages/ProjectDetail.tsx` | `MembersTab`: nhãn role, avatar, admin đặt lại MK |

**Approach & tại sao chọn**

- Avatar lưu disk `public`, URL tương đối — Vite proxy `/storage` → backend (đồng bộ với PDF/tiles).
- Đặt lại MK admin: tái dùng `AdminSetPasswordModal`; policy `UserPolicy::resetPassword` tránh leo thang qua reset admin.

**Verify**

- `npm run lint && npm run build` (frontend) — 0 error.
- Backend: chạy migration `add_avatar_path_to_users` nếu chưa (`php artisan migrate`).

---

### Session: 2026-03-23 — Xuất PDF bản vẽ (PM/admin + đội được giao)

**Task**

- **PM / admin** (`CanvasEditor`, `CanvasView`): xuất **PDF toàn layer** (tiles + zone/mark) hoặc **kéo chọn vùng** trên viewport → PDF một trang đúng tỷ lệ vùng.
- **Đội hiện trường** (`CanvasProgress`): nút **PDF vùng giao** — ảnh ghép giữ nguyên logic **mờ** zone không được giao (`opacity` như `MarkDrawCanvas`); chỉ user có role `field_team` trên dự án (không hiện cho admin global / PM trên trang tiến độ).

**Files changed**

| File | Thay đổi |
|------|-----------|
| `frontend/package.json` | dependency **`jspdf`** |
| `frontend/src/lib/canvasPdfExport.ts` | **Mới:** `drawTilesOnContext`, `compositeLayerToCanvas`, `downloadCanvasAsPdf`, `exportLayerPdf` |
| `frontend/src/components/canvas/ExportMarqueeOverlay.tsx` | **Mới:** overlay kéo thả + map `getBoundingClientRect(lowerCanvas)` → pixel layer |
| `frontend/src/components/canvas/PolygonLayer.tsx` | `forwardRef` + `FabricCanvasHandle` / `useImperativeHandle` → `getFabric()` |
| `frontend/src/pages/CanvasEditor.tsx` | Nút PDF toàn bộ / PDF vùng chọn; marquee + `hasProjectRole` PM/admin |
| `frontend/src/pages/CanvasView.tsx` | `ReadOnlyCanvas` `forwardRef`; PDF + marquee tương tự editor |
| `frontend/src/pages/CanvasProgress.tsx` | `MarkDrawCanvas` `forwardRef`; nút PDF cho `field_team` |

**Approach & tại sao chọn**

- **Client-only:** không API mới — tải lại tile JPEG qua URL công khai (`/api/v1/layers/.../tiles/0/x/y`), vẽ lên `CanvasRenderingContext2D`, ghép **`fabric.Canvas.toDataURL`** (overlay zone/mark đúng như màn hình).
- **Không html2canvas** trên DOM transform — tránh sai lệch zoom/pan; `jspdf` kéo theo `html2canvas` transitive (chunk build) — chấp nhận size bundle tăng.
- **Marquee:** tọa độ màn hình → layer qua tỷ lệ với `lowerCanvasEl.getBoundingClientRect()`.

**Decisions quan trọng**

- Quyền: PDF đầy đủ/vùng = **`project_manager` + `admin`**; PDF “vùng được giao” = **`field_team`** trên project (admin dùng editor/view để xuất full).
- Trang PDF một trang, `unit: 'px'`, `format: [w,h]` khớp ảnh xuất.

**Đã thử / fail**

- ESLint `set-state-in-effect` trên overlay khi `active` → bỏ effect reset; dùng **`key`** tăng (`pdfMarqueeKey`) mỗi lần mở marquee để remount sạch state.

**Claude AI Web cần biết**

- Export dùng **`polygonFabricRef` / `MarkDrawCanvas` ref** → `getFabric()`; map marquee cần **`lowerCanvasEl`** sau `useLayoutEffect` khi mở overlay.
- Bản vẽ lớn → PDF nặng; có thể sau này giảm `multiplier` hoặc JPEG tiles + overlay PNG.

**Verify**

- `npm run lint && npm run build` — 0 error.

---

### Session: 2026-03-22 — Tab title (`document.title`) theo route

**Task**

- Tab trình duyệt mặc định **frontend** (Vite) → đổi thành **tiêu đề ngắn theo hành động** từng route; mặc định / không khớp → **TienDo**.

**Files changed**

| File | Thay đổi |
|------|-----------|
| `frontend/index.html` | `<title>frontend</title>` → `TienDo` |
| `frontend/src/lib/documentTitle.ts` | **Mới:** `APP_TAB_NAME`, `titleForPathname()`, `DocumentTitleSync` (`useLocation` + `useEffect` → `document.title`) |
| `frontend/src/App.tsx` | Trong `<BrowserRouter>` render `<DocumentTitleSync />` |

**Approach & tại sao chọn**

- **Không** thêm `react-helmet-async` — chỉ `document.title` + React Router; giảm dependency, đủ UX tab.
- **`titleForPathname`**: regex pathname theo thứ tự **route sâu trước** (…/editor, …/progress, …/view) rồi mới `projects/:id`, tránh khớp nhầm.
- **`DocumentTitleSync`**: component side-effect (`return null`), đặt **bên trong** `BrowserRouter` để mọi lần đổi URL đều sync title.

**Decisions quan trọng**

- Format tab: **`Hành động · TienDo`** (tiếng Việt ngắn, đồng bộ yêu cầu “đúng action”).
- Tên app tập trung ở **`APP_TAB_NAME`** trong `documentTitle.ts` + fallback `index.html`.

**Đã thử / fail**

- Không thử Helmet — tính năng chỉ cần đổi title động; SEO/meta OG không nằm trong scope lần này.

**Claude AI Web cần biết**

- Thêm/sửa route → cập nhật **`titleForPathname()`** (`frontend/src/lib/documentTitle.ts`).
- Nếu sau này Vite **`base`** khác `/`, có thể cần chuẩn hoá pathname (strip base) trước khi regex.

**Verify**

- `npm run lint` — 0 error.

---

### Session: 2026-03-22 — Gộp SESSION-LOG + template Current Session

**Task**

- **Lần 1 (yêu cầu trước):** Rà soát toàn bộ thread QA CanvasProgress / Share / Excel / WSL; **gộp** nhiều mục `### Session: 2026-03-17` lặp trong `## Current Session` thành **một** block **«Tổng hợp QA»** theo template: Task đánh số theo thứ tự xử lý, bảng **Files changed**, **Decisions**, **Đã thử / fail**, **Claude AI Web cần biết**, **Verify**.
- **Lần 2 (phiên này):** Tóm tắt lại conversation và **ghi log** với tiêu đề session theo **ngày hiện tại** (`2026-03-22`).

**Files changed**

| File | Thay đổi |
|------|-----------|
| `SESSION-LOG.md` | Chỉnh `## Current Session`: gộp / chuẩn hoá block log; thêm mục session **2026-03-22** (meta). |

**Decisions**

- Log **meta** (chỉnh SESSION-LOG) tách riêng session **theo ngày ghi**, không trộn vào các session feature cũ trừ khi đang gộp lịch sử cùng một đợt QA.

**Đã thử / fail**

- Lần **search_replace** gộp session đầu tiên **fail** khi `old_string` không khớp 100% (ví dụ đường dẫn `frontend/lib/...` vs `frontend/src/lib/...` trong block cũ) → cần copy đúng nội dung file hiện tại rồi replace.

**Claude AI Web cần biết**

- Chi tiết code CanvasProgress / Share link / Excel import / `normalizeMark`… đã có trong **Sprint Commit History** (`fix: canvas-progress-…`, `share-link-…`, `excel-import-…`, v.v.) và/hoặc block gộp **2026-03-17** nếu vẫn giữ trong repo.
- `SESSION-LOG.md`: mục **Current Session** được clear sau mỗi git commit (ghi chú đầu section).

**Verify**

- Đọc lại `SESSION-LOG.md` — `## Current Session` có `### Session: 2026-03-22` và cấu trúc template đầy đủ.

---

### Session: 2026-03-20 — CommentsTab multipart (TEST 7.3 / 7.4) + ghi log

**Task**

- Sửa **TEST 7.3**: thumbnail/click ảnh comment 404 (`NOT_FOUND`), URL sai dạng `.../images/comments/2/uuid.png`; comment **chỉ ảnh** báo "Validation failed."
- Sửa **TEST 7.4**: chọn **> 5 ảnh** phải báo rõ, không âm thầm cắt file; tránh trạng thái lỗi / mất ảnh sau khi đổi zone.
- Đồng bộ **PROJECT-STATUS.md** (gotchas Comment image + FormData).
- Cập nhật **SESSION-LOG** (mục này + dòng Sprint).

**Files changed**

| File | Thay đổi |
|------|-----------|
| `frontend/src/pages/CanvasEditor.tsx` | `CommentsTab`: helper `commentImageBasename()`, URL ảnh = basename + `encodeURIComponent`; **bỏ** `headers: { 'Content-Type': 'multipart/form-data' }` trên `POST` comment (để axios gắn boundary); `MAX_IMAGES_PER_COMMENT`, thông báo "Tối đa 5 ảnh mỗi bình luận.", reset file + disable Gửi khi > 5 |
| `frontend/src/pages/ProjectDetail.tsx` | Excel import + upload PDF layer: bỏ cùng header multipart sai |
| `PROJECT-STATUS.md` | Gotchas: không set Content-Type multipart thủ công; URL comment chỉ basename; gộp bullet trùng |

**Approach & tại sao chọn**

- Laravel route `GET /comments/{id}/images/{filename}` — `{filename}` **một segment**. Ghép cả path storage vào segment → route không khớp / 404. → Luôn dùng **basename** + encode an toàn.
- Axios + `FormData`: set `Content-Type: multipart/form-data` **không kèm boundary** → server không parse file → `images` rỗng → lỗi "Validation failed" hoặc chỉ lưu text. → **Không** set header; browser/axios tự thêm boundary (chuẩn MDN/axios).
- Giới hạn 5 ảnh: hằng số + chặn ở `onChange` + `submit` + disable nút — tránh UX "cắt 6→5" im lặng.

**Decisions quan trọng**

- Ưu tiên **sửa client** (multipart + URL); backend `ZoneCommentController::image` + `StoreZoneCommentRequest` đã đúng — không đổi API.
- Cùng pattern **bỏ header multipart** áp dụng cho Excel import / PDF upload trong `ProjectDetail` để tránh lỗi tương tự sau này.

**Đã thử / fail**

- Chỉ `img.split('/').pop()` vẫn có thể thiếu nếu path lạ → chọn **`commentImageBasename()`** (normalize `\`, lấy segment cuối).
- Ban đầu nghi backend `NOT_FOUND` do policy — thực tế do **URL nhiều segment sau `/images/`** + multipart không tới server.

**Claude AI Web cần biết**

- Mọi `client.post(..., formData)` với **FormData**: **không** override `Content-Type` — đây là gotcha hay gặp với Laravel + axios.
- Ảnh comment public: `/api/v1/comments/{commentId}/images/{basename}`; `{basename}` = tên file trong `storage/.../comments/{id}/`.
- Bảng Sprint Commit History bên dưới đã có dòng `fix: comments-tab-multipart-images` mô tả kỹ thuật; **PROJECT-STATUS.md** § Gotchas đã cập nhật cùng nội dung.

---

### Session: E2E Test Fix — Sprint 1 Deliverable

**Bugs phát hiện & fix (theo thứ tự):**

1. **`ProjectList.tsx` thiếu nút "Tạo dự án" cho admin**
   - File: `frontend/src/pages/ProjectList.tsx`
   - Root cause: component chưa implement button và modal.
   - Fix: Thêm `isAdmin = user?.role === 'admin'`, button hiện khi `isAdmin`, `CreateProjectModal` với form `name/code/description/address` → `POST /api/v1/projects` → `onCreated` callback append vào list.

2. **Backend đang chạy là partial root app, không phải backend đầy đủ**
   - Root cause: Toàn bộ Sprint 2+3 backend code nằm trong `/var/www/tiendo/backend/` (riêng), nhưng `start-wsl.sh` chạy Laravel từ root `/var/www/tiendo/` (chỉ có Auth + Project cơ bản, không có Jobs dir, không có ProcessPdfJob).
   - Fix: Cập nhật `start-wsl.sh` để `cd "$BACKEND_DIR"` (`./backend/`) trước khi chạy mọi lệnh artisan. Thêm `BACKEND_DIR="$SCRIPT_DIR/backend"` variable.
   - Fix: Thêm `ADMIN_PASSWORD=Admin@2026` vào `backend/.env`. Tạo admin user trực tiếp qua tinker (AdminUserSeeder trong backend rỗng).
   - Fix: `migrate:fresh` trong backend → 19/19 migrations DONE.

3. **`geometry_pct` format mismatch frontend vs backend**
   - Frontend: `Geometry.points: [number, number][]` (array tuple)
   - Backend expects: `geometry_pct.points: [{x, y}]` (object array)
   - Backend only accepts `type: 'polygon'` (không có `rect`)
   - Fix `CanvasEditor.tsx`: thêm `toApiGeometry()` helper — convert `rect` → polygon 4 điểm, convert `[x,y]` → `{x,y}` trước khi POST /zones.
   - Fix `canvasStore.ts`: thêm `normalizeGeometry()` + `normalizeZone()` + `normalizeMark()` — khi nhận data từ API convert `{x,y}` → `[x,y]` để PolygonLayer render đúng. Apply trong `fetchZonesAndMarks`, `syncSince`, `addZone`, `updateZone`.

4. **TileLayer URL format sai**
   - Frontend dùng: `/api/v1/layers/{id}/tiles/0_x_y.jpg` (underscore + .jpg)
   - Backend route: `/api/v1/layers/{layer}/tiles/{z}/{x}/{y}` (slash-separated, backend tự ghép filename)
   - Fix: `TileLayer.tsx` đổi URL sang `/api/v1/layers/${layerId}/tiles/0/${x}/${y}`.

5. **Tile endpoint 401 vì `<img>` tag không gửi Bearer token**
   - Root cause: tile route nằm trong `auth:sanctum` middleware.
   - Fix backend `routes/api.php`: chuyển tile route ra ngoài auth group (public route, không cần token).
   - Fix `LayerController@tile`: bỏ `$this->authorize('view', $layer)`.

6. **PDF file `layers/1/original.pdf` không tồn tại khi ProcessPdfJob chạy**
   - Root cause: Upload đầu tiên qua root app, sau đó root app không có `Storage::disk('local')` trỏ đúng → file bị mất. Khi chuyển sang backend, layer cũ không có PDF.
   - Fix: Xóa layer cũ, upload lại PDF qua backend đúng.

7. **`PATCH /zones/{id}/status` không nhận `completion_pct`, `notes`, `deadline`**
   - Root cause: `TransitionZoneStatusRequest` chỉ validate `status` + `note`.
   - Fix backend: Thêm `completion_pct`, `notes`, `deadline` vào `TransitionZoneStatusRequest.rules()`. Cập nhật `ZoneController::status()` để pass các field mới. Cập nhật `ZoneService::transitionStatus()` signature + logic.
   - Fix frontend `CanvasEditor.tsx` `ZoneDetailPanel.save()`: khi `status === zone.status` (không đổi) → dùng `PUT /zones/{id}` thay `PATCH /status` (tránh INVALID_STATE_TRANSITION).

---

**Files changed (session này):**

| File | Thay đổi |
|---|---|
| `frontend/src/pages/ProjectList.tsx` | **rewrite** — thêm `isAdmin` guard, `CreateProjectModal` full (POST /projects) |
| `frontend/src/stores/canvasStore.ts` | + `normalizeGeometry/normalizeZone/normalizeMark` — convert API `{x,y}` → `[x,y]` tại tất cả entry points |
| `frontend/src/pages/CanvasEditor.tsx` | + `toApiGeometry()` (rect→polygon + [x,y]→{x,y}), fix `save()` — dùng PUT khi status không đổi |
| `frontend/src/components/canvas/TileLayer.tsx` | URL `/tiles/0_x_y.jpg` → `/tiles/0/x/y` |
| `backend/routes/api.php` | Tile route chuyển ra ngoài auth group (public) |
| `backend/app/Http/Controllers/Api/LayerController.php` | `tile()` bỏ authorize |
| `backend/app/Http/Requests/TransitionZoneStatusRequest.php` | + `completion_pct`, `notes`, `deadline` |
| `backend/app/Http/Controllers/Api/ZoneController.php` | Pass `completion_pct`/`notes`/`deadline` vào service |
| `backend/app/Services/ZoneService.php` | `transitionStatus()` nhận + apply `completion_pct`, `notes`, `deadline` |
| `backend/.env` | + `ADMIN_PASSWORD=Admin@2026` |
| `start-wsl.sh` | **rewrite** — `BACKEND_DIR=./backend`, tất cả artisan chạy từ `backend/`, admin seed bằng tinker |

---

**Decisions quan trọng:**

- **`normalizeGeometry` ở store level, không phải PolygonLayer**: Đảm bảo data luôn nhất quán trong store. Mọi consumer (PolygonLayer, CanvasProgress, ZoneDetailPanel) đều nhận `[x,y][]` đúng format.
- **`toApiGeometry` ở CanvasEditor**: Chỉ convert khi gửi lên API. Internal store luôn dùng `[x,y][]` để không break PolygonLayer render.
- **Tile route public**: Tile images cần load trong `<img>` tag (không thể gửi Bearer). Tiles không chứa sensitive data (chỉ là ảnh bản vẽ) → OK để public.
- **PUT khi status không đổi**: Tách rõ 2 use cases — state transition (PATCH /status) vs field update (PUT /zones/{id}). Tránh lỗi INVALID_STATE_TRANSITION khi user chỉ muốn sửa notes/pct.

**Fails đã xử lý:**

- Phát hiện backend root có `app/Jobs/` directory missing → ProcessPdfJob class not found → incomplete class serialization error trong queue. Root cause: toàn bộ backend Sprint 2+3 nằm trong `./backend/` subdirectory.
- PDF test 328 bytes (minimal PDF) bị reject bởi pdf_processor.py (empty content) → tạo PDF có content thực sự mới xử lý được.
- Tiles được generate vào `storage/app/private/layers/` nhưng tile controller dùng `Storage::disk('local')->path()` trả đúng `private/` path → hoạt động.

**Tool kia cần biết:**

- **Backend thực tế**: `/var/www/tiendo/backend/` — toàn bộ Sprint 1+2+3. Root `/var/www/tiendo/` chỉ có Auth + Project cơ bản (reference implementation).
- **start-wsl.sh đã fix**: Chạy artisan từ `./backend/`, tự seed admin bằng tinker.
- **Tile URL**: `/api/v1/layers/{id}/tiles/{z}/{x}/{y}` — public route, không cần Bearer.
- **geometry_pct format**: Backend lưu và trả `{type: "polygon", points: [{x,y}]}`. Frontend normalize sang `[x,y][]` khi nhận. Frontend convert ngược `{x,y}` khi gửi.
- **Zone status vs field update**: PATCH /status khi đổi status, PUT /zones/{id} khi chỉ update pct/notes/deadline.

---

### Session: WSL Dev Environment Setup + Migration Fix

**Tasks hoàn thành (theo thứ tự):**

1. **Tạo `start-wsl.sh`** — Script khởi động toàn bộ hệ thống trên WSL: start PostgreSQL (sudo), kiểm tra/tạo DB nếu chưa có, chạy `migrate`, `storage:link`, khởi động queue worker (nohup + pid file) và `php artisan serve` port 8000. Hỗ trợ mode `stop` để kill tất cả process theo pid file.

2. **Thêm Vite proxy** vào `frontend/vite.config.ts` — `/api/*` và `/storage/*` forward sang `http://localhost:8000` để frontend dev server (port 5173) gọi được API Laravel mà không bị CORS, không cần Nginx trong dev.

3. **Fix migration trùng lặp** — Phát hiện 2 bộ migration song song: `2026_03_19_1000xx` (cũ, 13 files) và `2026_03_19_1200xx` (mới hơn, 13 files). Bộ mới khác biệt quan trọng: `code` có `.unique()` trực tiếp thay `$table->unique('code')`, FK `created_by` có `.constrained('users')` rõ ràng, thêm `index('created_by')`. Xóa bộ cũ `1000xx`, giữ lại bộ `1200xx`.

4. **Fix `personal_access_tokens` duplicate table** — Bảng đã tồn tại trong DB (từ lần chạy migration cũ) nhưng migration table không ghi nhận → `migrate --force` fail 42P07. Thử `tinker` insert record vào `migrations` table thủ công nhưng sau đó các bảng khác cũng gặp cùng vấn đề. Giải pháp cuối: `migrate:fresh --force` — drop toàn bộ + recreate sạch → **17/17 migration DONE**.

5. **Thêm `ADMIN_PASSWORD=Admin@2026` vào `.env`** + re-seed `AdminUserSeeder` → admin user sẵn sàng với password chuẩn.

6. **Verify end-to-end**: `curl POST /api/v1/auth/login` trả token → API hoạt động. `npm run dev` (Vite 8.0) ready tại port 5173.

---

**Files changed (session này):**

| File | Thay đổi |
|---|---|
| `start-wsl.sh` | **new** — WSL dev startup script (PostgreSQL + migrate + queue + serve + pid management) |
| `frontend/vite.config.ts` | + `server.proxy` cho `/api` và `/storage` → `http://localhost:8000` |
| `database/migrations/2026_03_19_1000{01..13}_*.php` | **deleted** — bộ migration cũ trùng lặp |
| `.env` | + `ADMIN_PASSWORD=Admin@2026` |

---

**Decisions quan trọng:**

- **Chọn `php artisan serve` thay Nginx**: WSL dev không cần Nginx (chưa cài). `artisan serve` đủ cho dev + Vite proxy xử lý CORS. Nginx chỉ cần khi deploy VPS thật.
- **Giữ bộ `1200xx` thay `1000xx`**: Bộ mới có schema chuẩn hơn (unique inline, FK explicit). Nếu giữ bộ cũ sẽ phải patch schema sau.
- **`migrate:fresh` thay manual fix**: Thử mark migration bằng tinker nhưng sau đó các bảng kế tiếp cũng bị conflict. `migrate:fresh` sạch hơn, không có data thật cần bảo vệ.
- **Pid file trong `.dev-pids/`**: Lưu pid để `stop` mode có thể kill chính xác process mà không dùng `pkill` (có thể kill nhầm process khác cùng tên).

**Fails đã xử lý:**

- `sudo service postgresql start` fail trong script vì shell tool không có TTY → không thể dùng heredoc sudo. Script vẫn cần user gõ password thủ công trong terminal WSL (expected behavior).
- `pg_ctlcluster 14 main start` fail: `must run as cluster owner (postgres) or root` → không dùng được, quay về `sudo service postgresql start`.
- `php artisan tinker --execute` insert migration record → chạy được nhưng không đủ: bảng `projects` cũng đã tồn tại từ lần run cũ → chọn `migrate:fresh`.
- Login test với `Admin@2026` fail (Invalid credentials) vì seeder dùng `env('ADMIN_PASSWORD')` không có trong `.env` → fallback `'admin'`. Fix bằng cách thêm `ADMIN_PASSWORD` vào `.env` và re-seed.

**Tool kia cần biết:**

- **WSL dev flow**: (1) `bash /var/www/tiendo/start-wsl.sh` → (2) terminal mới: `cd frontend && npm run dev` → mở http://localhost:5173. Mỗi lần restart WSL phải chạy lại vì không có systemd.
- **Migration hiện tại**: 17 migrations, tất cả DONE. Bộ `1000xx` đã xóa. Chỉ còn `0001_*` (3 files) + `093131_personal_access_tokens` + `1200xx` (13 files).
- **Admin account**: `admin@tiendo.vn` / `Admin@2026`. Được seed qua `AdminUserSeeder`, đọc `ADMIN_PASSWORD` từ `.env`.
- **Vite proxy**: `/api/*` → `:8000` trong dev. Khi build prod (`npm run build`), frontend được serve bởi Laravel (hoặc Nginx) nên không cần proxy.
- **Nginx chưa cài trên WSL** — không cần cho dev. Deploy VPS thật mới cần theo `deploy/nginx.conf`.

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
| chore: wsl-dev-setup | WSL dev environment: tạo `start-wsl.sh` (PostgreSQL + queue + artisan serve + pid management), thêm Vite proxy (`/api` → :8000). Fix migration trùng lặp (xóa bộ 1000xx, giữ 1200xx), `migrate:fresh` → 17/17 DONE. Thêm `ADMIN_PASSWORD` vào `.env`, re-seed admin. Verified: API login OK + Vite dev server OK. | Không có — hệ thống WSL sẵn sàng để phát triển và test |
| fix: e2e-sprint1-bugs | 7 bugs fixed: (1) ProjectList thiếu nút "Tạo dự án" → thêm CreateProjectModal; (2) start-wsl.sh chạy wrong Laravel dir → fix dùng `./backend/`; (3) geometry_pct format mismatch `[x,y]` vs `{x,y}` → normalizeGeometry ở store + toApiGeometry ở CanvasEditor; (4) TileLayer URL sai `0_x_y.jpg` → `/0/x/y`; (5) Tile 401 vì img tag → move tile route ra public; (6) PATCH /status thiếu completion_pct → fix backend + frontend smart PUT/PATCH; (7) backend admin seed → tinker trực tiếp. Build 0 lỗi. | Full E2E flow verified qua API: login → tạo project → ML → upload PDF → ready → zone → status amber |
| fix: sprint2-3-ui-bugs | 6 fixes: (1) CommentsTab: thêm PM delete permission + 10MB/file validation + reset list khi đổi zone; (2) HistoryTab: fix canRollback chỉ check admin → dùng isPM prop, thêm fetchZonesAndMarks(layerId) sau rollback, reset list khi đổi zone; (3) ZoneDetailPanel: truyền layerId + isPM xuống tabs; (4) backend move GET /comments/{id}/images/{filename} ra ngoài auth middleware (như tiles) + remove authorize('viewImage'); (5) SettingsTab export: thay `<a href>` bằng Axios blob download (auth header được gửi đúng); (6) ExcelImportModal: gọi fetchZonesAndMarks(layerId) khi đóng sau apply. Lint 0 error, build 0 error. | — |
| fix: stats-field-name-mismatch | Bug "undefined%": backend trả `progress_pct`/`completed`/`in_progress`/`delayed`/`paused`/`not_started` nhưng frontend type dùng `completion_pct`/`done_zones`/`in_progress_zones`/`delayed_zones`/`paused_zones`/`not_started_zones`. Fix: cập nhật `ProjectStats` type + tất cả `project.stats.*` references để match đúng field name từ `ProjectDashboardRepository`. Thêm `Math.round()` cho `progress_pct`. Lint 0 error, build 0 error. Verified: CommentsTab/HistoryTab/Notifications/AppShell bell badge đều đã implement đầy đủ. | — |
| feat: anh-duong-brand-design | Apply Ánh Dương brand tokens (SPEC §16): (1) index.css: --primary=24 100% 58% (#FF7F29 orange), --primary-foreground=white, Inter font import, brand CSS vars; (2) tailwind.config: thêm brand.{DEFAULT,hover,light} colors; (3) AppShell: header bg-[#FF7F29] + white text, nav links white/80 inactive, logout border-white/40, mobile menu bg-[#E5691D]; (4) Login: logo text-[#FF7F29] font-bold centered, card shadow-lg; (5) ProjectList: code badge bg-[#FFF3E8] text-[#FF7F29] rounded-full, card hover border-[#FF7F29]; (6) ProjectDetail: Stat component bg-[#F8FAFC] highlight prop cho Tiến độ text-[#FF7F29], fix completion_pct ?? 0 bug, TabButton → underline style border-b-2 border-[#FF7F29], project code badge orange, layer card bg-[#F8FAFC]; (7) CanvasEditor: zone selected border-l-2 border-[#FF7F29] bg-[#FFF3E8], tab active border-[#FF7F29] text-[#FF7F29], Lưu button bg-[#FF7F29]. Lint 0 error, build 0 error. | — |
| fix: p1-bugs-6 | **Fix 6 P1 bugs chặn sử dụng**: (B1) `CanvasProgress.StatusPopup`: `PATCH /zones/{id}` → 405 → đổi sang `PUT /zones/{id}` với `name + completion_pct`; (B2) `CanvasProgress.handleMarkDrawn`: geometry_pct gửi `[x,y][]` tuple → 422 → thêm `toApiGeometry()` convert sang `{x,y}[]` trước khi POST; (B3) `ShareView.tsx`: `flatMap` của `master_layers/layers` có thể là undefined → thêm `?? []` guard cho cả 2 chỗ, bonus fix tile URL từ `0_x_y.jpg` → `0/x/y`; (B4) `ExcelImportModal`: `applyResult.errors` từ API có thể null → `(applyResult.errors ?? []).length` và `.map()`; (B5) `CommentsTab`: image URL duplicate path `comments/2/uuid.png` → fix dùng `img.split('/').pop()` lấy chỉ filename; (B6) Backend `StoreZoneCommentRequest`: `content` required → nullable + `withValidator` yêu cầu có content OR images; thêm migration `make_zone_comments_content_nullable` (`php artisan migrate` DONE). Lint 0 error, build 0 error. | — |
| fix: shareview-fabric-covers-tiles | **Fix ShareView Fabric canvas che tiles**: Khi Fabric.js khởi tạo, nó wrap `<canvas>` với `.canvas-container` có `position: relative` và có thể set `backgroundColor` trắng → che hết tiles bên dưới. Fix: (1) Tách tiles vào div riêng `position: absolute, inset: 0` làm sibling với `<canvas>` trong containerRef — đúng pattern của `CanvasView`/`TileLayer`; (2) Set `fc.backgroundColor = ''` ngay sau `new fabric.Canvas()` để đảm bảo canvas trong suốt; (3) Đổi `outerRef` ra div ngoài cùng (thay vì `containerRef.current.parentElement`) để wheel event attach đúng phần tử. Lint 0 error, build 0 error. | — |
| fix: shareview-auth-block | **Fix ShareView bị block bởi authStore loading**: `App.tsx` — khi `loading=true`, toàn bộ app return loading div → `/share/:token` không mount được. Fix: `const isShareRoute = window.location.pathname.startsWith('/share/')` → nếu `loading && !isShareRoute` mới block; share routes render ngay lập tức không cần chờ auth init. Đồng thời revert `fabricReady` state trong `ShareCanvas` (gây lint error `react-hooks/set-state-in-effect`, và cũng không cần thiết sau khi App.tsx được fix). Lint 0 error, build 0 error. | — |
| fix: shareview-canvas-blank | **Fix ShareView canvas trắng**: `canRender` guard thêm điều kiện `width_px > 0 && height_px > 0`; truyền `selectedLayer!.width_px!` / `selectedLayer!.height_px!` / `selectedLayer!.id` trực tiếp (không dùng fallback 2480/3508 có thể mask lỗi); layer selector hiện khi `length > 0` (trước chỉ hiện khi `> 1`). Lint 0 warning, build 0 error. | — |
| fix: shareview-data-structure | **Fix ShareView sai data structure + sai endpoint**: API `/share/{token}` trả `data.layers[]` (flat) KHÔNG phải `data.master_layers[].layers[]`; zones đã nhúng sẵn trong mỗi layer (không cần gọi thêm API). Đã sửa: (1) `ShareData` type: `share_link.{token,expires_at,role}` + `project` + `layers: ShareLayer[]`; (2) `ShareLayer` type: flat layer với `master_layer: {...}` và `zones: RawZone[]` (mỗi zone có `marks: RawMark[]`); (3) Xóa toàn bộ 2 `useEffect` gọi `/share/{token}/layers/{id}/zones` và `/share/{token}/zones/{id}/marks` (endpoint không tồn tại); (4) Thêm `normalizeGeometry/normalizeZone/normalizeMark` để convert `{x,y}[]` → `[x,y][]`; (5) `ShareCanvas` nhận `zones: Zone[]` + `marks: Mark[]` qua props thay vì tự fetch; (6) Layer selector: flat `shareData.layers.map()` thay vì `master_layers.map(ml => ml.layers.map(...))`; (7) Header: `shareData.share_link.role/expires_at` thay vì `shareData.role/expires_at`. Lint 0 warning, build 0 error. | — |
| feat: ui-redesign-full | **Redesign toàn bộ UI theo style direction "Bento Box + Soft UI + Flat Design"**. Dùng Lucide icons xuyên suốt. (1) **Login**: full-screen centered, radial gradient bg, icon T, rounded-2xl card, inputs với focus ring cam, button rounded-xl; (2) **AppShell**: Avatar circle với initials, Lucide Bell icon, h-14 header fixed, hamburger Lucide Menu/X, logout Lucide LogOut; (3) **ProjectList**: MapPin/Plus/FolderOpen/Building2 icons, skeleton loading, card rounded-2xl hover border-[#FF7F29], CreateProjectModal dùng inputCls với focus ring cam; (4) **ProjectDetail**: Stat component bento grid với icon (Layers/CheckCircle2/HardHat/AlertTriangle/PauseCircle/TrendingUp), project header với Building2 icon + MapPin, ChevronLeft back link, skeleton loading; (5) **CanvasEditor**: ChevronLeft breadcrumb, sidebar header với count badge rounded-full, zone items rounded-lg no border-b, filter chips border màu status tương ứng, legend và panels dùng rounded-xl + border-[#E2E8F0], ZoneDetailPanel header bg-[#F8FAFC], fieldCls với focus ring cam, Lưu button rounded-xl; (6) **CanvasToolbar**: Lucide MousePointer2/Pentagon/RectangleHorizontal, h-9 w-9 buttons rounded-lg, container rounded-xl; (7) **ZoomControls**: Lucide Minus/Plus/Maximize2, compact h-8 w-8 buttons, container rounded-xl; (8) **Notifications**: Lucide Bell/BellOff/CheckCheck/Clock icons, notification item icon-per-type, unread bg-[#FFF3E8] border-[#FF7F29]/30, empty state BellOff icon, "Đọc tất cả" button text-[#FF7F29]. Lint 0 error, build 0 error. | — |
| fix: e2e-test-bugs-round2 | **Fix 6 bugs từ E2E test (2026-03-17)**: (1) **Login error bị mất** — authStore.login() set loading:true → App.tsx unmount Login → setError() trên unmounted component bị bỏ qua → Fix: bỏ set({loading}) khỏi login(), Login.tsx dùng local loading state; (2) **CanvasView zones biến mất khi mở popup** — onZoneClick inline arrow tạo mới mỗi render → init effect [onZoneClick] re-run → canvas blank → Fix: useCallback stable reference CanvasView.tsx; (3) **Validation errors mơ hồ** — parseApiError chỉ đọc error.message → Fix: tạo shared src/lib/parseApiError.ts: VALIDATION_FAILED → join messages từ details; INVALID_STATE_TRANSITION → tiếng Việt; import trong 4 pages; (4) **Comment 6 ảnh** — silently slice(0,5) → Fix: check all.length > 5 → show error + reset input; (5) **Sort order tooltip** — placeholder cải thiện + title giải thích; (6) **Save feedback** — sau lưu: CanvasEditor hiện '✓ Đã lưu' 2.5s; CanvasProgress '✓ Đã lưu' 1.2s. Lint 0 error, build 0 error. | — |
| fix: validation-error-code + zone-modal-ui | **TEST 2.5 + 5.7**: (1) API Laravel trả `error.code: VALIDATION_ERROR` (không phải VALIDATION_FAILED) — `parseApiError` không gom `details` → user chỉ thấy "Validation failed." → Fix: xử lý cả `VALIDATION_ERROR` + helper `collectValidationMessages`; bỏ qua message generic "Validation failed." khi đã có details (VD: mã TM01 trùng → "Project code already exists."). (2) **ZoneCreateModal** — nền overlay `bg-[#0F172A]/55 backdrop-blur-sm`, `z-[9999]`, card trắng `rounded-2xl` + shadow + border; header `bg-[#F8FAFC]` + viền cam trái; input `fieldCls` brand focus ring; nút cam/outline; click-outside đóng modal; `role=dialog` + aria. Lint 0 error, build 0 error. | — |
| fix: zone-save-toast + invalid-transition-copy | **TEST 6.1 + 6.3**: (1) **Lưu zone** — "Đang lưu" biến mất quá nhanh + cần popup rõ ràng → `ZoneDetailPanel`: giữ loading tối thiểu 550ms sau API; toast thành công `createPortal` vào `document.body`, `z-[10050]`, card trắng + icon CheckCircle2 + 2 dòng mô tả, ~4.2s, `aria-live=polite`; cleanup timeout khi đổi zone/unmount. (2) **INVALID_STATE_TRANSITION** — câu tiếng Việt đầy đủ cho khách (không nhảy cóc trạng thái); nếu chuỗi kỹ thuật lọt trong `details` thì map sang cùng nội dung. Files: `parseApiError.ts`, `CanvasEditor.tsx`. Lint 0 error, build 0 error. | — |
| fix: comments-tab-multipart-images | **TEST 7.3 + 7.4**: (1) **Thumbnail 404 / URL sai** — `GET /comments/{id}/images/{filename}` chỉ khớp **một** segment; nếu ghép `comments/2/uuid.png` vào path thì route lệch → 404 NOT_FOUND. Fix: `commentImageBasename()` lấy tên file cuối + `encodeURIComponent` cho segment; key React `c.id + img`. (2) **Chỉ ảnh → Validation failed** — gửi `FormData` với `headers: { 'Content-Type': 'multipart/form-data' }` **không có boundary** → Laravel không nhận file → chỉ lưu text / lỗi validation. Fix: **bỏ** header, để axios/browser gắn boundary. (3) **6 ảnh** — thống nhất `MAX_IMAGES_PER_COMMENT = 5`, lỗi "Tối đa 5 ảnh mỗi bình luận.", reset `files` + input khi quá 5; disable nút Gửi khi `files.length > 5`. Bonus: `ProjectDetail` Excel import + upload PDF — bỏ cùng header multipart. Lint 0 error, build 0 error. | — |
| docs: session-log-2026-03-20-comments | **SESSION-LOG**: thêm mục **Current Session** (task TEST 7.3/7.4, files, approach, decisions, fail, context cho Claude Web); 1 dòng tóm tắt = fix comments multipart + URL basename + không set Content-Type FormData + cap 5 ảnh + sync PROJECT-STATUS. | — |
| ux: document-title-per-route | **Tab trình duyệt theo route**: `index.html` mặc định **TienDo**; `src/lib/documentTitle.ts` — `titleForPathname()` + `DocumentTitleSync` trong `App.tsx` (`useLocation` → `document.title`: Đăng nhập / Dự án / Chi tiết dự án / Soạn bản vẽ / Tiến độ / Xem bản vẽ / Thông báo / Người dùng / Xem chia sẻ). Không dùng react-helmet; regex pathname từ cụ thể → chung. Lint 0 error. | — |
| feat: canvas-pdf-export | **Xuất PDF bản vẽ client-side**: `jspdf` + `canvasPdfExport.ts` (tiles + `fabric.toDataURL`); `PolygonLayer`/`MarkDrawCanvas`/`ReadOnlyCanvas` ref `getFabric()`; `ExportMarqueeOverlay` chọn vùng. **CanvasEditor** + **CanvasView**: PM/admin — PDF toàn bộ + PDF vùng chọn. **CanvasProgress**: chỉ **field_team** — PDF giữ zone không giao mờ. Lint + build 0 error. | — |
