import { useState } from 'react'
import Modal from '../../components/Modal'
import { useStore } from '../../store/context'
import { FEATURES } from '../../config/features'
import { addDays, deadlineProblems, toFormDate, toFormStamp, vnStamp } from '../../validation/classDates'
import { parseWeekdays } from '../../validation/sessionPattern'

const timed = FEATURES.registrationTimes
const formValue = value => (timed ? toFormStamp(value, 'end') : toFormDate(value))

// Gia hạn đăng ký (manager): chỉ đổi registrationCloseAt, các trường khác của lớp giữ nguyên khi gửi saveClass.
// saveClass tự làm mới ngầm (refresh({ silent: true })) nên modal chi tiết lớp phía sau vẫn mở.
export default function ExtendDeadlineModal({ cls, onClose }) {
  const { saveClass } = useStore()
  const current = formValue(cls.registrationCloseAt)
  const [value, setValue] = useState(current)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const startDate = toFormDate(cls.startDate)
  const submit = async event => {
    event.preventDefault()
    if (busy) return
    const problems = deadlineProblems(value, { startDate, now: new Date(), changed: value !== current, timed })
    if (problems.length) { setError(problems.join(' ')); return }
    setBusy(true); setError('')
    try {
      await saveClass({ ...cls, startDate, endDate: toFormDate(cls.endDate), registrationCloseAt: value, sessionWeekdays: parseWeekdays(cls.sessionWeekdays) })
      onClose()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <Modal title={`Gia hạn đăng ký — ${cls.classCode || cls.name}`} onClose={() => { if (!busy) onClose() }} width={420}>
    <form className="form" onSubmit={submit} noValidate>
      <fieldset className="form api-fieldset" disabled={busy}>
        <label>Hạn đăng ký mới<input type={timed ? 'datetime-local' : 'date'} value={value} onChange={e => setValue(e.target.value)}
          min={timed ? vnStamp() : vnStamp().slice(0, 10)} max={!startDate ? undefined : timed ? `${startDate}T00:00` : addDays(startDate, -1)} /></label>
        <p className="small muted">Hạn phải ở tương lai và không sau 00:00 ngày bắt đầu lớp. Để trống: nhận đăng ký đến khi lớp bắt đầu.</p>
      </fieldset>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="form-actions"><button type="button" className="btn" disabled={busy} onClick={onClose}>Hủy</button><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu'}</button></div>
    </form>
  </Modal>
}
