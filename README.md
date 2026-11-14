## FE1 Auth & Public update (2026-10-18)

Open `/#/home`, `/#/register`, and `/#/login` while logged out; email links open `/verify-email?token=...`. The public home describes Gym, Yoga and Boxing without loading or showing the class list. Visitors must sign in to see classes and schedules. Registration creates an account only and does not start a session or open package checkout.

Registration shows instructions to check email. BE sends a single-use verification link; FE submits its token to `/auth/verify-email`. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `MAIL_FROM`, and `FRONTEND_BASE_URL` in the backend environment (use a Gmail App Password for `SMTP_PASSWORD`). Authenticated class data uses the existing protected role pages and APIs. See [FE1 API handoff](docs/FE1_API_HANDOFF.md), [QA checklist](docs/QA_CHECKLIST.md), [task list 1](docs/FE1_TASK_LIST_IMPLEMENTATION.md), [task list 2](docs/FE1_TASK_LIST_HANDOFF.md) and [review notes](docs/FE1_REVIEW_NOTES.md). Existing Spring REST architecture remains; no Thymeleaf controllers were added.

Run `npm run test:public` for offline contract checks. Browser fixtures mock verification-link responses and do not verify real email delivery. No auto-login token from registration is stored.

# GymMaster Front-End

React + Vite. FE mặc định dùng API Spring Boot trong `D:/SWP391_Test/Back-End`; không dùng dữ liệu demo để đăng nhập hoặc xử lý nghiệp vụ.

## Chạy cùng Back-End

1. Chạy MySQL và BE tại `http://localhost:8080`. Kiểm tra `http://localhost:8080/api/test`.
2. Trong terminal mới:

```powershell
cd D:\SWP391_Test\Front-End
npm install
npm run dev
```

3. Mở địa chỉ Vite hiển thị (thường `http://localhost:5173`).
4. Đăng nhập bằng tài khoản BE. Nếu đã chạy `Back-End/sql/seed-users.sql`, tài khoản mẫu là `manager@example.com`, `receptionist@example.com`, `coach@example.com`, `member@example.com`, mật khẩu `password123`. Nút trên trang đăng nhập chỉ điền thông tin; mọi lần đăng nhập đều gọi `/auth/login`.

Các tài khoản demo cũ `*@gym.vn` và dữ liệu `gymmaster-demo-v1` không dùng trong chế độ API. Không cần xóa dữ liệu cũ; FE không đọc/ghi khóa đó nữa.

## Cấu hình kết nối

Mặc định không cần thêm biến môi trường: trình duyệt gọi `/backend/...`, Vite proxy sang `http://localhost:8080/...`. Proxy `/backend` tách biệt `/api/avatar/sign` của Cloudinary. Proxy hoạt động với cả `npm run dev` và `npm run preview`.

Nếu BE dùng cổng khác, thêm vào `.env.local` (giữ dòng Cloudinary đang có):

```dotenv
BACKEND_URL=http://localhost:8081
VITE_API_BASE_URL=/backend
```

Khởi động lại Vite sau khi thay env. `BACKEND_URL` chỉ dành cho proxy Node, `VITE_API_BASE_URL` được dùng trong trình duyệt. Khi deploy bản build tĩnh, cấu hình reverse proxy `/backend` hoặc đặt `VITE_API_BASE_URL` là URL BE và cấu hình `CORS_ORIGINS` phía BE. Không đưa Cloudinary API secret vào biến `VITE_*`.

## Đã nối API

- Đăng ký/đăng nhập JWT, phân trang theo vai trò, giữ phiên qua reload trong cùng tab; 401 xóa phiên, 403 hiển thị lỗi quyền.
- Manager: đọc/thêm/sửa/xóa gói, phòng, lớp và buổi học. Lớp và lịch là hai tài nguyên riêng; lịch dùng ngày/giờ cụ thể. Lỗi trùng lịch/ràng buộc BE được hiển thị tại form.
- Coach: đọc lịch theo `coachId` bằng tài khoản đang đăng nhập.
- Member: đọc danh mục gói, xem các buổi còn chỗ và lịch riêng, đăng ký/hủy buổi qua ID lịch thật. BE kiểm tra gói còn hiệu lực và sức chứa.
- Member: chọn gói và phương thức để tạo thanh toán chờ xác nhận; xem lịch sử/chi tiết thanh toán, hóa đơn; đọc các gói đã mua và cảnh báo hết hạn/sắp hết hạn (7 ngày, bao gồm hôm nay).
- Manager và Receptionist: màn hình thanh toán/hóa đơn, thu tiền mặt cho ID hội viên có sẵn, xác nhận đã nhận tiền hoặc hủy giao dịch đang chờ. Tìm kiếm trên danh sách giao dịch đã tải.
- VNPay now uses the backend payment URL endpoint and redirects to the configured VNPay provider/sandbox. Other online methods may still use `simulate-pay`; they are not real provider integrations. Tiền mặt do nhân viên xác nhận.
- Nút kiểm tra kết nối gọi `/api/test`; kiểm tra quyền vai trò gọi `/{role}/dashboard`.
- Loading, lỗi/thử lại và thông báo thành công chỉ sau khi request thành công. Có hộp thoại xác nhận xóa.

