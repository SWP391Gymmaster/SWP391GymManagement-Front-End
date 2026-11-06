import { useId, useState } from 'react'
import Modal from '../../components/Modal'
import { useStore } from '../../store/context'
import { SUBJECTS } from '../../data/seed'
import { FEATURES } from '../../config/features'
import { classWarnings, coachLockReason, coachTeaches, sameAssignment, validateClass } from '../../validation/classRules'
import { coachIsFull, coachLoad } from '../../validation/classDuplicates'
import { addDays, toFormDate, toFormStamp, vnStamp } from '../../validation/classDates'
import { codePrefix, MAX_CLASSES_PER_COACH, subjectDefaults } from '../../config/classDefaults'
import { findByCode, nextFreeCode, suggestClasses } from '../../validation/classCode'
import { STATUS, buildCatalog } from '../../catalog/catalogRules'
import '../../catalog.css'

const timed = FEATURES.registrationTimes
const EMPTY = { classCode: '', name: '', subject: 'Gym', description: '', capacity: 15, coachId: '', startDate: '', endDate: '', registrationOpenAt: '', registrationCloseAt: '' }
const NO_DATES = { startDate: '', endDate: '', registrationOpenAt: '', registrationCloseAt: '' }
// Tạo mới: điền sẵn tiền tố mã và sĩ số mặc định theo bộ môn ban đầu.
const fresh = () => ({ ...EMPTY, classCode: codePrefix(EMPTY.subject), capacity: subjectDefaults(EMPTY.subject).capacity })
// Giá trị BE → ô nhập: ngày thì yyyy-MM-dd, mốc đăng ký sớm có giờ thì yyyy-MM-ddTHH:mm.
const fromClass = cls => ({
  ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map(k => [k, cls[k] ?? ''])), id: cls.id,
  startDate: toFormDate(cls.startDate), endDate: toFormDate(cls.endDate),
  registrationOpenAt: timed ? toFormStamp(cls.registrationOpenAt, 'start') : toFormDate(cls.registrationOpenAt),
  registrationCloseAt: timed ? toFormStamp(cls.registrationCloseAt, 'end') : toFormDate(cls.registrationCloseAt),
})

