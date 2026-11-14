# Manual test giao diện: Integration theo module và System theo luồng

**Phạm vi:** chỉ thao tác trên giao diện người dùng bằng trình duyệt; dùng hộp thư test và trang PayOS sandbox khi luồng cần. Không dùng Postman, DevTools, SQL, sửa dữ liệu trực tiếp hay kiểm bảng DB. Đây là **kịch bản để chạy**, không phải kết quả đã chạy. Mỗi case kiểm thông báo trên màn hình, danh sách/chi tiết, rồi **refresh hoặc đăng nhập lại** để xác nhận dữ liệu còn đúng. Nếu chức năng chưa có trên UI, ghi `Blocked` cùng tên màn hình, không tự coi là `Pass`.

## 0. Chuẩn bị trước khi test

1. Mở ứng dụng ở môi trường test, dùng Chrome/Edge; chuẩn bị tài khoản `admin`, `manager`, `receptionist`, `coach A`, `coach B`, `member A`, `member B` và một email chưa đăng ký. Có thể tạo thêm tài khoản qua UI. Dùng tên/mã có hậu tố riêng cho đợt test, ví dụ `MT-20261113-01`, để dễ tìm lại.
2. Chuẩn bị hộp thư test nhận email xác minh, PayOS sandbox có thể thanh toán/hủy, hai phòng đủ sức chứa (Gym/Yoga), các gói ngắn/dài hạn và lịch lớp ở tương lai. Chỉ tạo dữ liệu qua UI. Với case cần sát mốc giờ, tạo lịch trước và ghi giờ thực tế; không đổi đồng hồ máy.
3. Với case dữ liệu cũ hoặc nhiều người cùng lúc, mở **hai cửa sổ riêng** hoặc hai browser profile đã login bằng hai tài khoản. Ghi lại tên lớp, mã gói, ngày/giờ và ảnh màn hình trước/sau. Không dùng dữ liệu thật của khách hàng.
4. Kết quả mỗi case: `Pass`, `Fail`, `Blocked`. Một case chỉ Pass khi **mọi bước** và kết quả mong đợi đều đúng. Nếu lỗi, ghi màn hình, tài khoản, dữ liệu, giờ, các bước tái hiện và ảnh. Các thao tác cần role khác được thực hiện bằng logout/login hoặc cửa sổ riêng.

| ID | Kết quả | Ngày/giờ, người test | Tài khoản và dữ liệu | Ảnh/ghi chú | Bug ID |
|---|---|---|---|---|---|
| `I-AUTH-01` |  |  |  |  |  |

## 1. Integration test theo module (chỉ trên UI)

### 1.1 Trang công khai, tài khoản, xác minh email, phiên

| ID | Các bước trên giao diện | Kết quả mong đợi |
|---|---|---|
| I-AUTH-01 | 1. Mở ứng dụng khi chưa login. 2. Đi qua trang chủ, gói tập, lớp công khai, đăng ký, đăng nhập. 3. Refresh và dùng Back/Forward. | Màn hình tải đúng, link điều hướng đúng; không hiện menu/dữ liệu riêng tư của role nào. |
| I-AUTH-02 | 1. Đăng ký member với thông tin hợp lệ. 2. Mở hộp thư test. 3. Mở link xác minh mới nhất rồi login. | Có thông báo cần xác minh, mail tới đúng địa chỉ; xác minh xong login được và vào trang member. |
| I-AUTH-03 | 1. Đăng ký tài khoản mới. 2. Thử login trước xác minh. 3. Xác minh rồi thử lại. | Trước xác minh bị chặn có thông báo rõ; sau xác minh vào được. |
| I-AUTH-04 | 1. Thử bỏ trống từng field đăng ký; email/điện thoại sai; username quá ngắn/dài hoặc có ký tự lạ; mật khẩu yếu, xác nhận khác. 2. Sửa từng lỗi rồi submit. | Lỗi gắn đúng field, không chuyển trang như đã đăng ký; dữ liệu đúng mới đi tiếp. |
| I-AUTH-05 | 1. Đăng ký trùng email hoặc username với tài khoản có sẵn; thử khác hoa/thường hoặc thêm khoảng trắng. 2. Tìm/login tài khoản cũ. | Bị báo trùng; tài khoản cũ vẫn dùng được, không xuất hiện hai tài khoản cùng danh tính trong màn hình quản trị. |
| I-AUTH-06 | 1. Với tài khoản chưa xác minh, bấm Gửi lại mail. 2. Bấm lần nữa ngay, sau thời gian chờ thì thử tiếp. 3. Mở link cũ và link mới. | Có thông báo chờ/giới hạn; chỉ link còn hiệu lực xác minh được; không bị login tự động trước xác minh. |
| I-AUTH-07 | 1. Thử link xác minh sai, đã dùng, hết hạn nếu có email cũ. 2. Quay lại login/gửi lại. | Link lỗi báo rõ, không xác minh nhầm; có cách nhận link mới. Nếu không dựng được link hết hạn qua UI, đánh dấu riêng nhánh đó `Blocked`. |
| I-AUTH-08 | 1. Login sai password/email. 2. Login đúng lần lượt các role. 3. Refresh, logout, dùng Back rồi mở lại trang riêng. | Sai thông tin báo lỗi; đúng tài khoản vào menu đúng role; logout không mở lại dữ liệu được. |
| I-AUTH-09 | 1. Login member A ở một cửa sổ, mở lịch/hoá đơn. 2. Logout rồi login member B cùng cửa sổ. 3. Dùng Back/Forward/refresh. | Không thấy lịch, hoá đơn, thông báo, avatar hoặc tên A trong phiên B. |
| I-AUTH-10 | 1. Mở trực tiếp link chi tiết lớp hợp lệ và link lớp không tồn tại. 2. Refresh, dùng Back/Forward, thử khi guest. | Lớp hợp lệ mở đúng khi có quyền; link sai hiện trạng thái không tìm thấy; guest không vượt qua bước login cần thiết. |

