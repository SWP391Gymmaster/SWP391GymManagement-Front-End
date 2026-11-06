import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCatalog, classStarted, deadlinePassed, filterCatalog, registrationOpen, EMPTY_FILTERS } from '../src/catalog/catalogRules.js'

const now = new Date('2026-10-21T12:00:00+07:00')
const classes = [
  { id: 1, name: 'Yoga sáng', subject: 'Yoga', capacity: 10, coachId: 7 },
  { id: 2, name: 'Boxing tối', subject: 'Boxing', capacity: 5, coachId: 8 },
  { id: 3, name: 'Gym cũ', subject: 'Gym', capacity: 20, coachId: 7 },
]
const schedules = [
  { id: 11, classId: 1, coachId: 7, startTime: '2026-10-25T07:00:00', endTime: '2026-10-25T08:00:00' },
  { id: 21, classId: 2, coachId: 8, startTime: '2026-10-26T18:00:00', endTime: '2026-10-26T19:00:00' },
  { id: 31, classId: 3, coachId: 7, startTime: '2026-10-01T09:00:00', endTime: '2026-10-01T10:00:00' },
]
// BE chỉ trả buổi còn chỗ: buổi 21 (Boxing) không có trong danh sách ⇒ đã đầy.
const available = [{ id: 11, registeredCount: 4, remainingSlots: 6 }]
const items = buildCatalog({ classes, schedules, available, now })
const by = (n) => items.find((i) => i.cls.id === n)

test('trạng thái lớp: mở / đầy / đóng', () => {
  assert.equal(by(1).status, 'open')
  assert.equal(by(2).status, 'full')
  assert.equal(by(3).status, 'closed')
})

test('số chỗ còn lại của buổi sắp tới', () => {
  assert.equal(by(1).next.remaining, 6)
  assert.equal(by(1).next.registered, 4)
  assert.equal(by(2).next.remaining, 0)
})

test('không có dữ liệu sĩ số thì không kết luận đầy', () => {
  const unknown = buildCatalog({ classes, schedules, available: null, now })
  assert.equal(unknown.find((i) => i.cls.id === 2).status, 'open')
  assert.equal(unknown.find((i) => i.cls.id === 1).next.remaining, null)
})

test('lọc theo bộ môn, huấn luyện viên, trạng thái', () => {
  assert.deepEqual(filterCatalog(items, { ...EMPTY_FILTERS, subject: 'Yoga' }).map((i) => i.cls.id), [1])
  assert.deepEqual(filterCatalog(items, { ...EMPTY_FILTERS, coachId: '7' }).map((i) => i.cls.id), [1])
  assert.deepEqual(filterCatalog(items, { ...EMPTY_FILTERS, status: 'full' }).map((i) => i.cls.id), [2])
})

test('lọc ngày và khung giờ', () => {
  assert.deepEqual(filterCatalog(items, { ...EMPTY_FILTERS, date: '2026-10-25' }).map((i) => i.cls.id), [1])
  assert.deepEqual(filterCatalog(items, { ...EMPTY_FILTERS, slot: 'evening' }).map((i) => i.cls.id), [2])
  assert.deepEqual(filterCatalog(items, { ...EMPTY_FILTERS, slot: 'morning' }).map((i) => i.cls.id), [1])
})

test('còn chỗ + các bộ lọc khác kết hợp với nhau', () => {
  assert.deepEqual(filterCatalog(items, { ...EMPTY_FILTERS, hasSeats: true }).map((i) => i.cls.id), [1])
  assert.deepEqual(filterCatalog(items, { ...EMPTY_FILTERS, hasSeats: true, subject: 'Boxing' }), [])
})

test('bộ lọc rỗng trả về các lớp chưa đóng', () => {
  assert.equal(filterCatalog(items, EMPTY_FILTERS).length, 2)
})

