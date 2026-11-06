// Gợi ý mã lớp khi manager tạo lớp (kiểu tự hoàn thành của Excel). Hàm thuần để test bằng node --test.
import { normalizeCode } from './roomRules.js'
import { codePrefix } from '../config/classDefaults.js'

export const MAX_SUGGESTIONS = 6

const clean = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

// Lớp có mã hoặc tên chứa input (không phân biệt hoa thường). Khớp phần đầu xếp trước, còn lại giữ thứ tự gốc.
export function suggestClasses(input, classes = []) {
  const query = clean(input)
  if (query.length < 2) return []
  const ranked = []
  for (const cls of classes) {
    const code = clean(cls.classCode)
    const name = clean(cls.name)
    if (code.startsWith(query) || name.startsWith(query)) ranked.push({ cls, rank: 0 })
    else if (code.includes(query) || name.includes(query)) ranked.push({ cls, rank: 1 })
  }
  return ranked.sort((a, b) => a.rank - b.rank).slice(0, MAX_SUGGESTIONS).map((r) => r.cls)
}

// Lớp đang dùng đúng mã này (so sánh sau khi chuẩn hóa in hoa), không có thì undefined.
export const findByCode = (code, classes = []) => {
  const target = normalizeCode(code)
  return target ? classes.find((c) => normalizeCode(c.classCode) === target) : undefined
}

// Độ dài tối đa mã lớp theo BE (3–32 ký tự, ^[A-Z0-9]+(-[A-Z0-9]+)*$).
const MAX_CODE = 32

// Mã tự sinh khi TẠO lớp: CLS-<TIỀN TỐ BỘ MÔN>-<STT 2 chữ số>, vd CLS-ZUMBA-01.
// STT = số nhỏ nhất (từ 1) chưa lớp nào dùng với cùng tiền tố (so sánh không phân biệt hoa thường; "-1" và "-01" coi là cùng số).
// Tiền tố lấy từ codePrefix; phần bộ môn tối đa 24 ký tự (để cả STT 3 chữ số vẫn ≤ 32), rỗng thì dùng "LOP".
export function nextClassCode(subject, classes = []) {
  const prefix = `CLS-${(codePrefix(subject).slice(4, -1) || 'LOP').slice(0, MAX_CODE - 8)}-`
  const used = new Set(classes.map((c) => normalizeCode(c.classCode)))
  const numbers = new Set([...used]
    .filter((code) => code.startsWith(prefix) && /^\d+$/.test(code.slice(prefix.length)))
    .map((code) => Number(code.slice(prefix.length))))
  let n = 1
  while (numbers.has(n)) n += 1
  return `${prefix}${String(n).padStart(2, '0')}`
}

// BE từ chối vì mã lớp đã có (vd hai manager tạo cùng lúc). err.code giữ câu gốc của BE.
export const isDuplicateCodeError = (err) => /^Class code already exists/i.test(err?.code || '') || /Mã lớp đã tồn tại/.test(err?.message || '')
