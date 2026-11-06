// Luật cho trang Danh sách lớp: lọc (T2.1) và vòng đời/trạng thái lớp (T2.2). Hàm thuần để test.
import { vietnamTime } from '../services/api.js'
import { isUnscheduled } from '../validation/sessionPattern.js'

export const STATUS = {
  upcoming: { label: 'Chưa mở', badge: 'badge-wait' },
  open: { label: 'Đang mở', badge: 'badge-green' },
  full: { label: 'Đã đầy', badge: 'badge-red' },
  closed: { label: 'Đã đóng', badge: 'badge-gray' },
}

export const TIME_SLOTS = [
  { value: 'morning', label: 'Sáng (trước 12h)', from: 0, to: 12 },
  { value: 'afternoon', label: 'Chiều (12h–17h)', from: 12, to: 17 },
  { value: 'evening', label: 'Tối (từ 17h)', from: 17, to: 24 },
]

export const EMPTY_FILTERS = { subject: '', coachId: '', date: '', slot: '', status: '', hasSeats: false, showClosed: false }

const at = (value) => new Date(vietnamTime(value))
// Mốc thời gian đăng ký sớm: BE có thể trả ngày (yyyy-MM-dd) hoặc ngày giờ (yyyy-MM-ddTHH:mm:ss).
// Chỉ có ngày thì mốc mở là 00:00 và mốc đóng là hết ngày đó; có giờ thì dùng đúng giờ đó.
const hasTime = (value) => String(value).length > 10
const dayStart = (value) => (!value ? null : hasTime(value) ? at(`${String(value).slice(0, 16)}:00`) : at(`${String(value).slice(0, 10)}T00:00:00`))
const dayEnd = (value) => (!value ? null : hasTime(value) ? at(`${String(value).slice(0, 16)}:59`) : at(`${String(value).slice(0, 10)}T23:59:59`))

// Vòng đời của lớp theo ngày (chỉ có tác dụng khi BE đã trả các trường ngày):
//  - Quá ngày kết thúc lớp             → closed   (Đã đóng, mặc định ẩn)
//  - Trước/trong thời gian đăng ký sớm → upcoming (Chưa mở)
//  - Sau khi đăng ký sớm kết thúc      → null     (rồi xét theo buổi học/chỗ trống: Đang mở hoặc Đã đầy)
export function windowStatus(cls, now) {
  const open = dayStart(cls.registrationOpenAt)
  const closeEnd = dayEnd(cls.registrationCloseAt)
  const end = dayEnd(cls.endDate)
  if (end && now > end) return 'closed'
  if ((open && now < open) || (closeEnd && now <= closeEnd)) return 'upcoming'
  return null
}

// Hội viên được đăng ký LỚP không: lớp đang mở thì được; lớp chưa mở chỉ được khi đã tới giờ mở đăng ký sớm.
// (Đăng ký buổi học còn chặt hơn: chỉ khi lớp đã mở thật, xem sessionsOpen trong buildCatalog.)
export function canRegister(cls, status, now) {
  if (status === 'open') return true
  if (status !== 'upcoming') return false
  const open = dayStart(cls.registrationOpenAt)
  return Boolean(open && now >= open)
}

