// Lịch học hằng tuần của lớp (FEATURES.sessionPattern). Hàm thuần để test bằng node --test.
// BE lưu GymClass.sessionWeekdays dạng "MON,WED,FRI" và tự sinh một buổi cho mỗi ngày khớp thứ trong khoảng
// startDate..endDate (chỉ từ hôm nay trở đi). Buổi tự sinh CHƯA có giờ và phòng: startTime === endTime (00:00), roomId null.

// Thứ tự hiển thị T2..CN.
export const WEEKDAYS = [
  { code: 'MON', label: 'T2', name: 'Thứ 2' },
  { code: 'TUE', label: 'T3', name: 'Thứ 3' },
  { code: 'WED', label: 'T4', name: 'Thứ 4' },
  { code: 'THU', label: 'T5', name: 'Thứ 5' },
  { code: 'FRI', label: 'T6', name: 'Thứ 6' },
  { code: 'SAT', label: 'T7', name: 'Thứ 7' },
  { code: 'SUN', label: 'CN', name: 'Chủ nhật' },
]
const CODES = WEEKDAYS.map((w) => w.code)
// Date.getDay(): 0 = Chủ nhật.
const BY_JS_DAY = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

// Chuỗi BE ("MON,WED") hoặc mảng mã → mảng mã hợp lệ, không trùng, theo thứ tự MON..SUN.
export function parseWeekdays(value) {
  const list = Array.isArray(value) ? value : String(value ?? '').split(',')
  const picked = new Set(list.map((c) => String(c).trim().toUpperCase()))
  return CODES.filter((c) => picked.has(c))
}
// Mảng mã → chuỗi gửi BE ("" khi không chọn thứ nào).
export const serializeWeekdays = (codes) => parseWeekdays(codes).join(',')

const pad = (n) => String(n).padStart(2, '0')
// 'yyyy-MM-dd' → Date theo giờ địa phương (không qua UTC). Sai định dạng → null.
// Năm < 1900 cũng coi là sai: ô ngày của trình duyệt phát giá trị tạm như "0002-11-26" khi đang gõ năm,
// nếu nhận thì xem trước sẽ chạy từ hôm nay thay vì từ ngày bắt đầu đang nhập.
function parseDay(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''))
  if (!m || Number(m[1]) < 1900) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}
// Date → 'yyyy-MM-dd' theo giờ địa phương (không dùng toISOString để tránh lệch múi giờ).
export const localDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const weekdayOf = (day) => WEEKDAYS.find((w) => w.code === BY_JS_DAY[parseDay(day).getDay()])
// Tên thứ của một ngày ('yyyy-MM-dd' hoặc ngày giờ), vd "Thứ 2"; sai định dạng → ''.
export const weekdayName = (day) => (parseDay(day) ? weekdayOf(day).name : '')

// Các ngày 'yyyy-MM-dd' trong [startDate, endDate] (gồm cả hai đầu) rơi vào các thứ đã chọn.
export function generateDates(weekdayCodes, startDate, endDate) {
  const codes = new Set(parseWeekdays(weekdayCodes))
  const start = parseDay(startDate)
  const end = parseDay(endDate)
  if (!codes.size || !start || !end || end < start) return []
  const days = []
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (codes.has(BY_JS_DAY[d.getDay()])) days.push(localDay(d))
  }
  return days
}

// Các buổi BE sẽ tạo thêm: bỏ ngày trước hôm nay và ngày lớp đã có buổi (khi sửa lớp).
// existingSessions: các buổi của chính lớp này. Trả [{ date, weekdayLabel }].
export function previewSessions({ weekdays, startDate, endDate, existingSessions = [], now = new Date() }) {
  const today = localDay(now)
  const taken = new Set(existingSessions.map((s) => String(s.startTime ?? '').slice(0, 10)))
  return generateDates(weekdays, startDate, endDate)
    .filter((day) => day >= today && !taken.has(day))
    .map((date) => ({ date, weekdayLabel: weekdayOf(date).name }))
}

// Lỗi khi đã chọn thứ: thiếu ngày bắt đầu/kết thúc, thiếu coach, hoặc không có ngày nào khớp (từ hôm nay nếu truyền now).
// form: { sessionWeekdays (mảng mã hoặc chuỗi), startDate, endDate, coachId }.
export function patternProblems(form, { now } = {}) {
  if (!parseWeekdays(form?.sessionWeekdays).length) return []
  const errors = []
  if (!form.startDate || !form.endDate) errors.push('Cần nhập ngày bắt đầu và ngày kết thúc lớp để tạo lịch học hằng tuần.')
  if (form.coachId == null || form.coachId === '') errors.push('Cần chọn huấn luyện viên để tạo lịch học hằng tuần.')
  if (form.startDate && form.endDate) {
    const days = generateDates(form.sessionWeekdays, form.startDate, form.endDate)
    const today = now ? localDay(now) : ''
    if (!days.some((d) => d >= today)) errors.push('Không có ngày nào khớp các thứ đã chọn trong khoảng ngày của lớp.')
  }
  return errors
}

// Buổi chưa xếp giờ (BE tự sinh): giờ bắt đầu trùng giờ kết thúc.
export function isUnscheduled(session) {
  if (!session || session.startTime == null || session.endTime == null) return false
  return String(session.startTime).slice(0, 16) === String(session.endTime).slice(0, 16)
}
