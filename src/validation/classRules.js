// Luật nghiệp vụ cho Lớp học và Buổi học (T2.4). Hàm thuần để test bằng node --test.
import { codeProblem, normalizeCode, roomMatchesSubject, roomTypeLabel } from './roomRules.js'
import { validateClassDates, vnStamp } from './classDates.js'
import { codePrefix, MAX_CLASSES_PER_COACH } from '../config/classDefaults.js'
import { coachIsFull, coachLoad, findDuplicate, findOverlaps } from './classDuplicates.js'
import { FEATURES } from '../config/features.js'
import { isUnscheduled } from './sessionPattern.js'

export { validateClassDates }

const ymd = (value) => (value ? String(value).slice(0, 10) : '')
const minute = (value) => String(value).slice(0, 16)
const hhmm = (value) => String(value).slice(11, 16)
const dm = (value) => `${String(value).slice(8, 10)}/${String(value).slice(5, 7)}`

// Mã lớp: A-Z, 0-9, "-", 3-32 ký tự (codeProblem), không kết thúc bằng "-" và không được chỉ có tiền tố bộ môn.
// originalCode = mã gốc khi sửa lớp; sửa mà không đổi mã thì bỏ qua hai luật mới, chỉ giữ codeProblem.
export function classCodeProblem(value, subject, originalCode) {
  const code = normalizeCode(value)
  const unchanged = originalCode != null && normalizeCode(originalCode) === code
  if (!unchanged) {
    const prefix = codePrefix(subject)
    if (code && (code === prefix || code === prefix.slice(0, -1))) return `Mã lớp cần thêm phần riêng sau tiền tố ${prefix} (ví dụ ${prefix}AM).`
    if (code.endsWith('-')) return 'Mã lớp không được kết thúc bằng dấu gạch ngang.'
  }
  return codeProblem(value, 'Mã lớp')
}

// FEATURES.coachSubjects: coach chỉ dạy bộ môn có trong subjects; coach không có subjects thì không dạy môn nào.
export const coachTeaches = (coach, subject) => Array.isArray(coach?.subjects) && coach.subjects.includes(subject)

// Lỗi khi coach không dạy bộ môn (chỉ khi bật cờ và có chọn coach). enabled mặc định theo FEATURES.coachSubjects.
export function coachSubjectProblem(coachId, subject, coaches = [], enabled = FEATURES.coachSubjects) {
  if (!enabled || coachId == null || coachId === '') return ''
  const coach = coaches.find((c) => String(c.id) === String(coachId))
  const name = coach?.name || `#${coachId}`
  if (!coach?.subjects?.length) return `Huấn luyện viên ${name} chưa được phân công bộ môn nào nên chưa thể nhận lớp.`
  if (!coachTeaches(coach, subject)) return `Huấn luyện viên ${name} không dạy bộ môn ${subject}.`
  return ''
}

const classLabel = (c) => `${c.classCode} – ${c.name}`
// Sửa lớp mà không đổi coach và ngày thì không kiểm tra lại trùng / số lớp (để sửa được lớp cũ đã vượt giới hạn).
export const sameAssignment = (form, original) => Boolean(original) && String(form.coachId ?? '') === String(original.coachId ?? '')
  && ymd(form.startDate) === ymd(original.startDate) && ymd(form.endDate) === ymd(original.endDate)

// Luật chặn lưu về coach: lớp trùng hoàn toàn (cùng coach, cùng ngày bắt đầu và kết thúc) và coach đã đủ số lớp.
// options: { classes, coaches, original, today }. Chỉ kiểm tra khi lớp có coach.
export function coachProblems(form, { classes = [], coaches = [], original = null, today } = {}) {
  if (form.coachId == null || form.coachId === '' || sameAssignment(form, original)) return []
  const errors = []
  const duplicate = findDuplicate(form, classes, { today })
  if (duplicate) errors.push(`Lớp trùng với lớp ${classLabel(duplicate)}: cùng huấn luyện viên, cùng ngày bắt đầu và ngày kết thúc.`)
  const load = coachLoad(form.coachId, classes, { startDate: form.startDate, endDate: form.endDate, excludeId: form.id, today })
  if (coachIsFull(load)) {
    const name = coaches.find((c) => String(c.id) === String(form.coachId))?.name || `#${form.coachId}`
    errors.push(`Coach ${name} đã đủ ${MAX_CLASSES_PER_COACH} lớp trong khoảng thời gian này.`)
  }
  return errors
}