### 1.2 Admin: dashboard, tài khoản, nhân sự và môn dạy

| ID | Các bước trên giao diện | Kết quả mong đợi |
|---|---|---|
| I-ADMIN-01 | 1. Login admin, mở Bảng điều khiển. 2. Xem các thẻ/chỉ số/link. 3. Tạo hoặc khóa một tài khoản test, refresh dashboard. | Không có số liệu trống giả; chỉ số liên quan cập nhật, link mở đúng trang. |
| I-ADMIN-02 | 1. Mở Accounts & verification. 2. Lọc theo role/trạng thái xác minh/hoạt động, tìm tên/email/điện thoại. 3. Đi trang trước/sau, xoá bộ lọc. | Kết quả, tổng số và phân trang hợp lý; không thấy tài khoản admin trong danh sách quản trị thường. |
| I-ADMIN-03 | 1. Tạo lần lượt member, manager, receptionist, coach với dữ liệu hợp lệ. 2. Tìm từng tài khoản; mở mail test. | Mỗi tài khoản xuất hiện đúng role/trạng thái, có luồng xác minh. Không có tùy chọn tự tạo thêm admin. |
| I-ADMIN-04 | 1. Trong form tạo tài khoản thử thiếu field, email/username trùng, role không chọn, điện thoại sai. 2. Sửa rồi lưu. | Lỗi rõ, form giữ dữ liệu đang nhập; không sinh bản ghi lỗi trong danh sách; lần hợp lệ lưu một lần. |
| I-ADMIN-05 | 1. Mở tài khoản chưa có giao dịch, sửa tên/username/phone/email/role hợp lệ. 2. Refresh, tìm lại; kiểm mail sau đổi email. | Giá trị mới hiện đúng; email đổi phải xác minh lại; tài khoản cũ không biến thành bản ghi mới. |
| I-ADMIN-06 | 1. Chọn member đã mua gói/đăng ký lớp hoặc coach có lịch. 2. Thử đổi role. 3. Refresh các màn hình liên quan. | Đổi role bị chặn với thông báo; lịch sử mua/lớp và lịch dạy vẫn hiển thị đúng. |
| I-ADMIN-07 | 1. Khóa một tài khoản test đang hoạt động, thử login bằng tài khoản đó. 2. Mở khóa và login lại. 3. Kiểm tra lịch sử cũ. | Khóa chặn login; mở khóa cho login khi email hợp lệ; lịch sử không mất. |
| I-ADMIN-08 | 1. Với user chưa xác minh, bấm Gửi lại mail ở màn Accounts. 2. Thử bấm nhiều lần nhanh. 3. Xác minh bằng mail mới. | Có thông báo gửi hoặc giới hạn tần suất; mail mới hoạt động, trạng thái xác minh đổi sau refresh. |
| I-ADMIN-09 | 1. Mở Quản lý nhân sự, lọc/tìm và phân trang. 2. Tạo nhân viên bằng form tại đây, rồi tìm trong Accounts. 3. Thử khóa/mở khóa. | Hai màn hình thống nhất tên, role, trạng thái; form lỗi có chỉ dẫn; không tạo trùng khi bấm một lần. |
| I-ADMIN-10 | 1. Tạo coach A/B. 2. Vào Bộ môn được dạy, gán Gym/Yoga; lưu và mở lại. 3. Thử danh sách rỗng, trùng môn, tên lạ. | Môn hợp lệ được lưu và xuất hiện trong form chọn coach của lớp; dữ liệu lỗi bị báo hoặc chuẩn hóa rõ ràng. |
| I-ADMIN-11 | 1. Tạo lớp/buổi tương lai cho coach A. 2. Thử bỏ môn đang dạy hoặc khóa coach. 3. Mở lại lịch dạy/chi tiết lớp. | Không làm mất liên kết lịch; nếu khóa coach khiến buổi sắp tới không có người dạy, ghi bug và cách chuyển coach cần dùng. |

### 1.3 Gói thành viên (admin/manager) và quyền lợi

| ID | Các bước trên giao diện | Kết quả mong đợi |
|---|---|---|
| I-PKG-01 | 1. Manager tạo gói với mã/tên/giá/thời hạn/môn/mô tả hợp lệ. 2. Mở danh sách admin, manager, member và màn bán tại quầy. | Thông tin, giá và môn giống nhau trên các màn hình; gói đang bán có thể chọn mua. |
| I-PKG-02 | 1. Tạo gói trùng mã rồi trùng tên, thử khác hoa/thường/khoảng trắng. 2. Thử sửa gói chưa giao dịch thành tên/mã đã dùng. | Báo trùng, không có hai card cùng mã/tên; gói sửa lỗi vẫn giữ thông tin cũ sau refresh. |
| I-PKG-03 | 1. Trong form thử mã/tên/môn rỗng, giá 0/âm/lẻ, thời hạn 0/âm, môn trùng hoặc lạ. 2. Sửa dần từng field. | Không lưu dữ liệu sai; thông báo cụ thể; form hợp lệ lưu được. |
| I-PKG-04 | 1. Sửa mọi trường của gói chưa bán. 2. Tra cứu theo mã, refresh member checkout. 3. Tạm ngưng rồi Mở bán. | Thông tin cập nhật nhất quán; gói tạm ngưng không chọn mua mới; mở bán xuất hiện lại. |
| I-PKG-05 | 1. Xóa một gói chưa có giao dịch bằng hộp xác nhận; thử Hủy trước khi xác nhận. 2. Tra cứu lại mã. | Hủy giữ gói; xác nhận xóa làm gói biến mất khỏi danh sách/tra cứu/mua. |
| I-PKG-06 | 1. Member mua gói test hoặc lễ tân bán tại quầy. 2. Quay về màn quản lý gói. 3. Thử tìm nút Sửa/Xóa và Tạm ngưng. | Gói đã phát sinh giao dịch không cho sửa/xóa; vẫn tạm ngưng/mở bán được; hóa đơn/quyền lợi đã mua vẫn xem được. |

