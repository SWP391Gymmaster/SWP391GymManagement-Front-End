import assert from 'node:assert/strict'
import test from 'node:test'
import { WEEKDAYS, generateDates, isUnscheduled, parseWeekdays, patternProblems, previewSessions, serializeWeekdays, weekdayName } from '../src/validation/sessionPattern.js'

// 2026-11-09 là Thứ 2.
const monday = '2026-11-09'

test('WEEKDAYS theo thứ tự T2..CN (MON..SUN)', () => {
  assert.deepEqual(WEEKDAYS.map((w) => w.code), ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'])
  assert.deepEqual(WEEKDAYS.map((w) => w.label), ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'])
})

test('parse / serialize: lọc mã sai, bỏ trùng, xếp MON..SUN', () => {
  assert.deepEqual(parseWeekdays('FRI, mon,XYZ,MON'), ['MON', 'FRI'])
  assert.deepEqual(parseWeekdays(null), [])
  assert.deepEqual(parseWeekdays(''), [])
  assert.equal(serializeWeekdays(['SUN', 'WED', 'MON']), 'MON,WED,SUN')
  assert.equal(serializeWeekdays([]), '')
})

test('generateDates: gồm cả hai đầu, đúng thứ, theo giờ địa phương', () => {
  assert.equal(weekdayName(monday), 'Thứ 2')
  assert.deepEqual(generateDates(['MON', 'WED', 'FRI'], monday, '2026-11-22'),
    ['2026-11-09', '2026-11-11', '2026-11-13', '2026-11-16', '2026-11-18', '2026-11-20'])
  assert.deepEqual(generateDates(['MON'], monday, monday), [monday]) // một ngày, đúng thứ
  assert.deepEqual(generateDates(['SUN'], '2026-11-22', '2026-11-22'), ['2026-11-22'])
  // Qua tháng / năm
  assert.deepEqual(generateDates(['THU'], '2026-12-30', '2027-01-08'), ['2026-12-31', '2027-01-07'])
})

test('generateDates: thiếu dữ liệu hoặc ngày ngược → rỗng', () => {
  assert.deepEqual(generateDates([], monday, '2026-11-22'), [])
  assert.deepEqual(generateDates(['MON'], '', '2026-11-22'), [])
  assert.deepEqual(generateDates(['MON'], '2026-11-22', monday), [])
})

test('previewSessions: bỏ ngày trước hôm nay và ngày đã có buổi', () => {
  const now = new Date(2026, 10, 11, 15, 0) // Thứ 4 11/11, chiều
  const list = previewSessions({ weekdays: 'MON,WED,FRI', startDate: monday, endDate: '2026-11-22', now,
    existingSessions: [{ startTime: '2026-11-13T00:00:00', endTime: '2026-11-13T00:00:00' }] })
  // 09/11 đã qua; 11/11 là hôm nay (vẫn tạo); 13/11 đã có buổi.
  assert.deepEqual(list, [
    { date: '2026-11-11', weekdayLabel: 'Thứ 4' },
    { date: '2026-11-16', weekdayLabel: 'Thứ 2' },
    { date: '2026-11-18', weekdayLabel: 'Thứ 4' },
    { date: '2026-11-20', weekdayLabel: 'Thứ 6' },
  ])
})

test('patternProblems: không chọn thứ → không lỗi', () => {
  assert.deepEqual(patternProblems({ sessionWeekdays: [], startDate: '', endDate: '', coachId: '' }), [])
})

test('patternProblems: thiếu ngày, thiếu coach, không có ngày khớp', () => {
  assert.deepEqual(patternProblems({ sessionWeekdays: ['MON'], startDate: '', endDate: '', coachId: 7 }),
    ['Cần nhập ngày bắt đầu và ngày kết thúc lớp để tạo lịch học hằng tuần.'])
  assert.deepEqual(patternProblems({ sessionWeekdays: 'MON', startDate: monday, endDate: '2026-11-22', coachId: '' }),
    ['Cần chọn huấn luyện viên để tạo lịch học hằng tuần.'])
  // 10/11 (T3) → 12/11 (T5): không có T2 nào.
  assert.deepEqual(patternProblems({ sessionWeekdays: ['MON'], startDate: '2026-11-10', endDate: '2026-11-12', coachId: 7 }),
    ['Không có ngày nào khớp các thứ đã chọn trong khoảng ngày của lớp.'])
  assert.deepEqual(patternProblems({ sessionWeekdays: ['MON'], startDate: monday, endDate: '2026-11-22', coachId: 7 }), [])
})

test('patternProblems với now: chỉ tính ngày từ hôm nay', () => {
  const form = { sessionWeekdays: ['MON'], startDate: monday, endDate: '2026-11-12', coachId: 7 }
  assert.deepEqual(patternProblems(form, { now: new Date(2026, 10, 9, 8) }), [])
  assert.equal(patternProblems(form, { now: new Date(2026, 10, 10, 8) }).length, 1)
})

test('isUnscheduled: startTime === endTime', () => {
  assert.equal(isUnscheduled({ startTime: '2026-11-09T00:00:00', endTime: '2026-11-09T00:00:00' }), true)
  assert.equal(isUnscheduled({ startTime: '2026-11-09T00:00', endTime: '2026-11-09T00:00:00+07:00' }), true)
  assert.equal(isUnscheduled({ startTime: '2026-11-09T07:00:00', endTime: '2026-11-09T08:00:00' }), false)
  assert.equal(isUnscheduled(null), false)
  assert.equal(isUnscheduled({}), false)
})