// Tạo mới (cls = null) hoặc sửa lớp. Kiểm tra ở FE trước, BE kiểm tra lại khi lưu.
// Khi tạo mới, ô Mã lớp gợi ý các lớp đã có: lớp đã đóng → mở kỳ mới (chuyển sang sửa lớp đó), lớp khác → dùng làm mẫu.
export default function ClassFormModal({ cls, onClose }) {
  const { users, rooms, classes, schedules, saveClass } = useStore()
  const [target, setTarget] = useState(cls) // lớp đang sửa; null = tạo mới
  const [reopen, setReopen] = useState(false) // sửa lớp đã đóng để mở kỳ mới: ngày nhập lại theo luật tạo mới
  const [form, setForm] = useState(() => cls ? fromClass(cls) : fresh())
  // Ô mà manager đã tự sửa thì không tự điền đè khi đổi bộ môn (chỉ dùng khi tạo mới).
  const [touched, setTouched] = useState({ classCode: false, capacity: false })
  const [original, setOriginal] = useState(() => cls ? fromClass(cls) : null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [askReopen, setAskReopen] = useState(null) // lớp đã đóng đang chờ xác nhận mở kỳ mới
  const [copiedFrom, setCopiedFrom] = useState('')
  const [coachNote, setCoachNote] = useState('') // báo nhẹ khi HLV đang chọn bị bỏ chọn vì đã đủ lớp
  const listId = useId()
  const creating = !target
  const freshDates = creating || reopen
  const coaches = users.filter(u => u.role === 'coach')
  // Sửa lớp đã có buổi học / người đăng ký (không phải mở kỳ mới): không đổi được HLV (BE cũng chặn).
  const coachLock = coachLockReason(target, schedules, reopen)
  // Số lớp khác của coach giao với khoảng ngày đang nhập (chưa đủ ngày thì đếm mọi lớp chưa đóng).
  const loadOf = (coachId, f) => coachLoad(coachId, classes, { startDate: f.startDate, endDate: f.endDate, excludeId: f.id })
  // Coach đang chọn không còn hợp lệ thì bỏ chọn và báo nhẹ: không dạy bộ môn (FEATURES.coachSubjects, khi đổi môn / chép mẫu)
  // hoặc đã đủ lớp (khi đổi ngày / chép mẫu).
  const checkCoach = next => {
    if (!next.coachId || coachLock) return next // HLV đang khóa thì giữ nguyên, khi lưu sẽ báo nếu không hợp lệ
    const name = coaches.find(c => String(c.id) === String(next.coachId))?.name || `#${next.coachId}`
    if (FEATURES.coachSubjects && next.subject !== form.subject && !coachTeaches(coaches.find(c => String(c.id) === String(next.coachId)), next.subject)) {
      setCoachNote(`Đã bỏ chọn HLV ${name} vì không dạy bộ môn ${next.subject}.`)
      return { ...next, coachId: '' }
    }
    // Chưa đủ hai ngày thì không bỏ chọn vì lý do đủ lớp (khi lưu vẫn bị chặn nếu đủ 5 lớp).
    if (!next.startDate || !next.endDate || sameAssignment(next, original) || !coachIsFull(loadOf(next.coachId, next))) return next
    setCoachNote(`Đã bỏ chọn HLV ${name} vì đã đủ ${MAX_CLASSES_PER_COACH}/${MAX_CLASSES_PER_COACH} lớp trong khoảng thời gian này.`)
    return { ...next, coachId: '' }
  }
  const set = (key, value) => {
    if (creating && key in touched && !touched[key]) setTouched({ ...touched, [key]: true })
    if (key === 'coachId') setCoachNote('')
    const next = { ...form, [key]: value }
    setForm(key === 'startDate' || key === 'endDate' || key === 'subject' ? checkCoach(next) : next)
  }
  // Đổi bộ môn khi tạo mới: thay tiền tố cũ bằng tiền tố mới (giữ phần đã gõ phía sau); sĩ số theo môn nếu chưa tự sửa.
  const changeSubject = subject => {
    if (!creating) { set('subject', subject); return }
    const oldPrefix = codePrefix(form.subject)
    const classCode = !touched.classCode ? codePrefix(subject)
      : form.classCode.toUpperCase().startsWith(oldPrefix) ? codePrefix(subject) + form.classCode.slice(oldPrefix.length) : form.classCode
    setForm(checkCoach({ ...form, subject, classCode, capacity: touched.capacity ? form.capacity : subjectDefaults(subject).capacity }))
  }
  // Gợi ý mã lớp (chỉ khi tạo mới), trạng thái lấy từ cùng logic với trang Danh sách lớp.
  const statusById = creating ? new Map(buildCatalog({ classes, schedules }).map(i => [i.cls.id, i.status])) : null
  const suggestions = creating ? suggestClasses(form.classCode, classes) : []
  const showList = listOpen && suggestions.length > 0
  const existing = creating ? findByCode(form.classCode, classes) : null
  const closeList = () => { setListOpen(false); setActive(-1) }
  // Dùng lớp có sẵn làm mẫu: chép thông tin, mã mới chưa ai dùng, để trống các ngày.
  const applyTemplate = source => {
    setCoachNote('')
    setForm(checkCoach({ ...form, ...NO_DATES, name: source.name || '', subject: source.subject || form.subject, description: source.description || '', capacity: source.capacity ?? form.capacity, coachId: source.coachId ?? '', classCode: nextFreeCode(source.classCode, classes) }))
    setTouched({ classCode: true, capacity: true })
    setCopiedFrom(source.classCode); setAskReopen(null); setError(''); closeList()
  }
  // Mở kỳ mới: chuyển sang sửa chính lớp đó, giữ mã và thông tin cũ, xóa trắng các ngày.
  const startReopen = source => {
    const base = { ...fromClass(source), ...NO_DATES }
    setTarget(source); setReopen(true); setForm(base); setOriginal(base)
    setAskReopen(null); setCopiedFrom(''); setCoachNote(''); setError(''); closeList()
  }
  const pick = source => {
    closeList()
    if (statusById.get(source.id) === 'closed') setAskReopen(source)
    else applyTemplate(source)
  }
  const onCodeKey = event => {
    if (!showList) return
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((active + 1) % suggestions.length) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((active - 1 + suggestions.length) % suggestions.length) }
    else if (event.key === 'Enter' && active >= 0) { event.preventDefault(); pick(suggestions[active]) }
    else if (event.key === 'Escape') { event.stopPropagation(); closeList() }
  }
  const usedRooms = form.id ? [...new Set(schedules.filter(s => String(s.classId) === String(form.id)).map(s => s.roomId))].map(id => rooms.find(r => r.id === id)).filter(Boolean) : []
  const current = vnStamp()
  const tomorrow = addDays(current.slice(0, 10), 1)
  const existingText = c => `Mã ${c.classCode} đã được lớp "${c.name}" sử dụng. Hãy đổi mã khác hoặc dùng lớp này làm mẫu.`
  const submit = async event => {
    event.preventDefault()
    if (busy) return
    // Tạo mới / mở kỳ mới: bắt buộc có ngày bắt đầu/kết thúc, không được ở quá khứ. Sửa: chỉ kiểm tra giá trị đã đổi.
    // Luật coach (trùng hoàn toàn, đủ 5 lớp) chặn lưu; lớp chỉ giao nhau thì là cảnh báo bên dưới.
    const problems = validateClass(form, usedRooms, { ...(FEATURES.classDates ? { now: new Date(), requireDates: freshDates } : {}), original, timed, classes, coaches })
    if (existing) problems.unshift(existingText(existing))
    if (problems.length) { setError(problems.join(' ')); return }
    setBusy(true); setError('')
    try { await saveClass(form); onClose() } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const field = (key, label, props = {}) => <label>{label}<input value={form[key]} onChange={e => set(key, e.target.value)} {...props} /></label>
  const regType = timed ? 'datetime-local' : 'date'
  const regMin = timed ? current : current.slice(0, 10)
  const codeLabel = `Mã lớp (VD: ${creating ? codePrefix(form.subject) : 'CLS-YOGA-'}AM)`
  const codeField = !creating ? field('classCode', codeLabel, { required: true }) : <div className="code-suggest"><div className="code-suggest-box">
    <label>{codeLabel}<input value={form.classCode} required autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={showList} aria-controls={listId}
      aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
      onChange={e => { set('classCode', e.target.value); setListOpen(true); setActive(-1); setAskReopen(null) }}
      onFocus={() => setListOpen(true)} onBlur={closeList} onKeyDown={onCodeKey} /></label>
    {showList && <ul className="code-suggest-list" role="listbox" id={listId}>
      {suggestions.map((c, i) => {
        const status = STATUS[statusById.get(c.id)] || STATUS.upcoming
        return <li key={c.id} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={i === active ? 'active' : ''}
          onMouseDown={e => e.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => pick(c)}>
          <span><strong>{c.classCode}</strong> — {c.name}</span><span className={`badge ${status.badge}`}>{status.label}</span>
        </li>
      })}
    </ul>}</div>
    {copiedFrom && <p className="small muted">Đã sao chép từ {copiedFrom}</p>}
    {askReopen && <div className="alert alert-info" role="alert">
      Lớp {askReopen.classCode} đã đóng. Mở kỳ mới cho lớp này?
      <div className="code-suggest-actions"><button type="button" className="btn btn-primary btn-sm" onClick={() => startReopen(askReopen)}>Đồng ý</button><button type="button" className="btn btn-sm" onClick={() => setAskReopen(null)}>Hủy</button></div>
    </div>}
    {existing && !askReopen && <div className="alert alert-error" role="alert">
      {existingText(existing)}
      <div className="code-suggest-actions"><button type="button" className="btn btn-sm" onClick={() => applyTemplate(existing)}>Dùng lớp này làm mẫu</button></div>
    </div>}
  </div>
  const nameField = field('name', 'Tên lớp', { required: true })
  const subjectField = <label>Bộ môn<select value={form.subject} onChange={e => changeSubject(e.target.value)}>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select></label>
  const descField = <label>Mô tả<textarea rows={3} value={form.description} onChange={e => set('description', e.target.value)} /></label>
  const capacityField = field('capacity', 'Sĩ số tối đa', { type: 'number', min: 1, step: 1, required: true })
  // HLV kèm số lớp theo ngày đang nhập: còn chỗ và ít lớp lên trước; đủ lớp thì không chọn được
  // (trừ khi đang sửa lớp mà giữ nguyên HLV và ngày như cũ).
  // FEATURES.coachSubjects: chỉ liệt kê coach dạy bộ môn của lớp (coach đang chọn mà sai môn vẫn hiện nhưng không chọn lại được).
  const coachRows = coaches
    .filter(c => !FEATURES.coachSubjects || coachTeaches(c, form.subject) || String(c.id) === String(form.coachId))
    .map(c => {
      const n = loadOf(c.id, form)
      const wrongSubject = FEATURES.coachSubjects && !coachTeaches(c, form.subject)
      return { c, n, wrongSubject, full: coachIsFull(n) && !sameAssignment({ ...form, coachId: c.id }, original) }
    }).sort((a, b) => a.full - b.full || a.n - b.n || String(a.c.name).localeCompare(String(b.c.name), 'vi'))
  const coachText = ({ c, n, full, wrongSubject }) => wrongSubject ? `${c.name} (không dạy ${form.subject})`
    : full ? `${c.name} (đủ ${MAX_CLASSES_PER_COACH}/${MAX_CLASSES_PER_COACH})` : `${c.name} (${n}/${MAX_CLASSES_PER_COACH} lớp)`
  const coachField = <div className="code-suggest">
    <label>Huấn luyện viên<select value={form.coachId} disabled={Boolean(coachLock)} onChange={e => set('coachId', e.target.value)}><option value="">Chưa phân công</option>
      {coachRows.map(row => <option key={row.c.id} value={row.c.id} disabled={row.full || row.wrongSubject}>{coachText(row)}</option>)}
    </select></label>
    {coachLock && <p className="small muted">{coachLock}</p>}
    {FEATURES.coachSubjects && !coachLock && !coachRows.some(r => !r.wrongSubject) && <p className="small muted">Chưa có huấn luyện viên nào dạy bộ môn {form.subject}.</p>}
    {coachNote && <p className="small muted" role="status">{coachNote}</p>}
  </div>
  const warnings = classWarnings(form, { classes, original })
  return <Modal title={creating ? 'Tạo lớp mới' : reopen ? `Mở kỳ mới — ${form.classCode}` : 'Sửa lớp học'} onClose={() => { if (!busy) onClose() }} width={640}>
    <form className="form" onSubmit={submit} noValidate>
      <fieldset className="form api-fieldset" disabled={busy}>
        {reopen && <div className="alert alert-info" role="status">Mở kỳ mới cho lớp {form.classCode}: giữ mã và thông tin cũ, hãy nhập lại ngày bắt đầu/kết thúc và đăng ký sớm cho kỳ mới.</div>}
        {/* Tạo và sửa cùng thứ tự: bộ môn → mã → tên → mô tả → sĩ số → ngày lớp → đăng ký sớm → HLV. */}
        {subjectField}{codeField}{nameField}{descField}{capacityField}
        {FEATURES.classDates && <>
          <p className="small muted">Thời gian lớp. Ngày bắt đầu phải từ ngày mai trở đi. Đăng ký sớm phải bắt đầu từ bây giờ và kết thúc trước 00:00 ngày bắt đầu lớp. Khi lớp đã đóng, chỉ cần đổi các ngày này để mở kỳ mới, không cần tạo lớp trùng mã.</p>
          {field('startDate', 'Ngày bắt đầu lớp', { type: 'date', min: freshDates ? tomorrow : undefined, required: freshDates })}
          {field('endDate', 'Ngày kết thúc lớp', { type: 'date', min: form.startDate ? addDays(form.startDate, 1) : undefined, required: freshDates })}
          {field('registrationOpenAt', timed ? 'Mở đăng ký sớm từ (ngày giờ)' : 'Mở đăng ký sớm từ ngày', { type: regType, min: freshDates ? regMin : undefined })}
          {field('registrationCloseAt', timed ? 'Kết thúc đăng ký sớm lúc (ngày giờ)' : 'Kết thúc đăng ký sớm ngày', { type: regType, min: form.registrationOpenAt || (freshDates ? regMin : undefined) })}
        </>}
        {coachField}
      </fieldset>
      {warnings.map(w => <div key={w} className="alert alert-info" role="status">{w}</div>)}
      {error &&<div className="alert alert-error" role="alert">{error}</div>}
      <div className="form-actions"><button type="button" className="btn" disabled={busy} onClick={onClose}>Hủy</button><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Đang xử lý...' : 'Lưu thay đổi'}</button></div>
    </form>
  </Modal>
}
