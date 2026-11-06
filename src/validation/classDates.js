// Luật về thời gian của lớp (T2.4). Hàm thuần, so sánh chuỗi theo giờ Việt Nam để test bằng node --test.
//  - Ngày bắt đầu/kết thúc lớp: dạng yyyy-MM-dd.
//  - Hạn đăng ký (registrationCloseAt): yyyy-MM-ddTHH:mm khi timed = true, yyyy-MM-dd khi timed = false.

const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/
const ymd = (value) => (value ? String(value).slice(0, 10) : '')
export const dmy = (value) => (value ? `${String(value).slice(8, 10)}/${String(value).slice(5, 7)}/${String(value).slice(0, 4)}` : '')

// Giờ Việt Nam hiện tại, dạng yyyy-MM-ddTHH:mm.
export const vnStamp = (now = new Date()) => new Date(now.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 16)
export const addDays = (date, n) => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Giá trị BE trả về → giá trị cho ô nhập. edge: giờ mặc định khi BE chỉ có ngày (mở = 00:00, đóng = 23:59).
export const toFormDate = (value) => ymd(value)
export const toFormStamp = (value, edge = 'start') => {
  if (!value) return ''
  const text = String(value)
  return text.length > 10 ? text.slice(0, 16) : `${text}T${edge === 'end' ? '23:59' : '00:00'}`
}
// Giá trị ô nhập → giá trị gửi BE (LocalDateTime hoặc LocalDate).
export const toPayloadStamp = (value, timed) => (!value ? null : timed ? `${String(value).slice(0, 16)}:00` : ymd(value))

/**
 * Trả về danh sách lỗi (tiếng Việt).
 * options.now: thời điểm hiện tại. Có thì mới kiểm tra "không được ở quá khứ".
 * options.original: lớp đang sửa. Giá trị không đổi so với bản gốc thì không bị kiểm tra quá khứ (để sửa lớp đang chạy).
 * options.requireDates: bắt buộc nhập ngày bắt đầu và kết thúc lớp.
 */
export function validateClassDates(form, { now = null, original = null, timed = true, requireDates = false } = {}) {
  const errors = []
  const start = ymd(form.startDate)
  const end = ymd(form.endDate)
  const stamp = (value) => (timed ? String(value || '').slice(0, 16) : ymd(value))
  // registrationOpenAt không còn dùng (BE luôn đặt null): chỉ còn hạn đăng ký registrationCloseAt (tùy chọn).
  const close = stamp(form.registrationCloseAt)
  const before = (key) => {
    if (!original) return null
    if (key === 'startDate' || key === 'endDate') return ymd(original[key])
    return timed ? toFormStamp(original[key], key === 'registrationCloseAt' ? 'end' : 'start') : ymd(original[key])
  }
  const changed = (key, value) => !original || value !== before(key)

  if (requireDates && !start) errors.push('Vui lòng nhập ngày bắt đầu lớp.')
  if (requireDates && !end) errors.push('Vui lòng nhập ngày kết thúc lớp.')
  if (now) {
    const current = vnStamp(now)
    const tomorrow = addDays(current.slice(0, 10), 1)
    if (start && changed('startDate', start) && start < tomorrow) errors.push(`Ngày bắt đầu lớp phải từ ngày mai (${dmy(tomorrow)}) trở đi.`)
  }
  if (start && end && end <= start) errors.push('Ngày kết thúc lớp phải sau ngày bắt đầu.')
  errors.push(...deadlineProblems(close, { startDate: start, now, changed: changed('registrationCloseAt', close), timed }))
  return errors
}

/**
 * Luật hạn đăng ký (dùng chung cho form lớp và modal "Gia hạn"). Trống = không đặt hạn → không lỗi.
 *  - đúng định dạng (chặn năm bất thường như 222222)
 *  - ở tương lai (chỉ khi changed = giá trị khác bản đang lưu, giống BE; cần now)
 *  - không sau 00:00 ngày bắt đầu lớp
 */
export function deadlineProblems(value, { startDate = '', now = null, changed = true, timed = true } = {}) {
  const close = timed ? String(value || '').slice(0, 16) : ymd(value)
  if (!close) return []
  if (!(timed ? STAMP : DAY).test(close)) return ['Hạn đăng ký không hợp lệ, vui lòng chọn lại ngày giờ.']
  const errors = []
  if (now && changed && (timed ? close <= vnStamp(now) : close < vnStamp(now).slice(0, 10))) errors.push('Hạn đăng ký phải ở tương lai.')
  const start = ymd(startDate)
  if (start && (timed ? close > `${start}T00:00` : close >= start)) errors.push(`Hạn đăng ký không được sau 00:00 ngày bắt đầu lớp (${dmy(start)}).`)
  return errors
}