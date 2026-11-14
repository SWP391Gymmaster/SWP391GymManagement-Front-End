# Đăng ký lớp và lộ trình

## Quy tắc

- Hội viên đăng ký **lớp** một lần. Mọi buổi trong lịch của lớp thuộc lịch cá nhân của hội viên đã đăng ký; không có thao tác đăng ký/hủy từng buổi.
- `registrationCloseAt` là hạn chót duy nhất. Tại thời điểm bằng hoặc sau hạn, API từ chối đăng ký mới. Quản lý có thể sửa hạn đến một thời điểm tương lai, trước ngày bắt đầu lớp. Mốc mở đăng ký cũ không còn được áp dụng; lớp cũ không có hạn tiếp tục dùng ngày bắt đầu lớp làm giới hạn.
- Một hội viên không thể đăng ký lớp nếu bất kỳ buổi nào của lớp giao giờ với buổi thuộc lớp họ đã đăng ký. Hai khoảng `[start, end)` tiếp giáp được phép. Thêm/sửa buổi sau khi đã có người đăng ký cũng không được tạo xung đột.
- Danh sách/lộ trình của hội viên chỉ gồm các lớp họ đã đăng ký, kèm thời gian, phòng, HLV và mô tả từng buổi. Danh sách lớp công khai vẫn xem được để quyết định đăng ký; tư cách tham gia được xác định bằng đăng ký lớp. Repository hiện chưa có điểm danh/check-in nên chưa có cổng xác nhận hiện diện tại phòng tập.
- Giữ bảng `class_enrollments` cũ để bảo toàn lịch sử, ngừng ghi bản ghi mới. Lịch cá nhân mới đọc từ `class_registrations` và `schedules`.
- File mẫu CSV lộ trình dùng các cột `classCode,startTime,endTime,roomCode,coachEmail,description`; đây là mẫu chuẩn bị dữ liệu, chưa tự động nhập vào hệ thống.

Ví dụ một dòng dữ liệu: `CLS-YOGA-001,2026-12-01T09:00:00,2026-12-01T10:00:00,ROOM-YOGA-01,coach@example.com,Khởi động và tư thế cơ bản`. Mã lớp, phòng và email huấn luyện viên phải khớp dữ liệu thật trước khi dùng.

## Kiểm chứng

- Đăng ký đúng hạn, hết hạn, gia hạn; đầy lớp và trùng lớp.
- Trùng giờ giữa hai lớp, giờ tiếp giáp, thêm/sửa buổi gây trùng.
- Member chỉ đăng ký lớp, thấy toàn bộ buổi và mô tả; không có nút hay API ghi đăng ký buổi.