### 1.4 Phòng tập

| ID | Các bước trên giao diện | Kết quả mong đợi |
|---|---|---|
| I-ROOM-01 | 1. Manager tạo phòng Gym/Yoga với mã, tên, sức chứa hợp lệ. 2. Tìm phòng, mở lịch phòng; sửa tên rồi refresh. | Mã/tên/sức chứa/loại đúng; phòng mới chưa có lịch; sửa tên không đổi lịch liên quan. |
| I-ROOM-02 | 1. Tạo mã trùng hoặc khác hoa/thường, mã rỗng/sai dạng, tên rỗng, sức chứa 0/âm, loại bỏ trống. 2. Sửa lại. | Dữ liệu sai bị chặn; dữ liệu hợp lệ mới tạo được một phòng. |
| I-ROOM-03 | 1. Xóa phòng chưa có buổi, thử Hủy ở hộp xác nhận rồi xóa thật. 2. Tạo buổi trong phòng khác và thử xóa phòng đang dùng. | Hủy không xóa; phòng rỗng xóa được; phòng đang có buổi bị chặn và lịch vẫn hiện. |
| I-ROOM-04 | 1. Dùng phòng Gym sức chứa 10 cho lớp 10 người. 2. Giảm sức chứa xuống 9 hoặc đổi loại sang Yoga. 3. Sửa tên. | Hai thay đổi làm sai lịch bị chặn; sửa tên hợp lệ; lớp/buổi vẫn trỏ đúng phòng. |
| I-ROOM-05 | 1. Dùng phòng có buổi đã qua và sắp tới. 2. Thử sửa sức chứa/loại rồi refresh. | Không làm sai lịch sử; nếu UI cho sửa trái quy tắc lịch sử thì Fail, ghi buổi liên quan. |

### 1.5 Lớp học, chi tiết lớp, thời hạn đăng ký

| ID | Các bước trên giao diện | Kết quả mong đợi |
|---|---|---|
| I-CLASS-01 | 1. Manager bấm + Tạo lớp mới, nhập mã lớp tự chọn và các trường hợp lệ. 2. Lưu. 3. Mở Xem chi tiết. | Tạo xong quay về danh sách; detail có URL riêng, đúng thông tin, tổng buổi = 0; không tự tạo lộ trình. |
| I-CLASS-02 | 1. Tạo mã lớp trùng hoặc khác hoa/thường; mã rỗng/sai dạng/dài, tên rỗng, sĩ số 0/âm. 2. Sửa lại. | Không tạo lớp lỗi; thông báo rõ; chỉ dữ liệu hợp lệ lưu được. |
| I-CLASS-03 | 1. Chọn ngày bắt đầu/kết thúc sai thứ tự, hạn đăng ký trước/đúng lúc mở, hoặc sau khi lớp bắt đầu. 2. Chọn mốc hợp lệ. | Mốc sai bị chặn; detail hiển thị hạn đăng ký và ngày học theo giờ Việt Nam. |
| I-CLASS-04 | 1. Chọn coach không dạy môn hoặc đã quá tải nếu có thể chọn. 2. Chọn coach phù hợp, tạo lớp. | Không lưu lớp với coach không hợp lệ; coach hợp lệ xuất hiện đúng trong detail và lịch dạy. |
| I-CLASS-05 | 1. Mở danh sách; lọc môn, coach, ngày, khung giờ, trạng thái/còn chỗ theo từng filter và kết hợp. 2. Xóa bộ lọc. | Danh sách/đếm khớp điều kiện nhìn thấy; xóa lọc trả toàn bộ lớp phù hợp role. |
| I-CLASS-06 | 1. Mở detail bằng nút, refresh, Back/Forward, rồi mở URL lớp sai. 2. So số buổi và thông tin. | Detail có trang riêng, không mất nội dung sau refresh; link sai hiện không tìm thấy; đếm buổi đúng danh sách lộ trình. |
| I-CLASS-07 | 1. Sửa tên/sĩ số/ngày/môn của lớp chưa có đăng ký. 2. Thử giảm sĩ số thấp hơn số đã đăng ký hoặc đổi môn làm member không đủ gói. | Sửa hợp lệ lưu; sửa làm sai quyền/ghế/lộ trình bị chặn, dữ liệu cũ còn sau refresh. |
| I-CLASS-08 | 1. Tạo lớp có hạn mở ở tương lai và hạn đóng trước buổi đầu. 2. Member xem trước giờ mở, sau giờ mở, sau hạn đóng. 3. Manager gia hạn hạn đóng hợp lệ. | Trước mở không đăng ký được; trong cửa sổ có nút; quá hạn đóng; gia hạn hợp lệ mở lại khi chưa tới buổi đầu. |
| I-CLASS-09 | 1. Xóa lớp chưa có buổi/đăng ký. 2. Thử xóa lớp đã có buổi hoặc người đăng ký. 3. Refresh danh sách. | Lớp sạch xóa được; lớp còn dữ liệu bị chặn; không mất lịch/đăng ký của member. |

### 1.6 Buổi học, tạo nhiều buổi, import, chuyển coach