// Cảnh báo (không chặn lưu): cùng coach và khoảng ngày giao với các lớp khác.
export function classWarnings(form, { classes = [], original = null, today } = {}) {
  if (sameAssignment(form, original)) return []
  const overlaps = findOverlaps(form, classes, { today })
  return overlaps.length ? [`Huấn luyện viên đang có ${overlaps.length} lớp gồm: ${overlaps.map((c) => c.classCode).join(', ')}.`] : []
}

// Lớp: mã, tên, sĩ số; khi sửa còn phải khớp với các phòng đã xếp lịch.
// usedRooms = các phòng mà lớp này đang dùng trong lịch (có thể rỗng khi tạo mới).
// dateOptions: xem validateClassDates (now, original, timed, requireDates); thêm classes, coaches cho luật coach (coachProblems)
// và coachSubjects (mặc định FEATURES.coachSubjects) cho luật coach theo bộ môn.
export function validateClass(form, usedRooms = [], dateOptions = {}) {
  const errors = []
  const code = classCodeProblem(form.classCode, form.subject, dateOptions.original?.classCode)
  if (code) errors.push(code)
  if (!String(form.name ?? '').trim()) errors.push('Tên lớp không được để trống.')
  const capacity = Number(form.capacity)
  if (!Number.isInteger(capacity) || capacity < 1) errors.push('Sĩ số phải là số nguyên lớn hơn 0.')
  else {
    const small = usedRooms.find((r) => capacity > Number(r.capacity))
    if (small) errors.push(`Sĩ số (${capacity}) vượt sức chứa phòng "${small.name}" (${small.capacity}) mà lớp đang dùng.`)
  }
  const wrong = usedRooms.find((r) => !roomMatchesSubject(r, form.subject))
  if (wrong) errors.push(`Bộ môn ${form.subject} không phù hợp với phòng "${wrong.name}" (${roomTypeLabel(wrong.type)}) mà lớp đang dùng.`)
  errors.push(...validateClassDates(form, dateOptions))
  if (dateOptions.classes) {
    const today = dateOptions.today || (dateOptions.now ? vnStamp(dateOptions.now).slice(0, 10) : undefined)
    errors.push(...coachProblems(form, { classes: dateOptions.classes, coaches: dateOptions.coaches, original: dateOptions.original, today }))
  }
  const subjectProblem = coachSubjectProblem(form.coachId, form.subject, dateOptions.coaches, dateOptions.coachSubjects ?? FEATURES.coachSubjects)
  if (subjectProblem) errors.push(subjectProblem)
  return errors
}

// Lý do không cho đổi coach của lớp (null = được đổi): lớp đã có buổi học hoặc đã có người đăng ký lớp.
// Mở kỳ mới (reopening) thì luôn được đổi. Tạo lớp mới (cls không có id) không khóa.
// Lớp chưa có coach thì không khóa: BE cho gán coach lần đầu.
// Số người đăng ký lấy từ cls.registeredCount nếu BE có trả; không có thì chỉ dựa vào buổi học.
export const COACH_LOCK_REASON = 'Lớp đã mở, không được phép thay đổi giáo viên'
export function coachLockReason(cls, schedules = [], reopening = false) {
  if (!cls || cls.id == null || cls.id === '' || reopening) return null
  if (cls.coachId == null || cls.coachId === '') return null
  const hasSessions = schedules.some((s) => String(s.classId) === String(cls.id))
  const hasRegistrations = Number(cls.registeredCount) > 0
  return hasSessions || hasRegistrations ? COACH_LOCK_REASON : null
}

