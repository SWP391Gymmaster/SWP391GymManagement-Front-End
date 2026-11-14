import assert from 'node:assert/strict'
import test from 'node:test'
import { validateClassDates, vnStamp, addDays, toFormStamp, toPayloadStamp } from '../src/validation/classDates.js'

// Hôm nay 28/10/2026 10:00 (giờ Việt Nam).
const now = new Date('2026-10-28T10:00:00+07:00')
const ok = { startDate: '2026-10-29', endDate: '2026-12-29', registrationOpenAt: '2026-10-28T11:00', registrationCloseAt: '2026-10-28T23:00' }
const check = (form, opts = {}) => validateClassDates({ ...ok, ...form }, { now, requireDates: true, timed: true, ...opts })

test('giờ Việt Nam và cộng ngày', () => {
  assert.equal(vnStamp(now), '2026-10-28T10:00')
  assert.equal(addDays('2026-10-31', 1), '2026-11-01')
})

test('ví dụ hợp lệ: tạo 28/10, mở lớp 29/10, đăng ký sớm 11:00 đến 23:00', () => {
  assert.deepEqual(check({}), [])
})

test('ngày bắt đầu phải từ ngày mai', () => {
  assert.equal(check({ startDate: '2026-10-28' }).length >= 1, true)
  assert.equal(check({ startDate: '2026-10-27' }).length >= 1, true)
  assert.deepEqual(check({ startDate: '2026-10-29' }), [])
})

test('đăng ký sớm không được trước thời điểm hiện tại', () => {
  assert.equal(check({ registrationOpenAt: '2026-10-15T00:00' }).length >= 1, true)
  assert.equal(check({ registrationOpenAt: '2026-10-28T09:59' }).length, 1)
  assert.deepEqual(check({ registrationOpenAt: '2026-10-28T10:00' }), [])
})

test('đóng đăng ký sớm phải sau mở và trước 00:00 ngày bắt đầu', () => {
  assert.equal(check({ registrationCloseAt: '2026-10-28T11:00' }).length, 1)
  assert.equal(check({ registrationCloseAt: '2026-10-29T08:00' }).length, 1)
  assert.deepEqual(check({ registrationCloseAt: '2026-10-29T00:00' }), [])
})

test('phải nhập đủ cả hai mốc đăng ký sớm hoặc để trống cả hai', () => {
  assert.equal(check({ registrationCloseAt: '' }).length, 1)
  assert.deepEqual(check({ registrationOpenAt: '' }), [])
})

test('kết thúc lớp phải sau bắt đầu; tạo mới phải có ngày', () => {
  assert.equal(check({ endDate: '2026-10-29' }).length, 1)
  assert.equal(check({ startDate: '', endDate: '' }).length, 2)
})

test('sửa lớp: giá trị không đổi thì không bị coi là quá khứ', () => {
  const original = { startDate: '2026-10-01', endDate: '2026-12-01', registrationOpenAt: '2026-09-20T00:00', registrationCloseAt: '2026-09-30T23:59' }
  assert.deepEqual(validateClassDates(original, { now, original, timed: true }), [])
  const reopen = { ...original, startDate: '2026-10-20' }
  assert.equal(validateClassDates(reopen, { now, original, timed: true }).length >= 1, true)
})

test('chế độ chỉ có ngày (BE hiện tại)', () => {
  const form = { startDate: '2026-10-29', endDate: '2026-12-29', registrationOpenAt: '2026-10-28', registrationCloseAt: '2026-10-28' }
  assert.deepEqual(validateClassDates(form, { now, timed: false, requireDates: true }), [])
  assert.equal(validateClassDates({ ...form, registrationOpenAt: '2026-10-27' }, { now, timed: false }).length >= 1, true)
  assert.equal(validateClassDates({ ...form, registrationCloseAt: '2026-10-29' }, { now, timed: false }).length, 1)
})

test('đổi định dạng giữa form và BE', () => {
  assert.equal(toFormStamp('2026-10-28T11:00:00'), '2026-10-28T11:00')
  assert.equal(toFormStamp('2026-10-28', 'end'), '2026-10-28T23:59')
  assert.equal(toPayloadStamp('2026-10-28T11:00', true), '2026-10-28T11:00:00')
  assert.equal(toPayloadStamp('2026-10-28T11:00', false), '2026-10-28')
  assert.equal(toPayloadStamp('', true), null)
})
