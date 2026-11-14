import { useState } from 'react'
import Modal from '../../components/Modal'
import { useStore } from '../../store/context'
import { FEATURES } from '../../config/features'
import { roomMatchesSubject } from '../../validation/roomRules'
import { SESSION_DESCRIPTION_MAX, coachTeaches, validateSchedule } from '../../validation/classRules'
import { defaultRoomId } from '../../validation/sessionDefaults'
import '../../catalog.css'

// Thêm hoặc sửa một buổi học của lớp. Ô phòng chỉ liệt kê phòng hợp bộ môn của lớp.
// FEATURES.coachSubjects: ô HLV chỉ liệt kê coach dạy bộ môn của lớp. FEATURES.sessionDescription: thêm ô lộ trình / mô tả.
// THÊM buổi: HLV lấy theo lớp (chỉ đọc), phòng lấy theo buổi gần nhất (chỉ đọc, bấm "Đổi phòng" để chọn lại),
// manager chủ yếu nhập ngày giờ. Lớp chưa có HLV / chưa có buổi nào thì vẫn là ô chọn như cũ.
export default function SessionFormModal({ cls, session, onClose }) {
  const { users, rooms, schedules, classes, saveSchedule } = useStore()
  const adding = !session
  const classCoachId = cls.coachId != null && cls.coachId !== '' ? String(cls.coachId) : ''
  const [form, setForm] = useState(() => session
    ? { id: session.id, classId: cls.id, roomId: session.roomId ?? '', coachId: session.coachId ?? '', startTime: String(session.startTime).slice(0, 16), endTime: String(session.endTime).slice(0, 16), description: session.description ?? '' }
    : { classId: cls.id, roomId: defaultRoomId(cls.id, schedules), coachId: classCoachId, startTime: '', endTime: '', description: '' })
  const [duration, setDuration] = useState(60)
  const [roomLocked, setRoomLocked] = useState(() => adding && form.roomId !== '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [roomHint, setRoomHint] = useState(false) // lỗi liên quan tới phòng đang khóa → nhắc bấm "Đổi phòng"
  const coaches = users.filter(u => u.role === 'coach')
  const coachLocked = !adding || Boolean(classCoachId)
  const classCoach = coaches.find(c => String(c.id) === classCoachId)
  // Coach đang chọn mà sai môn (dữ liệu cũ) vẫn hiện để biết, nhưng không chọn lại được.
  const coachList = coaches.filter(c => !FEATURES.coachSubjects || coachTeaches(c, cls.subject) || String(c.id) === String(form.coachId))
  const set = (key, value) => setForm({ ...form, [key]: value })
  const roomList = rooms.filter(r => roomMatchesSubject(r, cls.subject) || String(r.id) === String(form.roomId))
  const currentRoom = rooms.find(r => String(r.id) === String(form.roomId))
  const submit = async event => {
    event.preventDefault()
    if (busy) return
    const room = currentRoom
    const problems = validateSchedule(form, cls, room, { schedules, classes, coaches })
    // Lớp chưa có HLV: BE yêu cầu buổi học phải có HLV.
    if (adding && !classCoachId && !form.coachId) problems.unshift('Lớp chưa có huấn luyện viên, vui lòng chọn huấn luyện viên cho buổi học.')
    if (problems.length) {
      setError(problems.join(' '))
      setRoomHint(roomLocked && Boolean(room) && problems.some(m => m.includes(`"${room.name}"`)))
      return
    }
    setBusy(true); setError(''); setRoomHint(false)
    try { await saveSchedule(form); onClose() } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const coachLabel = FEATURES.coachSubjects ? 'Huấn luyện viên (lọc theo bộ môn)' : 'Huấn luyện viên'
  const roomField = roomLocked
    ? <div className="readonly-field">
      <span className="readonly-label">Phòng (theo buổi gần nhất)</span>
      <div className="readonly-value"><strong>{currentRoom ? `${currentRoom.name} (${currentRoom.capacity} chỗ)` : `#${form.roomId}`}</strong>
        <button type="button" className="btn btn-sm" onClick={() => { setRoomLocked(false); setRoomHint(false) }}>Đổi phòng</button></div>
    </div>
    : <label>Phòng (lọc theo bộ môn)<select required value={form.roomId} onChange={e => set('roomId', e.target.value)}><option value="">-- Chọn phòng --</option>{roomList.map(r => <option key={r.id} value={r.id}>{r.name} ({r.capacity} chỗ)</option>)}</select></label>
  const coachField = coachLocked
    ? <div className="readonly-field">
      <span className="readonly-label">Huấn luyện viên (phụ trách lớp)</span>
      <div className="readonly-value"><strong>{coaches.find(c => String(c.id) === String(form.coachId))?.name || classCoach?.name || `#${form.coachId || classCoachId}`}</strong></div>
    </div>
    : <label>{coachLabel}<select required={adding} value={form.coachId} onChange={e => set('coachId', e.target.value)}><option value="">{adding ? '-- Chọn huấn luyện viên --' : 'Theo huấn luyện viên của lớp'}</option>
      {coachList.map(c => { const wrong = FEATURES.coachSubjects && !coachTeaches(c, cls.subject); return <option key={c.id} value={c.id} disabled={wrong}>{wrong ? `${c.name} (không dạy ${cls.subject})` : c.name}</option> })}
    </select>{adding && <span className="small muted">Lớp chưa có huấn luyện viên phụ trách, cần chọn cho buổi học.</span>}</label>
  return <Modal title={session ? 'Sửa buổi học' : 'Thêm buổi học'} onClose={() => { if (!busy) onClose() }} width={560}>
    <form className="form" onSubmit={submit}>
      <p className="small muted">Lớp: <strong>{cls.name}</strong> ({cls.subject})</p>
      <fieldset className="form api-fieldset" disabled={busy}>
        {roomField}
        {coachField}
        <label>Ngày giờ bắt đầu<input type="datetime-local" required value={form.startTime} onChange={e => { const startTime = e.target.value; setForm(previous => ({ ...previous, startTime, endTime: adding && startTime ? new Date(new Date(`${startTime}:00+07:00`).getTime() + duration * 60000 + 7 * 3600000).toISOString().slice(0, 16) : previous.endTime })) }} /></label>
        {adding && <label>Thời lượng (phút)<input type="number" min="1" required value={duration} onChange={e => { const minutes = Number(e.target.value); setDuration(minutes); if (form.startTime && minutes > 0) set('endTime', new Date(new Date(`${form.startTime}:00+07:00`).getTime() + minutes * 60000 + 7 * 3600000).toISOString().slice(0, 16)) }} /></label>}
        <label>Ngày giờ kết thúc<input type="datetime-local" required value={form.endTime} onChange={e => set('endTime', e.target.value)} /></label>
        {FEATURES.sessionDescription && <label>Lộ trình / mô tả buổi học
          <textarea rows={4} maxLength={SESSION_DESCRIPTION_MAX} value={form.description} onChange={e => set('description', e.target.value)} placeholder="VD: Khởi động 10 phút, bài chính, giãn cơ..." />
          <span className="small muted">{form.description.length}/{SESSION_DESCRIPTION_MAX} ký tự</span>
        </label>}
      </fieldset>
      {error && <div className="alert alert-error" role="alert">{error}
        {roomHint && <div className="code-suggest-actions"><span>Phòng đang lấy theo buổi gần nhất. Bấm "Đổi phòng" để chọn phòng khác.</span>
          <button type="button" className="btn btn-sm" onClick={() => { setRoomLocked(false); setRoomHint(false) }}>Đổi phòng</button></div>}
      </div>}
      <div className="form-actions"><button type="button" className="btn" disabled={busy} onClick={onClose}>Hủy</button><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Đang xử lý...' : 'Lưu buổi học'}</button></div>
    </form>
  </Modal>
}
