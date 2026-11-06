import { useEffect, useState } from 'react'
import '../catalog.css'
import { useStore } from '../store/context'
import ClassFormModal from './catalog/ClassFormModal'
import CatalogData from './catalog/CatalogData'
import { closedReason, deadlineLine, dmy, seatText, useClassActions } from './catalog/classActions'
import { STATUS, TIME_SLOTS, EMPTY_FILTERS, buildCatalog, deadlineDisplay, filterCatalog, hasActiveFilter } from '../catalog/catalogRules'

// Danh sách lớp. Chi tiết lớp là trang riêng: goTo('class-detail', { classId }) (src/pages/ClassDetail.jsx).
function CatalogView({ available, classStats = null, membership = null, goTo }) {
  const { classes, schedules, users, currentUser } = useStore()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  // Quản lý (chỉ Manager, BE chỉ cho Manager ghi): form lớp — cls = null nghĩa là tạo mới
  const [classForm, setClassForm] = useState(null)
  // Tự cập nhật mỗi phút để thẻ chuyển trạng thái (Đang mở → Hết hạn đăng ký → Đã bắt đầu) mà không cần tải lại trang
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer) }, [])
  const coaches = users.filter(u => u.role === 'coach')
  const subjects = [...new Set(classes.map(c => c.subject).filter(Boolean))]
  const items = buildCatalog({ classes, schedules, available, classStats, now })
  const visible = filterCatalog(items, filters)
  const actions = useClassActions({ items, membership, goTo })
  const { busy } = actions
  const set = (key, value) => setFilters({ ...filters, [key]: value })
  const coachName = id => coaches.find(c => Number(c.id) === Number(id))?.name || 'Chưa phân công'
  const isMember = currentUser.role === 'member'
  const canManage = currentUser.role === 'manager'
  const openDetail = cls => { actions.clearMessages(); goTo('class-detail', { classId: cls.id }) }
  // Tạo lớp (kể cả dùng làm mẫu / mở kỳ mới từ gợi ý mã) xong thì sang trang chi tiết của lớp đó.
  // saveClass chỉ trả về sau khi đã tải lại ngầm, nên các buổi tự sinh đã có trong store khi trang mở.
  const onClassSaved = (saved, { created }) => { if (created && saved?.id != null) goTo('class-detail', { classId: saved.id }) }
  return <div className="stack">
    {canManage && <div className="catalog-toolbar"><h3>Danh sách lớp ({items.length})</h3><button className="btn btn-primary" onClick={() => setClassForm({ cls: null })}>+ Tạo lớp mới</button></div>}
    <div className="card"><div className="form catalog-filters">
      <label>Bộ môn<select value={filters.subject} onChange={e => set('subject', e.target.value)}><option value="">Tất cả</option>{subjects.map(s => <option key={s}>{s}</option>)}</select></label>
      <label>Huấn luyện viên<select value={filters.coachId} onChange={e => set('coachId', e.target.value)}><option value="">Tất cả</option>{coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Ngày học<input type="date" value={filters.date} onChange={e => set('date', e.target.value)} /></label>
      <label>Khung giờ<select value={filters.slot} onChange={e => set('slot', e.target.value)}><option value="">Cả ngày</option>{TIME_SLOTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
      <label>Trạng thái<select value={filters.status} onChange={e => set('status', e.target.value)}><option value="">Tất cả</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
      <label className="check"><input type="checkbox" checked={filters.showClosed} onChange={e => set('showClosed', e.target.checked)} />Hiện lớp đã đóng</label>
      <label className="check"><input type="checkbox" checked={filters.hasSeats} disabled={!available} onChange={e => set('hasSeats', e.target.checked)} />Chỉ lớp còn chỗ</label>
      <button className="btn" disabled={!hasActiveFilter(filters)} onClick={() => setFilters(EMPTY_FILTERS)}>Xóa bộ lọc</button>
    </div>
    {!available && <p className="small muted">Số chỗ còn lại chỉ hiển thị với tài khoản hội viên.</p>}</div>
    {actions.notice && <div className="alert alert-success" role="status">{actions.notice}</div>}
    <p className="small muted">Tìm thấy {visible.length} / {items.length} lớp</p>
    {!visible.length ? <div className="card member-empty"><p>Không có lớp phù hợp bộ lọc.</p></div> : <div className="catalog-grid">
      {visible.map(({ cls, status, next, firstDate, lastDate, sessionCount, canRegister, classStat, canJoin }) => <article className="catalog-card" key={cls.id}>
        <div className="catalog-top"><span className="badge badge-green">{cls.subject || '—'}</span><span className={`badge ${STATUS[status].badge}`}>{STATUS[status].label}</span></div>
        <h3>{cls.name}</h3>
        <p>Mã lớp: {cls.classCode || '—'}</p>
        <p>HLV: {coachName(cls.coachId)}</p>
        <p>Bắt đầu lớp: {dmy(cls.startDate || firstDate) || '—'}</p>
        <p>Kết thúc lớp: {dmy(cls.endDate || lastDate) || '—'}</p>
        <p>Số buổi: {sessionCount}</p>
        {status !== 'closed' && status !== 'started' && deadlineDisplay(cls, now) && <p>Hạn đăng ký: {deadlineLine(deadlineDisplay(cls, now))}</p>}
        <p>{classStat ? seatText({ remaining: classStat.remainingSlots }, cls.capacity) : next ? seatText(next, cls.capacity) : `Sĩ số tối đa ${cls.capacity}`}</p>
        {isMember && classStat?.registeredByMe && <p className="small"><strong>Bạn đã đăng ký lớp này</strong></p>}
        <div className="catalog-actions">
          <button className="btn btn-sm" onClick={() => openDetail(cls)}>Xem chi tiết</button>
          {isMember && canJoin && <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => actions.joinClass(cls)}>Đăng ký lớp</button>}
          {isMember && classStat && !classStat.registeredByMe && !canRegister && status !== 'closed' && <button className="btn btn-sm" disabled>{closedReason(status)}</button>}
          {canManage && <button className="btn btn-sm" onClick={() => setClassForm({ cls })}>Sửa</button>}
          {canManage && <button className="btn btn-sm btn-ghost" onClick={() => actions.ask('class', cls)}>Xóa</button>}
        </div>
        {actions.classMsgBox(cls.id)}
      </article>)}
    </div>}
    {classForm && <ClassFormModal cls={classForm.cls} onClose={() => setClassForm(null)} onSaved={onClassSaved} />}
    {actions.dialogs}
  </div>
}

export default function ClassCatalog({ goTo }) {
  return <CatalogData render={data => <CatalogView {...data} goTo={goTo} />} />
}
