import { useId, useState } from 'react'
import Modal from '../../components/Modal'
import { useStore } from '../../store/context'
import { SUBJECTS } from '../../data/seed'
import { FEATURES } from '../../config/features'
import { classWarnings, coachLockReason, coachTeaches, sameAssignment, validateClass } from '../../validation/classRules'
import { coachIsFull, coachLoad } from '../../validation/classDuplicates'
import { addDays, vnStamp } from '../../validation/classDates'
import { EMPTY_CLASS_FORM, TERM_DATES, classToForm, isReopening, reopenForm } from '../../validation/classForm'
import { codePrefix, MAX_CLASSES_PER_COACH, subjectDefaults } from '../../config/classDefaults'
import { normalizeCode } from '../../validation/roomRules'
import { findByCode, isDuplicateCodeError, nextClassCode, suggestClasses } from '../../validation/classCode'
import { STATUS, buildCatalog, classStarted } from '../../catalog/catalogRules'
import { WEEKDAYS, parseWeekdays, patternProblems, previewSessions, serializeWeekdays } from '../../validation/sessionPattern'
import { formatDate } from '../../store/utils'
import '../../catalog.css'

const timed = FEATURES.registrationTimes
// Tạo mới: mã lớp tự sinh theo bộ môn (CLS-YOGA-01...) và sĩ số mặc định theo bộ môn ban đầu.
const fresh = classes => ({ ...EMPTY_CLASS_FORM, classCode: nextClassCode(EMPTY_CLASS_FORM.subject, classes), capacity: subjectDefaults(EMPTY_CLASS_FORM.subject).capacity })

