# Báo cáo chạy kiểm thử E2E — 13/11/2026 (sau sửa P0/P1)

## Phạm vi và môi trường

- Backend Spring Boot chạy cổng `18080`, frontend Vite cổng `15173`, MySQL 8.0.44 với database riêng `swp391_e2e_20261113`.
- Runner chỉ chấp nhận tên DB `swp391_e2e_*`, reset/seed dữ liệu test trước bộ API và trước bộ browser. DB làm việc `swp391_group3` không bị dùng trong lượt chạy này.
- Tám tài khoản test đã xác minh: admin, manager, hai coach, ba member, receptionist. Mật khẩu chỉ dùng cho fixture là `password123`.
- Không kiểm thử PayOS, đăng ký tài khoản/gửi email, Cloudinary thật theo phạm vi đã thống nhất. Thanh toán tiền mặt và xác nhận bank transfer nội bộ có trong bộ test.

## Kết quả

| Bộ kiểm thử | Kết quả | Ghi chú |
|---|---:|---|
| API E2E + đối chiếu MySQL | 20/20 đạt | Node ghi 21 pass vì có thêm một test cha |
| Browser E2E (Playwright Chromium) | 7/7 đạt | Bao gồm báo cáo manager với phiên đăng nhập hiện tại |
| Đồng thời | 3/3 đạt | Tranh ghế cuối; đăng ký trùng; hai nhân viên xác nhận cùng payment |
| Backend `mvnw.cmd test -q` | 87/87 đạt | Chạy riêng sau khi dừng API server; lượt đầu gặp lỗi Mockito attach khi chạy đồng thời, lượt sau phát hiện một kỳ vọng test cũ cần cập nhật |
| Frontend `npm test` | 87/87 đạt | Unit/Node tests hiện có |
| Frontend `npm run test:api` | Đạt | API contract tests hiện có |
| Frontend `npm run test:payments` | Đạt | Mock payment/invoice, quyền và ranh giới ngày |
| Frontend `npm run test:public` | Đạt | Mock đăng ký/xác minh email; không gửi mail thật |
| Frontend `npm run test:mockapi` | Đạt | CRUD gói qua mock Axios/fetch; in 404 cho các endpoint legacy nhưng script exit 0 |
| Frontend `npm run build` | Đạt | Vite production build |
| ESLint scripts E2E mới | Đạt | Chỉ kiểm tra ba file E2E mới |
| Frontend `npm run lint` toàn repo | Không đạt | 18 errors, 2 warnings trong source hiện tại; ba trang receptionist lỗi parse, `manager/Classes.jsx` có tên chưa định nghĩa |

`npm run test:e2e` trả exit code `0` sau khi sửa. Trước khi sửa, 4 nhóm API và 1 luồng browser fail đúng như mô tả bên dưới.
Lượt chạy cuối có thêm kiểm tra browser rằng lớp chưa đến giờ mở hiển thị `Chưa mở đăng ký` và không có nút đăng ký. Một lượt browser trước đó timeout khi tìm ô Email ở lần mở trang đầu; chạy lại pass 7/7, chưa xác định nguyên nhân vì không tái hiện. Test hiện ghi URL và nội dung trang nếu lỗi lặp lại.
Lệnh lint toàn repo trả exit code `1`; chi tiết tại `src/api/client.js`, `src/pages/admin/{AdminDashboard,StaffManagement}.jsx`, `src/pages/manager/Classes.jsx` và ba trang `src/pages/receptionist/{CounterRegister,Invoices,MemberSearch}.jsx`. Build thành công không chứng minh các trang này hoạt động.

## Lỗi phát hiện và đã sửa

### P0-01 — Xóa buổi duy nhất khiến lớp đã đăng ký không có buổi: đã sửa

1. Tạo lớp và một buổi, cấp gói hợp lệ, đăng ký member vào lớp.
2. Manager gọi `DELETE /api/schedules/{id}`.
3. Thực tế: HTTP `204`; MySQL còn một `class_registrations` và không còn `schedules` cho lớp. Mong đợi: từ chối thao tác hoặc xử lý registration nhất quán theo một quy tắc được chốt.

`ScheduleService.delete` kiểm tra đăng ký theo buổi cũ và attendance, nhưng thiếu kiểm tra `class_registrations`. Ảnh hưởng trực tiếp tới lộ trình, quyền tham gia và dữ liệu đăng ký.
Sau sửa: API trả `400`, buổi và registration còn nguyên trong DB. Service test chặn xóa buổi cuối.

### P0-02 — Đăng ký được trước thời điểm mở: đã sửa

1. Tạo lớp với `registrationOpenAt` trong tương lai và `registrationCloseAt` hợp lệ; thêm buổi, cấp gói.
2. Member đăng ký ngay.
3. Thực tế: HTTP `201`, DB có registration. Mong đợi: từ chối trước giờ mở.

