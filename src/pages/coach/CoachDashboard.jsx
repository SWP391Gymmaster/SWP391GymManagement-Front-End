import { ErrorBox, Loading } from '../../components/Status'
import { classApi, roomApi, scheduleApi } from '../../api/services'
import useApi from '../../api/useApi'
import { useStore } from '../../store/context'
import { addDays, dayLabel, dayOf, formatDate, formatTime, mondayOf, nowVN, sessionHours } from '../../store/utils'

export default function CoachDashboard({ goTo }) {
  const { session } = useStore()
  const { data, loading, error, reload } = useApi(
    () =>
      Promise.all([scheduleApi.byCoach(session.userId), classApi.list(), roomApi.list()]).then(
        ([schedules, classes, rooms]) => ({ schedules, classes, rooms }),
      ),
    [session.userId],
  )

  if (loading && !data) return <Loading />
  if (!data) return <ErrorBox error={error} onRetry={reload} />

  const now = nowVN()
  const today = now.slice(0, 10)
  const monday = mondayOf(today)
  const sunday = addDays(monday, 6)
  const month = now.slice(0, 7)
  const list = [...data.schedules].sort((a, b) => a.startTime.localeCompare(b.startTime))

  const todays = list.filter((s) => s.startTime.slice(0, 10) === today)
  const thisWeek = list.filter((s) => s.startTime.slice(0, 10) >= monday && s.startTime.slice(0, 10) <= sunday)
  const doneThisMonth = list.filter((s) => s.startTime.slice(0, 7) === month && s.endTime <= now)
  const hoursThisMonth = doneThisMonth.reduce((h, s) => h + sessionHours(s), 0)
  const upcoming = list.filter((s) => s.endTime > now).slice(0, 8)
  const myClasses = new Set(list.map((s) => s.classId))

  const cls = (id) => data.classes.find((c) => c.id === id)
  const room = (id) => data.rooms.find((r) => r.id === id)?.name || '—'
  const statusOf = (s) => (s.startTime <= now && s.endTime > now ? 'live' : s.startTime.slice(0, 10) === today ? 'today' : '')

  return (
    <div className="stack">
      <ErrorBox error={error} onRetry={reload} />
      <div className="stats">
        <div className="stat"><span>Buổi dạy hôm nay</span><strong>{todays.length}</strong><em>{todays[0] ? `Buổi đầu ${formatTime(todays[0].startTime)}` : 'Không có lịch'}</em></div>
        <div className="stat"><span>Buổi dạy tuần này</span><strong>{thisWeek.length}</strong><em>{formatDate(monday).slice(0, 5)} – {formatDate(sunday).slice(0, 5)}</em></div>
        <div className="stat"><span>Lớp phụ trách</span><strong>{myClasses.size}</strong><em>do Center Manager phân công</em></div>
        <div className="stat"><span>Giờ đã dạy tháng này</span><strong>{hoursThisMonth.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</strong><em>{doneThisMonth.length} buổi đã hoàn thành</em></div>
      </div>

      <div className="card">
        <div className="card-head row-between">
          <h3>Buổi dạy sắp tới</h3>
          <button className="btn btn-sm" onClick={() => goTo('schedule')}>Xem lịch tuần →</button>
        </div>
        {upcoming.length === 0 ? (
          <p className="muted">Không có buổi dạy nào sắp tới.</p>
        ) : (
          <table className="table">
            <thead><tr><th>Ngày</th><th>Giờ</th><th>Lớp</th><th>Phòng</th><th>Sĩ số</th></tr></thead>
            <tbody>
              {upcoming.map((s) => {
                const st = statusOf(s)
                const c = cls(s.classId)
                return (
                  <tr key={s.id}>
                    <td>
                      {dayLabel(dayOf(s.startTime))}, {formatDate(s.startTime)}{' '}
                      {st === 'live' && <span className="badge badge-green">Đang diễn ra</span>}
                      {st === 'today' && <span className="badge badge-amber">Hôm nay</span>}
                    </td>
                    <td>{formatTime(s.startTime)}–{formatTime(s.endTime)}</td>
                    <td><strong>{c?.name || 'Lớp #' + s.classId}</strong><div className="small muted">{c?.subject}</div></td>
                    <td>{room(s.roomId)}</td>
                    <td><span className="muted" title="Chờ Back-End có API sĩ số (G4)">— / {c?.capacity ?? '—'}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <p className="small muted">Sĩ số buổi học được tính theo số hội viên đăng ký lớp.</p>
      </div>
    </div>
  )
}
