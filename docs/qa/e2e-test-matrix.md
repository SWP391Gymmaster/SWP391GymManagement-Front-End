# Ma trận kiểm thử nghiệp vụ và E2E

Phạm vi: hệ thống hiện tại, trừ PayOS và luồng đăng ký/gửi email. Tài khoản E2E được seed ở trạng thái đã xác minh. Thanh toán tiền mặt nằm trong phạm vi. Mỗi case phải kiểm tra HTTP/UI **và** dữ liệu DB khi có mutation. `A` = chạy trong `scripts/e2e/api.test.mjs`; `B` = chạy trong `scripts/e2e/browser.mjs`; `U` = có unit/integration test hiện tại; `P` = case cần tiếp tục tự động hóa hoặc thực thi thủ công. Các ký hiệu chỉ nói về coverage, không nói pass.

## Smoke, auth, phân quyền

| ID | Kịch bản / oracle | Coverage |
|---|---|---|
| S01 | Tám vai trò seed đăng nhập thành công; JWT chứa đúng role/user | A |
| S02 | Khách xem catalog công khai, không vào API member | A,B |
| S03 | Manager không vào API member/admin; member không vào admin | A |
| S04 | Manager đăng nhập bằng form thật và thấy menu đúng | B |
| S05 | Admin, receptionist, coach và member thấy đúng menu và trang khởi đầu | B |
| S06 | Mật khẩu sai, email không tồn tại, body sai, tài khoản khóa/chưa xác minh | U,P |
| S07 | JWT thiếu, sửa chữ ký, hết hạn; đổi vai trò/khóa sau khi cấp JWT | U,P |
| S08 | Đăng xuất, refresh, back/forward và request cũ không ghi đè phiên mới | P |
| S09 | Public GET lớp/phòng/lịch/gói và cấm POST/PUT/DELETE theo role | A,P |

## Admin, coach, user

| ID | Kịch bản / oracle | Coverage |
|---|---|---|
| U01 | Gán bộ môn coach; manager bị từ chối | A |
| U02 | Coach sai role, bộ môn sai/trùng/rỗng, vượt giới hạn | U,P |
| U03 | Danh sách user phân trang/lọc/tìm đúng; không lộ admin qua API quản lý | U,P |
| U04 | Tạo/sửa user với dữ liệu hợp lệ, chuẩn hóa email/username/phone | U,P |
| U05 | Email/username trùng khác hoa thường; thiếu field, quá độ dài, field PATCH lạ | U,P |
| U06 | Không tạo/sửa user thành ADMIN; manager/member không dùng API admin | A,U |
| U07 | Không đổi role member có đăng ký/gói/thu tiền, coach có lớp/lịch; DB giữ role cũ | A |
| U08 | Khóa/mở khóa tài khoản, đăng nhập bị chặn sau khóa, dữ liệu lịch sử giữ nguyên | U,P |

## Gói, membership, thanh toán tiền mặt

| ID | Kịch bản / oracle | Coverage |
|---|---|---|
| P01 | Tạo gói có mã/tên/giá/thời hạn/bộ môn và xem lại | A |
| P02 | Trùng mã/tên, kể cả khác hoa thường; DB giữ một bản ghi | A,U |
| P03 | Giá 0/âm/lẻ/NaN, thời hạn 0/âm, bộ môn rỗng/sai/trùng | A,U,P |
| P04 | Tạm ngưng loại khỏi danh sách active; kích hoạt lại | A |
| P05 | Gói có invoice/membership: sửa nội dung hoặc xóa bị chặn; status vẫn đổi được | A |
| P06 | Thu tiền mặt tạo một payment COMPLETED, invoice PAID, membership đúng member/gói/ngày | A,B |
| P07 | Gói tạm ngưng, member sai role, package/member ID thiếu hoặc không tồn tại không ghi tiền | U,P |
| P08 | Member chỉ đọc payment/invoice của mình; staff đọc theo role; tiền/giá snapshot đúng | A,U |
| P09 | Hủy giao dịch hoàn tất bị chặn; xác nhận/hủy lặp, rollback nếu activate lỗi | A,U,P |
| P10 | Gia hạn cùng gói, nâng cấp nhiều bộ môn, quote ngày và ranh giới ngày cuối | A,U,P |
| P11 | Hai yêu cầu thu tiền cùng lúc: xác định có chủ đích tạo hai giao dịch hay cần idempotency | P |

## Phòng, lớp, lộ trình

