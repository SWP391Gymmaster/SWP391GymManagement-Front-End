# Class Sessions and Attendance Implementation Plan

**Goal:** Tạo lớp rồi quản lý lộ trình riêng, tạo/import nhiều buổi, chuyển coach có kiểm soát và điểm danh cho member.

**Architecture:** Giữ GymClass và Schedule hiện có. Batch Schedule gọi chung validation trong một transaction. Attendance gắn schedule và member đã đăng ký lớp; API theo role bảo vệ roster và thông báo.

**Tech Stack:** Spring Boot/JPA, React/Vite, CSV UTF-8, JUnit và Node test.

**Spec:** `docs/class-sessions-attendance-spec.md`

## Tasks

- [x] Backend: batch schedule atomic, khóa đổi coach trong sửa thường, endpoint chuyển coach; test validation.
- [x] Backend: lưu điểm danh, coach roster/ghi, member thông báo; test quyền và cập nhật.
- [x] Frontend: mã lớp tự nhập, trang chi tiết riêng, tổng số buổi và chuyển sang chi tiết sau tạo.
- [x] Frontend: thời lượng, tạo buổi lặp, import CSV có preview; test parser/generator.
- [x] Frontend: coach roster và điểm danh, member thông báo; chạy test khả dụng.
