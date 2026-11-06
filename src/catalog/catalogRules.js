// Luật cho trang Danh sách lớp: lọc (T2.1) và vòng đời/trạng thái lớp (T2.2). Hàm thuần để test.
import { vietnamTime } from '../services/api.js'
import { isUnscheduled } from '../validation/sessionPattern.js'

// upcoming = lớp chưa có buổi học nào (chưa xếp lịch). expired / started = lớp chưa kết thúc nhưng không còn nhận đăng ký lớp.
export const STATUS = {
  upcoming: { label: 'Chưa mở', badge: 'badge-wait' },
  open: { label: 'Đang mở', badge: 'badge-green' },
  full: { label: 'Đã đầy', badge: 'badge-red' },
  expired: { label: 'Hết hạn đăng ký', badge: 'badge-amber' },
  started: { label: 'Đã bắt đầu', badge: 'badge-blue' },
  closed: { label: 'Đã đóng', badge: 'badge-gray' },
}

export const TIME_SLOTS = [
  { value: 'morning', label: 'Sáng (trước 12h)', from: 0, to: 12 },
  { value: 'afternoon', label: 'Chiều (12h–17h)', from: 12, to: 17 },
  { value: 'evening', label: 'Tối (từ 17h)', from: 17, to: 24 },
]

export const EMPTY_FILTERS = { subject: '', coachId: '', date: '', slot: '', status: '', hasSeats: false, showClosed: false }

const at = (value) => new Date(vietnamTime(value))
const hasTime = (value) => String(value).length > 10
const dayStart = (value) => (!value ? null : at(`${String(value).slice(0, 10)}T00:00:00`))
const dayEnd = (value) => (!value ? null : hasTime(value) ? at(`${String(value).slice(0, 16)}:59`) : at(`${String(value).slice(0, 10)}T23:59:59`))
// Hạn đăng ký (registrationCloseAt): có giờ thì đúng phút đó (bây giờ <= hạn vẫn được); lớp cũ chỉ có ngày thì hết ngày đó.
// registrationOpenAt không còn dùng (BE luôn đặt null) nên bỏ qua.
const deadlineOf = (cls) => {
  const value = cls?.registrationCloseAt
  return !value ? null : hasTime(value) ? at(`${String(value).slice(0, 16)}:00`) : at(`${String(value).slice(0, 10)}T23:59:59`)
}

// Lớp đã bắt đầu: bây giờ >= 00:00 ngày bắt đầu (giờ Việt Nam). Lớp chưa có ngày bắt đầu thì coi là chưa bắt đầu.
export const classStarted = (cls, now = new Date()) => { const start = dayStart(cls?.startDate); return Boolean(start && now >= start) }
export const classEnded = (cls, now = new Date()) => { const end = dayEnd(cls?.endDate); return Boolean(end && now > end) }
// Đã quá hạn đăng ký (chỉ khi có đặt hạn).
export const deadlinePassed = (cls, now = new Date()) => { const deadline = deadlineOf(cls); return Boolean(deadline && now > deadline) }

// Đúng quy tắc BE: đăng ký LỚP được khi (chưa đặt hạn hoặc bây giờ <= hạn) VÀ lớp chưa bắt đầu VÀ lớp chưa kết thúc.
export const registrationOpen = (cls, now = new Date()) => !deadlinePassed(cls, now) && !classStarted(cls, now) && !classEnded(cls, now)

// "dd/MM/yyyy HH:mm" (hoặc dd/MM/yyyy khi chỉ có ngày) của hạn đăng ký.
const deadlineStamp = (value) => {
  const v = String(value)
  const day = `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}`
  return hasTime(v) ? `${day} ${v.slice(11, 16)}` : day
}
// Dòng "Hạn đăng ký" trong chi tiết lớp, khớp với điều kiện hiện nút "Gia hạn" (canExtendDeadline: chưa bắt đầu và chưa kết thúc).
// null = ẩn dòng. kind: 'open' | 'none' | 'expired' (còn nút Gia hạn) · 'started' | 'ended' (không có nút).
export function deadlineDisplay(cls, now = new Date()) {
  const value = cls?.registrationCloseAt
  if (classEnded(cls, now)) return value ? { kind: 'ended', text: deadlineStamp(value) } : null
  if (classStarted(cls, now)) return value ? { kind: 'started', text: deadlineStamp(value), note: 'Lớp đã bắt đầu, không nhận đăng ký' } : null
  if (!value) return { kind: 'none', text: 'Không giới hạn đến khi lớp bắt đầu' }
  if (deadlinePassed(cls, now)) return { kind: 'expired', text: `Đã hết hạn đăng ký (${deadlineStamp(value)})` }
  return { kind: 'open', text: deadlineStamp(value) }
}

// Nút "Gia hạn" (manager, trong chi tiết lớp): hiện khi lớp chưa bắt đầu và chưa kết thúc, kể cả khi hạn đã qua hoặc chưa đặt hạn.
export const canExtendDeadline = (cls, now = new Date()) => !classStarted(cls, now) && !classEnded(cls, now)

// Vòng đời của lớp theo ngày (chỉ có tác dụng khi BE đã trả các trường ngày):
//  - Quá ngày kết thúc lớp                    → closed  (Đã đóng, mặc định ẩn)
//  - Lớp đã bắt đầu (chưa kết thúc)           → started (Đã bắt đầu)
//  - Chưa bắt đầu nhưng đã quá hạn đăng ký    → expired (Hết hạn đăng ký)
//  - Còn nhận đăng ký                         → null    (rồi xét theo buổi học/chỗ trống: Chưa mở / Đang mở / Đã đầy)
export function windowStatus(cls, now) {
  if (classEnded(cls, now)) return 'closed'
  if (classStarted(cls, now)) return 'started'
  if (deadlinePassed(cls, now)) return 'expired'
  return null
}

// Hội viên được đăng ký LỚP không: đúng registrationOpen và lớp chưa đóng (lớp cũ không có ngày thì đóng khi hết buổi).
export function canRegister(cls, status, now) {
  return status !== 'closed' && registrationOpen(cls, now)
}

// Đăng ký từng BUỔI (cách cũ, BE chưa đổi): mở khi lớp chưa đóng và không còn trong hạn đăng ký lớp
// (chưa đặt hạn thì mở luôn, như BE hiện tại).
export function sessionRegistrationOpen(cls, status, now) {
  if (status === 'closed') return false
  return !deadlineOf(cls) || deadlinePassed(cls, now) || classStarted(cls, now)
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
    // Đăng ký BUỔI HỌC: mở sau hạn đăng ký lớp (xem sessionRegistrationOpen); buổi chưa xếp giờ vẫn khóa riêng ở giao diện.
    const sessionsOpen = sessionRegistrationOpen(cls, status, now)
    // Đăng ký LỚP: trong hạn (registrationOpen), lớp còn chỗ và hội viên chưa đăng ký lớp.
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