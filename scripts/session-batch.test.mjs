import assert from 'node:assert/strict'
import test from 'node:test'
import { parseSessionCsv, repeatSessions } from '../src/validation/sessionBatch.js'

const cls = { id: 1, classCode: 'YOGA-01' }
const rooms = [{ id: 2, roomCode: 'R1' }]
const coaches = [{ id: 3, email: 'coach@example.com' }]

test('CSV maps known room and coach and rejects wrong class', () => {
  const head = 'classCode,startTime,endTime,roomCode,coachEmail,description\n'
  const row = 'YOGA-01,2026-12-01T09:00,2026-12-01T10:00,R1,coach@example.com,"Yoga, basics"'
  assert.deepEqual(parseSessionCsv(head + row, cls, rooms, coaches), [{ classId: 1, roomId: 2, coachId: 3, startTime: '2026-12-01T09:00', endTime: '2026-12-01T10:00', description: 'Yoga, basics' }])
  assert.throws(() => parseSessionCsv(head + row.replace('YOGA-01', 'OTHER'), cls, rooms, coaches), /mã lớp/)
})

test('repeated sessions keep Vietnam local time and duration', () => {
  const rows = repeatSessions({ classId: 1, roomId: 2, coachId: 3, startTime: '2026-12-01T09:00', duration: 60, everyDays: 7, count: 2, description: '' })
  assert.deepEqual(rows.map(row => [row.startTime, row.endTime]), [['2026-12-01T09:00', '2026-12-01T10:00'], ['2026-12-08T09:00', '2026-12-08T10:00']])
  assert.throws(() => repeatSessions({ startTime: '2026-12-01T09:00', duration: 60, everyDays: 7, count: 101 }), /tối đa 100/)
})