| ID | Các bước trên giao diện | Kết quả mong đợi |
|---|---|---|
| I-SESSION-01 | 1. Vào detail lớp, bấm + Thêm buổi học. 2. Điền ngày/giờ/phòng/mô tả hợp lệ; lưu, refresh. | Một buổi mới ở lộ trình; tổng buổi tăng 1; lịch coach và member đã đăng ký (nếu có) cập nhật. |
| I-SESSION-02 | 1. Thử kết thúc bằng/trước bắt đầu, thiếu ngày/giờ, ngoài khoảng lớp, mô tả quá dài. 2. Sửa hợp lệ. | Không tạo buổi sai; form chỉ dẫn lỗi; buổi hợp lệ mới xuất hiện. |
| I-SESSION-03 | 1. Tạo buổi trùng giờ với phòng đang bận hoặc coach đang dạy lớp khác. 2. Thử phòng sai môn/nhỏ hơn sĩ số. 3. Chọn giờ/phòng hợp lệ. | Các trường hợp xung đột bị chặn; lịch cũ không đổi; buổi hợp lệ lưu được. |
| I-SESSION-04 | 1. Bấm Tạo nhiều buổi / Import CSV. 2. Chọn số buổi, khoảng cách/ngày/giờ/phòng. 3. Xem trước rồi lưu; refresh. | Preview đúng số buổi và thời gian; tổng buổi/detail/lịch dạy cùng số sau lưu. |
| I-SESSION-05 | 1. Tải/mở file mẫu import trong docs, tạo CSV hợp lệ. 2. Import qua UI. 3. Đối chiếu danh sách lộ trình. | Mỗi dòng hợp lệ thành một buổi đúng giờ/phòng/mô tả; không tạo buổi trùng ngoài ý muốn. |
| I-SESSION-06 | 1. Trong batch/CSV, làm một buổi sai ngày, trùng giờ, thiếu phòng hoặc file sai cột. 2. Import. 3. Sửa và import lại. | Báo lỗi rõ; lần lỗi không thêm nửa batch; lần đúng thêm đủ số buổi. |
| I-SESSION-07 | 1. Sửa mô tả/giờ/phòng của một buổi; mở lại. 2. Quan sát form sửa có cho đổi coach trực tiếp không. | Sửa hợp lệ cập nhật lộ trình; coach không đổi bằng form sửa buổi thường. |
| I-SESSION-08 | 1. Trên buổi, bấm Chuyển HLV, chọn coach hợp môn/rảnh. 2. Login coach cũ và coach mới xem lịch. | Buổi chuyển sang coach mới; coach cũ không còn quyền điểm danh; member thấy coach đúng. |
| I-SESSION-09 | 1. Thử chuyển sang coach sai môn hoặc bận nếu UI cho chọn. 2. Thử xóa buổi có điểm danh hoặc buổi cuối của lớp còn người đăng ký. | Chuyển/xóa nguy hiểm bị chặn; lộ trình/điểm danh không mất. |
| I-SESSION-10 | 1. Member đăng ký lớp với gói vừa đủ đến buổi cuối. 2. Manager dời hoặc thêm buổi vượt hạn gói, rồi thử giờ hợp lệ. | Thay đổi khiến member mất quyền bị chặn; thay đổi hợp lệ hiện trong lịch coach/member. |

### 1.7 Member: mua gói, đăng ký lớp, lộ trình và lịch cá nhân

| ID | Các bước trên giao diện | Kết quả mong đợi |
|---|---|---|
| I-MEMBER-01 | 1. Login member chưa có gói/lớp, mở Trang của tôi, Gói tập, Danh sách lớp, Lịch tập cá nhân. 2. Dùng các link hướng dẫn. | Empty state rõ, không có lịch/ghế giả; link tới trang mua/khám phá lớp đúng. |
| I-MEMBER-02 | 1. Member có gói đúng môn/đủ hạn, mở lớp còn chỗ trong hạn. 2. Bấm Đăng ký lớp, refresh detail/lịch. | Detail báo đã đăng ký; ghế còn lại giảm; toàn bộ buổi và mô tả xuất hiện trong lịch cá nhân; không có nút đăng ký từng buổi. |
| I-MEMBER-03 | 1. Bấm đăng ký lần nữa hoặc double-click khi nút còn hiện. 2. Refresh. | Không có hai đăng ký hoặc trừ hai ghế; UI báo đã đăng ký hoặc chặn thao tác lặp. |
| I-MEMBER-04 | 1. Thử đăng ký lớp chưa có buổi, chưa mở, đã đóng, đầy chỗ, hoặc buổi đầu đã bắt đầu. 2. Xem thông báo tại detail. | Không có đăng ký mới; lý do/giới hạn hiển thị đúng, ghế không đổi sau refresh. |
| I-MEMBER-05 | 1. Chưa có gói thử đăng ký. 2. Mua gói chỉ có môn khác, thử lại. 3. Mua gói đúng môn/đủ hạn, thử lại. | Hai lần đầu bị chặn và có hướng mua gói; lần cuối đăng ký được nếu lớp còn hạn/chỗ. |
| I-MEMBER-06 | 1. Chọn lớp có buổi cuối sau ngày hết hạn gói. 2. Thử đăng ký, gia hạn/nâng gói qua UI, thử lại. | Trước gia hạn bị chặn; sau khi gói đủ ngày có thể đăng ký; ngày quyền lợi hiển thị rõ. |
| I-MEMBER-07 | 1. Tạo qua UI hai lớp khác coach/phòng có buổi giao giờ. 2. Member đăng ký A rồi B. 3. Manager dời buổi B sang giờ không trùng, member thử lại. | B bị chặn khi trùng giờ; sau dời giờ thì đăng ký được, lịch không chồng nhau. |
| I-MEMBER-08 | 1. Member đã đăng ký bấm Hủy đăng ký lớp trước buổi đầu. 2. Xác nhận, refresh lịch/ghế; thử đăng ký lại. | Hủy trả ghế và bỏ lộ trình của lớp; đăng ký lại được nếu vẫn trong hạn. |
| I-MEMBER-09 | 1. Sau khi buổi đầu bắt đầu, member thử hủy. 2. Refresh detail và lịch. | Hủy bị chặn, lịch và trạng thái đăng ký vẫn đúng. |
| I-MEMBER-10 | 1. Trong Lịch tập cá nhân, chuyển Sắp tới/Đã qua, lọc môn/ngày, xóa lọc. 2. Mở lớp từ lịch nếu có link. | Chỉ thấy buổi thuộc lớp đã đăng ký, đúng tab/filter/giờ/phòng/mô tả; xóa lọc trả danh sách. |
| I-MEMBER-11 | 1. Mở lớp đã đăng ký sau hạn đăng ký. 2. Xem detail/lộ trình và lịch cá nhân. | Hạn đóng chỉ chặn đăng ký mới; member đã đăng ký vẫn xem được lộ trình. |

