import assert from 'node:assert/strict'
import test from 'node:test'
import { findByCode, isDuplicateCodeError, nextClassCode, suggestClasses, MAX_SUGGESTIONS } from '../src/validation/classCode.js'
import { classCodeProblem } from '../src/validation/classRules.js'

const classes = [
  { id: 1, classCode: 'CLS-YOGA-AM', name: 'Yoga sáng' },
  { id: 2, classCode: 'CLS-YOGA-PM', name: 'Yoga chiều' },
  { id: 3, classCode: 'CLS-GYM-AM', name: 'Gym buổi sáng' },
  { id: 4, classCode: 'CLS-BOX-01', name: 'Boxing cơ bản' },
]
const codes = (list) => list.map((c) => c.classCode)

test('khớp một phần mã hoặc tên', () => {
  assert.deepEqual(codes(suggestClasses('yoga-p', classes)), ['CLS-YOGA-PM'])
  assert.deepEqual(codes(suggestClasses('cơ bản', classes)), ['CLS-BOX-01'])
})

test('không phân biệt hoa thường, bỏ khoảng trắng thừa', () => {
  assert.deepEqual(codes(suggestClasses('  cls-YOGA ', classes)), ['CLS-YOGA-AM', 'CLS-YOGA-PM'])
  assert.deepEqual(codes(suggestClasses('yoga    SÁNG', classes)), ['CLS-YOGA-AM'])
})

test('dưới 2 ký tự thì không gợi ý', () => {
  assert.deepEqual(suggestClasses('c', classes), [])
  assert.deepEqual(suggestClasses('   ', classes), [])
})

test('ưu tiên khớp phần đầu', () => {
  // "AM-01" khớp đầu mã nên đứng trước "CLS-A-AM" (chỉ khớp giữa mã) dù đứng sau trong danh sách gốc
  const list = [{ id: 1, classCode: 'CLS-A-AM', name: 'Lớp am nhạc' }, { id: 2, classCode: 'AM-01', name: 'Khác' }]
  assert.deepEqual(codes(suggestClasses('am', list)), ['AM-01', 'CLS-A-AM'])
})

test('tối đa 6 gợi ý', () => {
  const many = Array.from({ length: 10 }, (_, i) => ({ id: i, classCode: `CLS-YOGA-${i}`, name: `Yoga ${i}` }))
  assert.equal(MAX_SUGGESTIONS, 6)
  assert.equal(suggestClasses('yoga', many).length, 6)
})

test('nextClassCode: CLS-<BỘ MÔN>-01 khi chưa có lớp nào', () => {
  assert.equal(nextClassCode('Zumba', []), 'CLS-ZUMBA-01')
  assert.equal(nextClassCode('Group X', classes), 'CLS-GROUPX-01')
  assert.equal(nextClassCode('Yoga', classes), 'CLS-YOGA-01') // CLS-YOGA-AM/PM không phải số thứ tự
})

test('nextClassCode: số nhỏ nhất chưa dùng, không phân biệt hoa thường', () => {
  const list = [{ classCode: 'CLS-ZUMBA-01' }, { classCode: 'cls-zumba-02' }, { classCode: 'CLS-ZUMBA-04' }]
  assert.equal(nextClassCode('Zumba', list), 'CLS-ZUMBA-03')
  assert.equal(nextClassCode('Zumba', [...list, { classCode: 'CLS-ZUMBA-03' }]), 'CLS-ZUMBA-05')
  // "-1" và "-01" là cùng số
  assert.equal(nextClassCode('Zumba', [{ classCode: 'CLS-ZUMBA-1' }]), 'CLS-ZUMBA-02')
  // Mã của bộ môn khác không ảnh hưởng
  assert.equal(nextClassCode('Zumba', [{ classCode: 'CLS-YOGA-01' }]), 'CLS-ZUMBA-01')
  // Từ 100 trở đi dùng 3 chữ số
  const many = Array.from({ length: 99 }, (_, i) => ({ classCode: `CLS-GYM-${String(i + 1).padStart(2, '0')}` }))
  assert.equal(nextClassCode('Gym', many), 'CLS-GYM-100')
})

test('nextClassCode: luôn hợp định dạng BE (3–32 ký tự) và qua classCodeProblem', () => {
  const be = /^[A-Z0-9]+(-[A-Z0-9]+)*$/
  for (const subject of ['Gym', 'Yoga', 'Group X', 'Võ cổ truyền', 'Đấm bốc', 'Một bộ môn có tên rất rất rất dài vượt giới hạn', '日本', '']) {
    const code = nextClassCode(subject, [])
    assert.match(code, be, subject)
    assert.ok(code.length >= 3 && code.length <= 32, `${subject}: ${code}`)
    assert.equal(classCodeProblem(code, subject), '', `${subject}: ${code}`)
  }
  assert.equal(nextClassCode('日本', []), 'CLS-LOP-01')
})

test('isDuplicateCodeError: nhận lỗi trùng mã của BE', () => {
  assert.equal(isDuplicateCodeError({ code: 'Class code already exists: CLS-ZUMBA-01', message: 'Mã lớp đã tồn tại. Vui lòng chọn mã khác.' }), true)
  assert.equal(isDuplicateCodeError({ message: 'Mã lớp đã tồn tại. Vui lòng chọn mã khác.' }), true)
  assert.equal(isDuplicateCodeError({ code: 'Room code already exists', message: 'Mã phòng đã tồn tại.' }), false)
  assert.equal(isDuplicateCodeError(null), false)
})

test('findByCode tìm đúng mã đã tồn tại, không phân biệt hoa thường', () => {
  assert.equal(findByCode(' cls-yoga-am ', classes)?.id, 1)
  assert.equal(findByCode('CLS-YOGA', classes), undefined)
  assert.equal(findByCode('', classes), undefined)
})
