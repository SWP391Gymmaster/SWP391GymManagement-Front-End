import { useStore } from '../../store/context'
import { formatDate, formatTime, nowVN } from '../../store/utils'
import { isUnscheduled } from '../../validation/sessionPattern'

export default function CoachOverview({ goTo }) {
  const { currentUser, schedules, classes, rooms, loading, loadError, refresh } = useStore()
  const mine = schedules
    .filter((schedule) => String(schedule.coachId) === String(currentUser.id))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
  const now = nowVN()
  const today = now.slice(0, 10)
  const month = now.slice(0, 7)
  // Buổi chưa xếp giờ (00:00, startTime === endTime) vẫn là buổi sắp tới cho tới hết ngày đó và không tính là đã dạy.
  const upcoming = mine.filter((schedule) => isUnscheduled(schedule) ? schedule.startTime.slice(0, 10) >= today : schedule.endTime > now).slice(0, 8)
  const completed = mine.filter((schedule) => !isUnscheduled(schedule) && schedule.startTime.slice(0, 7) === month && schedule.endTime <= now)
  const hours = completed.reduce((total, schedule) => total + Math.max(0,
    (new Date(schedule.endTime) - new Date(schedule.startTime)) / 3_600_000), 0)
  const className = (id) => classes.find((item) => String(item.id) === String(id))?.name || `Lớp #${id}`
  const roomName = (id) => (id == null || id === '' ? 'Chưa xếp phòng' : rooms.find((item) => String(item.id) === String(id))?.name || 'Chưa phân phòng')

  return <div className="stack">
    {loadError && <div role="alert" className="alert alert-error">{loadError} <button className="btn btn-sm" onClick={refresh}>Thử lại</button></div>}
    <div className="stats">
      <div className="stat"><span>Buổi dạy hôm nay</span><strong>{mine.filter((s) => s.startTime.slice(0, 10) === today).length}</strong><em>{formatDate(today)}</em></div>
      <div className="stat"><span>Buổi sắp tới</span><strong>{upcoming.length}</strong><em>Lịch đã được phân công</em></div>
      <div className="stat"><span>Lớp đang phụ trách</span><strong>{new Set(mine.map((s) => s.classId)).size}</strong><em>Theo lịch dạy của bạn</em></div>
      <div className="stat"><span>Giờ đã dạy tháng này</span><strong>{hours.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</strong><em>{completed.length} buổi hoàn thành</em></div>
    </div>
    <div className="card">
      <div className="card-head row-between"><h3>Buổi dạy sắp tới</h3><button className="btn btn-sm" onClick={() => goTo('schedule')}>Xem lịch dạy</button></div>
      {loading && <p className="muted">Đang tải lịch dạy…</p>}
      {!loading && upcoming.length > 0 && <div className="table-scroll"><table className="table"><thead><tr><th>Ngày</th><th>Giờ</th><th>Lớp</th><th>Phòng</th></tr></thead>
        <tbody>{upcoming.map((schedule) => <tr key={schedule.id}><td>{formatDate(schedule.startTime)}</td>
          <td>{isUnscheduled(schedule) ? 'Chưa xếp giờ' : `${formatTime(schedule.startTime)} – ${formatTime(schedule.endTime)}`}</td><td>{className(schedule.classId)}</td><td>{roomName(schedule.roomId)}</td></tr>)}</tbody>
      </table></div>}
      {!loading && !upcoming.length && <p className="muted">Bạn chưa có buổi dạy sắp tới.</p>}
    </div>
  </div>
}
