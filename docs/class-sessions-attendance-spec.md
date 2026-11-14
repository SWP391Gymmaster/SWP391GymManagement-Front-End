# Lớp, buổi học và điểm danh

- Quản lý nhập mã lớp thủ công. Tạo lớp chỉ lưu thông tin lớp; sau khi lưu, giao diện mở trang chi tiết lớp. Lộ trình nằm ở mô tả từng buổi.
- Trang chi tiết lớp có thông tin lớp, tổng số buổi, danh sách buổi và các thao tác quản lý. Không dùng modal chi tiết.
- Tạo buổi đơn có thời lượng tính bằng phút. Tạo nhiều buổi theo ngày bắt đầu, khoảng cách ngày, thời lượng và số lần. Nhập CSV theo `classCode,startTime,endTime,roomCode,coachEmail,description`; xem trước và gửi cả lô trong một giao dịch. Lỗi một dòng thì không lưu dòng nào.
- Huấn luyện viên của buổi mặc định theo lớp và chỉ đọc trong form sửa buổi. Quản lý dùng thao tác Chuyển HLV riêng; backend kiểm tra người nhận dạy đúng môn và không trùng giờ. Coach không có quyền sửa buổi.
- Coach chỉ xem danh sách hội viên đã đăng ký lớp của buổi mình dạy và điểm danh từng người. Member xem thông báo điểm danh trong ứng dụng, gắn với buổi học và trạng thái có mặt/vắng mặt. Không có gửi email/SMS.

## Kiểm tra

- Mã tự nhập được giữ khi đổi môn; trùng mã bị chặn.
- Tạo buổi hàng loạt rollback khi một buổi sai; nhập CSV có dấu phẩy trong mô tả và mã phòng/coach không hợp lệ bị chặn.
- Không đổi HLV qua PUT buổi thường; chuyển HLV hợp lệ và từ chối chuyển khi trùng lịch.
- Coach khác không xem hoặc ghi điểm danh; member khác không xem thông báo.
