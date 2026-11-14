// Luật cho trang Danh sách lớp: lọc (T2.1) và vòng đời/trạng thái lớp (T2.2). Hàm thuần để test.
import { vietnamTime } from '../services/api.js'

export const STATUS = {
  open: { label: 'Đang mở', badge: 'badge-green' },
  pending: { label: 'Chưa mở đăng ký', badge: 'badge-amber' },
  full: { label: 'Đã đầy', badge: 'badge-red' },
  closed: { label: 'Đã đóng', badge: 'badge-gray' },
}

export const TIME_SLOTS = [
  { value: 'morning', label: 'Sáng (trước 12h)', from: 0, to: 12 },
  { value: 'afternoon', label: 'Chiều (12h–17h)', from: 12, to: 17 },
  { value: 'evening', label: 'Tối (từ 17h)', from: 17, to: 24 },
]

export const EMPTY_FILTERS = { subject: '', coachId: '', date: '', slot: '', status: '', hasSeats: false, showClosed: true }

const at = (value) => new Date(vietnamTime(value))
// Mốc thời gian đăng ký sớm: BE có thể trả ngày (yyyy-MM-dd) hoặc ngày giờ (yyyy-MM-ddTHH:mm:ss).
// Chỉ có ngày thì mốc mở là 00:00 và mốc đóng là hết ngày đó; có giờ thì dùng đúng giờ đó.
const hasTime = (value) => String(value).length > 10
const dayStart = (value) => (!value ? null : hasTime(value) ? at(`${String(value).slice(0, 16)}:00`) : at(`${String(value).slice(0, 10)}T00:00:00`))
const dayEnd = (value) => (!value ? null : hasTime(value) ? at(`${String(value).slice(0, 16)}:59`) : at(`${String(value).slice(0, 10)}T23:59:59`))

// Trạng thái đăng ký lớp theo hạn chót; lớp đã đăng ký vẫn hiện trong catalog.
export function windowStatus(cls, now) {
  const openStart = cls.registrationOpenAt ? (hasTime(cls.registrationOpenAt) ? at(cls.registrationOpenAt) : dayStart(cls.registrationOpenAt)) : null
  const closeEnd = cls.registrationCloseAt ? (hasTime(cls.registrationCloseAt) ? at(cls.registrationCloseAt) : dayEnd(cls.registrationCloseAt)) : null
  const start = dayStart(cls.startDate)
  const end = dayEnd(cls.endDate)
  if (end && now > end) return 'closed'
  if ((closeEnd && now >= closeEnd) || (!closeEnd && start && now >= start)) return 'closed'
  if (openStart && now < openStart) return 'pending'
  return 'open'
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
        const closed = at(s.startTime) <= now
        const row = free?.get(Number(s.id))
        let registered = null
        let remaining = null
        if (free && !closed) {
          registered = row ? Number(row.registeredCount) : cls.capacity
          remaining = row ? Number(row.remainingSlots) : 0
        }
        return { ...s, closed, registered, remaining, full: !closed && remaining === 0 }
      })
    const upcoming = sessions.filter((s) => !s.closed)
    const hasCounts = Boolean(free)
    const classStat = stats ? (stats.get(Number(cls.id)) || { registeredCount: 0, remainingSlots: cls.capacity, registeredByMe: false }) : null
    let status = windowStatus(cls, now)
    if (!upcoming.length) status = 'closed'
    if (status === 'open') {
      if (classStat?.remainingSlots === 0) status = 'full'
      else if (!classStat && hasCounts && upcoming.every(s => s.full)) status = 'full'
    }
    const next = upcoming.find((s) => !s.full) || upcoming[0] || null
    // Khoảng ngày suy ra từ các buổi học (dùng khi BE chưa có ngày bắt đầu/kết thúc của lớp)
    const range = sessions.length
      ? { firstDate: sessions[0].startTime.slice(0, 10), lastDate: sessions[sessions.length - 1].startTime.slice(0, 10), sessionCount: sessions.length }
      : { firstDate: '', lastDate: '', sessionCount: 0 }
    const timeOk = status === 'open'
    // Đăng ký lớp: trong thời gian cho phép, lớp còn chỗ và hội viên chưa đăng ký.
    const canJoin = Boolean(classStat) && timeOk && upcoming.length > 0 && !classStat.registeredByMe && classStat.remainingSlots > 0
    return {
      cls, sessions, upcoming, next, status, canRegister: timeOk, classStat, canJoin, hasCounts, ...range,
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
    if (item.status === 'closed' && !item.classStat?.registeredByMe && !f.showClosed && f.status !== 'closed') return false
    if (f.status && item.status !== f.status) return false
    if (f.hasSeats && (item.classStat ? item.classStat.remainingSlots === 0 : item.hasCounts && !item.upcoming.some(s => !s.full))) return false
    if (f.date || f.slot) {
      const ok = item.sessions.some((s) => (!f.date || s.startTime.slice(0, 10) === f.date) && (!f.slot || slotOf(s.startTime) === f.slot))
      if (!ok) return false
    }
    return true
  })
}

export const hasActiveFilter = (f) => Object.keys(EMPTY_FILTERS).some((k) => f[k] !== EMPTY_FILTERS[k])
