import { useState } from 'react'
import { useStore } from '../../store/context'
import { usePreferences } from '../../preferences/context'
import Modal from '../../components/Modal'
import { SUBJECTS } from '../../data/seed'
import { isUnassignedCoach, sortCoachesForAssignment } from '../../validation/coachAssignments'

// Manager phân công bộ môn cho coach (PUT /api/coaches/{id}/subjects qua store.saveCoachSubjects).
export default function CoachSubjects() {
  const { t } = usePreferences()
  const { users, saveCoachSubjects } = useStore()
  const [editing, setEditing] = useState(null) // { coach, subjects }
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const coaches = sortCoachesForAssignment(users.filter(u => u.role === 'coach'))
  const unassigned = coaches.filter(isUnassignedCoach).length

  const open = coach => { setEditing({ coach, subjects: [...(coach.subjects || [])] }); setError(''); setNotice('') }
  const toggle = subject => setEditing({
    ...editing,
    subjects: editing.subjects.includes(subject) ? editing.subjects.filter(s => s !== subject) : [...editing.subjects, subject],
  })

  // Cho phép lưu danh sách rỗng (xóa hết bộ môn của coach).
  const save = async () => {
    if (busy || !editing) return
    setBusy(true); setError('')
    try {
      await saveCoachSubjects(editing.coach.id, editing.subjects)
      setNotice(`Đã cập nhật bộ môn cho ${editing.coach.name}.`)
      setEditing(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return <div className="stack">
    <div className="toolbar">
      <p className="muted">{t('Chọn bộ môn mỗi huấn luyện viên được dạy. Coach chỉ được phân công lớp thuộc bộ môn của mình.')}</p>
      {unassigned > 0 && <span className="badge badge-amber">{unassigned} {t('coach chưa phân công')}</span>}
    </div>
    {notice && <div className="alert alert-success" role="status">{t(notice)}</div>}
    <div className="card">
      <div className="table-scroll">
        <table className="table">
          <thead><tr><th>{t('Huấn luyện viên')}</th><th>{t('Email')}</th><th>{t('Bộ môn đang dạy')}</th><th>{t('Thao tác')}</th></tr></thead>
          <tbody>
            {coaches.map(coach => {
              const empty = isUnassignedCoach(coach)
              return <tr key={coach.id} className={empty ? 'coach-unassigned' : ''}>
                <td><strong>{coach.name}</strong></td>
                <td><span className="small">{coach.email || '—'}</span></td>
                <td>{empty
                  ? <span className="badge badge-amber">{t('Chưa phân công')}</span>
                  : <div className="coach-subject-chips">{coach.subjects.map(s => <span key={s} className="badge badge-green">{s}</span>)}</div>}
                </td>
                <td className="nowrap"><button className="btn btn-sm" disabled={busy} onClick={() => open(coach)}>{t('Chỉnh sửa')}</button></td>
              </tr>
            })}
            {!coaches.length && <tr><td colSpan={4} className="center muted">{t('Chưa có huấn luyện viên nào.')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>

    {editing && <Modal title="Bộ môn được dạy" onClose={() => { if (!busy) setEditing(null) }}>
      <div className="stack">
        <p>{t('Huấn luyện viên')} <strong>{editing.coach.name}</strong></p>
        <fieldset className="form api-fieldset" disabled={busy}>
          <div className="staff-subject-list">
            {SUBJECTS.map(subject => <label key={subject} className="check">
              <input type="checkbox" checked={editing.subjects.includes(subject)} onChange={() => toggle(subject)} />
              {subject}
            </label>)}
          </div>
        </fieldset>
        {!editing.subjects.length && <p className="small muted">{t('Không chọn bộ môn nào: coach sẽ không thể được phân công lớp.')}</p>}
        {error && <div className="alert alert-error" role="alert">{t(error)}</div>}
        <div className="form-actions">
          <button className="btn" disabled={busy} onClick={() => setEditing(null)}>{t('Hủy')}</button>
          <button className="btn btn-primary" disabled={busy} onClick={save}>{t(busy ? 'Đang xử lý...' : 'Lưu bộ môn')}</button>
        </div>
      </div>
    </Modal>}
  </div>
}
