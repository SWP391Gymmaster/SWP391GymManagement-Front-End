import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chromium } from 'playwright'

const front = 'http://127.0.0.1:15173'
const api = 'http://127.0.0.1:18080'
const db = process.env.E2E_DB || 'swp391_e2e_20261113'
if (!/^swp391_e2e_[a-zA-Z0-9_]+$/.test(db) || !process.env.MYSQL_PWD) throw new Error('Isolated E2E DB required')
const mysql = process.env.MYSQL_BIN || 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe'
const sql = statement => {
  const r = spawnSync(mysql, ['-u', 'root', '-h', '127.0.0.1', '-D', db, '-N', '-B', '-e', statement], { encoding: 'utf8', env: process.env })
  if (r.status) throw new Error(r.stderr || 'mysql failed')
  return r.stdout.trim()
}
const day = n => new Date(Date.now() + n * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
const vnTime = minutes => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).format(new Date(Date.now() + minutes * 60000)).replace('T', ' ')
const code = `E2E-BROWSER-${Date.now().toString(36).toUpperCase()}`
const creds = role => ({ email: `e2e.${role}@example.test`, password: 'password123' })
async function login(role) {
  const response = await fetch(`${api}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(creds(role)) })
  assert.equal(response.status, 200)
  return response.json()
}
async function call(path, token, method = 'GET', body) {
  const response = await fetch(`${api}${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const data = response.status === 204 ? null : await response.json()
  assert.ok(response.ok, `${method} ${path}: ${response.status} ${JSON.stringify(data)}`)
  return data
}
const browser = await chromium.launch({ headless: true })
const failures = []
async function flow(name, fn) {
  try { await fn(); process.stdout.write(`PASS ${name}\n`) }
  catch (error) { failures.push({ name, message: error.message }); process.stderr.write(`FAIL ${name}: ${error.stack}\n`) }
}
async function rolePage(role, hash = '') {
  const auth = await login(role)
  const context = await browser.newContext()
  await context.addInitScript(({ token, user }) => {
    sessionStorage.setItem('gymmaster-api-session-v1', JSON.stringify({ token, user }))
  }, { token: auth.token, user: { id: auth.userId, name: auth.fullName, email: auth.email, role: auth.role.toLowerCase(), subjects: [] } })
  const page = await context.newPage()
  await page.goto(`${front}/${hash}`)
  return { page, context, auth }
}

try {
  await flow('BROWSER-01 login form and manager menu', async () => {
    const page = await browser.newPage()
    const response = await page.goto(`${front}/#/login`)
    assert.equal(response.status(), 200)
    try { await page.getByRole('textbox', { name: 'Email' }).waitFor({ timeout: 10000 }) }
    catch { throw new Error(`Login page ${page.url()}: ${(await page.locator('body').innerText()).slice(0, 800)}`) }
    await page.getByRole('textbox', { name: 'Email' }).fill(creds('manager').email)
    await page.getByRole('textbox', { name: 'Mật khẩu' }).fill(creds('manager').password)
    await page.getByRole('button', { name: 'Đăng nhập' }).click()
    await page.getByRole('button', { name: 'Danh sách lớp' }).waitFor({ timeout: 10000 })
    assert.ok(await page.getByRole('button', { name: 'Phòng tập' }).count())
    await page.close()
  })

  const manager = await login('manager')
  const admin = await login('admin')
  const coach = await login('coach2')
  const member = await login('member2')
  const receptionist = await login('receptionist')
  await call(`/api/admin/coaches/${coach.userId}/subjects`, admin.token, 'PUT', { subjects: ['Gym'] })
  const pkg = await call('/api/membership-packages', manager.token, 'POST', {
    packageCode: `${code}-P`, name: `${code}-P`, description: 'E2E browser', price: 100000,
    durationDays: 90, status: 'ACTIVE', allowedSubjects: ['GYM'],
  })
  const room = await call('/api/rooms', manager.token, 'POST', {
    roomCode: `${code}-R`, name: `${code}-R`, capacity: 5, type: 'GYM',
  })
  const cls = await call('/api/classes', manager.token, 'POST', {
    classCode: `${code}-C`, name: `${code}-C`, subject: 'Gym', description: 'Browser E2E roadmap',
    capacity: 2, coachId: coach.userId, startDate: day(10), endDate: day(25),
  })
  await call('/api/schedules', manager.token, 'POST', {
    classId: cls.id, roomId: room.id, startTime: `${day(11)}T14:00:00`, endTime: `${day(11)}T15:00:00`, description: 'Bài tập đầu tiên',
  })
  const pending = await call('/api/classes', manager.token, 'POST', {
    classCode: `${code}-WAIT`, name: `${code}-WAIT`, subject: 'Gym', description: 'Future registration opening',
    capacity: 2, coachId: coach.userId, startDate: day(12), endDate: day(26),
    registrationOpenAt: `${day(1)}T08:00:00`, registrationCloseAt: `${day(11)}T23:00:00`,
  })
  await call('/api/schedules', manager.token, 'POST', {
    classId: pending.id, roomId: room.id, startTime: `${day(13)}T14:00:00`, endTime: `${day(13)}T15:00:00`, description: 'Pending class roadmap',
  })
  await call('/api/payments/cash-checkout', receptionist.token, 'POST', { memberId: member.userId, packageId: pkg.id })

  await flow('BROWSER-02 class deep link and back to catalog', async () => {
    const { page, context } = await rolePage('manager', `#/classes/${cls.id}`)
    await page.getByRole('heading', { name: cls.name }).waitFor({ timeout: 10000 })
    assert.ok(await page.getByText('Tổng số buổi học: 1').count())
    await page.getByRole('button', { name: '← Danh sách lớp' }).click()
    assert.equal(new URL(page.url()).hash, '')
    await page.getByText(cls.name).first().waitFor()
    await context.close()
  })

  await flow('BROWSER-03 member enrolls class and sees roadmap', async () => {
    const { page, context } = await rolePage('member2')
    await page.getByRole('button', { name: 'Danh sách lớp' }).click()
    const pendingCard = page.locator('.catalog-card').filter({ hasText: pending.name })
    await pendingCard.getByText('Chưa mở đăng ký').waitFor({ timeout: 10000 })
    assert.equal(await pendingCard.getByRole('button', { name: 'Đăng ký lớp', exact: true }).count(), 0)
    const card = page.locator('.catalog-card').filter({ hasText: cls.name })
    await card.getByRole('button', { name: 'Xem chi tiết' }).click()
    assert.match(page.url(), new RegExp(`#\/classes\/${cls.id}$`))
    await page.getByRole('button', { name: 'Đăng ký lớp', exact: true }).click()
    await page.getByText('Bạn đã đăng ký lớp này').first().waitFor({ timeout: 10000 })
    await page.getByRole('button', { name: 'Lịch tập cá nhân' }).click()
    await page.getByText(cls.name).first().waitFor({ timeout: 10000 })
    await page.reload()
    await page.getByText(cls.name).first().waitFor({ timeout: 10000 })
    await context.close()
  })

  await flow('BROWSER-04 coach sees registered member in roster', async () => {
    const { page, context } = await rolePage('coach2')
    await page.getByRole('button', { name: 'Lịch dạy', exact: true }).click()
    const row = page.locator('tr').filter({ hasText: cls.name })
    await row.getByRole('button', { name: 'Xem và điểm danh' }).click()
    await page.getByText('E2E Member Two').first().waitFor({ timeout: 10000 })
    await context.close()
  })

  await flow('BROWSER-05 attendance notice and mark read', async () => {
    const pastCode = `${code}-A`
    sql(`INSERT INTO classes(class_code,name,subject,description,capacity,coach_id,start_date,end_date) VALUES('${pastCode}','${pastCode}','Gym','E2E',2,${coach.userId},'${day(-1)}','${day(1)}')`)
    const pastClass = Number(sql(`SELECT id FROM classes WHERE class_code='${pastCode}'`))
    sql(`INSERT INTO schedules(class_id,coach_id,room_id,start_time,end_time,description) VALUES(${pastClass},${coach.userId},${room.id},'${vnTime(-450)}','${vnTime(-390)}','Attendance browser E2E')`)
    const pastSession = Number(sql(`SELECT MAX(id) FROM schedules WHERE class_id=${pastClass}`))
    sql(`INSERT INTO class_registrations(member_id,class_id,registered_at) VALUES(${member.userId},${pastClass},NOW(6))`)
    const marked = await call(`/api/coach/schedules/${pastSession}/attendance`, coach.token, 'POST', { memberId: member.userId, present: true })
    assert.equal(marked.present, true)
    const { page, context } = await rolePage('member2')
    await page.getByText('Thông báo điểm danh').first().waitFor({ timeout: 10000 })
    await page.getByRole('button', { name: 'Đánh dấu đã xem' }).first().click()
    await page.getByText('Thông báo điểm danh (0 chưa xem)').waitFor({ timeout: 10000 })
    await context.close()
  })

  await flow('BROWSER-06 admin and receptionist module navigation', async () => {
    const adminPage = await rolePage('admin')
    await adminPage.page.getByRole('button', { name: 'Quản lý nhân sự' }).click()
    await adminPage.page.getByRole('heading', { name: 'Tạo và quản lý tài khoản nhân viên' }).waitFor({ timeout: 10000 })
    await adminPage.context.close()

    const counterPage = await rolePage('receptionist')
    await counterPage.page.getByRole('button', { name: 'Thanh toán tại quầy' }).waitFor({ timeout: 10000 })
    await counterPage.context.close()
  })

  await flow('BROWSER-07 manager reports load with current login session', async () => {
    const reportPage = await rolePage('manager')
    await reportPage.page.getByRole('button', { name: 'Báo cáo & Tiến độ' }).click()
    await reportPage.page.getByRole('button', { name: 'Tiến độ lớp & Coach' }).click()
    await reportPage.page.getByText('Đang tải dữ liệu...').waitFor({ state: 'hidden', timeout: 10000 })
    try { await reportPage.page.getByRole('heading', { name: /Tiến độ lớp học/ }).first().waitFor({ timeout: 10000 }) }
    catch { throw new Error((await reportPage.page.locator('body').innerText()).slice(-1800)) }
    await reportPage.context.close()
  })
} finally {
  await browser.close()
}
if (failures.length) process.exitCode = 1
