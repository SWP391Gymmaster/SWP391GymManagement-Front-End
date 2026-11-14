// Luật về thời gian của lớp (T2.4). Hàm thuần, so sánh chuỗi theo giờ Việt Nam để test bằng node --test.
//  - Ngày bắt đầu/kết thúc lớp: dạng yyyy-MM-dd.
//  - Mở/kết thúc đăng ký sớm: yyyy-MM-ddTHH:mm khi timed = true, yyyy-MM-dd khi timed = false.

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
  const open = stamp(form.registrationOpenAt)
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
    if (open && changed('registrationOpenAt', open) && (timed ? open < current : open < current.slice(0, 10))) {
      errors.push(timed ? 'Thời gian mở đăng ký sớm không được trước thời điểm hiện tại.' : 'Ngày mở đăng ký sớm không được trước ngày hiện tại.')
    }
    if (close && changed('registrationCloseAt', close) && (timed ? close <= current : close < current.slice(0, 10))) {
      errors.push(timed ? 'Hạn đăng ký phải sau thời điểm hiện tại.' : 'Hạn đăng ký không được trước ngày hiện tại.')
    }
  }
  if (start && end && end <= start) errors.push('Ngày kết thúc lớp phải sau ngày bắt đầu.')
  if (requireDates && !close) errors.push('Vui lòng nhập hạn đăng ký lớp.')
  if (open && close && (timed ? close <= open : close < open)) {
    errors.push(timed ? 'Hạn đăng ký phải sau thời gian mở.' : 'Hạn đăng ký phải từ ngày mở trở đi.')
  }
  if (close && start) {
    if (timed && close > `${start}T00:00`) errors.push(`Hạn đăng ký phải trước 00:00 ngày bắt đầu lớp (${dmy(start)}).`)
    if (!timed && close >= start) errors.push('Hạn đăng ký phải trước ngày bắt đầu lớp.')
  }
  return errors
}
