import assert from 'node:assert/strict'
import test from 'node:test'
import { coachLoad, findDuplicate, findOverlaps, rangesOverlap } from '../src/validation/classDuplicates.js'
import { classWarnings, coachProblems, validateClass } from '../src/validation/classRules.js'

const today = '2026-10-30'
const cls = (id, coachId, startDate, endDate, extra = {}) => ({ id, classCode: `CLS-T-${id}`, name: `Lớp ${id}`, coachId, startDate, endDate, ...extra })
const classes = [
  cls(1, 7, '2026-11-01', '2026-11-30'),
  cls(2, 7, '2026-12-01', '2026-12-31'),
  cls(3, 8, '2026-11-01', '2026-11-30'),
  cls(4, 7, '2026-01-01', '2026-03-31'), // đã đóng
]
const form = (extra) => ({ classCode: 'CLS-T-NEW', name: 'Lớp mới', subject: 'Gym', capacity: 15, coachId: 7, startDate: '2026-11-01', endDate: '2026-11-30', ...extra })
const coaches = [{ id: 7, name: 'Phạm Ngọc Lan', subjects: ['Gym'] }, { id: 8, name: 'Lê Văn B' }]

test('khoảng ngày giao nhau tính cả hai đầu', () => {
  assert.equal(rangesOverlap('2026-11-01', '2026-11-30', '2026-11-30', '2026-12-10'), true)
  assert.equal(rangesOverlap('2026-11-01', '2026-11-29', '2026-11-30', '2026-12-10'), false)
})

test('trùng hoàn toàn: cùng coach, cùng ngày bắt đầu và kết thúc', () => {
  assert.equal(findDuplicate(form(), classes, { today })?.id, 1)
  assert.match(coachProblems(form(), { classes, coaches, today })[0], /trùng với lớp CLS-T-1 – Lớp 1/)
})

test('giao nhau: cùng coach, chỉ giao khoảng ngày → cảnh báo, không chặn', () => {
  const f = form({ startDate: '2026-11-15', endDate: '2026-12-05' })
  assert.equal(findDuplicate(f, classes, { today }), undefined)
  assert.deepEqual(findOverlaps(f, classes, { today }).map((c) => c.id), [1, 2])
  assert.deepEqual(coachProblems(f, { classes, coaches, today }), [])
  assert.deepEqual(classWarnings(f, { classes, today }), ['Huấn luyện viên đang có 2 lớp gồm: CLS-T-1, CLS-T-2.'])
  assert.deepEqual(classWarnings(form({ startDate: '2026-11-15', endDate: '2026-11-20' }), { classes, today }), ['Huấn luyện viên đang có 1 lớp gồm: CLS-T-1.'])
})

test('trùng hoàn toàn không nằm trong danh sách giao nhau', () => {
  assert.deepEqual(findOverlaps(form(), classes, { today }), [])
})

test('không giao nhau thì không trùng, không cảnh báo', () => {
  const f = form({ startDate: '2027-01-05', endDate: '2027-02-05' })
  assert.equal(findDuplicate(f, classes, { today }), undefined)
  assert.deepEqual(findOverlaps(f, classes, { today }), [])
  assert.equal(coachLoad(7, classes, { ...f, today }), 0)
})

test('khác coach thì không tính', () => {
  const f = form({ coachId: 9 })
  assert.equal(findDuplicate(f, classes, { today }), undefined)
  assert.deepEqual(findOverlaps(f, classes, { today }), [])
  assert.equal(coachLoad(9, classes, { ...f, today }), 0)
})

test('lớp đang sửa không tự trùng chính nó', () => {
  const editing = form({ id: 1, classCode: 'CLS-T-1' })
  assert.equal(findDuplicate(editing, classes, { today }), undefined)
  assert.equal(coachLoad(7, classes, { startDate: editing.startDate, endDate: editing.endDate, excludeId: 1, today }), 0)
})

test('lớp đã đóng không tính', () => {
  const f = form({ startDate: '2026-01-01', endDate: '2026-03-31' })
  assert.equal(findDuplicate(f, classes, { today }), undefined)
  assert.equal(coachLoad(7, classes, { today }), 2)
})

test('thiếu ngày: không kiểm tra trùng/giao, số lớp đếm mọi lớp chưa đóng', () => {
  const f = form({ endDate: '' })
  assert.equal(findDuplicate(f, classes, { today }), undefined)
  assert.deepEqual(findOverlaps(f, classes, { today }), [])
  assert.equal(coachLoad(7, classes, { startDate: '2026-11-01', today }), 2)
})

test('không có coach thì không kiểm tra luật coach', () => {
  assert.deepEqual(coachProblems(form({ coachId: '' }), { classes, coaches, today }), [])
  assert.equal(coachLoad('', classes, { today }), 0)
})

const busy = (n) => Array.from({ length: n }, (_, i) => cls(100 + i, 7, '2026-11-01', '2026-11-30', { classCode: `CLS-B-${i}` }))
const fresh = form({ startDate: '2026-11-10', endDate: '2026-11-20' }) // giao nhưng không trùng

test('coach đang có 4 lớp giao nhau vẫn nhận thêm được (4/5)', () => {
  assert.equal(coachLoad(7, busy(4), { ...fresh, today }), 4)
  assert.deepEqual(coachProblems(fresh, { classes: busy(4), coaches, today }), [])
})

test('coach đã có 5 lớp giao nhau thì bị chặn (5/5)', () => {
  assert.equal(coachLoad(7, busy(5), { ...fresh, today }), 5)
  assert.deepEqual(coachProblems(fresh, { classes: busy(5), coaches, today }), ['Coach Phạm Ngọc Lan đã đủ 5 lớp trong khoảng thời gian này.'])
})

test('validateClass áp dụng luật coach khi có danh sách lớp, sửa không đổi coach/ngày thì bỏ qua', () => {
  assert.ok(validateClass(form(), [], { classes, coaches, today }).some((m) => m.includes('trùng với lớp')))
  assert.deepEqual(validateClass(form(), [], { coachSubjects: false }), [])
  const original = form({ id: 200, classCode: 'CLS-T-200' })
  assert.deepEqual(validateClass({ ...original, name: 'Đổi tên' }, [], { classes: busy(6), coaches, original, today }), [])
  assert.ok(validateClass({ ...original, endDate: '2026-11-29' }, [], { classes: busy(6), coaches, original, today }).some((m) => m.includes('đã đủ 5 lớp')))
})
