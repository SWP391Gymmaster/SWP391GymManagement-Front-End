import assert from 'node:assert/strict'
import test from 'node:test'
import { validateClassDates, vnStamp, addDays, toFormStamp, toPayloadStamp } from '../src/validation/classDates.js'

// Hôm nay 28/10/2026 10:00 (giờ Việt Nam).
const now = new Date('2026-10-28T10:00:00+07:00')
const ok = { startDate: '2026-10-29', endDate: '2026-12-29', registrationCloseAt: '2026-10-28T23:00' }
const check = (form, opts = {}) => validateClassDates({ ...ok, ...form }, { now, requireDates: true, timed: true, ...opts })

test('giờ Việt Nam và cộng ngày', () => {
  assert.equal(vnStamp(now), '2026-10-28T10:00')
  assert.equal(addDays('2026-10-31', 1), '2026-11-01')
})

test('ví dụ hợp lệ: tạo 28/10, mở lớp 29/10, hạn đăng ký 23:00 ngày 28/10', () => {
  assert.deepEqual(check({}), [])
})

test('hạn đăng ký là tùy chọn', () => {
  assert.deepEqual(check({ registrationCloseAt: '' }), [])
})

test('ngày bắt đầu phải từ ngày mai', () => {
  assert.equal(check({ startDate: '2026-10-28', registrationCloseAt: '' }).length, 1)
  assert.equal(check({ startDate: '2026-10-27', registrationCloseAt: '' }).length, 1)
  assert.deepEqual(check({ startDate: '2026-10-29', registrationCloseAt: '' }), [])
})

test('hạn đăng ký phải ở tương lai', () => {
  assert.deepEqual(check({ registrationCloseAt: '2026-10-28T09:59' }), ['Hạn đăng ký phải ở tương lai.'])
  assert.deepEqual(check({ registrationCloseAt: '2026-10-28T10:00' }), ['Hạn đăng ký phải ở tương lai.'])
  assert.deepEqual(check({ registrationCloseAt: '2026-10-28T10:01' }), [])
})

test('hạn đăng ký không sau 00:00 ngày bắt đầu lớp', () => {
  assert.deepEqual(check({ registrationCloseAt: '2026-10-29T00:00' }), [])
  assert.deepEqual(check({ registrationCloseAt: '2026-10-29T08:00' }), ['Hạn đăng ký không được sau 00:00 ngày bắt đầu lớp (29/10/2026).'])
  // Đổi ngày bắt đầu sớm hơn hạn đang có cũng bị chặn
  assert.equal(check({ startDate: '2026-10-29', registrationCloseAt: '2026-11-01T00:00' }).length, 1)
})

test('năm bất thường (vd 222222) bị chặn', () => {
  assert.equal(check({ registrationCloseAt: '222222-01-01T00:00' }).length, 1)
  assert.equal(check({ registrationCloseAt: '222222-01-01T00:00', startDate: '', endDate: '' }, { requireDates: false }).length, 1)
})

test('sửa lớp: hạn không đổi thì không kiểm tra tương lai; đổi (gia hạn) thì phải ở tương lai', () => {
  const original = { startDate: '2026-11-10', endDate: '2026-12-10', registrationCloseAt: '2026-10-20T12:00:00' }
  const form = { startDate: '2026-11-10', endDate: '2026-12-10', registrationCloseAt: '2026-10-20T12:00' }
  assert.deepEqual(validateClassDates(form, { now, original, timed: true }), [])
  assert.deepEqual(validateClassDates({ ...form, registrationCloseAt: '2026-10-27T12:00' }, { now, original, timed: true }), ['Hạn đăng ký phải ở tương lai.'])
  assert.deepEqual(validateClassDates({ ...form, registrationCloseAt: '2026-11-05T12:00' }, { now, original, timed: true }), [])
  assert.equal(validateClassDates({ ...form, registrationCloseAt: '2026-11-10T00:01' }, { now, original, timed: true }).length, 1)
})

test('lớp cũ còn registrationOpenAt: trường này bị bỏ qua', () => {
  assert.deepEqual(check({ registrationOpenAt: '2026-10-01T00:00' }), [])
})

test('kết thúc lớp phải sau bắt đầu; tạo mới phải có ngày', () => {
  assert.equal(check({ endDate: '2026-10-29' }).length, 1)
  assert.equal(check({ startDate: '', endDate: '' }).length, 2)
})

test('sửa lớp: giá trị không đổi thì không bị coi là quá khứ', () => {
  const original = { startDate: '2026-10-01', endDate: '2026-12-01', registrationCloseAt: '2026-09-30T23:59' }
  assert.deepEqual(validateClassDates(original, { now, original, timed: true }), [])
  const reopen = { ...original, startDate: '2026-10-20' }
  assert.equal(validateClassDates(reopen, { now, original, timed: true }).length >= 1, true)
})

test('chế độ chỉ có ngày (BE hiện tại)', () => {
  const form = { startDate: '2026-10-29', endDate: '2026-12-29', registrationCloseAt: '2026-10-28' }
  assert.deepEqual(validateClassDates(form, { now, timed: false, requireDates: true }), [])
  assert.equal(validateClassDates({ ...form, registrationCloseAt: '2026-10-27' }, { now, timed: false }).length, 1)
  assert.equal(validateClassDates({ ...form, registrationCloseAt: '2026-10-29' }, { now, timed: false }).length, 1)
})

test('đổi định dạng giữa form và BE', () => {
  assert.equal(toFormStamp('2026-10-28T11:00:00'), '2026-10-28T11:00')
  assert.equal(toFormStamp('2026-10-28', 'end'), '2026-10-28T23:59')
  assert.equal(toPayloadStamp('2026-10-28T11:00', true), '2026-10-28T11:00:00')
  assert.equal(toPayloadStamp('2026-10-28T11:00', false), '2026-10-28')
  assert.equal(toPayloadStamp('', true), null)
})