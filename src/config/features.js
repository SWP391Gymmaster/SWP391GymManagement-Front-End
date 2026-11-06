// Bật/tắt tính năng phụ thuộc BE. Chỉ đổi sang true khi BE đã làm xong phần tương ứng.
export const FEATURES = {
  // BE đã có 4 trường ngày trong GymClass (startDate, endDate, registrationOpenAt, registrationCloseAt).
  classDates: true,
  // true: mở/kết thúc đăng ký sớm có cả giờ (BE đổi 2 trường registrationOpenAt/registrationCloseAt sang LocalDateTime).
  // false: chỉ nhập ngày (BE hiện tại, kiểu LocalDate); giờ mặc định mở 00:00 và đóng hết ngày.
  registrationTimes: true,
  // true: hội viên đăng ký LỚP trước, rồi mới đăng ký được buổi học của lớp đó (BE cần API đăng ký lớp, xem trang yêu cầu BE).
  classRegistration: true,
  // true: coach chỉ dạy bộ môn của mình. BE cần trả mảng subjects cho từng coach ở GET /api/coaches (ví dụ ["Yoga","Pilates"])
  // và có PUT /api/coaches/{id}/subjects (manager); mapUser trong services/api.js giữ trường subjects.
  coachSubjects: true,
  // true: mỗi buổi học có lộ trình / mô tả. BE cần thêm description cho Schedule và trả về trong GET /api/schedules.
  sessionDescription: true,
  // true: lớp có "Lịch học hằng tuần" (GymClass.sessionWeekdays, ví dụ "MON,WED,FRI"); BE tự sinh buổi chưa có giờ/phòng
  // cho mỗi ngày khớp thứ trong khoảng ngày của lớp. false: form lớp như cũ, không gửi sessionWeekdays.
  sessionPattern: true,
}