// available: danh sách buổi còn chỗ do BE trả (chỉ hội viên có); null nếu chưa biết sĩ số.
// BE chỉ trả buổi tương lai còn chỗ, nên buổi tương lai không nằm trong danh sách ⇒ đã đầy.
// classStats (khi bật đăng ký lớp): [{ classId, registeredCount, remainingSlots, registeredByMe }] — sĩ số tính theo số hội viên đã đăng ký LỚP.
export function buildCatalog({ classes, schedules, available = null, classStats = null, now = new Date() }) {
  const stats = classStats ? new Map(classStats.map((c) => [Number(c.classId), c])) : null
  const free = available ? new Map(available.map((s) => [Number(s.id), s])) : null
  return classes.map((cls) => {
    const sessions = schedules
      .filter((s) => Number(s.classId) === Number(cls.id))
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((s) => {
        // Buổi chưa xếp giờ (FEATURES.sessionPattern): chưa "bắt đầu" cho tới hết ngày của buổi, không có sĩ số
        // (BE không trả trong danh sách còn chỗ) nên không bị tính là đầy.
        const unscheduled = isUnscheduled(s)
        const closed = unscheduled ? dayEnd(s.startTime.slice(0, 10)) < now : at(s.startTime) <= now
        const row = free?.get(Number(s.id))
        let registered = null
        let remaining = null
        if (free && !closed && !unscheduled) {
          registered = row ? Number(row.registeredCount) : cls.capacity
          remaining = row ? Number(row.remainingSlots) : 0
        }
        return { ...s, unscheduled, closed, registered, remaining, full: !closed && remaining === 0 }
      })
    const upcoming = sessions.filter((s) => !s.closed)
    const bookable = upcoming.filter((s) => !s.unscheduled) // buổi sắp tới đã có giờ (đăng ký được)
    const hasCounts = Boolean(free)
    const classStat = stats ? (stats.get(Number(cls.id)) || { registeredCount: 0, remainingSlots: cls.capacity, registeredByMe: false }) : null
    let status = windowStatus(cls, now)
    if (!status) {
      status = 'open'
      if (!sessions.length) status = 'upcoming' // chưa xếp lịch
      else if (!upcoming.length) status = 'closed'
      else if (classStat) { if (classStat.remainingSlots === 0) status = 'full' }
      else if (hasCounts && bookable.length && bookable.every((s) => s.full)) status = 'full'
    }
    const next = bookable.find((s) => !s.full) || bookable[0] || upcoming[0] || null
    // Khoảng ngày suy ra từ các buổi học (dùng khi BE chưa có ngày bắt đầu/kết thúc của lớp)
    const range = sessions.length
      ? { firstDate: sessions[0].startTime.slice(0, 10), lastDate: sessions[sessions.length - 1].startTime.slice(0, 10), sessionCount: sessions.length }
      : { firstDate: '', lastDate: '', sessionCount: 0 }
    const timeOk = canRegister(cls, status, now)
    // Đăng ký BUỔI HỌC chỉ mở khi lớp đã mở thật (sau khi đăng ký sớm kết thúc). Trong thời gian đăng ký sớm chỉ đăng ký được LỚP.
    const sessionsOpen = status === 'open' || status === 'full'
    // Đăng ký LỚP: trong thời gian cho phép, lớp còn chỗ và hội viên chưa đăng ký lớp.
    const canJoin = Boolean(classStat) && timeOk && !classStat.registeredByMe && classStat.remainingSlots > 0
    return {
      cls, sessions, upcoming, next, status, canRegister: timeOk, sessionsOpen, classStat, canJoin, hasCounts, ...range,
      coachIds: [...new Set([cls.coachId, ...sessions.map((s) => s.coachId)].filter(Boolean).map(Number))],
    }
  })
}

const slotOf = (startTime) => {
  const hour = Number(startTime.slice(11, 13))
  return TIME_SLOTS.find((s) => hour >= s.from && hour < s.to)?.value
}

// Các điều kiện kết hợp bằng AND. Lớp "Đã đóng" bị ẩn trừ khi bật showClosed hoặc chọn trạng thái Đã đóng.
export function filterCatalog(items, f) {
  return items.filter((item) => {
    if (f.subject && item.cls.subject !== f.subject) return false
    if (f.coachId && !item.coachIds.includes(Number(f.coachId))) return false
    if (item.status === 'closed' && !f.showClosed && f.status !== 'closed') return false
    if (f.status && item.status !== f.status) return false
    if (f.hasSeats && item.hasCounts && !item.upcoming.some((s) => !s.full && !s.unscheduled)) return false
    if (f.date || f.slot) {
      // Buổi chưa xếp giờ chỉ khớp lọc theo ngày, không thuộc khung giờ nào.
      const ok = item.sessions.some((s) => (!f.date || s.startTime.slice(0, 10) === f.date) && (!f.slot || (!s.unscheduled && slotOf(s.startTime) === f.slot)))
      if (!ok) return false
    }
    return true
  })
}

export const hasActiveFilter = (f) => Object.keys(EMPTY_FILTERS).some((k) => f[k] !== EMPTY_FILTERS[k])