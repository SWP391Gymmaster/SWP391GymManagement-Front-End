import assert from 'node:assert/strict'
import test from 'node:test'
import { isUnassignedCoach, sortCoachesForAssignment } from '../src/validation/coachAssignments.js'

test('isUnassignedCoach: rỗng / thiếu subjects là chưa phân công', () => {
  assert.equal(isUnassignedCoach({ subjects: [] }), true)
  assert.equal(isUnassignedCoach({}), true)
  assert.equal(isUnassignedCoach(null), true)
  assert.equal(isUnassignedCoach({ subjects: ['Yoga'] }), false)
})

test('sortCoachesForAssignment: coach chưa có bộ môn lên đầu, rồi theo tên', () => {
  const coaches = [
    { id: 1, name: 'Bình', subjects: ['Gym'] },
    { id: 2, name: 'Dũng', subjects: [] },
    { id: 3, name: 'An', subjects: ['Yoga'] },
    { id: 4, name: 'Chi' },
  ]
  assert.deepEqual(sortCoachesForAssignment(coaches).map(c => c.id), [4, 2, 3, 1])
  assert.deepEqual(coaches.map(c => c.id), [1, 2, 3, 4]) // không sửa mảng gốc
})