| ID | Kịch bản / oracle | Coverage |
|---|---|---|
| R01 | Tạo/xem phòng, mã chuẩn hóa; xóa phòng chưa sử dụng | A,U |
| R02 | Mã sai/trùng, tên rỗng, capacity 0/âm, type sai; unique MySQL thật | A,U |
| R03 | Phòng đang dùng: giảm sức chứa, đổi type sai môn, xóa đều bị chặn | A |
| R04 | Sửa tên phòng hợp lệ, giữ nguyên lịch và quan hệ | P |
| C01 | Tạo lớp mã tự nhập, chưa có buổi; URL chi tiết riêng, 0 buổi | A,B |
| C02 | Mã trùng/sai, thiếu tên, capacity 0, ngày bắt đầu quá khứ/kết thúc trước bắt đầu | A,U |
| C03 | Hạn mở/đóng: thứ tự đúng, thời gian tương lai, trước ngày lớp bắt đầu | U,P |
| C04 | Coach sai role/sai môn, trùng khoảng ngày, vượt số lớp cho phép | A,U |
| C05 | Giảm sức chứa dưới số đăng ký; đổi môn/ngày làm sai phòng/lịch/gói | A,P |
| C06 | Lớp có đăng ký/lịch/điểm danh không được xóa; lớp quá khứ giữ dữ liệu lịch sử | A,U |
| C07 | URL lớp không tồn tại, reload/back/forward, tạo lớp xong mở chi tiết | B,P |
| L01 | Tạo một buổi, batch/import CSV; số buổi và nội dung lộ trình đúng | A,B,U |
| L02 | Kết thúc bằng/trước bắt đầu, giờ thiếu, mô tả >1000, ngoài ngày lớp | A,U,P |
| L03 | Phòng và coach không trùng giờ; chạm biên giờ được phép | A,U,P |
| L04 | Room type theo môn và sức chứa phòng ≥ sĩ số lớp | A,U |
| L05 | Batch rỗng/>100, trùng giờ trong batch, một dòng sai: rollback toàn batch | A,U |
| L06 | Sửa buổi không đổi coach trực tiếp; chuyển coach riêng, kiểm tra môn/lịch/quyền coach cũ/mới | U,P |
| L07 | Buổi có attendance/hồ sơ cũ không xóa được | A |

## Đăng ký lớp, điểm danh, thông báo

| ID | Kịch bản / oracle | Coverage |
|---|---|---|
| E01 | Gói hợp môn và phủ đến buổi cuối; đăng ký lớp 201, ghế giảm, lịch cá nhân hiện đủ buổi | A,B |
| E02 | Lớp chưa có buổi, gói thiếu/hết hạn/sai môn/không phủ ngày cuối bị chặn | A,U,P |
| E03 | Đúng thời điểm mở/đóng, trước mở, sau đóng, đúng giờ buổi đầu | A,B,U,P |
| E04 | Đăng ký lặp, lớp đầy, hủy trước buổi đầu, hủy lặp/sau buổi đầu | A,U,P |
| E05 | Hai lớp có ít nhất một buổi trùng giờ không đăng ký cùng lúc | A,U |
| E06 | Hai member tranh ghế cuối; hai request cùng member: tối đa một registration | A |
| E07 | Endpoint đăng ký theo buổi cũ trả 404, không ghi `class_enrollments` mới | A |
| E08 | Member sau reload vẫn thấy đúng lộ trình; hủy thì lịch và ghế cập nhật | B,P |
| A01 | Coach xem roster buổi mình dạy; coach khác bị chặn | A,B |
| A02 | Chỉ member đã đăng ký lớp mới được điểm danh; trước giờ bắt đầu/sau cửa sổ bị chặn | A,U |
| A03 | Có mặt/vắng mặt, sửa kết quả, một hàng DB cho mỗi member/buổi | A |
| A04 | Member chỉ thấy thông báo của mình; đọc của người khác trả 404 | A |
| A05 | Đánh dấu đã xem giữ qua reload; sửa điểm danh làm chưa xem trở lại | A,B |
| A06 | Hai coach/request điểm danh đồng thời, chuyển coach hoặc hủy lớp sát thời điểm điểm danh | P |

## Liên module P0 và đồng thời

| ID | Kịch bản / oracle | Coverage |
|---|---|---|
| X01 | Xóa buổi duy nhất sau khi có registration phải bị chặn hoặc xử lý đăng ký nhất quán | A |
| X02 | Mở đăng ký trong tương lai phải chặn signup sớm dù member đủ gói/ghế | A |
| X03 | Dời buổi sau khi member đăng ký vượt ngày hết hạn gói phải bị chặn | A |
| X04 | Đổi môn lớp đã có registration không được làm gói member mất quyền | A |
| X05 | Dời/thêm buổi tạo trùng lịch giữa các lớp member đã đăng ký phải bị chặn | U,P |
| X06 | Đổi coach sau điểm danh không làm mất lịch sử và không cho coach cũ sửa | P |
| X07 | Khóa member/coach có bản ghi nghiệp vụ không mất lịch sử; API quyền cập nhật đúng | A,U,P |
| X08 | Hai member tranh ghế cuối và duplicate request cùng member | A |
| X09 | Hai cashier/manager đồng thời xác nhận một payment: không kích hoạt hai lần; thu tiền mới lặp cần thêm idempotency spec | A,U,P |
| X10 | MySQL unique trên room/class/package code, package name, registration, attendance | A,P |
| X11 | Transaction lỗi giữa invoice/payment/membership hoặc batch buổi phải rollback toàn bộ | A,U,P |
| X12 | Báo cáo doanh thu, tiến độ lớp và tổng buổi đối soát dữ liệu sau mutation | B,P |
| X13 | Manager đã đăng nhập mở báo cáo bằng cùng phiên hiện tại, không bị báo hết hạn giả | B |

## Cách chạy

1. Start MySQL 8. Backend dùng `SPRING_DATASOURCE_URL=jdbc:mysql://127.0.0.1:3306/swp391_e2e_20261113?...` và `SERVER_PORT=18080`. Frontend dùng `BACKEND_URL=http://127.0.0.1:18080`, port 15173.
2. Set `MYSQL_PWD` cho tài khoản MySQL local. Chạy `npm run test:e2e` tại frontend. Runner kiểm tra tên DB `swp391_e2e_*`, reset **chỉ DB đó**, seed user, chạy API E2E, reset lại và chạy browser E2E. Hai bộ đều chạy ngay cả khi bộ đầu fail.
3. Không chạy các script SQL E2E với database làm việc. Không chạy PayOS, đăng ký email hoặc upload Cloudinary thật.
