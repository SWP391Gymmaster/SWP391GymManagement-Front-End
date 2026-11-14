import { useState } from 'react'
import Modal from '../../components/Modal'
import { useStore } from '../../store/context'
import { validateSchedule } from '../../validation/classRules'
import { parseSessionCsv, repeatSessions } from '../../validation/sessionBatch'

export default function SessionBatchModal({ cls, onClose }) {
  const { rooms, users, schedules, classes, createSessions } = useStore()
  const coaches = users.filter(u => u.role === 'coach')
  const [mode, setMode] = useState('repeat')
  const [form, setForm] = useState({ startTime: '', duration: 60, everyDays: 7, count: 1, roomId: '', coachId: cls.coachId || '', description: '' })
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (key, value) => setForm(previous => ({ ...previous, [key]: value }))
  const importFile = async event => {
    setError(''); setRows([])
    try { setRows(parseSessionCsv(await event.target.files[0].text(), cls, rooms, coaches)) }
    catch (err) { setError(err.message) }
  }
  const submit = async event => {
    event.preventDefault()
    if (busy) return
    try {
      const proposed = mode === 'csv' ? rows : repeatSessions({ ...form, classId: cls.id })
      if (!proposed.length) throw new Error('Chọn file CSV có buổi học trước khi lưu.')
      const checked = [...schedules]
      for (const [index, row] of proposed.entries()) {
        const room = rooms.find(r => String(r.id) === String(row.roomId))
        const problems = validateSchedule(row, cls, room, { schedules: checked, classes, coaches })
        if (!row.coachId) problems.unshift('Buổi học chưa có HLV.')
        if (problems.length) throw new Error(`Buổi ${index + 1}: ${problems.join(' ')}`)
        checked.push(row)
      }
      setBusy(true); setError('')
      await createSessions(proposed)
      onClose()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <Modal title={`Tạo nhiều buổi học · ${cls.name}`} onClose={() => { if (!busy) onClose() }} width={640}>
    <form className="form" onSubmit={submit}>
      <div className="catalog-actions"><button type="button" className="btn" aria-pressed={mode === 'repeat'} onClick={() => setMode('repeat')}>Tạo theo chu kỳ</button><button type="button" className="btn" aria-pressed={mode === 'csv'} onClick={() => setMode('csv')}>Import CSV</button></div>
      {mode === 'repeat' ? <fieldset className="form api-fieldset" disabled={busy}>
        <label>Bắt đầu<input type="datetime-local" required value={form.startTime} onChange={e => set('startTime', e.target.value)} /></label>
        <label>Thời lượng mỗi buổi (phút)<input type="number" min="1" required value={form.duration} onChange={e => set('duration', e.target.value)} /></label>
        <label>Cách nhau (ngày)<input type="number" min="1" required value={form.everyDays} onChange={e => set('everyDays', e.target.value)} /></label>
        <label>Số buổi<input type="number" min="1" max="100" required value={form.count} onChange={e => set('count', e.target.value)} /></label>
        <label>Phòng<select required value={form.roomId} onChange={e => set('roomId', e.target.value)}><option value="">Chọn phòng</option>{rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        <label>HLV<select required value={form.coachId} onChange={e => set('coachId', e.target.value)}><option value="">Chọn HLV</option>{coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Lộ trình mỗi buổi<textarea maxLength="1000" value={form.description} onChange={e => set('description', e.target.value)} /></label>
      </fieldset> : <div className="stack"><p className="small">CSV: classCode,startTime,endTime,roomCode,coachEmail,description. Giờ theo YYYY-MM-DDTHH:mm, tối đa 100 buổi. <a href="/lo-trinh-import-template.csv" download>Tải file mẫu</a></p><input type="file" accept=".csv,text/csv" onChange={importFile} disabled={busy} aria-label="Chọn file CSV lộ trình" /><p role="status">Đã đọc {rows.length} buổi học.</p>{rows.length > 0 && <div className="table-scroll"><table className="table"><thead><tr><th>Bắt đầu</th><th>Kết thúc</th><th>Phòng</th><th>HLV</th><th>Lộ trình</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index}><td>{row.startTime}</td><td>{row.endTime}</td><td>{rooms.find(room => room.id === row.roomId)?.name}</td><td>{coaches.find(coach => coach.id === row.coachId)?.name}</td><td>{row.description}</td></tr>)}</tbody></table></div>}</div>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="form-actions"><button type="button" className="btn" onClick={onClose} disabled={busy}>Hủy</button><button type="submit" className="btn btn-primary" disabled={busy || (mode === 'csv' && !rows.length)}>{busy ? 'Đang lưu...' : 'Tạo buổi học'}</button></div>
    </form>
  </Modal>
}