### 1.8 Coach: lịch dạy, danh sách member, điểm danh; member nhận thông báo

| ID | Các bước trên giao diện | Kết quả mong đợi |
|---|---|---|
| I-ATT-01 | 1. Coach A mở Tổng quan và Lịch dạy. 2. Đối chiếu lớp/buổi/phòng; bấm Xem và điểm danh. 3. Login coach B xem cùng danh sách. | A chỉ thấy buổi mình dạy; roster gồm member đã đăng ký lớp; B không thấy buổi/roster của A. |
| I-ATT-02 | 1. Mở roster lớp chưa có người đăng ký. 2. Member A đăng ký, member B chưa đăng ký; refresh roster. | Empty state rõ lúc đầu; sau đó chỉ A xuất hiện, B không xuất hiện. |
| I-ATT-03 | 1. Trước giờ buổi học bấm Có mặt/Vắng mặt. 2. Đến giờ bắt đầu, bấm Có mặt cho A. | Trước giờ nút bị khóa hoặc bị chặn; đến giờ trạng thái A đổi Có mặt và giữ sau refresh. |
| I-ATT-04 | 1. Đánh A Có mặt rồi Vắng mặt, refresh coach/member. 2. Đánh lại Có mặt. | Trạng thái cuối hiển thị nhất quán; không có nhiều dòng A trùng trong roster/thông báo. |
| I-ATT-05 | 1. Member A mở Trang của tôi sau điểm danh. 2. Bấm Đánh dấu đã xem; refresh/logout/login. 3. Coach đổi kết quả. | Thông báo đúng lớp/ngày/kết quả; đã xem được lưu; đổi kết quả tạo trạng thái chưa xem lại. Member B không thấy thông báo A. |
| I-ATT-06 | 1. Sau khi hết ngày của buổi học, coach mở roster và thử sửa điểm danh. 2. Member xem lịch sử. | Sửa bị chặn; kết quả cũ vẫn hiện cho member. Nếu không tạo được lịch quá khứ qua UI, dùng buổi đã diễn ra tự nhiên và ghi nhánh `Blocked` cho tới lúc đó. |
| I-ATT-07 | 1. Manager chuyển buổi từ coach A sang B. 2. A/B mở lịch và roster; thử điểm danh trong cửa sổ hợp lệ. | Chỉ B có quyền điểm danh sau chuyển; lịch sử đã điểm danh và thông báo của member vẫn giữ. |

### 1.9 Checkout, PayOS, thanh toán tại quầy, chuyển khoản, hóa đơn

| ID | Các bước trên giao diện | Kết quả mong đợi |
|---|---|---|
| I-PAY-01 | 1. Member vào Gói tập, chọn gói đang bán. 2. Qua các bước chọn phương thức, xem tóm tắt và ngày quyền lợi. 3. Quay lại/chọn gói khác rồi tiếp tục. | Tên gói, môn, giá, ngày bắt đầu/kết thúc và tổng tiền thống nhất; Back không tự tạo giao dịch. |
| I-PAY-02 | 1. Chọn PayOS sandbox, hoàn tất thanh toán. 2. Quay về app, bấm Kiểm tra lại nếu đang chờ. 3. Mở lịch sử giao dịch, hóa đơn và Trang của tôi. | Chỉ khi PayOS xác nhận mới hiện đã thanh toán và gói active; số tiền/mã gói khớp. |
| I-PAY-03 | 1. Tạo checkout PayOS, hủy trên trang thanh toán hoặc đóng tab. 2. Trở về app, mở lịch sử và Trang của tôi. 3. Mua lại bằng giao dịch mới. | Giao dịch hủy/chờ không cấp quyền; giao dịch thành công sau đó mới cấp gói; không cộng hai lần. |
| I-PAY-04 | 1. Trong màn hình kết quả PayOS đang chờ, refresh hoặc bấm Kiểm tra lại trước/sau xác nhận. 2. Dùng Back/Forward. | Không báo thành công chỉ vì quay về app; trạng thái cuối khớp lịch sử; không tự tạo thêm giao dịch. |
| I-PAY-05 | 1. Receptionist/manager vào Thanh toán tại quầy, nhập ID member và chọn gói active. 2. Xác nhận đã nhận tiền. 3. Member login xem gói/hóa đơn. | Giao dịch hoàn tất và gói active ngay; số tiền/mã gói/ID member thống nhất. |
| I-PAY-06 | 1. Tại quầy thử bỏ ID, nhập ID sai/không tồn tại, không chọn gói, chọn gói tạm ngưng nếu hiện. 2. Thử bấm xác nhận nhanh nhiều lần. | Báo lỗi/chặn; không cấp gói cho member sai; một thao tác UI không tạo giao dịch lặp ngoài ý muốn. |
| I-PAY-07 | 1. Nếu UI có lựa chọn chuyển khoản thủ công, member tạo giao dịch và mở lịch sử. 2. Lễ tân/manager xác nhận sau khi nhận tiền. 3. Member refresh. | Trong lúc chờ không có quyền; sau xác nhận có gói active, hóa đơn đã thanh toán. Nếu UI hiện tại không có lựa chọn này, ghi `Blocked: chưa có checkout chuyển khoản trên UI`. |
| I-PAY-08 | 1. Với giao dịch chuyển khoản đang chờ, lễ tân/manager bấm Hủy và nhập lý do. 2. Thử xác nhận lại; tạo giao dịch khác để xác nhận. | Giao dịch đã hủy không cấp gói/không xác nhận lại; giao dịch mới hợp lệ được xác nhận. |
| I-PAY-09 | 1. Admin, manager, receptionist, member lần lượt mở Thanh toán/Hóa đơn. 2. Chuyển hai tab, tìm mã giao dịch, tên/ID member, gói; mở Chi tiết, bấm Tải lại. | Mỗi role chỉ thấy nội dung/phím thao tác được phép; member chỉ thấy của mình; chi tiết, trạng thái và số tiền đúng sau reload. |
| I-PAY-10 | 1. Member A mua gói, member B đăng nhập cùng trình duyệt sau logout. 2. B mở thanh toán/hóa đơn và thử tìm mã giao dịch của A. | B không nhìn thấy giao dịch, hóa đơn hoặc gói của A. |
| I-PAY-11 | 1. Mua cùng gói lần nữa khi còn hạn; xem ngày gia hạn. 2. Mua gói khác thêm môn; xem ngày/quyền lợi. 3. Thử đăng ký lớp môn mới. | Ngày quyền lợi trên checkout và Trang của tôi thống nhất; môn mới chỉ đăng ký được sau khi mua thành công. |

