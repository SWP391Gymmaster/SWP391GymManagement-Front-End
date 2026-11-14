import { useState } from 'react'
import { usePreferences } from '../../preferences/context'
import { useStore } from '../../store/context'
import { formatDate } from '../../store/utils'

export default function CoachSchedule() {
  const { t } = usePreferences()
  const { classes, rooms, schedules, currentUser, refresh, coachRoster, markAttendance } = useStore()
  const [selected, setSelected] = useState(null)
  const [roster, setRoster] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const mine = schedules.filter(s => String(s.coachId) === String(currentUser.id)).sort((a, b) => a.startTime.localeCompare(b.startTime))
  const openRoster = async session => {
    setSelected(session); setError(''); setRoster([])
    try { setRoster(await coachRoster(session.id)) } catch (err) { setError(err.message) }
  }
  const mark = async (memberId, present) => {
    setBusy(true); setError('')
    try { const row = await markAttendance(selected.id, memberId, present); setRoster(previous => previous.map(item => item.memberId === memberId ? row : item)) }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <div className="card stack"><div className="toolbar"><h3>{t('Lịch dạy')} ({mine.length})</h3><button className="btn" onClick={refresh}>{t('Tải lại dữ liệu')}</button></div><div className="table-scroll"><table className="table"><thead><tr><th>{t('Lớp')}</th><th>{t('Ngày')}</th><th>{t('Giờ học')}</th><th>{t('Phòng')}</th><th>Thành viên</th></tr></thead><tbody>{mine.map(s => <tr key={s.id}><td>{classes.find(c => c.id === s.classId)?.name || '—'}</td><td>{formatDate(s.startTime)}</td><td>{s.startTime.slice(11, 16)} → {formatDate(s.endTime)} {s.endTime.slice(11, 16)}</td><td>{rooms.find(r => r.id === s.roomId)?.name || '—'}</td><td><button className="btn btn-sm" onClick={() => openRoster(s)}>Xem và điểm danh</button></td></tr>)}{!mine.length && <tr><td colSpan={5} className="center muted">{t('Chưa có dữ liệu.')}</td></tr>}</tbody></table></div>
    {selected && <section className="stack" aria-label="Danh sách thành viên"><div className="toolbar"><h4>Thành viên lớp {classes.find(c => c.id === selected.classId)?.name} · {formatDate(selected.startTime)}</h4><button className="btn btn-sm" onClick={() => setSelected(null)}>Đóng</button></div>{error && <div className="alert alert-error" role="alert">{error}</div>}{!roster.length && <p className="muted">Chưa có thành viên đăng ký.</p>}{roster.map(row => <div className="summary" key={row.memberId}><strong>{row.memberName}</strong><span>{row.present == null ? 'Chưa điểm danh' : row.present ? 'Có mặt' : 'Vắng mặt'}</span><div className="catalog-actions"><button className="btn btn-sm" disabled={busy || new Date(`${selected.startTime.slice(0, 19)}+07:00`) > new Date()} onClick={() => mark(row.memberId, true)}>Có mặt</button><button className="btn btn-sm" disabled={busy || new Date(`${selected.startTime.slice(0, 19)}+07:00`) > new Date()} onClick={() => mark(row.memberId, false)}>Vắng mặt</button></div></div>)}</section>}
  </div>
}
