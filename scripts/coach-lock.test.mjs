import assert from 'node:assert/strict'
import test from 'node:test'
import { COACH_LOCK_REASON, coachLockReason } from '../src/validation/classRules.js'

const cls = { id: 5, classCode: 'CLS-YOGA-AM', coachId: 7 }
const schedules = [{ id: 1, classId: 9 }, { id: 2, classId: '5' }]

test('lớp đã có buổi học: khóa đổi coach', () => {
  assert.equal(coachLockReason(cls, schedules), COACH_LOCK_REASON)
  assert.equal(COACH_LOCK_REASON, 'Lớp đã mở, không được phép thay đổi giáo viên')
})

test('lớp chưa có buổi học và chưa có người đăng ký: không khóa', () => {
  assert.equal(coachLockReason(cls, [{ id: 1, classId: 9 }]), null)
  assert.equal(coachLockReason(cls), null)
  assert.equal(coachLockReason({ ...cls, registeredCount: 0 }, []), null)
})

test('lớp có người đăng ký (registeredCount) dù chưa có buổi: khóa', () => {
  assert.equal(coachLockReason({ ...cls, registeredCount: 3 }, []), COACH_LOCK_REASON)
})

test('đang mở kỳ mới: luôn mở khóa', () => {
  assert.equal(coachLockReason(cls, schedules, true), null)
  assert.equal(coachLockReason({ ...cls, registeredCount: 3 }, schedules, true), null)
})

test('tạo lớp mới (chưa có lớp / chưa có id): không khóa', () => {
  assert.equal(coachLockReason(null, schedules), null)
  assert.equal(coachLockReason({ classCode: 'X' }, [{ classId: undefined }]), null)
})
