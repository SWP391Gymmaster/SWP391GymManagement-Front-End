import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCatalog, filterCatalog, EMPTY_FILTERS } from '../src/catalog/catalogRules.js'

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
  assert.deepEqual(filterCatalog(items, { ...EMPTY_FILTERS, coachId: '7' }).map((i) => i.cls.id), [1, 3])
  assert.deepEqual(filterCatalog(items, { ...EMPTY_FILTERS, status: 'full' }).map((i) => i.cls.id), [2])
})

test('lọc ngày và khung giờ', () => {
  assert.deepEqual(filterCatalog(items, { ...EMPTY_FILTERS, date: '2026-10-25' }).map((i) => i.cls.id), [1])
  assert.deepEqual(filterCatalog(items, { ...EMPTY_FILTERS, slot: 'evening' }).map((i) => i.cls.id), [2])
  assert.deepEqual(filterCatalog(items, { ...EMPTY_FILTERS, slot: 'morning' }).map((i) => i.cls.id), [1, 3])
})

test('còn chỗ + các bộ lọc khác kết hợp với nhau', () => {
  assert.deepEqual(filterCatalog(items, { ...EMPTY_FILTERS, hasSeats: true }).map((i) => i.cls.id), [1])
  assert.deepEqual(filterCatalog(items, { ...EMPTY_FILTERS, hasSeats: true, subject: 'Boxing' }), [])
})

test('bộ lọc rỗng hiển thị cả lớp đã đóng', () => {
  assert.equal(filterCatalog(items, EMPTY_FILTERS).length, 3)
})

test('buổi đầu đã qua không tự đóng lớp còn buổi sắp tới', () => {
  const mixed = buildCatalog({ classes: [classes[0]], schedules: [
    { id: 1, classId: 1, startTime: '2026-10-01T07:00:00', endTime: '2026-10-01T08:00:00' },
    { id: 2, classId: 1, startTime: '2026-10-25T07:00:00', endTime: '2026-10-25T08:00:00' },
  ], now })
  assert.equal(mixed[0].status, 'open')
})

test('hạn đăng ký: đang mở → đã đóng', () => {
  const one = (extra, now2 = now) => buildCatalog({ classes: [{ id: 1, name: 'L', subject: 'Yoga', capacity: 5, ...extra }], schedules: [{ id: 1, classId: 1, startTime: '2026-11-02T07:00:00', endTime: '2026-11-02T08:00:00' }], available: [{ id: 1, registeredCount: 1, remainingSlots: 4 }], now: now2 })[0]
  const dates = { startDate: '2026-10-30', endDate: '2026-12-30', registrationOpenAt: '2026-10-24', registrationCloseAt: '2026-10-29' }
  // 21/10: chưa tới ngày mở đăng ký sớm → Chưa mở, chưa được đăng ký
  assert.equal(one(dates).status, 'pending')
  assert.equal(one(dates).canRegister, false)
  // 25/10: đã đến giờ mở đăng ký
  const early = one(dates, new Date('2026-10-25T09:00:00+07:00'))
  assert.equal(early.status, 'open')
  assert.equal(early.canRegister, true)
  // 30/10: hết đăng ký sớm → chuyển sang Đang mở
  assert.equal(one(dates, new Date('2026-10-30T09:00:00+07:00')).status, 'closed')
  assert.equal(one(dates, new Date('2026-10-30T09:00:00+07:00')).canRegister, false)
  // sau ngày kết thúc lớp → Đã đóng
  assert.equal(one(dates, new Date('2026-12-31T09:00:00+07:00')).status, 'closed')
  // không có ngày thì suy theo buổi học
  assert.equal(one({}).status, 'open')
})

test('lớp chưa có lịch đóng đăng ký; lớp đã đóng bị ẩn mặc định', () => {
  const none = buildCatalog({ classes: [classes[0]], schedules: [], now })
  assert.equal(none[0].status, 'closed')
  assert.deepEqual(filterCatalog(items, EMPTY_FILTERS).map((i) => i.cls.id), [1, 2, 3])
  assert.deepEqual(filterCatalog(items, { ...EMPTY_FILTERS, showClosed: false }).map((i) => i.cls.id), [1, 2])
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

test('hạn đăng ký có giờ: đóng đúng thời điểm', () => {
  const cls = { id: 9, name: 'Yoga mới', subject: 'Yoga', capacity: 10, registrationOpenAt: '2026-10-28T11:00:00', registrationCloseAt: '2026-10-28T23:00:00', startDate: '2026-10-29', endDate: '2026-12-29' }
  const at = (t) => buildCatalog({ classes: [cls], schedules: [{ id: 91, classId: 9, startTime: '2026-10-29T07:00:00', endTime: '2026-10-29T08:00:00' }], now: new Date(t) })[0]
  assert.equal(at('2026-10-28T10:59:00+07:00').status, 'pending')
  assert.equal(at('2026-10-28T10:59:00+07:00').canRegister, false)
  assert.equal(at('2026-10-28T11:00:00+07:00').canRegister, true)
  const memberAt = t => buildCatalog({ classes: [cls], schedules: [{ id: 91, classId: 9, startTime: '2026-10-29T07:00:00', endTime: '2026-10-29T08:00:00' }], classStats: [{ classId: 9, registeredCount: 0, remainingSlots: 10, registeredByMe: false }], now: new Date(t) })[0]
  assert.equal(memberAt('2026-10-28T10:59:00+07:00').canJoin, false)
  assert.equal(memberAt('2026-10-28T11:00:00+07:00').canJoin, true)
  assert.equal(at('2026-10-28T22:59:00+07:00').status, 'open')
  assert.equal(at('2026-10-28T23:00:00+07:00').status, 'closed')
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

test('lớp hết hạn vẫn hiện cho hội viên đã đăng ký', () => {
  const cls = { id: 1, capacity: 10, registrationCloseAt: '2026-10-20T23:00:00' }
  const result = buildCatalog({ classes: [cls], schedules: [schedules[0]],
    classStats: [{ classId: 1, registeredCount: 1, remainingSlots: 9, registeredByMe: true }], now })
  assert.equal(result[0].canJoin, false)
  assert.equal(filterCatalog(result, EMPTY_FILTERS).length, 1)
})
