import assert from 'node:assert/strict'
import test from 'node:test'
import { COACH_LOCK_REASON, coachLockReason } from '../src/validation/classRules.js'
import { TERM_DATES, classToForm, isReopening, reopenForm } from '../src/validation/classForm.js'
import { previewSessions } from '../src/validation/sessionPattern.js'
import { deadlineDisplay } from '../src/catalog/catalogRules.js'

// Tình huống thật: CLS-CARDIO-AM chưa có coach, buổi cuối 26/10/2026 (đã kết thúc), hạn cũ 20/01/2027.
const cardio = { id: 21, classCode: 'CLS-CARDIO-AM', name: 'Cardio', subject: 'Cardio', capacity: 15, coachId: null,
  startDate: '2026-09-01', endDate: '2026-10-26', registrationCloseAt: '2027-01-20T23:59:00', sessionWeekdays: 'MON,WED,FRI' }
const cardioSessions = [{ id: 158, classId: 21, coachId: 16, startTime: '2026-10-26T20:00:00', endTime: '2026-10-26T21:00:00' }]

test('mở kỳ mới: không giữ hạn đăng ký cũ, không giữ ngày cũ', () => {
  const form = reopenForm(cardio)
  assert.deepEqual([form.startDate, form.endDate, form.registrationCloseAt], ['', '', ''])
  assert.equal(form.classCode, 'CLS-CARDIO-AM')
  assert.deepEqual(form.sessionWeekdays, ['MON', 'WED', 'FRI'])
  // Dùng làm mẫu cũng xóa đúng ba ô này
  assert.deepEqual(TERM_DATES, { startDate: '', endDate: '', registrationCloseAt: '' })
})

test('sửa lớp đã kết thúc: ô hạn để trống; lớp còn chạy thì nạp hạn để gia hạn', () => {
  assert.equal(classToForm(cardio, { ended: true }).registrationCloseAt, '')
  assert.equal(classToForm(cardio).registrationCloseAt, '2027-01-20T23:59')
  assert.equal(classToForm(cardio, { ended: true }).startDate, '2026-09-01')
})

test('isReopening: xác nhận mở kỳ mới, hoặc lớp đã kết thúc và đổi ngày', () => {
  const original = classToForm(cardio)
  assert.equal(isReopening({ reopen: true, form: original, original }), true)
  assert.equal(isReopening({ ended: true, form: original, original }), false) // chưa đổi ngày
  assert.equal(isReopening({ ended: true, form: { ...original, startDate: '2026-11-26' }, original }), true)
  assert.equal(isReopening({ ended: false, form: { ...original, startDate: '2026-11-26' }, original }), false)
})

test('coachLockReason: lớp chưa có coach → không khóa (gán coach lần đầu)', () => {
  assert.equal(coachLockReason(cardio, cardioSessions), null)
  assert.equal(coachLockReason({ ...cardio, coachId: '' }, cardioSessions), null)
  assert.equal(coachLockReason({ ...cardio, coachId: 7 }, cardioSessions), COACH_LOCK_REASON)
})

test('coachLockReason: đang mở kỳ mới → không khóa dù lớp có coach và buổi học', () => {
  const withCoach = { ...cardio, coachId: 7, registeredCount: 4 }
  const original = classToForm(withCoach)
  const reopening = isReopening({ ended: true, form: { ...original, startDate: '2026-11-26', endDate: '2027-01-26' }, original })
  assert.equal(coachLockReason(withCoach, cardioSessions, reopening), null)
})

test('xem trước khi mở kỳ mới: nằm trong [ngày bắt đầu, ngày kết thúc] của form, từ hôm nay trở đi', () => {
  const now = new Date(2026, 10, 6, 9) // hôm nay 06/11/2026
  const form = { ...reopenForm(cardio), startDate: '2026-11-26', endDate: '2027-01-26' }
  const list = previewSessions({ weekdays: form.sessionWeekdays, startDate: form.startDate, endDate: form.endDate, existingSessions: cardioSessions, now })
  assert.equal(list[0].date, '2026-11-27') // T6 đầu tiên từ 26/11, không phải 06/11
  assert.equal(list.at(-1).date, '2027-01-25')
  assert.ok(list.every((p) => p.date >= '2026-11-26' && p.date <= '2027-01-26'))
  // Ngày bắt đầu trong quá khứ: chỉ từ hôm nay
  assert.equal(previewSessions({ weekdays: 'MON,WED,FRI', startDate: '2026-11-01', endDate: '2026-11-30', now })[0].date, '2026-11-06')
})

test('xem trước: giá trị tạm khi đang gõ năm (vd 0002-11-26) không tạo danh sách từ hôm nay', () => {
  const now = new Date(2026, 10, 6, 9)
  assert.deepEqual(previewSessions({ weekdays: 'MON,WED,FRI', startDate: '0002-11-26', endDate: '2027-01-26', now }), [])
  assert.deepEqual(previewSessions({ weekdays: 'MON,WED,FRI', startDate: '2026-11-26', endDate: '0202-01-26', now }), [])
})

test('dòng hạn đăng ký theo trạng thái lớp (khớp nút Gia hạn)', () => {
  const now = new Date('2026-11-06T10:00:00+07:00')
  const base = { startDate: '2026-11-26', endDate: '2027-01-26' }
  // chưa bắt đầu, không đặt hạn
  assert.deepEqual(deadlineDisplay({ ...base, registrationCloseAt: null }, now), { kind: 'none', text: 'Không giới hạn đến khi lớp bắt đầu' })
  // chưa bắt đầu, còn hạn
  assert.deepEqual(deadlineDisplay({ ...base, registrationCloseAt: '2026-11-20T18:30:00' }, now), { kind: 'open', text: '20/11/2026 18:30' })
  // chưa bắt đầu, hạn đã qua
  assert.deepEqual(deadlineDisplay({ ...base, registrationCloseAt: '2026-11-05T18:30:00' }, now), { kind: 'expired', text: 'Đã hết hạn đăng ký (05/11/2026 18:30)' })
  // đã bắt đầu
  const started = { startDate: '2026-11-01', endDate: '2027-01-26' }
  assert.equal(deadlineDisplay(started, now), null)
  assert.deepEqual(deadlineDisplay({ ...started, registrationCloseAt: '2026-10-30T20:00:00' }, now),
    { kind: 'started', text: '30/10/2026 20:00', note: 'Lớp đã bắt đầu, không nhận đăng ký' })
  // đã kết thúc
  assert.equal(deadlineDisplay({ startDate: '2026-09-01', endDate: '2026-10-26' }, now), null)
  assert.equal(deadlineDisplay({ startDate: '2026-09-01', endDate: '2026-10-26', registrationCloseAt: '2026-08-30T20:00:00' }, now).kind, 'ended')
})