// Coach của buổi học luôn là coach của lớp: lớp chưa có coach thì chưa thêm/sửa buổi được.
export const NO_CLASS_COACH = 'Lớp chưa có huấn luyện viên, hãy gán coach cho lớp trước.'
export const classHasCoach = (cls) => cls?.coachId != null && cls.coachId !== ''

// Tìm buổi khác trùng giờ về phòng hoặc huấn luyện viên. context = { schedules, classes }.
function conflicts(form, cls, room, { schedules = [], classes = [] }) {
  const errors = []
  const start = minute(form.startTime)
  const end = minute(form.endTime)
  const coachOf = (s) => s.coachId || classes.find((c) => String(c.id) === String(s.classId))?.coachId
  const myCoach = cls?.coachId
  const nameOf = (s) => classes.find((c) => String(c.id) === String(s.classId))?.name || `#${s.classId}`
  let roomDone = false
  let coachDone = false
  for (const s of schedules) {
    if (form.id && String(s.id) === String(form.id)) continue
    if (isUnscheduled(s)) continue // buổi chưa xếp giờ không tính trùng phòng/coach cho tới khi được điền giờ
    if (!(minute(s.startTime) < end && start < minute(s.endTime))) continue
    const when = `${hhmm(s.startTime)}–${hhmm(s.endTime)} ngày ${dm(s.startTime)}`
    if (!roomDone && room && String(s.roomId) === String(room.id)) {
      errors.push(`Phòng "${room.name}" đã có lớp "${nameOf(s)}" lúc ${when}.`)
      roomDone = true
    }
    if (!coachDone && myCoach && String(coachOf(s)) === String(myCoach)) {
      errors.push(`Huấn luyện viên đã dạy lớp "${nameOf(s)}" lúc ${when}.`)
      coachDone = true
    }
  }
  return errors
}

export const SESSION_DESCRIPTION_MAX = 1000

// Buổi học: cls và room là object đã tra cứu từ id; có thể undefined nếu chưa chọn.
// context: { schedules, classes }. Coach của buổi = coach của lớp (bộ môn đã kiểm tra khi lưu lớp), nên chỉ cần lớp có coach.
export function validateSchedule(form, cls, room, context = {}) {
  const errors = []
  if (!cls) errors.push('Vui lòng chọn lớp.')
  if (!room) errors.push('Vui lòng chọn phòng.')
  if (!form.startTime || !form.endTime) errors.push('Vui lòng nhập giờ bắt đầu và giờ kết thúc.')
  else if (form.endTime <= form.startTime) errors.push('Giờ kết thúc phải sau giờ bắt đầu.')
  if (cls && !classHasCoach(cls)) errors.push(NO_CLASS_COACH)
  if (String(form.description ?? '').length > SESSION_DESCRIPTION_MAX) errors.push(`Lộ trình / mô tả buổi học tối đa ${SESSION_DESCRIPTION_MAX} ký tự.`)
  if (cls && room) {
    if (Number(cls.capacity) > Number(room.capacity)) errors.push(`Sĩ số lớp (${cls.capacity}) vượt sức chứa phòng "${room.name}" (${room.capacity}).`)
    if (!roomMatchesSubject(room, cls.subject)) errors.push(`Phòng "${room.name}" (${roomTypeLabel(room.type)}) không phù hợp với bộ môn ${cls.subject}.`)
  }
  if (cls && form.startTime && form.endTime && form.endTime > form.startTime) {
    const day = ymd(form.startTime)
    if (ymd(cls.startDate) && day < ymd(cls.startDate)) errors.push(`Buổi học nằm trước ngày bắt đầu lớp (${dm(cls.startDate)}).`)
    if (ymd(cls.endDate) && day > ymd(cls.endDate)) errors.push(`Buổi học nằm sau ngày kết thúc lớp (${dm(cls.endDate)}).`)
    errors.push(...conflicts(form, cls, room, context))
  }
  return errors
}