### 1.10 Báo cáo, dashboard, hồ sơ, trạng thái giao diện

| ID | Các bước trên giao diện | Kết quả mong đợi |
|---|---|---|
| I-REPORT-01 | 1. Manager mở Tổng quan doanh thu và Báo cáo & Tiến độ. 2. Chuyển tháng có/không có giao dịch; tạo giao dịch đã thanh toán/chờ/hủy qua UI rồi refresh. | Doanh thu chỉ phản ánh giao dịch hoàn tất; dashboard và báo cáo thống nhất; tháng rỗng hiện 0. |
| I-REPORT-02 | 1. Ở tab Tiến độ lớp & Coach, ghi tổng buổi, buổi qua/sắp tới, số lớp/giờ dạy. 2. Thêm/dời/xóa buổi hợp lệ, refresh. | Chỉ số thay đổi đúng theo lộ trình nhìn thấy; không cộng nhầm buổi của coach khác. |
| I-REPORT-03 | 1. Xuất CSV và In ở hai tab, thử tháng rỗng. 2. Mở file/tờ in, so với màn hình đang lọc. | Tiếng Việt, ngày/tiền/tổng số và bộ lọc đúng; không lộ dữ liệu ngoài phạm vi màn hình. |
| I-PROFILE-01 | 1. Mở Hồ sơ ở từng role. 2. Xem tên/email và thử sửa. 3. Logout/login. | Thông tin đúng tài khoản; trường chỉ đọc nếu UI chưa hỗ trợ sửa; không báo đã lưu giả. |
| I-PROFILE-02 | 1. Chọn ảnh JPG/PNG/WebP hợp lệ, xem trước rồi Hủy. 2. Chọn lại và Lưu. 3. Refresh, đổi sang tài khoản khác. | Hủy giữ ảnh cũ; lưu hiện ảnh mới ở cùng browser; avatar không lẫn account. |
| I-PROFILE-03 | 1. Chọn file không phải ảnh, 0 byte, >5 MB, ảnh quá lớn/hỏng. 2. Thử khi dịch vụ upload lỗi nếu môi trường test hỗ trợ. | Báo lỗi rõ, không mất ảnh đang dùng; có thể thử lại. |
| I-UI-01 | 1. Mỗi role mở tất cả menu. 2. Thử dữ liệu rỗng, loading, lỗi mạng bằng cách ngắt kết nối trình duyệt rồi kết nối lại. 3. Bấm Thử lại/Tải lại. | Không crash hoặc báo thành công giả; có trạng thái rỗng/lỗi rõ; tải lại phục hồi. |
| I-UI-02 | 1. Dùng bàn phím Tab/Enter/Escape trong login, form, modal, filter. 2. Thử mobile và zoom 200%. | Có focus rõ; lỗi nằm gần field; modal đóng được; không mất nút hoặc nội dung quan trọng. |
| I-UI-03 | 1. Receptionist mở Tra cứu hội viên. 2. Thử tìm kiếm nếu có điều khiển. | Nếu vẫn là màn hình “chưa khả dụng”, ghi `Blocked` cho nghiệp vụ tra cứu, không tính Pass như tính năng đã có. |
| I-UI-04 | 1. Thay đổi giao diện sáng/tối và ngôn ngữ nếu UI có. 2. Refresh và đổi tài khoản. | Chữ, số tiền, thời gian, nút dễ đọc và nhất quán; sở thích không làm lẫn dữ liệu account. |

## 2. System test theo luồng trên trình duyệt

Mỗi luồng bắt đầu bằng dữ liệu test riêng; làm đúng thứ tự và chụp màn hình tại các mốc. Khi một bước yêu cầu màn hình chưa có, ghi `Blocked` cho luồng cùng bước cụ thể.

