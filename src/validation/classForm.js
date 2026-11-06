// Giá trị ban đầu của form tạo/sửa lớp (ClassFormModal). Hàm thuần để test bằng node --test.
import { toFormDate, toFormStamp } from './classDates.js'
import { parseWeekdays } from './sessionPattern.js'

// sessionWeekdays (FEATURES.sessionPattern): mảng mã thứ ['MON', 'WED']; backendStore.saveClass nối thành "MON,WED" khi gửi BE.
// registrationCloseAt = "Hết hạn đăng ký" (tùy chọn, không có mặc định). registrationOpenAt không còn dùng nên không có trong form.
export const EMPTY_CLASS_FORM = { classCode: '', name: '', subject: 'Gym', description: '', capacity: 15, coachId: '', startDate: '', endDate: '', registrationCloseAt: '', sessionWeekdays: [] }
// Các ngày của một kỳ học: mở kỳ mới và dùng làm mẫu đều để trống cả ba (không giữ / không dịch hạn cũ).
export const TERM_DATES = { startDate: '', endDate: '', registrationCloseAt: '' }

const ymd = (value) => (value ? String(value).slice(0, 10) : '')

// Lớp từ BE → giá trị form. Sửa lớp còn chạy thì nạp hạn đang có (để gia hạn).
// ended = lớp đã kết thúc: hạn cũ không còn ý nghĩa cho kỳ mới nên để trống ô hạn.
export function classToForm(cls, { timed = true, ended = false } = {}) {
  return {
    ...EMPTY_CLASS_FORM, ...Object.fromEntries(Object.keys(EMPTY_CLASS_FORM).map((k) => [k, cls[k] ?? ''])), id: cls.id,
    startDate: toFormDate(cls.startDate), endDate: toFormDate(cls.endDate),
    registrationCloseAt: ended ? '' : timed ? toFormStamp(cls.registrationCloseAt, 'end') : toFormDate(cls.registrationCloseAt),
    sessionWeekdays: parseWeekdays(cls.sessionWeekdays),
  }
}

// Mở kỳ mới từ gợi ý mã lớp: giữ thông tin lớp, xóa trắng ngày bắt đầu/kết thúc và hạn đăng ký.
export const reopenForm = (cls, options = {}) => ({ ...classToForm(cls, options), ...TERM_DATES })

// Đang mở kỳ mới: đã xác nhận mở kỳ mới, hoặc sửa lớp đã kết thúc mà đổi ngày bắt đầu/kết thúc.
export const isReopening = ({ reopen = false, ended = false, form, original }) => reopen
  || (ended && Boolean(original) && (ymd(form?.startDate) !== ymd(original.startDate) || ymd(form?.endDate) !== ymd(original.endDate)))