// Tạo mới (cls = null) hoặc sửa lớp. Kiểm tra ở FE trước, BE kiểm tra lại khi lưu.
// Khi tạo mới, mã lớp tự sinh (ô khóa). Bấm "Đổi mã" để tự nhập; lúc đó ô Mã lớp gợi ý các lớp đã có:
// lớp đã đóng → mở kỳ mới (chuyển sang sửa lớp đó), lớp khác → dùng làm mẫu (mã mới lại tự sinh).
export default function ClassFormModal({ cls, onClose, onSaved }) {
  const { users, rooms, classes, schedules, saveClass, refresh } = useStore()
  // Lớp đã kết thúc (cùng trạng thái "Đã đóng" như trang Danh sách lớp, kể cả lớp chỉ suy ngày từ buổi học).
  const endedOf = c => Boolean(c) && buildCatalog({ classes: [c], schedules })[0].status === 'closed'
  const [target, setTarget] = useState(cls) // lớp đang sửa; null = tạo mới
  const [reopen, setReopen] = useState(false) // đã xác nhận mở kỳ mới từ gợi ý mã lớp
  // Sửa lớp đã kết thúc: không nạp hạn đăng ký cũ (hạn cũ không dùng được cho kỳ mới).
  const [form, setForm] = useState(() => cls ? classToForm(cls, { timed, ended: endedOf(cls) }) : fresh(classes))
  // Ô mà manager đã tự sửa thì không tự điền đè khi đổi bộ môn (chỉ dùng khi tạo mới).
  const [touched, setTouched] = useState({ classCode: false, capacity: false })
  // Mã tự sinh (ô khóa) khi tạo mới; false sau khi bấm "Đổi mã".
  const [codeAuto, setCodeAuto] = useState(true)
  const [codeConflict, setCodeConflict] = useState('') // mã vừa bị BE từ chối vì trùng
  const [original, setOriginal] = useState(() => cls ? classToForm(cls, { timed }) : null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [listOpen, setListOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [askReopen, setAskReopen] = useState(null) // lớp đã đóng đang chờ xác nhận mở kỳ mới
  const [copiedFrom, setCopiedFrom] = useState('')
  const [coachNote, setCoachNote] = useState('') // báo nhẹ khi HLV đang chọn bị bỏ chọn vì đã đủ lớp
  const listId = useId()
  const creating = !target
  // Mở kỳ mới: đã xác nhận từ gợi ý mã, hoặc sửa lớp đã kết thúc mà đổi ngày. Ngày nhập lại theo luật tạo mới.
  const reopening = isReopening({ reopen, ended: endedOf(target), form, original })
  const freshDates = creating || reopening
  // Lớp đã bắt đầu (đang sửa, không phải mở kỳ mới): không gia hạn được, khóa ô hạn đăng ký.
  const deadlineLocked = Boolean(target) && !reopening && classStarted(target)
  const coaches = users.filter(u => u.role === 'coach')
  // Sửa lớp đã có coach và đã có buổi học / người đăng ký (không phải mở kỳ mới): không đổi được HLV (BE cũng chặn).
  const coachLock = coachLockReason(target, schedules, reopening)
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
  // Đổi bộ môn khi tạo mới: mã tự sinh lại theo bộ môn mới, trừ khi manager đã bấm "Đổi mã" và tự nhập; sĩ số theo môn nếu chưa tự sửa.
  const changeSubject = subject => {
    if (!creating) { set('subject', subject); return }
    const classCode = codeAuto || !touched.classCode ? nextClassCode(subject, classes) : form.classCode
    setCodeConflict('')
    setForm(checkCoach({ ...form, subject, classCode, capacity: touched.capacity ? form.capacity : subjectDefaults(subject).capacity }))
  }
  // Gợi ý mã lớp (chỉ khi tạo mới), trạng thái lấy từ cùng logic với trang Danh sách lớp.
  const statusById = creating ? new Map(buildCatalog({ classes, schedules }).map(i => [i.cls.id, i.status])) : null
  const suggestions = creating ? suggestClasses(form.classCode, classes) : []
  const showList = listOpen && suggestions.length > 0
  const existing = creating ? findByCode(form.classCode, classes) : null
  const closeList = () => { setListOpen(false); setActive(-1) }
  // Mở khóa ô mã để tự nhập (vẫn kiểm tra trùng và định dạng); quay lại mã tự sinh thì sinh lại theo bộ môn.
  const unlockCode = () => { setCodeAuto(false); setTouched({ ...touched, classCode: false }) }
  // skip: mã vừa bị BE từ chối (lớp tạo cùng lúc chưa có trong store) → bỏ qua khi sinh lại.
  const autoCode = (skip = '') => {
    setCodeAuto(true); setCodeConflict(''); setAskReopen(null); setError(''); closeList()
    setTouched({ ...touched, classCode: false })
    setForm({ ...form, classCode: nextClassCode(form.subject, skip ? [...classes, { classCode: skip }] : classes) })
  }
  // Dùng lớp có sẵn làm mẫu: chép thông tin, mã mới tự sinh theo bộ môn, để trống các ngày.
  const applyTemplate = source => {
    setCoachNote('')
    setForm(checkCoach({ ...form, ...TERM_DATES, name: source.name || '', subject: source.subject || form.subject, description: source.description || '', capacity: source.capacity ?? form.capacity, coachId: source.coachId ?? '', sessionWeekdays: parseWeekdays(source.sessionWeekdays), classCode: nextClassCode(source.subject || form.subject, classes) }))
    setTouched({ classCode: false, capacity: true }); setCodeAuto(true); setCodeConflict('')
    setCopiedFrom(source.classCode); setAskReopen(null); setError(''); closeList()
  }
  // Mở kỳ mới: chuyển sang sửa chính lớp đó, giữ mã và thông tin cũ, xóa trắng các ngày và hạn đăng ký.
  const startReopen = source => {
    const base = reopenForm(source, { timed })
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
    // Lịch học hằng tuần: chỉ kiểm tra khi tạo mới / mở kỳ mới / đổi thứ hoặc ngày, để sửa lớp cũ (đã qua ngày) không bị chặn.
    if (patternActive && (freshDates || patternChanged)) problems.push(...patternProblems(form, { now: new Date() }))
    if (existing) problems.unshift(existingText(existing))
    if (problems.length) { setError(problems.join(' ')); return }
    setBusy(true); setError('')
    // onSaved(lớp đã lưu, { created }): created = form mở ở chế độ tạo mới (kể cả dùng làm mẫu / mở kỳ mới từ gợi ý mã).
    const created = !cls
    try { const saved = await saveClass(form); onClose(); onSaved?.(saved, { created }) } catch (err) {
      // Trùng mã khi tạo (vd hai manager tạo cùng lúc): báo rõ và cho sinh mã khác; tải lại ngầm để thấy lớp vừa được tạo.
      if (creating && isDuplicateCodeError(err)) {
        setCodeConflict(normalizeCode(form.classCode))
        setError(`Mã lớp ${normalizeCode(form.classCode)} vừa được một lớp khác sử dụng (có thể do tạo lớp cùng lúc). Bấm "Sinh mã mới" rồi lưu lại.`)
        void refresh?.({ silent: true })
      } else setError(err.message)
    } finally { setBusy(false) }
  }
  const field = (key, label, props = {}) => <label>{label}<input value={form[key]} onChange={e => set(key, e.target.value)} {...props} /></label>
  const regType = timed ? 'datetime-local' : 'date'
  const regMin = timed ? current : current.slice(0, 10)
  const codeLabel = creating ? `Mã lớp (tự nhập, VD: ${codePrefix(form.subject)}01)` : 'Mã lớp'
  const conflictBox = codeConflict && <div className="code-suggest-actions"><button type="button" className="btn btn-primary btn-sm" onClick={() => autoCode(codeConflict)}>Sinh mã mới</button></div>
  // Tạo mới, mã tự sinh: ô chỉ đọc + nút "Đổi mã".
  const autoCodeField = <div className="code-suggest">
    <label>Mã lớp (tự sinh theo bộ môn)<input value={form.classCode} readOnly aria-readonly="true" className="code-auto" /></label>
    <div className="code-suggest-actions"><button type="button" className="btn btn-sm" onClick={unlockCode}>Đổi mã</button>
      <span className="small muted">Tự nhập mã, hoặc gõ mã / tên để tìm lớp có sẵn (mở kỳ mới, dùng làm mẫu).</span></div>
    {copiedFrom && <p className="small muted">Đã sao chép từ {copiedFrom}</p>}
    {conflictBox}
  </div>
  const codeField = !creating ? field('classCode', codeLabel, { required: true }) : codeAuto ? autoCodeField : <div className="code-suggest"><div className="code-suggest-box">
    <label>{codeLabel}<input value={form.classCode} required autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={showList} aria-controls={listId}
      aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
      onChange={e => { set('classCode', e.target.value); setListOpen(true); setActive(-1); setAskReopen(null); setCodeConflict('') }}
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
    <div className="code-suggest-actions"><button type="button" className="btn btn-sm" onClick={() => autoCode()}>Dùng mã tự sinh</button></div>
    {copiedFrom && <p className="small muted">Đã sao chép từ {copiedFrom}</p>}
    {conflictBox}
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
  // FEATURES.sessionPattern: chọn thứ trong tuần, BE tự sinh buổi (chưa có giờ/phòng) cho mỗi ngày khớp.
  const patternActive = FEATURES.sessionPattern && form.sessionWeekdays.length > 0
  const patternChanged = Boolean(original) && (serializeWeekdays(form.sessionWeekdays) !== serializeWeekdays(original.sessionWeekdays)
    || form.startDate !== original.startDate || form.endDate !== original.endDate)
  const toggleWeekday = code => set('sessionWeekdays', form.sessionWeekdays.includes(code) ? form.sessionWeekdays.filter(c => c !== code) : [...form.sessionWeekdays, code])
  // Sửa lớp: chỉ liệt kê ngày MỚI (bỏ ngày lớp đã có buổi). Mở kỳ mới cũng là sửa lớp đó nên vẫn bỏ ngày đã có.
  const ownSessions = target ? schedules.filter(s => String(s.classId) === String(target.id)) : []
  const preview = patternActive ? previewSessions({ weekdays: form.sessionWeekdays, startDate: form.startDate, endDate: form.endDate, existingSessions: ownSessions }) : []
  const patternCoach = coaches.find(c => String(c.id) === String(form.coachId))?.name || 'Chưa phân công'
  const patternField = FEATURES.sessionPattern && <div className="pattern-block">
    <span className="pattern-title">Lịch học hằng tuần</span>
    <div className="pattern-days" role="group" aria-label="Các thứ học trong tuần">
      {WEEKDAYS.map(w => { const on = form.sessionWeekdays.includes(w.code); return <button key={w.code} type="button" title={w.name} aria-pressed={on} className={`btn btn-sm${on ? ' btn-primary' : ''}`} onClick={() => toggleWeekday(w.code)}>{w.label}</button> })}
    </div>
    {!patternActive ? <p className="small muted">Không chọn thứ nào: lớp không tự tạo buổi học, có thể thêm buổi thủ công sau.</p> : <>
      <p className="small"><strong>{creating ? 'Các buổi sẽ được tạo' : 'Các buổi mới sẽ được thêm'}</strong></p>
      {!form.startDate || !form.endDate ? <p className="small muted">Nhập ngày bắt đầu và ngày kết thúc lớp để xem các buổi.</p>
        : !preview.length ? <p className="small muted">{creating ? 'Không có ngày nào khớp các thứ đã chọn từ hôm nay trong khoảng ngày của lớp.' : 'Không có buổi mới nào cần thêm.'}</p>
          : <div className="pattern-preview"><table className="table"><thead><tr><th>Thứ</th><th>Ngày</th><th>Huấn luyện viên</th></tr></thead>
            <tbody>{preview.map(p => <tr key={p.date}><td>{p.weekdayLabel}</td><td>{formatDate(p.date)}</td><td>{patternCoach}</td></tr>)}</tbody></table></div>}
      <p className="small"><strong>Tổng: {preview.length} buổi</strong></p>
      <p className="small muted">Giờ, phòng và mô tả của từng buổi sẽ điền sau trong chi tiết lớp.</p>
    </>}
    {!creating && <p className="small muted">Khi đổi lịch: buổi tự sinh chưa chỉnh sửa mà không còn khớp lịch mới sẽ bị xóa; buổi đã chỉnh hoặc tạo tay được giữ nguyên.</p>}
  </div>
  const warnings = classWarnings(form, { classes, original })
  return <Modal title={creating ? 'Tạo lớp mới' : reopening ? `Mở kỳ mới — ${form.classCode}` : 'Sửa lớp học'} onClose={() => { if (!busy) onClose() }} width={640}>
    <form className="form" onSubmit={submit} noValidate>
      <fieldset className="form api-fieldset" disabled={busy}>
        {reopening && <div className="alert alert-info" role="status">Mở kỳ mới cho lớp {form.classCode}: giữ mã và thông tin cũ, hãy nhập lại ngày bắt đầu/kết thúc và hạn đăng ký cho kỳ mới.</div>}
        {/* Tạo và sửa cùng thứ tự: bộ môn → mã → tên → mô tả → sĩ số → ngày lớp → hạn đăng ký → HLV. */}
        {subjectField}{codeField}{nameField}{descField}{capacityField}
        {FEATURES.classDates && <>
          <p className="small muted">Thời gian lớp. Ngày bắt đầu phải từ ngày mai trở đi. Khi lớp đã đóng, chỉ cần đổi các ngày này để mở kỳ mới, không cần tạo lớp trùng mã.</p>
          {field('startDate', 'Ngày bắt đầu lớp', { type: 'date', min: freshDates ? tomorrow : undefined, required: freshDates })}
          {field('endDate', 'Ngày kết thúc lớp', { type: 'date', min: form.startDate ? addDays(form.startDate, 1) : undefined, required: freshDates })}
          <div className="code-suggest">
            {field('registrationCloseAt', timed ? 'Hết hạn đăng ký (ngày giờ, không bắt buộc)' : 'Hết hạn đăng ký (ngày, không bắt buộc)', {
              type: regType, disabled: deadlineLocked,
              min: deadlineLocked ? undefined : regMin,
              max: form.startDate ? (timed ? `${form.startDate}T00:00` : addDays(form.startDate, -1)) : undefined,
            })}
            {deadlineLocked ? <p className="small muted">Lớp đã bắt đầu, không thể gia hạn đăng ký.</p>
              : <p className="small muted">Để trống: hội viên đăng ký được đến trước khi lớp bắt đầu. Hạn phải ở tương lai và không sau 00:00 ngày bắt đầu lớp. Muốn gia hạn, chọn hạn mới rồi lưu.</p>}
          </div>
        </>}
        {coachField}
        {patternField}
      </fieldset>
      {warnings.map(w => <div key={w} className="alert alert-info" role="status">{w}</div>)}
      {error &&<div className="alert alert-error" role="alert">{error}</div>}
      <div className="form-actions"><button type="button" className="btn" disabled={busy} onClick={onClose}>Hủy</button><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Đang xử lý...' : 'Lưu thay đổi'}</button></div>
    </form>
  </Modal>
}
