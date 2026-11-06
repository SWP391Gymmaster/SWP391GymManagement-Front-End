import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCatalog, filterCatalog, EMPTY_FILTERS } from '../src/catalog/catalogRules.js'
import { validateSchedule } from '../src/validation/classRules.js'
import { mapSession } from '../src/services/api.js'

// Buổi BE tự sinh theo lịch hằng tuần: startTime === endTime (00:00), roomId null.
const now = new Date('2026-11-10T12:00:00+07:00')
const cls = { id: 1, name: 'Yoga', subject: 'Yoga', capacity: 10, coachId: 7 }
const today = { id: 11, classId: 1, coachId: 7, roomId: null, startTime: '2026-11-10T00:00:00', endTime: '2026-11-10T00:00:00' }
const later = { id: 12, classId: 1, coachId: 7, roomId: null, startTime: '2026-11-12T00:00:00', endTime: '2026-11-12T00:00:00' }
const past = { id: 13, classId: 1, coachId: 7, roomId: null, startTime: '2026-11-09T00:00:00', endTime: '2026-11-09T00:00:00' }

test('buildCatalog: buổi chưa xếp giờ hôm nay không bị tính là đã bắt đầu, không đầy', () => {
  const [item] = buildCatalog({ classes: [cls], schedules: [today, later, past], available: [], now })
  const by = (id) => item.sessions.find((s) => s.id === id)
  assert.equal(by(11).unscheduled, true)
  assert.equal(by(11).closed, false)
  assert.equal(by(11).full, false)
  assert.equal(by(13).closed, true) // ngày đã qua
  assert.equal(item.status, 'open') // không bị coi là "Đã đầy" chỉ vì BE không trả buổi chưa có giờ
  assert.equal(item.sessionCount, 3)
})

test('filterCatalog: buổi chưa xếp giờ khớp lọc ngày nhưng không khớp khung giờ', () => {
  const items = buildCatalog({ classes: [cls], schedules: [later], now })
  assert.equal(filterCatalog(items, { ...EMPTY_FILTERS, date: '2026-11-12' }).length, 1)
  assert.equal(filterCatalog(items, { ...EMPTY_FILTERS, slot: 'morning' }).length, 0)
})

test('validateSchedule: bỏ qua buổi chưa xếp giờ khi tính trùng phòng/coach', () => {
  const room = { id: 1, name: 'Phòng Yoga', capacity: 20, type: 'YOGA' }
  const busy = { id: 20, classId: 1, coachId: 7, roomId: 1, startTime: '2026-11-12T07:00:00', endTime: '2026-11-12T08:00:00' }
  const form = { id: 12, classId: 1, roomId: 1, startTime: '2026-11-12T00:00', endTime: '2026-11-12T09:00' }
  const other = { ...later, id: 30, roomId: 1 }
  assert.deepEqual(validateSchedule(form, cls, room, { schedules: [later, other], classes: [cls] }), [])
  assert.equal(validateSchedule(form, cls, room, { schedules: [busy], classes: [cls] }).length, 2) // trùng phòng + coach
  assert.deepEqual(validateSchedule({ ...form, startTime: '', endTime: '', roomId: '' }, cls, undefined).sort(),
    ['Vui lòng chọn phòng.', 'Vui lòng nhập giờ bắt đầu và giờ kết thúc.'].sort())
})

test('mapSession (member): buổi chưa xếp giờ không đăng ký được, ghi "Chưa xếp giờ"', () => {
  const s = mapSession({ ...later, scheduleId: 12, remainingSlots: 10 }, { classes: [cls] })
  assert.equal(s.unscheduled, true)
  assert.equal(s.time, 'Chưa xếp giờ')
  assert.equal(s.roomName, 'Chưa xếp phòng')
  assert.equal(s.allowed, false)
  assert.equal(s.reason, 'Chưa xếp giờ')
})