`GymClass.acceptsRegistrationAt` kiểm tra hạn đóng nhưng không xét hạn mở. Đây là lỗi ở ranh giới API, không chỉ ở giao diện.
Sau sửa: API trả `400`; test kiểm tra ngay trước giờ mở, đúng giờ mở và đúng hạn đóng.
Catalog hiện nhãn `Chưa mở đăng ký` và không cho bấm đăng ký trước giờ mở; frontend unit test và browser E2E đều xác nhận.

### P0-03 — Dời buổi ra sau ngày hết hạn gói của member đã đăng ký: đã sửa

1. Member có gói 90 ngày đăng ký lớp với buổi trong hạn.
2. Manager dời buổi sang ngày thứ 95.
3. Thực tế: HTTP `200`, lịch mới lưu vào DB. Member vẫn đăng ký nhưng gói không còn phủ buổi học. Mong đợi: chặn thay đổi hoặc có quy trình xử lý quyền lợi member.

`ScheduleService.update` kiểm tra phòng, coach, trùng giờ nhưng không đối soát quyền gói của các member đã đăng ký.
Sau sửa: API trả `400`, thời gian buổi giữ nguyên. Khi thêm/dời buổi, service kiểm tra ngày cuối của lộ trình sau thay đổi với gói của từng member đã đăng ký.

### P0-04 — Đổi bộ môn lớp làm mất quyền của member đã đăng ký: đã sửa

1. Member với gói chỉ có Gym đăng ký lớp Gym.
2. Manager đổi bộ môn lớp thành Yoga, với coach/phòng hợp lệ.
3. Thực tế: HTTP `200`, lớp thành Yoga trong khi registration giữ nguyên. Mong đợi: chặn thay đổi hoặc xử lý lại registration/quyền lợi theo quy tắc nghiệp vụ.

`GymClassService.update` kiểm tra coach/phòng nhưng chưa đối soát bộ môn với gói của các member đã đăng ký.
Sau sửa: API trả `400`, bộ môn lớp giữ nguyên. Service kiểm tra quyền gói của member trước khi lưu bộ môn mới.

### P1-01 — Báo cáo manager báo hết phiên dù vừa đăng nhập: đã sửa

1. Đăng nhập qua form bằng manager, mở trang Báo cáo.
2. Thực tế: trang hiện `Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại` và không tải dữ liệu.
3. `Reports.jsx` gọi `src/api/services.js` dùng phiên `gm-session` trong localStorage, trong khi luồng đăng nhập hiện tại lưu `gymmaster-api-session-v1` trong sessionStorage qua `backendStore.js`. Các phần khác trong phiên vẫn hoạt động.

Sau sửa: API client đọc cùng key và storage với luồng đăng nhập; Playwright mở được báo cáo sau khi đăng nhập manager.

## Những ràng buộc đã qua E2E

- Vai trò/đăng nhập và quyền API cơ bản; tạo/xem gói, phòng, lớp, buổi; mã và tên trùng; giao dịch khóa sửa/xóa gói; phòng sai bộ môn hoặc thiếu sức chứa; lớp không kèm lộ trình; batch buổi lỗi rollback.
- Thu tiền mặt sinh payment, invoice, membership và quyền xem theo member; quote gia hạn; đăng ký lớp, chống đăng ký trùng/trùng giờ; hủy; danh sách member của coach; điểm danh và thông báo đọc/chưa đọc.
- MySQL unique và số bản ghi sau mutation được đối chiếu trong các case tương ứng; ba race đồng thời ở bảng trên không tạo bản ghi trùng hay vượt ghế.

## Phạm vi còn cần chạy sâu hơn

Ma trận chi tiết ở [e2e-test-matrix.md](./e2e-test-matrix.md). Những ô `P` chưa được chứng minh bằng automation trong lượt này, nhất là JWT hết hạn/khóa giữa phiên; chuẩn hóa và validation đầy đủ của user; biên ngày/giờ mở, đóng và hủy đăng ký; chuyển coach sau điểm danh; thêm/dời buổi gây trùng lịch giữa các lớp của cùng member; race điểm danh và thu tiền mới đồng thời; rollback khi lỗi ở giữa invoice/payment/membership; đối soát số liệu báo cáo sau khi sửa lỗi phiên. Các case này không được tính là pass.

## Chạy lại

1. Start backend với `SPRING_DATASOURCE_URL` trỏ đúng DB test và `SERVER_PORT=18080`; start Vite cổng `15173` với `BACKEND_URL=http://127.0.0.1:18080`.
2. Đặt `MYSQL_PWD` trong môi trường local. Từ frontend chạy `npm run test:e2e`. Runner tự reset/seed DB riêng trước mỗi bộ; dữ liệu sau lượt browser được giữ để điều tra.
3. Sau khi xử lý từng lỗi mới, chạy lại toàn bộ E2E và đối chiếu DB. Không chạy reset SQL trên DB làm việc.

Không commit code trong lượt kiểm thử này.