| ID | Các bước liên tiếp trên UI | Kết quả cuối cần nhìn thấy |
|---|---|---|
| S-01 Đăng ký đến đi học | 1. Guest đăng ký/xác minh mail/login. 2. Member mua gói qua PayOS. 3. Manager tạo lớp rồi thêm lộ trình. 4. Member đăng ký lớp. 5. Coach điểm danh. 6. Member đọc thông báo; manager xem báo cáo. | Gói active, lớp đã đăng ký, lộ trình đầy đủ, điểm danh và báo cáo thống nhất. |
| S-02 Bán tại quầy đến đăng ký | 1. Admin tạo member test. 2. Receptionist thu tiền mặt. 3. Member login xem gói/hóa đơn. 4. Đăng ký lớp đúng môn. | Có quyền ngay sau thu; giao dịch và lịch lớp cùng member. |
| S-03 Tạo lớp từ đầu | 1. Admin tạo coach/gán môn. 2. Manager tạo phòng, gói, lớp mã tự nhập. 3. Mở detail thấy 0 buổi. 4. Tạo nhiều buổi/import. 5. Coach mở lịch. | Tên/mã/môn/phòng/coach và tổng số buổi thống nhất ở các trang. |
| S-04 Import có lỗi rồi sửa | 1. Manager chuẩn bị file 5 buổi, làm 1 dòng sai. 2. Import và xem tổng buổi. 3. Sửa file, import lại. | Lần đầu không thêm nửa chừng; lần sau đủ 5 buổi. |
| S-05 Mở/đóng đăng ký | 1. Tạo lớp có giờ mở/đóng và buổi đầu. 2. Member xem trước mở, trong hạn, sau đóng. 3. Manager gia hạn hợp lệ. | Chỉ đăng ký được trong cửa sổ hợp lệ; sau gia hạn mở lại trước buổi đầu. |
| S-06 Ghế cuối và hủy | 1. Lớp 1 chỗ, hai member đủ gói mở ở hai browser profile. 2. Cùng bấm đăng ký. 3. Người thành công hủy trước buổi đầu; người kia đăng ký lại. | Không bao giờ có hai người chiếm một chỗ; ghế được trả sau hủy. |
| S-07 Gói sai môn/hết hạn | 1. Member không gói thử lớp Gym. 2. Mua Yoga thử lại. 3. Mua Gym đủ hạn thử lại. | Hai lần đầu không vào lớp; lần cuối vào được và thấy lịch. |
| S-08 Hai lớp trùng giờ | 1. Manager tạo hai lớp khác phòng/coach có buổi giao giờ. 2. Member đăng ký A rồi B. 3. Manager dời B đến giờ không giao, member thử lại. | B chỉ đăng ký được sau dời giờ; lịch không chồng. |
| S-09 Thay lịch sau đăng ký | 1. Member đăng ký lớp có gói vừa đủ hạn. 2. Manager thêm/dời buổi vượt hạn hoặc trùng lịch khác của member. 3. Thử lịch hợp lệ. | Thay đổi gây sai quyền/lịch bị chặn; thay đổi hợp lệ hiện ở member và coach. |
| S-10 Đổi môn/sĩ số/phòng | 1. Member Gym-only đăng ký Gym. 2. Manager thử đổi lớp sang Yoga, giảm sĩ số dưới số đăng ký, đổi phòng nhỏ/sai môn. 3. Refresh mọi trang. | Không làm member mất quyền hoặc vượt sức chứa; dữ liệu trước đó vẫn đúng. |
| S-11 Xóa lịch có người học | 1. Member đăng ký lớp 1 buổi. 2. Manager thử xóa buổi cuối/lớp. 3. Coach điểm danh rồi thử xóa lần nữa. | Không mất lộ trình/điểm danh; chỉ lớp sạch mới xóa được. |
| S-12 Chuyển coach | 1. Coach A/B đủ môn. 2. Manager chuyển một buổi từ A sang B. 3. A/B mở lịch/roster và thử điểm danh. 4. Member xem detail. | B dạy và điểm danh, A không còn quyền, member thấy coach mới. |
| S-13 Quyền coach sau đổi môn/khóa | 1. A có lớp/buổi tương lai. 2. Admin thử bỏ môn/đổi role/khóa. 3. Manager chuyển buổi nếu cần. | Không có lịch dạy bị mất âm thầm; các thao tác bị chặn hoặc có cách chuyển buổi rõ. |
| S-14 Điểm danh và thông báo | 1. A đăng ký, B không đăng ký. 2. Coach đánh A Có mặt. 3. A xem/đánh dấu đã xem. 4. Coach đổi Vắng mặt. 5. A/B mở Trang của tôi. | Chỉ A có thông báo, trạng thái đổi đúng và trở lại chưa xem. |
| S-15 Gói đã bán tạm ngưng | 1. Member mua gói. 2. Manager thử sửa/xóa rồi tạm ngưng. 3. Member xem gói đã mua, người khác thử mua mới. 4. Mở bán lại. | Lịch sử/quyền cũ còn; tạm ngưng chặn mua mới; mở bán lại bình thường. |
| S-16 Gia hạn/nâng gói | 1. Member mua Gym ngắn hạn. 2. Gia hạn cùng gói. 3. Nâng gói thêm Yoga. 4. Đăng ký lớp Yoga có buổi cuối trong hạn. | Ngày quyền lợi và môn được phép nhất quán trên checkout, Trang của tôi và đăng ký lớp. |
| S-17 PayOS hủy rồi mua lại | 1. Member tạo link và hủy trên PayOS. 2. Về app xem lịch sử/gói. 3. Tạo link mới, trả thành công, bấm Kiểm tra lại. | Giao dịch hủy không cấp gói; giao dịch thành công cấp đúng một lần. |
| S-18 Báo cáo sau thay đổi | 1. Tạo giao dịch hoàn tất/chờ/hủy qua UI. 2. Thêm/dời/xóa buổi hợp lệ. 3. Manager xem hai tab báo cáo, xuất/in. | Doanh thu và tiến độ khớp dữ liệu nhìn thấy; file/tờ in khớp bộ lọc. |
| S-19 Đổi tài khoản liên tục | 1. Member A mở lịch, hóa đơn, thông báo. 2. Logout/login B; Back/Forward/refresh. 3. Login coach và receptionist cùng trình duyệt lần lượt. | Mỗi role thấy đúng menu/dữ liệu; không lưu lại thông tin của A trên màn hình role sau. |
| S-20 Trạng thái rỗng và lỗi mạng | 1. Login các role với dữ liệu test tối thiểu. 2. Mở mọi menu, modal và filter. 3. Ngắt mạng, thử tải/submit rồi kết nối lại. | Empty/error/loading dễ hiểu; retry có tác dụng; không báo đã lưu hoặc tạo trùng khi mạng lỗi. |
| S-21 Avatar và hồ sơ | 1. Member A tải ảnh hợp lệ rồi thử ảnh lỗi. 2. Refresh, logout/login B, quay lại A. 3. Đổi theme/ngôn ngữ nếu có. | Ảnh cũ giữ khi lỗi; avatar và dữ liệu hồ sơ không lẫn người; UI vẫn dễ đọc. |