test('vòng đời theo hạn đăng ký: đang mở → hết hạn đăng ký → đã bắt đầu → đã đóng', () => {
  const one = (extra, now2 = now) => buildCatalog({ classes: [{ id: 1, name: 'L', subject: 'Yoga', capacity: 5, ...extra }], schedules: [{ id: 1, classId: 1, startTime: '2026-11-02T07:00:00', endTime: '2026-11-02T08:00:00' }], available: [{ id: 1, registeredCount: 1, remainingSlots: 4 }], now: now2 })[0]
  const dates = { startDate: '2026-10-30', endDate: '2026-12-30', registrationCloseAt: '2026-10-28T20:00:00' }
  // 21/10: trong hạn → Đang mở, được đăng ký lớp, chưa đăng ký buổi
  assert.equal(one(dates).status, 'open')
  assert.equal(one(dates).canRegister, true)
  assert.equal(one(dates).sessionsOpen, false)
  // 29/10: quá hạn, lớp chưa bắt đầu → Hết hạn đăng ký; đăng ký buổi mở
  const expired = one(dates, new Date('2026-10-29T09:00:00+07:00'))
  assert.deepEqual([expired.status, expired.canRegister, expired.sessionsOpen], ['expired', false, true])
  // 30/10 00:00: lớp bắt đầu → Đã bắt đầu
  const started = one(dates, new Date('2026-10-30T00:00:00+07:00'))
  assert.deepEqual([started.status, started.canRegister, started.sessionsOpen], ['started', false, true])
  // sau ngày kết thúc lớp → Đã đóng
  assert.equal(one(dates, new Date('2026-12-31T09:00:00+07:00')).status, 'closed')
  // không có ngày thì suy theo buổi học
  assert.equal(one({}).status, 'open')
  assert.equal(one({}).sessionsOpen, true)
})

test('registrationOpen: đúng quy tắc BE', () => {
  const cls = { startDate: '2026-10-30', endDate: '2026-12-30', registrationCloseAt: '2026-10-28T20:00:00' }
  const t = (s) => new Date(s)
  assert.equal(registrationOpen(cls, t('2026-10-28T20:00:00+07:00')), true) // bây giờ <= hạn
  assert.equal(registrationOpen(cls, t('2026-10-28T20:00:30+07:00')), false)
  // chưa đặt hạn: đăng ký được tới trước 00:00 ngày bắt đầu
  const noDeadline = { ...cls, registrationCloseAt: null }
  assert.equal(registrationOpen(noDeadline, t('2026-10-29T23:59:00+07:00')), true)
  assert.equal(registrationOpen(noDeadline, t('2026-10-30T00:00:00+07:00')), false)
  assert.equal(classStarted(noDeadline, t('2026-10-30T00:00:00+07:00')), true)
  assert.equal(deadlinePassed(noDeadline, t('2030-01-01T00:00:00+07:00')), false)
  // lớp cũ có registrationOpenAt: bỏ qua
  assert.equal(registrationOpen({ ...noDeadline, registrationOpenAt: '2026-10-29T00:00:00' }, t('2026-10-21T12:00:00+07:00')), true)
  // lớp đã kết thúc
  assert.equal(registrationOpen({ endDate: '2026-10-01' }, t('2026-10-21T12:00:00+07:00')), false)
})

test('lớp hết hạn đăng ký / đã bắt đầu vẫn hiện trong danh sách; lọc theo trạng thái', () => {
  const list = buildCatalog({ now, schedules: [
    { id: 1, classId: 1, startTime: '2026-11-02T07:00:00', endTime: '2026-11-02T08:00:00' },
    { id: 2, classId: 2, startTime: '2026-10-22T07:00:00', endTime: '2026-10-22T08:00:00' },
    { id: 3, classId: 3, startTime: '2026-11-02T07:00:00', endTime: '2026-11-02T08:00:00' }], classes: [
    { id: 1, name: 'A', capacity: 5, startDate: '2026-10-30', endDate: '2026-12-30', registrationCloseAt: '2026-10-20T08:00:00' },
    { id: 2, name: 'B', capacity: 5, startDate: '2026-10-20', endDate: '2026-12-30' },
    { id: 3, name: 'C', capacity: 5, startDate: '2026-10-30', endDate: '2026-12-30' }] })
  assert.deepEqual(list.map((i) => i.status), ['expired', 'started', 'open'])
  assert.deepEqual(filterCatalog(list, EMPTY_FILTERS).map((i) => i.cls.id), [1, 2, 3])
  assert.deepEqual(filterCatalog(list, { ...EMPTY_FILTERS, status: 'expired' }).map((i) => i.cls.id), [1])
  assert.deepEqual(filterCatalog(list, { ...EMPTY_FILTERS, status: 'started' }).map((i) => i.cls.id), [2])
})

