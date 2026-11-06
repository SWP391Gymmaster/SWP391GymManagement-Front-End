import assert from 'node:assert/strict'
import test from 'node:test'
import { canExtendDeadline } from '../src/catalog/catalogRules.js'
import { deadlineProblems } from '../src/validation/classDates.js'

// Bây giờ: 28/10/2026 10:00 (giờ Việt Nam).
const now = new Date('2026-10-28T10:00:00+07:00')
const base = { startDate: '2026-11-01', endDate: '2026-12-01' }

test('canExtendDeadline: lớp chưa bắt đầu → hiện nút', () => {
  assert.equal(canExtendDeadline({ ...base, registrationCloseAt: '2026-10-30T20:00:00' }, now), true)
})

test('canExtendDeadline: không đặt hạn → vẫn hiện nút (khi chưa bắt đầu)', () => {
  assert.equal(canExtendDeadline({ ...base, registrationCloseAt: null }, now), true)
})

test('canExtendDeadline: có hạn đã qua nhưng lớp chưa bắt đầu → hiện nút', () => {
  assert.equal(canExtendDeadline({ ...base, registrationCloseAt: '2026-10-27T20:00:00' }, now), true)
})

test('canExtendDeadline: lớp đã bắt đầu (từ 00:00 ngày bắt đầu) → ẩn nút', () => {
  assert.equal(canExtendDeadline(base, new Date('2026-10-31T23:59:00+07:00')), true)
  assert.equal(canExtendDeadline(base, new Date('2026-11-01T00:00:00+07:00')), false)
  assert.equal(canExtendDeadline(base, new Date('2026-11-15T09:00:00+07:00')), false)
})

test('canExtendDeadline: lớp đã kết thúc → ẩn nút', () => {
  assert.equal(canExtendDeadline(base, new Date('2026-12-02T09:00:00+07:00')), false)
  assert.equal(canExtendDeadline({ endDate: '2026-10-01' }, now), false) // lớp cũ chỉ có ngày kết thúc
})

test('deadlineProblems: trống → không lỗi; hợp lệ → không lỗi', () => {
  assert.deepEqual(deadlineProblems('', { startDate: base.startDate, now }), [])
  assert.deepEqual(deadlineProblems('2026-10-31T23:00', { startDate: base.startDate, now }), [])
  assert.deepEqual(deadlineProblems('2026-11-01T00:00', { startDate: base.startDate, now }), [])
})

test('deadlineProblems: phải ở tương lai (chỉ khi đổi)', () => {
  assert.deepEqual(deadlineProblems('2026-10-28T10:00', { startDate: base.startDate, now }), ['Hạn đăng ký phải ở tương lai.'])
  assert.deepEqual(deadlineProblems('2026-10-28T10:00', { startDate: base.startDate, now, changed: false }), [])
})

test('deadlineProblems: không sau 00:00 ngày bắt đầu lớp', () => {
  assert.deepEqual(deadlineProblems('2026-11-01T00:01', { startDate: base.startDate, now }), ['Hạn đăng ký không được sau 00:00 ngày bắt đầu lớp (01/11/2026).'])
})

test('deadlineProblems: chặn năm bất thường', () => {
  assert.deepEqual(deadlineProblems('222222-01-01T00:00', { startDate: base.startDate, now }), ['Hạn đăng ký không hợp lệ, vui lòng chọn lại ngày giờ.'])
})

test('deadlineProblems: chế độ chỉ có ngày', () => {
  assert.deepEqual(deadlineProblems('2026-10-31', { startDate: base.startDate, now, timed: false }), [])
  assert.equal(deadlineProblems('2026-11-01', { startDate: base.startDate, now, timed: false }).length, 1)
  assert.equal(deadlineProblems('2026-10-27', { startDate: base.startDate, now, timed: false }).length, 1)
})
