# Class Registration Implementation Plan

**Goal:** Chỉ đăng ký lớp, áp dụng hạn chót và không trùng lịch, hiện lộ trình cho hội viên.

**Architecture:** `class_registrations` là nguồn quyền tham gia và sĩ số. `schedules` cung cấp các buổi và mô tả. Backend thực thi hạn và trùng lịch, frontend hiển thị lịch suy ra từ đăng ký lớp.

**Tech Stack:** Java 21/Spring Data JPA, React/Vite, JUnit và Node test.

**Spec:** `docs/class-registration-spec.md`

## Tasks

- [x] Backend: sửa điều kiện hạn đăng ký, dùng khóa hội viên khi đăng ký, kiểm tra trùng buổi giữa các lớp và khi quản lý đổi lịch. Thêm test biên thời gian và trùng lịch.
- [x] Backend: ngừng API ghi đăng ký buổi; sĩ số buổi lấy từ đăng ký lớp. Giữ dữ liệu buổi cũ. Cập nhật test API/service bị ảnh hưởng.
- [x] Frontend: sửa trạng thái catalog, form hạn, bỏ nút đăng ký buổi; lịch member lấy từ lớp đã đăng ký và hiện mô tả. Cập nhật test.
- [x] Tạo CSV mẫu lộ trình.
- [ ] Chạy frontend lint/build khi có npm và dependencies trong môi trường.