test('lớp chưa có buổi học nào là Chưa mở; lớp đã đóng bị ẩn mặc định', () => {
  const none = buildCatalog({ classes: [classes[0]], schedules: [], now })
  assert.equal(none[0].status, 'upcoming')
  assert.deepEqual(filterCatalog(items, EMPTY_FILTERS).map((i) => i.cls.id), [1, 2])
  assert.deepEqual(filterCatalog(items, { ...EMPTY_FILTERS, showClosed: true }).map((i) => i.cls.id), [1, 2, 3])
  assert.deepEqual(filterCatalog(items, { ...EMPTY_FILTERS, status: 'closed' }).map((i) => i.cls.id), [3])
})

test('khoảng ngày suy ra từ các buổi học của lớp', () => {
  assert.equal(by(1).sessionCount, 1)
  assert.equal(by(1).firstDate, '2026-10-25')
  assert.equal(by(1).lastDate, '2026-10-25')
  const many = buildCatalog({ classes: [classes[0]], schedules: [
    { id: 1, classId: 1, startTime: '2026-11-05T07:00:00', endTime: '2026-11-05T08:00:00' },
    { id: 2, classId: 1, startTime: '2026-10-31T07:00:00', endTime: '2026-10-31T08:00:00' },
    { id: 3, classId: 1, startTime: '2026-12-30T07:00:00', endTime: '2026-12-30T08:00:00' }], now })[0]
  assert.deepEqual([many.firstDate, many.lastDate, many.sessionCount], ['2026-10-31', '2026-12-30', 3])
})

test('canJoin: hết hạn đăng ký thì không đăng ký lớp được dù còn chỗ', () => {
  const cls = { id: 9, name: 'Yoga mới', subject: 'Yoga', capacity: 10, registrationCloseAt: '2026-10-28T23:00:00', startDate: '2026-10-29', endDate: '2026-12-29' }
  const at = (t) => buildCatalog({ classes: [cls], schedules: [{ id: 91, classId: 9, startTime: '2026-10-29T07:00:00', endTime: '2026-10-29T08:00:00' }], classStats: [{ classId: 9, registeredCount: 0, remainingSlots: 10, registeredByMe: false }], now: new Date(t) })[0]
  assert.equal(at('2026-10-28T23:00:00+07:00').canJoin, true)
  assert.equal(at('2026-10-28T23:01:00+07:00').canJoin, false)
  assert.equal(at('2026-10-28T23:01:00+07:00').status, 'expired')
})

test('đăng ký lớp: sĩ số tính theo lớp, canJoin chỉ khi còn chỗ và chưa đăng ký', () => {
  const cls = { id: 1, name: 'Yoga sáng', subject: 'Yoga', capacity: 10 }
  const sch = [{ id: 11, classId: 1, startTime: '2026-10-25T07:00:00', endTime: '2026-10-25T08:00:00' }]
  const build = (stat) => buildCatalog({ classes: [cls], schedules: sch, classStats: [{ classId: 1, ...stat }], now })[0]
  assert.equal(build({ registeredCount: 3, remainingSlots: 7, registeredByMe: false }).canJoin, true)
  assert.equal(build({ registeredCount: 3, remainingSlots: 7, registeredByMe: true }).canJoin, false)
  const full = build({ registeredCount: 10, remainingSlots: 0, registeredByMe: false })
  assert.equal(full.status, 'full')
  assert.equal(full.canJoin, false)
  assert.equal(buildCatalog({ classes: [cls], schedules: sch, now })[0].classStat, null)
})