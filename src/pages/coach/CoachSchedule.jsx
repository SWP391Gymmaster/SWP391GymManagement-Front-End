import { usePreferences } from '../../preferences/context'
import { useStore } from '../../store/context'
import { formatDate } from '../../store/utils'
import { isUnscheduled } from '../../validation/sessionPattern'

export default function CoachSchedule() {
  const { t } = usePreferences()
  const { classes, rooms, schedules, currentUser, refresh } = useStore()
  const mine = schedules.filter(s => String(s.coachId) === String(currentUser.id)).sort((a, b) => a.startTime.localeCompare(b.startTime))
  return <div className="card stack"><div className="toolbar"><h3>{t('Lịch dạy')} ({mine.length})</h3><button className="btn" onClick={refresh}>{t('Tải lại dữ liệu')}</button></div><div className="table-scroll"><table className="table"><thead><tr><th>{t('Lớp')}</th><th>{t('Ngày')}</th><th>{t('Giờ học')}</th><th>{t('Phòng')}</th></tr></thead><tbody>{mine.map(s => <tr key={s.id}><td>{classes.find(c => c.id === s.classId)?.name || '—'}</td><td>{formatDate(s.startTime)}</td><td>{isUnscheduled(s) ? t('Chưa xếp giờ') : `${s.startTime.slice(11, 16)} → ${formatDate(s.endTime)} ${s.endTime.slice(11, 16)}`}</td><td>{s.roomId == null ? t('Chưa xếp phòng') : rooms.find(r => r.id === s.roomId)?.name || '—'}</td></tr>)}{!mine.length && <tr><td colSpan={4} className="center muted">{t('Chưa có dữ liệu.')}</td></tr>}</tbody></table></div></div>
}