## 3. Cross-module case cần chú ý khi chạy UI

| ID | Thao tác trên nhiều màn hình | Kết quả mong đợi |
|---|---|---|
| X-01 | Member đăng ký lớp; manager thử xóa buổi cuối; member refresh lịch. | Member không còn đăng ký mà thiếu toàn bộ lộ trình. |
| X-02 | Member đăng ký; manager dời buổi vượt hạn gói; member refresh gói/lịch. | Thay đổi bị chặn, quyền và lịch cũ còn. |
| X-03 | Member đăng ký hai lớp không trùng; manager dời một buổi chồng giờ. | Không xuất hiện trùng lịch cá nhân sau thao tác. |
| X-04 | Member Gym-only đăng ký; manager đổi lớp sang Yoga. | Không làm người đã đăng ký mất quyền môn. |
| X-05 | Lớp đầy hoặc phòng đúng bằng sĩ số; manager giảm sĩ số/phòng. | Không vượt số ghế hoặc sức chứa phòng trên mọi màn hình. |
| X-06 | Coach có lịch; admin bỏ môn/đổi role; manager chuyển buổi; coach mở lịch. | Coach đang dạy luôn hợp môn/role, lịch không mất. |
| X-07 | Coach đã điểm danh; manager chuyển coach/xóa buổi; member xem thông báo. | Lịch sử vẫn truy cập được, coach cũ không sửa tiếp. |
| X-08 | Gói đã có giao dịch; manager tạm ngưng; member mở hóa đơn và gói. | Quyền và số tiền cũ không đổi, mua mới bị chặn. |
| X-09 | Hai member cùng bấm ghế cuối trong hai browser profile. | Chỉ một người thành công, sĩ số không vượt giới hạn. |
| X-10 | Hai cửa sổ staff cùng mở giao dịch chờ; một xác nhận, một thử xác nhận/hủy trên dữ liệu cũ. | Không cấp gói hai lần; cửa sổ cũ được báo trạng thái mới hoặc lỗi rõ sau refresh. |
| X-11 | Member hủy gần giờ bắt đầu; coach mở roster/điểm danh cùng lúc. | Không có điểm danh cho member đã hủy hợp lệ; nếu đã qua giờ hủy thì member còn trong lớp. |
| X-12 | PayOS quay về app trước khi trạng thái xác nhận; member bấm Kiểm tra lại rồi mở lịch sử. | Trạng thái không thành công sớm; sau xác nhận mới có gói. |
| X-13 | Admin đổi email/khóa user chưa xác minh; dùng mail cũ/mới và thử login. | Không xác minh sai email hoặc login tài khoản khóa. |
| X-14 | Đăng nhập A, đổi B, xem lịch, thanh toán, thông báo, hồ sơ/ảnh. | Không rò dữ liệu hoặc quyền của A sang B. |
| X-15 | Gần 00:00 giờ Việt Nam, xem hạn đăng ký, điểm danh, ngày gói, báo cáo trên UI. | Ngày/giờ nhất quán giữa các màn hình, không lệch một ngày. Nếu không chờ được mốc thật, ghi `Blocked` cho nhánh này. |

## 4. Hoàn tất đợt test

1. Ghi kết quả từng ID; không để trống. Với `Fail`, lưu bước ngắn nhất tái hiện được và ảnh trước/sau. Với `Blocked`, ghi chính xác màn hình, dữ liệu hay dịch vụ test chưa sẵn sàng.
2. Sau khi sửa bug, chạy lại case Fail và các luồng `S-*`/`X-*` liên quan; kiểm bằng refresh và login lại. Không suy ra Pass từ thông báo vừa hiện sau khi bấm Lưu.
3. Kiểm đủ menu: guest; admin (dashboard, nhân sự, gói, thanh toán, accounts); manager (dashboard, báo cáo, gói, phòng, lớp, thanh toán, hồ sơ); receptionist (quầy, tra cứu, hóa đơn, hồ sơ); coach (tổng quan, lịch dạy, hồ sơ); member (trang của tôi, gói, thanh toán, lớp, lịch, hồ sơ).

| Nhóm | Pass | Fail | Blocked | Bug IDs |
|---|---:|---:|---:|---|
| Integration `I-*` |  |  |  |  |
| System `S-*` |  |  |  |  |
| Cross-module `X-*` |  |  |  |  |

**Giới hạn của manual FE:** kiểm qua màn hình không chứng minh được unique constraint, transaction rollback, bảo mật API hoặc số bản ghi DB. Những phần đó thuộc bộ automation/API/DB riêng. Một số nhánh thời gian, chuyển khoản thủ công và tra cứu hội viên có thể cần đánh dấu `Blocked` vì chưa có UI hoặc chưa đến thời điểm kiểm.
