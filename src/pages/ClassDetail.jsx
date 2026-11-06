import { useEffect, useState } from 'react'
import '../catalog.css'
import { useStore } from '../store/context'
import ClassFormModal from './catalog/ClassFormModal'
import SessionFormModal from './catalog/SessionFormModal'
import ExtendDeadlineModal from './catalog/ExtendDeadlineModal'
import CatalogData from './catalog/CatalogData'
import { closedReason, deadlineLine, dmy, seatText, sessionTime, stamp, useClassActions } from './catalog/classActions'
import { formatDate } from '../store/utils'
import { FEATURES } from '../config/features'
import { STATUS, buildCatalog, canExtendDeadline, deadlineDisplay, sessionStats } from '../catalog/catalogRules'
import { findDetailClass } from '../navigation/pageState'
import { weekdayName } from '../validation/sessionPattern'

// Trang Chi tiết lớp (goTo('class-detail', { classId })). Nội dung chuyển nguyên từ modal chi tiết cũ của ClassCatalog.
function DetailView({ classId, goTo, available, enrolledIds, classStats, membership }) {
  const { classes, schedules, rooms, users, currentUser } = useStore()
  // Tự cập nhật mỗi phút để trạng thái lớp/buổi đổi theo thời gian mà không cần tải lại trang
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer) }, [])
  const [classForm, setClassForm] = useState(false)
  const [sessionForm, setSessionForm] = useState(null) // { session } — session = null nghĩa là thêm mới
  const [extendFor, setExtendFor] = useState(null)
  const cls = findDetailClass(classId, classes)
  const items = cls ? buildCatalog({ classes: [cls], schedules, available, classStats, now }) : []
  const detail = items[0]
  const back = () => goTo('catalog')
  const actions = useClassActions({ items, membership, goTo, onClassDeleted: back })
  // Lớp không còn (bị xóa, id cũ trong sessionStorage) → quay về danh sách.
  useEffect(() => { if (!cls) goTo('catalog') }, [cls, goTo])
  if (!detail) return null
  const coaches = users.filter(u => u.role === 'coach')
  const coachName = id => coaches.find(c => Number(c.id) === Number(id))?.name || 'Chưa phân công'
  const roomName = id => id == null || id === '' ? 'Chưa xếp phòng' : rooms.find(r => r.id === id)?.name || '—'
  const isMember = currentUser.role === 'member'
  const canManage = currentUser.role === 'manager'
  const { busy } = actions
  const stats = sessionStats(detail.sessions)
  const deadline = deadlineDisplay(detail.cls, now)
  return <div className="stack">
    <div className="catalog-toolbar">
      <button className="btn btn-sm" onClick={back}>← Quay lại danh sách</button>
      {canManage && <div className="catalog-actions"><button className="btn btn-sm" onClick={() => setClassForm(true)}>Sửa lớp</button><button className="btn btn-sm btn-ghost" onClick={() => actions.ask('class', detail.cls)}>Xóa lớp</button></div>}
    </div>
    <div className="card stack">
      <div className="catalog-top"><span className="badge badge-green">{detail.cls.subject || '—'}</span><span className={`badge ${STATUS[detail.status].badge}`}>{STATUS[detail.status].label}</span></div>
      <h3 className="class-detail-title">{detail.cls.name}</h3>
      <div className="catalog-dates">
        <div><span>Mã lớp</span>{detail.cls.classCode || '—'}</div>
        <div><span>Huấn luyện viên</span>{coachName(detail.cls.coachId)}</div>
        <div><span>Sĩ số tối đa</span>{detail.cls.capacity}</div>
        <div><span>Bắt đầu lớp</span>{dmy(detail.cls.startDate || detail.firstDate) || '—'}</div>
        <div><span>Kết thúc lớp</span>{dmy(detail.cls.endDate || detail.lastDate) || '—'}</div>
        {deadline && <div><span>Hạn đăng ký</span><span className="catalog-deadline">{deadlineLine(deadline)}
          {canManage && canExtendDeadline(detail.cls, now) && <button className="btn btn-sm" onClick={() => setExtendFor(detail.cls)}>Gia hạn</button>}</span></div>}
      </div>
      {detail.cls.description && <p className="class-detail-desc">{detail.cls.description}</p>}
    </div>
    {actions.notice && <div className="alert alert-success" role="status">{actions.notice}</div>}
    {isMember && detail.status === 'expired' && <div className="alert alert-error" role="status"><strong>Đã hết hạn đăng ký</strong>{detail.cls.registrationCloseAt ? ` (hạn ${stamp(detail.cls.registrationCloseAt)})` : ''}. Lớp không còn nhận đăng ký mới.</div>}
    {isMember && detail.canRegister && !detail.sessionsOpen && <div className="alert alert-info" role="status">
      Đăng ký lớp trước hạn {stamp(detail.cls.registrationCloseAt)}.{detail.classStat?.registeredByMe ? ' Bạn đã đăng ký lớp.' : ''} Đăng ký từng buổi học sẽ mở sau hạn này.</div>}
    {isMember && detail.classStat && <div className="catalog-actions">
      {detail.classStat.registeredByMe
        ? <><span className="badge badge-green">Bạn đã đăng ký lớp này</span><button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => actions.ask('unregister', detail.cls)}>Hủy đăng ký lớp</button></>
        : detail.canJoin ? <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => actions.joinClass(detail.cls)}>Đăng ký lớp</button>
          : !detail.canRegister ? <button className="btn btn-sm" disabled>{closedReason(detail.status)}</button>
            : <span className="small muted">{detail.classStat.remainingSlots === 0 ? 'Lớp đã đủ sĩ số.' : 'Chưa thể đăng ký lớp.'}</span>}
      {!detail.classStat.registeredByMe && detail.canJoin && <span className="small muted">Cần đăng ký lớp trước khi đăng ký từng buổi học.</span>}
      {actions.classMsgBox(detail.cls.id)}
    </div>}
    <div className="card stack">
      <div className="catalog-toolbar"><h3>Buổi học</h3>{canManage && <button className="btn btn-sm" onClick={() => setSessionForm({ session: null })}>+ Thêm buổi học</button>}</div>
      <div className="class-detail-stats">
        <div><span>Tổng số buổi</span><strong>{stats.total}</strong></div>
        <div><span>Đã diễn ra</span><strong>{stats.done}</strong></div>
        <div><span>Sắp tới</span><strong>{stats.upcoming}</strong></div>
        <div><span>Chưa xếp giờ</span><strong>{stats.unscheduled}</strong></div>
      </div>
      {!detail.sessions.length ? <p className="muted">Lớp chưa có lịch học.</p> : <ul className="catalog-sessions">
        {detail.sessions.map(s => {
          const mine = enrolledIds.includes(Number(s.id))
          const blocked = !detail.sessionsOpen
          const needClass = Boolean(detail.classStat) && !detail.classStat.registeredByMe
          // Buổi chưa xếp giờ: khóa nút đăng ký với chú thích "Chưa xếp giờ".
          const label = s.unscheduled && !s.closed ? 'Chưa xếp giờ' : blocked ? (detail.status === 'closed' ? 'Đã đóng' : 'Mở sau hạn đăng ký') : needClass ? 'Cần đăng ký lớp' : s.closed ? 'Đã đóng' : s.full ? 'Đã đầy' : mine ? 'Đã đăng ký' : 'Đăng ký'
          return <li key={s.id}>
            <span><strong>{weekdayName(s.startTime)}, {formatDate(s.startTime)}</strong> {sessionTime(s)} · {roomName(s.roomId)} · HLV {coachName(s.coachId ?? detail.cls.coachId)}<br /><span className="muted">{s.closed ? (s.unscheduled ? 'Buổi học đã qua' : 'Buổi học đã bắt đầu') : s.unscheduled ? 'Giờ và phòng sẽ được cập nhật sau' : seatText(s, detail.cls.capacity)}</span>
              {FEATURES.sessionDescription && s.description && <span className="catalog-session-desc small muted" title={s.description}>{s.description}</span>}</span>
            {canManage && <span className="catalog-session-actions"><button className="btn btn-sm" onClick={() => setSessionForm({ session: s })}>Sửa</button><button className="btn btn-sm btn-ghost" onClick={() => actions.ask('session', s)}>Xóa</button></span>}
            {isMember && <button className="btn btn-primary btn-sm" disabled={busy || s.unscheduled || needClass || blocked || s.closed || s.full || mine} onClick={() => actions.enroll(s)}>{label}</button>}
            {actions.sessionMsgBox(s.id)}
          </li>
        })}
      </ul>}
    </div>
    {classForm && <ClassFormModal cls={detail.cls} onClose={() => setClassForm(false)} />}
    {extendFor && <ExtendDeadlineModal cls={extendFor} onClose={() => setExtendFor(null)} />}
    {sessionForm && <SessionFormModal cls={detail.cls} session={sessionForm.session} onClose={() => setSessionForm(null)} />}
    {actions.dialogs}
  </div>
}

export default function ClassDetail({ goTo, params = {} }) {
  return <CatalogData render={data => <DetailView classId={params.classId} goTo={goTo} {...data} />} />
}
