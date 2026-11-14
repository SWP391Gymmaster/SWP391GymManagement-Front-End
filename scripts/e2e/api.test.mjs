import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

const base = process.env.E2E_API_URL || 'http://127.0.0.1:18080'
const db = process.env.E2E_DB || 'swp391_e2e_20261113'
const mysql = process.env.MYSQL_BIN || 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe'
if (!/^swp391_e2e_[a-zA-Z0-9_]+$/.test(db) || !/^http:\/\/(127\.0\.0\.1|localhost):18080$/.test(base)) {
  throw new Error('E2E refuses non-isolated DB or API URL')
}
if (!process.env.MYSQL_PWD) throw new Error('Set MYSQL_PWD for the isolated E2E database')

const suffix = Date.now().toString(36).toUpperCase()
const idCode = name => `E2E-${name}-${suffix}`
const sql = statement => {
  const result = spawnSync(mysql, ['-u', 'root', '-h', '127.0.0.1', '-D', db, '-N', '-B', '-e', statement], {
    encoding: 'utf8', env: process.env,
  })
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || 'mysql failed')
  return result.stdout.trim()
}
const count = statement => Number(sql(statement))
const sqlFails = statement => {
  const result = spawnSync(mysql, ['-u', 'root', '-h', '127.0.0.1', '-D', db, '-N', '-B', '-e', statement], {
    encoding: 'utf8', env: process.env,
  })
  assert.notEqual(result.status, 0, 'Expected MySQL constraint to reject duplicate data')
}
const day = n => new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
const stamp = (date, time) => `${date}T${time}:00`
const vnTime = minutes => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).format(new Date(Date.now() + minutes * 60000)).replace('T', ' ')
const state = { tokens: {}, ids: {} }