Transport/DTO: `src/services/api.js`. State và thao tác API: `src/services/backendStore.js`. `StoreProvider` chỉ khởi tạo adapter API. Xem [MEMBER_API.md](./MEMBER_API.md) để biết bảng endpoint và giới hạn hiện tại.

## Chưa có controller BE

BE chưa cung cấp endpoint danh sách/tra cứu hội viên, đăng ký tài khoản thay hội viên tại quầy hoặc cập nhật hồ sơ. Thu tiền tại quầy hiện dùng ID tài khoản MEMBER đã có; không tự tạo tài khoản mới. Avatar vẫn lưu URL trên trình duyệt.

Thời hạn gói lấy từ `/api/member/memberships`; FE dùng `active` và `daysRemaining` của máy chủ, phân biệt gói đang có hiệu lực, chưa tới ngày bắt đầu và hết hạn. BE vẫn quyết định điều kiện đặt/hủy buổi học. Chỉ thanh toán đã xác nhận mới kích hoạt gói; gia hạn bắt đầu sau thời hạn hiện có theo quy tắc BE.

## Avatar Cloudinary

Đăng nhập → Hồ sơ → Chọn ảnh → Lưu ảnh. JPG/PNG/WebP tối đa 5 MB; thu nhỏ tối đa 512 px. Ảnh upload lên Cloudinary; URL avatar lưu riêng trên trình duyệt theo tài khoản API, không giả lập lưu vào BE. Đổi avatar cập nhật hồ sơ, sidebar và thanh công cụ.

Cấu hình `CLOUDINARY_URL` trong `.env.local` theo `.env.example`. Endpoint ký `/api/avatar/sign` hiện chỉ chạy trong Vite development, cùng nguồn localhost; production cần backend có xác thực cho endpoint này. Xóa lựa chọn avatar không xóa file Cloudinary.

## Kiểm tra

```sh
npm run lint
npm run test:api
npm run test:payments
npm run test:avatar
npm run build
```

`test:api` chạy offline với HTTP transport mô phỏng theo DTO/controller BE: auth, payload CRUD, ID số, lịch có ngày, response 204/text, lỗi và session đổi trong lúc tải. Không tạo dữ liệu thật trong MySQL. Đăng ký chỉ thực hiện ở cấp lớp; dữ liệu buổi học của member được suy ra từ các lớp đã đăng ký.

Kiểm tra trực tiếp khi BE chạy: đăng nhập từng vai trò; tạo/sửa/xóa dữ liệu test ở Manager; xem lịch Coach; đặt/hủy buổi ở Member; tải lại trang; đăng xuất; đổi giao diện sáng/tối. Giao diện hiện dùng tiếng Việt thống nhất. Tạo lịch tương lai để Member nhìn thấy trong danh sách khả dụng.

Kiểm tra luồng mới bằng dữ liệu test: Member → Gói tập → chọn gói → tạo yêu cầu → Thanh toán & Hóa đơn. Với online, bấm Mô phỏng thanh toán và xác nhận; kiểm tra hóa đơn đã thanh toán và Trang của tôi có membership. Với tiền mặt, đăng nhập Manager/Receptionist để xác nhận khoản chờ, hoặc thu tiền trực tiếp cho hội viên bằng ID. Không thu tiền trực tiếp thêm cho một yêu cầu đang chờ: hãy xác nhận yêu cầu đó để tránh tạo hai giao dịch. `test:payments` kiểm tra các route/DTO, chuyển trạng thái và ranh giới hạn gói offline, không ghi giao dịch thật.

## Quy tắc làm việc nhóm

- Luôn Pull trước khi code.
- Commit với mô tả rõ ràng.
- Không dùng push --force.
