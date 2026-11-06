import assert from 'node:assert/strict'
import test from 'node:test'
import { DETAIL_PAGES, PAGE_STATE_KEY, findDetailClass, menuKeyOf, readPageState, restorePage, writePageState } from '../src/navigation/pageState.js'
import { buildCatalog, sessionStats } from '../src/catalog/catalogRules.js'

const memory = () => { const d = new Map(); return { getItem: (k) => d.get(k) ?? null, setItem: (k, v) => d.set(k, String(v)), removeItem: (k) => d.delete(k), dump: d } }
const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } }

test('trang chi tiết lớp làm sáng mục menu Danh sách lớp', () => {
  assert.equal(DETAIL_PAGES['class-detail'], 'catalog')
  assert.equal(menuKeyOf('class-detail'), 'catalog')
  assert.equal(menuKeyOf('rooms'), 'rooms')
})

test('lưu / đọc trạng thái trang trong sessionStorage; storage bị chặn thì không lỗi', () => {
  const s = memory()
  writePageState(s, { page: 'class-detail', params: { classId: 21 }, userId: 7 })
  assert.deepEqual(readPageState(s), { page: 'class-detail', params: { classId: 21 }, userId: 7 })
  writePageState(s, null)
  assert.equal(s.dump.has(PAGE_STATE_KEY), false)
  assert.equal(readPageState(s), null)
  s.setItem(PAGE_STATE_KEY, '{hỏng')
  assert.equal(readPageState(s), null)
  assert.doesNotThrow(() => writePageState(broken, { page: 'x' }))
  assert.equal(readPageState(broken), null)
  assert.equal(readPageState(null), null)
})

test('restorePage: chỉ khôi phục trang chi tiết của đúng người dùng, role có Danh sách lớp', () => {
  const saved = { page: 'class-detail', params: { classId: 21 }, userId: 7 }
  assert.deepEqual(restorePage(saved, { userId: 7, menuKeys: ['dashboard', 'catalog'] }), { page: 'class-detail', params: { classId: 21 } })
  assert.equal(restorePage(saved, { userId: 8, menuKeys: ['catalog'] }), null) // tài khoản khác
  assert.equal(restorePage(saved, { userId: 7, menuKeys: ['dashboard', 'schedule'] }), null) // coach: không có danh sách lớp
  assert.equal(restorePage({ ...saved, page: 'rooms' }, { userId: 7, menuKeys: ['rooms', 'catalog'] }), null) // trang thường: không giữ
  assert.equal(restorePage(null, { userId: 7, menuKeys: ['catalog'] }), null)
})

test('findDetailClass: lớp còn tồn tại thì trả lớp, không thì null (quay về danh sách)', () => {
  const classes = [{ id: 21, name: 'Cardio' }, { id: 3, name: 'Boxing' }]
  assert.equal(findDetailClass('21', classes).name, 'Cardio')
  assert.equal(findDetailClass(3, classes).name, 'Boxing')
  assert.equal(findDetailClass(99, classes), null)
  assert.equal(findDetailClass(undefined, classes), null)
  assert.equal(findDetailClass('', classes), null)
})

test('sessionStats: tổng, đã diễn ra, sắp tới, chưa xếp giờ', () => {
  const now = new Date('2026-11-06T12:00:00+07:00')
  const [item] = buildCatalog({ now, classes: [{ id: 1, name: 'L', capacity: 5 }], schedules: [
    { id: 1, classId: 1, startTime: '2026-11-02T07:00:00', endTime: '2026-11-02T08:00:00' }, // đã diễn ra
    { id: 2, classId: 1, startTime: '2026-11-04T00:00:00', endTime: '2026-11-04T00:00:00' }, // chưa xếp giờ, đã qua ngày
    { id: 3, classId: 1, startTime: '2026-11-06T00:00:00', endTime: '2026-11-06T00:00:00' }, // chưa xếp giờ, hôm nay
    { id: 4, classId: 1, startTime: '2026-11-09T07:00:00', endTime: '2026-11-09T08:00:00' }, // sắp tới
    { id: 5, classId: 2, startTime: '2026-11-09T07:00:00', endTime: '2026-11-09T08:00:00' }] }) // lớp khác
  assert.deepEqual(sessionStats(item.sessions), { total: 4, done: 2, upcoming: 2, unscheduled: 2 })
  assert.deepEqual(sessionStats([]), { total: 0, done: 0, upcoming: 0, unscheduled: 0 })
})