async function request(path, { method = 'GET', role, body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { ...(role ? { Authorization: `Bearer ${state.tokens[role]}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const raw = await response.text()
  let data = raw
  try { data = JSON.parse(raw) } catch { /* 204 or plain text */ }
  return { status: response.status, data }
}
const ok = (result, status) => {
  assert.equal(result.status, status, JSON.stringify(result.data))
  return result.data
}
const login = async role => {
  const data = ok(await request('/auth/login', { method: 'POST', body: {
    email: `e2e.${role}@example.test`, password: 'password123',
  } }), 200)
  state.tokens[role] = data.token
  state.ids[role] = data.userId
}
const packageBody = (name, extra = {}) => ({
  packageCode: idCode(name), name: idCode(name), description: 'E2E only',
  price: 100000, durationDays: 90, status: 'ACTIVE', allowedSubjects: ['GYM'], ...extra,
})
const roomBody = (name, extra = {}) => ({ roomCode: idCode(name), name: idCode(name), capacity: 10, type: 'GYM', ...extra })
const classBody = (name, coachId, extra = {}) => ({
  classCode: idCode(name), name: idCode(name), subject: 'Gym', description: 'E2E only',
  capacity: 2, coachId, startDate: day(2), endDate: day(20), ...extra,
})
const sessionBody = (classId, roomId, date, start = '10:00', end = '11:00', extra = {}) => ({
  classId, roomId, startTime: stamp(date, start), endTime: stamp(date, end), description: 'E2E roadmap', ...extra,
})
const makeClass = async (name, extra = {}) => ok(await request('/api/classes', { method: 'POST', role: 'manager', body: classBody(name, state.ids.coach, extra) }), 201)
const makeSession = async (classId, roomId, date, start = '10:00', end = '11:00') =>
  ok(await request('/api/schedules', { method: 'POST', role: 'manager', body: sessionBody(classId, roomId, date, start, end) }), 201)

test('Real API + isolated MySQL E2E', async t => {
  await t.test('SMOKE-01 roles login, public catalog, and DB isolation', async () => {
    assert.equal(sql('SELECT DATABASE()'), db)
    for (const role of ['admin', 'manager', 'coach', 'coach2', 'member', 'member2', 'member3', 'receptionist']) await login(role)
    assert.ok(Array.isArray(ok(await request('/api/classes'), 200)))
    ok(await request('/api/member/classes', { role: 'manager' }), 403)
    ok(await request('/api/admin/users', { role: 'member' }), 403)
    ok(await request('/api/member/classes'), 401)
    ok(await request('/api/member/class-enrollments', { role: 'member' }), 404)
    ok(await request('/api/member/class-sessions/1/enrollment', { method: 'POST', role: 'member' }), 404)
  })

  await t.test('ADMIN-01 coach subject assignment and RBAC', async () => {
    const path = `/api/admin/coaches/${state.ids.coach}/subjects`
    ok(await request(path, { method: 'PUT', role: 'manager', body: { subjects: ['Gym'] } }), 403)
    ok(await request(path, { method: 'PUT', role: 'admin', body: { subjects: ['Gym'] } }), 200)
    ok(await request(`/api/admin/coaches/${state.ids.coach2}/subjects`, { method: 'PUT', role: 'admin', body: { subjects: ['Gym'] } }), 200)
  })

  await t.test('PKG-01 CRUD, duplicate, validation, active filter', async () => {
    const body = packageBody('PKG')
    const pkg = ok(await request('/api/membership-packages', { method: 'POST', role: 'manager', body }), 201)
    state.ids.pkg = pkg.id
    ok(await request('/api/membership-packages', { method: 'POST', role: 'manager', body }), 400)
    ok(await request('/api/membership-packages', { method: 'POST', role: 'manager', body: packageBody('BAD', { price: 1.5 }) }), 400)
    ok(await request(`/api/membership-packages/${pkg.id}/suspend`, { method: 'PATCH', role: 'manager' }), 200)
    assert.ok(!ok(await request('/api/membership-packages/active'), 200).some(p => p.id === pkg.id))
    ok(await request(`/api/membership-packages/${pkg.id}/activate`, { method: 'PATCH', role: 'manager' }), 200)
    assert.equal(count(`SELECT COUNT(*) FROM membership_packages WHERE id=${pkg.id}`), 1)
  })

  await t.test('ROOM-01 CRUD, duplicate, malformed code, and DB unique', async () => {
    const body = roomBody('ROOM')
    const room = ok(await request('/api/rooms', { method: 'POST', role: 'manager', body }), 201)
    state.ids.room = room.id
    ok(await request('/api/rooms', { method: 'POST', role: 'manager', body }), 400)
    ok(await request('/api/rooms', { method: 'POST', role: 'manager', body: roomBody('BADROOM', { roomCode: 'bad code' }) }), 400)
    assert.equal(count(`SELECT COUNT(*) FROM rooms WHERE room_code='${body.roomCode}'`), 1)
  })

  await t.test('CLASS-01 create without roadmap; invalid and duplicate code', async () => {
    const cls = await makeClass('MAIN')
    state.ids.cls = cls.id
    assert.equal(ok(await request(`/api/classes/${cls.id}`), 200).classCode, cls.classCode)
    assert.deepEqual(ok(await request(`/api/schedules?classId=${cls.id}`), 200), [])
    ok(await request(`/api/member/classes/${cls.id}/registration`, { method: 'POST', role: 'member' }), 400)
    ok(await request('/api/classes', { method: 'POST', role: 'manager', body: classBody('MAIN', state.ids.coach) }), 400)
    ok(await request('/api/classes', { method: 'POST', role: 'manager', body: classBody('BADC', state.ids.coach, { capacity: 0 }) }), 400)
    assert.equal(count(`SELECT COUNT(*) FROM classes WHERE class_code='${cls.classCode}'`), 1)
  })

  await t.test('SESSION-01 roadmap, time, room/coach conflict, and batch rollback', async () => {
    const cls = state.ids.cls, room = state.ids.room
    const first = await makeSession(cls, room, day(3))
    state.ids.session = first.id
    ok(await request('/api/schedules', { method: 'POST', role: 'manager', body: sessionBody(cls, room, day(4), '11:00', '11:00') }), 400)
    ok(await request('/api/schedules', { method: 'POST', role: 'manager', body: sessionBody(cls, room, day(3), '10:30', '11:30') }), 400)
    const other = await makeClass('OTHER', { capacity: 2, startDate: day(3) })
    state.ids.other = other.id
    ok(await request('/api/schedules', { method: 'POST', role: 'manager', body: sessionBody(other.id, room, day(3), '10:30', '11:30') }), 400)
    const before = count(`SELECT COUNT(*) FROM schedules WHERE class_id=${cls}`)
    ok(await request('/api/schedules/batch', { method: 'POST', role: 'manager', body: [
      sessionBody(cls, room, day(5)), sessionBody(cls, room, day(5), '10:30', '11:30'),
    ] }), 400)
    assert.equal(count(`SELECT COUNT(*) FROM schedules WHERE class_id=${cls}`), before)
    assert.equal(ok(await request(`/api/schedules?classId=${cls}`), 200).length, 1)
  })

  await t.test('CASH-01 member entitlement, invoice/payment snapshot, ownership', async () => {
    for (const role of ['member', 'member2', 'member3']) {
      const receipt = ok(await request('/api/payments/cash-checkout', { method: 'POST', role: 'receptionist', body: {
        memberId: state.ids[role], packageId: state.ids.pkg,
      } }), 201)
      if (role === 'member') state.ids.payment = receipt.paymentId
      assert.equal(count(`SELECT COUNT(*) FROM member_memberships WHERE member_id=${state.ids[role]}`), 1)
    }
    ok(await request(`/api/membership-packages/${state.ids.pkg}`, { method: 'PUT', role: 'manager', body: packageBody('PKG', { price: 200000 }) }), 400)
    ok(await request(`/api/membership-packages/${state.ids.pkg}`, { method: 'DELETE', role: 'manager' }), 400)
    ok(await request(`/api/payments/${state.ids.payment}/cancel`, { method: 'POST', role: 'manager', body: {} }), 400)
    const own = ok(await request('/api/member/memberships', { role: 'member' }), 200)
    assert.equal(own.length, 1)
    assert.equal(count(`SELECT COUNT(*) FROM invoices WHERE member_id=${state.ids.member} AND status='PAID'`), 1)
    ok(await request(`/api/member/payments/${state.ids.payment}`, { role: 'member2' }), 400)
    ok(await request(`/api/member/payments/${state.ids.payment}`, { role: 'member' }), 200)
    const quote = ok(await request(`/api/member/memberships/quote?packageId=${state.ids.pkg}`, { role: 'member' }), 200)
    assert.ok(quote.startDate > day(0), JSON.stringify(quote))
  })

  await t.test('REG-01 class registration, duplicate, personal roadmap, cancel', async () => {
    const cls = state.ids.cls
    ok(await request(`/api/member/classes/${cls}/registration`, { method: 'POST', role: 'member' }), 201)
    ok(await request(`/api/member/classes/${cls}/registration`, { method: 'POST', role: 'member' }), 400)
    assert.equal(count(`SELECT COUNT(*) FROM class_registrations WHERE class_id=${cls} AND member_id=${state.ids.member}`), 1)
    const stats = ok(await request('/api/member/classes', { role: 'member' }), 200)
    assert.equal(stats.find(row => row.classId === cls).registeredByMe, true)
    ok(await request(`/api/member/classes/${cls}/registration`, { method: 'DELETE', role: 'member' }), 204)
    assert.equal(count(`SELECT COUNT(*) FROM class_registrations WHERE class_id=${cls} AND member_id=${state.ids.member}`), 0)
    ok(await request(`/api/member/classes/${cls}/registration`, { method: 'POST', role: 'member' }), 201)
  })

  await t.test('REG-02 schedule overlap across classes blocks second class', async () => {
    const secondRoom = ok(await request('/api/rooms', { method: 'POST', role: 'manager', body: roomBody('ROOM2') }), 201)
    state.ids.room2 = secondRoom.id
    const other = await makeClass('OVERLAP', { coachId: state.ids.coach2 })
    await makeSession(other.id, secondRoom.id, day(3), '10:00', '11:00')
    const result = await request(`/api/member/classes/${other.id}/registration`, { method: 'POST', role: 'member' })
    assert.equal(result.status, 400, JSON.stringify(result.data))
  })

  await t.test('DB-01 unique class registration and attendance constraints', async () => {
    sqlFails(`INSERT INTO class_registrations(member_id,class_id,registered_at) VALUES(${state.ids.member},${state.ids.cls},NOW(6))`)
    assert.equal(count(`SELECT COUNT(*) FROM class_registrations WHERE member_id=${state.ids.member} AND class_id=${state.ids.cls}`), 1)
    sqlFails(`INSERT INTO rooms(room_code,name,capacity,type) VALUES('${idCode('ROOM')}','Duplicate DB',10,'GYM')`)
    assert.equal(count(`SELECT COUNT(*) FROM rooms WHERE room_code='${idCode('ROOM')}'`), 1)
  })

  await t.test('CROSS-01 room and class changes cannot invalidate active schedules', async () => {
    const room = ok(await request(`/api/rooms/${state.ids.room}`), 200)
    ok(await request(`/api/rooms/${room.id}`, { method: 'PUT', role: 'manager', body: { ...room, capacity: 1 } }), 400)
    ok(await request(`/api/rooms/${room.id}`, { method: 'PUT', role: 'manager', body: { ...room, type: 'YOGA' } }), 400)
    ok(await request(`/api/rooms/${room.id}`, { method: 'DELETE', role: 'manager' }), 400)
    const cls = ok(await request(`/api/classes/${state.ids.cls}`), 200)
    ok(await request(`/api/classes/${cls.id}`, { method: 'PUT', role: 'manager', body: { ...cls, subject: 'Yoga' } }), 400)
    ok(await request(`/api/classes/${cls.id}`, { method: 'DELETE', role: 'manager' }), 400)
    assert.equal(ok(await request(`/api/rooms/${room.id}`), 200).type, 'GYM')
    assert.equal(ok(await request(`/api/classes/${cls.id}`), 200).subject, 'Gym')
  })

  await t.test('ADMIN-02 referenced users cannot change role', async () => {
    ok(await request(`/api/admin/users/${state.ids.member}`, { method: 'PATCH', role: 'admin', body: { role: 'COACH' } }), 409)
    ok(await request(`/api/admin/users/${state.ids.coach}`, { method: 'PATCH', role: 'admin', body: { role: 'MEMBER' } }), 409)
    ok(await request(`/api/admin/users/${state.ids.member}`, { method: 'PATCH', role: 'manager', body: { fullName: 'Wrong role' } }), 403)
    assert.equal(sql(`SELECT role FROM users WHERE id=${state.ids.member}`), 'MEMBER')
  })

  await t.test('P0-01 registered class must retain at least one session', async () => {
    const result = await request(`/api/schedules/${state.ids.session}`, { method: 'DELETE', role: 'manager' })
    const registrations = count(`SELECT COUNT(*) FROM class_registrations WHERE class_id=${state.ids.cls}`)
    const remaining = count(`SELECT COUNT(*) FROM schedules WHERE class_id=${state.ids.cls}`)
    assert.equal(result.status, 400, `Deleting last session stranded ${registrations} registrations with ${remaining} sessions`)
    assert.equal(count(`SELECT COUNT(*) FROM schedules WHERE id=${state.ids.session}`), 1)
  })

  await t.test('P0-02 future registration opening must block early signup', async () => {
    const cls = await makeClass('FUTOPEN', { startDate: day(4), registrationOpenAt: stamp(day(1), '08:00') })
    await makeSession(cls.id, state.ids.room2, day(4), '13:00', '14:00')
    const result = await request(`/api/member/classes/${cls.id}/registration`, { method: 'POST', role: 'member2' })
    const registrations = count(`SELECT COUNT(*) FROM class_registrations WHERE class_id=${cls.id}`)
    assert.equal(result.status, 400, `Signup before registrationOpenAt created ${registrations} registrations`)
  })

  await t.test('P0-03 moving a registered session beyond membership end must be blocked', async () => {
    const cls = await makeClass('LONGTERM', { coachId: state.ids.coach2, startDate: day(8), endDate: day(120) })
    const session = await makeSession(cls.id, state.ids.room2, day(10), '18:00', '19:00')
    ok(await request(`/api/member/classes/${cls.id}/registration`, { method: 'POST', role: 'member3' }), 201)
    const moved = await request(`/api/schedules/${session.id}`, { method: 'PUT', role: 'manager', body: sessionBody(cls.id, state.ids.room2, day(95), '18:00', '19:00') })
    const actualDate = ok(await request(`/api/schedules/${session.id}`), 200).startTime.slice(0, 10)
    assert.equal(moved.status, 400, `Membership ends before day 95; session is now ${actualDate}`)
    assert.equal(ok(await request(`/api/schedules/${session.id}`), 200).startTime.slice(0, 10), day(10))
  })

  await t.test('P0-04 changing registered class subject must preserve member entitlement', async () => {
    ok(await request(`/api/admin/coaches/${state.ids.coach2}/subjects`, { method: 'PUT', role: 'admin', body: { subjects: ['Gym', 'Yoga'] } }), 200)
    const room = ok(await request('/api/rooms', { method: 'POST', role: 'manager', body: roomBody('FLEX', { type: 'OTHER' }) }), 201)
    const cls = await makeClass('SUBJECT', { coachId: state.ids.coach2, startDate: day(9), endDate: day(35) })
    await makeSession(cls.id, room.id, day(12), '09:00', '10:00')
    ok(await request(`/api/member/classes/${cls.id}/registration`, { method: 'POST', role: 'member3' }), 201)
    const changed = await request(`/api/classes/${cls.id}`, { method: 'PUT', role: 'manager', body: { ...cls, subject: 'Yoga' } })
    const subject = ok(await request(`/api/classes/${cls.id}`), 200).subject
    assert.equal(changed.status, 400, `Gym-only member remains registered in class now subject=${subject}`)
    assert.equal(ok(await request(`/api/classes/${cls.id}`), 200).subject, 'Gym')
  })

  await t.test('CONCURRENT-01 two members racing for last seat', async () => {
    const cls = await makeClass('ONESHOT', { capacity: 1, startDate: day(5) })
    await makeSession(cls.id, state.ids.room2, day(6), '16:00', '17:00')
    const results = await Promise.all(['member2', 'member3'].map(role => request(
      `/api/member/classes/${cls.id}/registration`, { method: 'POST', role },
    )))
    assert.deepEqual(results.map(r => r.status).sort(), [201, 400])
    assert.equal(count(`SELECT COUNT(*) FROM class_registrations WHERE class_id=${cls.id}`), 1)
  })

  await t.test('CONCURRENT-02 duplicate request from one member', async () => {
    const cls = await makeClass('DUPRACE', { capacity: 2, startDate: day(6) })
    await makeSession(cls.id, state.ids.room2, day(7), '16:00', '17:00')
    const results = await Promise.all([1, 2].map(() => request(
      `/api/member/classes/${cls.id}/registration`, { method: 'POST', role: 'member3' },
    )))
    assert.deepEqual(results.map(r => r.status).sort(), [201, 400])
    assert.equal(count(`SELECT COUNT(*) FROM class_registrations WHERE class_id=${cls.id} AND member_id=${state.ids.member3}`), 1)
  })

  await t.test('CONCURRENT-03 staff confirming one bank transfer activates membership once', async () => {
    const memberId = state.ids.member3
    const before = count(`SELECT COUNT(*) FROM member_memberships WHERE member_id=${memberId}`)
    const invoiceCode = idCode('INV')
    const paymentCode = idCode('PAY')
    sql(`INSERT INTO invoices(invoice_code,member_id,package_id,amount,status,issued_at) VALUES('${invoiceCode}',${memberId},${state.ids.pkg},100000,'PENDING',NOW(6))`)
    const invoiceId = Number(sql(`SELECT id FROM invoices WHERE invoice_code='${invoiceCode}'`))
    sql(`INSERT INTO payments(payment_code,invoice_id,member_id,amount,payment_method,status,created_at) VALUES('${paymentCode}',${invoiceId},${memberId},100000,'BANK_TRANSFER','PENDING',NOW(6))`)
    const paymentId = Number(sql(`SELECT id FROM payments WHERE payment_code='${paymentCode}'`))
    const results = await Promise.all(['manager', 'receptionist'].map(role => request(
      `/api/payments/${paymentId}/confirm`, { method: 'POST', role, body: { transactionReference: idCode('BANK') } },
    )))
    assert.deepEqual(results.map(r => r.status).sort(), [200, 400])
    assert.equal(count(`SELECT COUNT(*) FROM member_memberships WHERE member_id=${memberId}`), before + 1)
    assert.equal(sql(`SELECT status FROM invoices WHERE id=${invoiceId}`), 'PAID')
    assert.equal(sql(`SELECT status FROM payments WHERE id=${paymentId}`), 'COMPLETED')
  })

  await t.test('ATT-01 coach ownership, notification isolation, read and correction', async () => {
    const coachId = state.ids.coach, memberId = state.ids.member
    const classCode = idCode('ATT')
    sql(`INSERT INTO classes(class_code,name,subject,description,capacity,coach_id,start_date,end_date) VALUES('${classCode}','${classCode}','Gym','E2E',2,${coachId},'${day(-1)}','${day(1)}')`)
    const cls = Number(sql(`SELECT id FROM classes WHERE class_code='${classCode}'`))
    // Hibernate's UTC JDBC setting shifts LocalDateTime by +07:00 when reading direct SQL fixtures.
    sql(`INSERT INTO schedules(class_id,coach_id,room_id,start_time,end_time,description) VALUES(${cls},${coachId},${state.ids.room},'${vnTime(-450)}','${vnTime(-390)}','E2E attendance')`)
    const scheduleId = Number(sql(`SELECT MAX(id) FROM schedules WHERE class_id=${cls}`))
    sql(`INSERT INTO class_registrations(member_id,class_id,registered_at) VALUES(${memberId},${cls},NOW(6))`)
    ok(await request(`/api/coach/schedules/${scheduleId}/attendance`, { role: 'coach2' }), 400)
    const roster = ok(await request(`/api/coach/schedules/${scheduleId}/attendance`, { role: 'coach' }), 200)
    assert.ok(roster.some(row => row.memberId === memberId))
    ok(await request(`/api/coach/schedules/${scheduleId}/attendance`, { method: 'POST', role: 'coach', body: { memberId: state.ids.member2, present: true } }), 400)
    ok(await request(`/api/coach/schedules/${scheduleId}/attendance`, { method: 'POST', role: 'coach', body: { memberId, present: true } }), 200)
    assert.ok(ok(await request('/api/member/attendance', { role: 'member' }), 200).some(n => n.scheduleId === scheduleId && !n.read))
    assert.ok(!ok(await request('/api/member/attendance', { role: 'member2' }), 200).some(n => n.scheduleId === scheduleId))
    ok(await request(`/api/member/attendance/${scheduleId}/read`, { method: 'POST', role: 'member2' }), 404)
    ok(await request(`/api/member/attendance/${scheduleId}/read`, { method: 'POST', role: 'member' }), 204)
    assert.ok(ok(await request('/api/member/attendance', { role: 'member' }), 200).some(n => n.scheduleId === scheduleId && n.read))
    ok(await request(`/api/coach/schedules/${scheduleId}/attendance`, { method: 'POST', role: 'coach', body: { memberId, present: false } }), 200)
    assert.ok(ok(await request('/api/member/attendance', { role: 'member' }), 200).some(n => n.scheduleId === scheduleId && !n.read && !n.present))
    assert.equal(count(`SELECT COUNT(*) FROM class_attendance WHERE schedule_id=${scheduleId} AND member_id=${memberId}`), 1)
    ok(await request(`/api/schedules/${scheduleId}`, { method: 'DELETE', role: 'manager' }), 400)
  })
})
