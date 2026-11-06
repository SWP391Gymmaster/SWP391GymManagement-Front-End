import { useState } from 'react'
import Modal from '../../components/Modal'
import { useStore } from '../../store/context'
import { FEATURES } from '../../config/features'
import { roomMatchesSubject } from '../../validation/roomRules'
import { NO_CLASS_COACH, SESSION_DESCRIPTION_MAX, classHasCoach, validateSchedule } from '../../validation/classRules'
import { defaultRoomId } from '../../validation/sessionDefaults'
import '../../catalog.css'

// Thêm hoặc sửa một buổi học của lớp. Ô phòng chỉ liệt kê phòng hợp bộ môn của lớp. FEATURES.sessionDescription: thêm ô lộ trình / mô tả.
// HLV của buổi LUÔN là HLV của lớp (chỉ đọc, cả khi thêm lẫn khi sửa); lớp chưa có HLV thì không lưu được.
// THÊM buổi: phòng lấy theo buổi gần nhất (chỉ đọc, bấm "Đổi phòng" để chọn lại), manager chủ yếu nhập ngày giờ.
export default function SessionFormModal({ cls, session, onClose }) {
  const { users, rooms, schedules, classes, saveSchedule } = useStore()
  const adding = !session
  const hasCoach = classHasCoach(cls)
  const classCoachId = hasCoach ? String(cls.coachId) : ''
  // coachId luôn gửi theo HLV của lớp (BE cũng ép như vậy).
  const [form, setForm] = useState(() => session
    ? { id: session.id, classId: cls.id, roomId: session.roomId ?? '', coachId: classCoachId, startTime: String(session.startTime).slice(0, 16), endTime: String(session.endTime).slice(0, 16), description: session.description ?? '' }
    : { classId: cls.id, roomId: defaultRoomId(cls.id, schedules), coachId: classCoachId, startTime: '', endTime: '', description: '' })
  const [roomLocked, setRoomLocked] = useState(() => adding && form.roomId !== '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [roomHint, setRoomHint] = useState(false) // lỗi liên quan tới phòng đang khóa → nhắc bấm "Đổi phòng"
  const classCoach = users.find(u => u.role === 'coach' && String(u.id) === classCoachId)
  const set = (key, value) => setForm({ ...form, [key]: value })
  const roomList = rooms.filter(r => roomMatchesSubject(r, cls.subject) || String(r.id) === String(form.roomId))
  const currentRoom = rooms.find(r => String(r.id) === String(form.roomId))
  const submit = async event => {
    event.preventDefault()
    if (busy) return
    const room = currentRoom
    const problems = validateSchedule(form, cls, room, { schedules, classes })
    if (problems.length) {
      setError(problems.join(' '))
      setRoomHint(roomLocked && Boolean(room) && problems.some(m => m.includes(`"${room.name}"`)))
      return
    }
    setBusy(true); setError(''); setRoomHint(false)
    try { await saveSchedule(form); onClose() } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const roomField = roomLocked
    ? <div className="readonly-field">
      <span className="readonly-label">Phòng (theo buổi gần nhất)</span>
      <div className="readonly-value"><strong>{currentRoom ? `${currentRoom.name} (${currentRoom.capacity} chỗ)` : `#${form.roomId}`}</strong>
        <button type="button" className="btn btn-sm" onClick={() => { setRoomLocked(false); setRoomHint(false) }}>Đổi phòng</button></div>
    </div>
    : <label>Phòng (lọc theo bộ môn)<select required value={form.roomId} onChange={e => set('roomId', e.target.value)}><option value="">-- Chọn phòng --</option>{roomList.map(r => <option key={r.id} value={r.id}>{r.name} ({r.capacity} chỗ)</option>)}</select></label>
  const coachField = <div className="readonly-field">
    <span className="readonly-label">Huấn luyện viên (phụ trách lớp)</span>
    <div className="readonly-value">{hasCoach ? <strong>{classCoach?.name || `#${classCoachId}`}</strong> : <span className="danger">Chưa có</span>}</div>
  </div>
  return <Modal title={session ? 'Sửa buổi học' : 'Thêm buổi học'} onClose={() => { if (!busy) onClose() }} width={560}>
    <form className="form" onSubmit={submit}>
      <p className="small muted">Lớp: <strong>{cls.name}</strong> ({cls.subject})</p>
      {!hasCoach && <div className="alert alert-error" role="alert">{NO_CLASS_COACH}</div>}
      <fieldset className="form api-fieldset" disabled={busy}>
        {roomField}
        {coachField}
        <label>Ngày giờ bắt đầu<input type="datetime-local" required value={form.startTime} onChange={e => set('startTime', e.target.value)} /></label>
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
      <div className="form-actions"><button type="button" className="btn" disabled={busy} onClick={onClose}>Hủy</button><button type="submit" className="btn btn-primary" disabled={busy || !hasCoach}>{busy ? 'Đang xử lý...' : 'Lưu buổi học'}</button></div>
    </form>
  </Modal>
}
