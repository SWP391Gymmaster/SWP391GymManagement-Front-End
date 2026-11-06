import assert from 'node:assert/strict'
import test from 'node:test'
import { FEATURES } from '../src/config/features.js'
import { coachSubjectProblem, coachTeaches, validateClass, validateSchedule, SESSION_DESCRIPTION_MAX } from '../src/validation/classRules.js'

const coaches = [
  { id: 7, name: 'Phạm Ngọc Lan', subjects: ['Yoga', 'Pilates'] },
  { id: 8, name: 'Lê Văn B', subjects: [] },
  { id: 9, name: 'Trần C' }, // BE chưa trả subjects
]
const yoga = { classCode: 'CLS-YOGA-AM', name: 'Yoga sáng', subject: 'Yoga', capacity: 20 }
const room = { id: 1, name: 'Phòng Yoga', capacity: 30, type: 'YOGA' }
const session = { classId: 1, roomId: 1, startTime: '2026-11-10T07:00', endTime: '2026-11-10T08:00' }
const yogaClass = { id: 1, ...yoga, coachId: 7 }

test('cờ coachSubjects mặc định tắt', () => assert.equal(FEATURES.coachSubjects, false))

test('coachTeaches: đúng môn / sai môn / không có subjects', () => {
  assert.equal(coachTeaches(coaches[0], 'Yoga'), true)
  assert.equal(coachTeaches(coaches[0], 'Gym'), false)
  assert.equal(coachTeaches(coaches[1], 'Yoga'), false)
  assert.equal(coachTeaches(coaches[2], 'Yoga'), false)
})

test('cờ tắt: không kiểm tra coach theo môn', () => {
  assert.equal(coachSubjectProblem(8, 'Yoga', coaches, false), '')
  assert.deepEqual(validateClass({ ...yoga, coachId: 8 }, [], { coaches, coachSubjects: false }), [])
})

test('cờ bật, đúng môn: hợp lệ', () => {
  assert.equal(coachSubjectProblem(7, 'Yoga', coaches, true), '')
  assert.deepEqual(validateClass({ ...yoga, coachId: 7 }, [], { coaches, coachSubjects: true }), [])
})

test('cờ bật, sai môn: bị chặn', () => {
  const gym = { ...yoga, classCode: 'CLS-GYM-AM', subject: 'Gym' }
  assert.deepEqual(validateClass({ ...gym, coachId: 7 }, [], { coaches, coachSubjects: true }), ['Huấn luyện viên Phạm Ngọc Lan không dạy bộ môn Gym.'])
})

test('buổi học không kiểm tra coach riêng: coach của buổi luôn là coach của lớp', () => {
  // coachId của form (kể cả coach không dạy môn) bị bỏ qua, chỉ cần lớp có coach.
  assert.deepEqual(validateSchedule({ ...session, coachId: 8 }, yogaClass, room, { coaches, coachSubjects: true }), [])
  assert.deepEqual(validateSchedule({ ...session, coachId: 7 }, { ...yogaClass, coachId: '' }, room), ['Lớp chưa có huấn luyện viên, hãy gán coach cho lớp trước.'])
  assert.deepEqual(validateSchedule(session, { ...yogaClass, coachId: null }, room), ['Lớp chưa có huấn luyện viên, hãy gán coach cho lớp trước.'])
})

test('cờ bật, coach không có subjects: không chọn được', () => {
  for (const id of [8, 9]) {
    assert.match(coachSubjectProblem(id, 'Yoga', coaches, true), /chưa được phân công bộ môn nào/)
    assert.ok(validateClass({ ...yoga, coachId: id }, [], { coaches, coachSubjects: true }).some((m) => m.includes('chưa được phân công bộ môn')))
  }
})

test('cờ bật, chưa chọn coach: không kiểm tra (lớp / buổi theo HLV của lớp)', () => {
  assert.equal(coachSubjectProblem('', 'Yoga', coaches, true), '')
  assert.deepEqual(validateClass({ ...yoga, coachId: '' }, [], { coaches, coachSubjects: true }), [])
  assert.deepEqual(validateSchedule({ ...session, coachId: '' }, yogaClass, room, { coaches, coachSubjects: true }), [])
})

test('mô tả buổi học tối đa 1000 ký tự', () => {
  assert.deepEqual(validateSchedule({ ...session, description: 'a'.repeat(SESSION_DESCRIPTION_MAX) }, yogaClass, room), [])
  assert.match(validateSchedule({ ...session, description: 'a'.repeat(SESSION_DESCRIPTION_MAX + 1) }, yogaClass, room)[0], /tối đa 1000 ký tự/)
})

test('createdUserId: lấy id từ response.user.id, dự phòng id / userId', async () => {
  const { createdUserId } = await import('../src/services/api.js')
  assert.equal(createdUserId({ user: { id: 12, fullName: 'A' }, verificationEmailStatus: 'SENT' }), 12)
  assert.equal(createdUserId({ id: 13 }), 13)
  assert.equal(createdUserId({ userId: 14 }), 14)
  assert.equal(createdUserId({ user: { id: 15 }, id: 99 }), 15)
  assert.equal(createdUserId({ verificationEmailStatus: 'SENT' }), null)
  assert.equal(createdUserId(null), null)
})
