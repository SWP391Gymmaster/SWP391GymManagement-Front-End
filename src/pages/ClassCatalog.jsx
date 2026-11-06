import { useEffect, useState } from 'react'
import '../catalog.css'
import { useStore } from '../store/context'
import { useMemberPortal } from '../services/useMemberPortal'
import MemberDataState from '../components/MemberDataState'
import Modal from '../components/Modal'
import ClassFormModal from './catalog/ClassFormModal'
import SessionFormModal from './catalog/SessionFormModal'
import { formatDate, formatTime } from '../store/utils'
import { FEATURES } from '../config/features'
import { STATUS, TIME_SLOTS, EMPTY_FILTERS, buildCatalog, filterCatalog, hasActiveFilter } from '../catalog/catalogRules'
import { isUnscheduled, weekdayName } from '../validation/sessionPattern'

// Giờ của buổi: buổi BE tự sinh chưa có giờ thì ghi "Chưa xếp giờ" thay cho 00:00–00:00.
const sessionTime = s => isUnscheduled(s) ? 'Chưa xếp giờ' : `${formatTime(s.startTime)}–${formatTime(s.endTime)}`

const dmy = v => formatDate(v)
// Mốc đăng ký sớm: có giờ thì hiện cả giờ.
const stamp = v => v && String(v).length > 10 ? `${formatDate(v)} ${String(v).slice(11, 16)}` : dmy(v)
const seatText = (s, capacity) => s.remaining == null ? `Sĩ số tối đa ${capacity}` : `Còn ${s.remaining}/${capacity} chỗ`

// Lỗi do chưa có gói / gói không còn hiệu lực (BE trả "Membership package ...", bản demo trả câu tiếng Việt có "gói tập")
const isPackageError = err => /membership package/i.test(err.code || '') || /gói tập/i.test(err.message || '')

function CatalogView({ available, enrolledIds = [], classStats = null, membership = null, goTo }) {
  const { classes, schedules, rooms, users, currentUser, memberService, deleteClass, deleteSchedule } = useStore()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // Kết quả đăng ký buổi học hiển thị ngay dưới buổi được nhấn: { id, type: 'success' | 'error', text }
  const [sessionMsg, setSessionMsg] = useState(null)
  const [classMsg, setClassMsg] = useState(null) // tương tự sessionMsg, cho đăng ký lớp
  // Quản lý (chỉ Manager, BE chỉ cho Manager ghi): form lớp, form buổi học, xác nhận xóa
  const [classForm, setClassForm] = useState(null) // { cls } — cls = null nghĩa là tạo mới
  const [sessionForm, setSessionForm] = useState(null) // { session } — session = null nghĩa là thêm mới
  const [confirm, setConfirm] = useState(null) // { kind: 'class' | 'session', item }
  const [confirmError, setConfirmError] = useState('')
  // Tự cập nhật mỗi phút để thẻ chuyển trạng thái (Chưa mở → Đang mở) mà không cần tải lại trang
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer) }, [])
  const coaches = users.filter(u => u.role === 'coach')
  const subjects = [...new Set(classes.map(c => c.subject).filter(Boolean))]
  const items = buildCatalog({ classes, schedules, available, classStats, now })
  const visible = filterCatalog(items, filters)
  const detail = selected && items.find(i => i.cls.id === selected)
  const set = (key, value) => setFilters({ ...filters, [key]: value })
  const coachName = id => coaches.find(c => Number(c.id) === Number(id))?.name || 'Chưa phân công'
  const roomName = id => id == null || id === '' ? 'Chưa xếp phòng' : rooms.find(r => r.id === id)?.name || '—'
  const isMember = currentUser.role === 'member'
    // Chưa mua gói hoặc gói đã hết hạn: báo và đưa hội viên tới trang Gói tập thay vì gọi BE.
  const [needPackage, setNeedPackage] = useState(false)
  const lacksPackage = isMember && (membership?.status === 'none' || membership?.status === 'expired')
  const canManage = currentUser.role === 'manager'
  const enroll = async session => {
    if (busy) return
    if (lacksPackage) { setNeedPackage(true); return }
    setBusy(true); setError(''); setNotice(''); setSessionMsg(null)
    try { await memberService.enroll(session.id); setSessionMsg({ id: session.id, type: 'success', text: 'Đăng ký thành công. Buổi học đã được thêm vào lịch cá nhân.' }) }
    catch (err) { setSessionMsg({ id: session.id, type: 'error', text: err.message, needPackage: isPackageError(err) }) } finally { setBusy(false) }
  }
  // Đăng ký / hủy đăng ký LỚP (chỉ khi bật FEATURES.classRegistration)
  const joinClass = async cls => {
    if (busy) return
    if (lacksPackage) { setNeedPackage(true); return }
    setBusy(true); setError(''); setNotice(''); setClassMsg(null)
    const early = items.find(i => i.cls.id === cls.id)?.status === 'upcoming'
    try { await memberService.registerClass(cls.id); setClassMsg({ id: cls.id, type: 'success', text: early ? `Bạn đã đăng ký sớm lớp ${cls.name}.` : `Đã đăng ký lớp ${cls.name}. Bạn có thể đăng ký các buổi học của lớp.` }) }
    catch (err) { setClassMsg({ id: cls.id, type: 'error', text: err.message, needPackage: isPackageError(err) }) } finally { setBusy(false) }
  }
  // Kết quả đăng ký lớp hiện ngay trên thẻ lớp / trong chi tiết lớp, kèm nút mua gói khi lỗi do gói tập
  const classMsgBox = id => classMsg?.id === id && <div className={`alert alert-${classMsg.type} catalog-session-msg`} role={classMsg.type === 'error' ? 'alert' : 'status'}>{classMsg.text}
    {classMsg.needPackage && <div><button className="btn btn-primary btn-sm" onClick={() => { setClassMsg(null); setSelected(null); goTo?.('buy') }}>Mua gói tập</button></div>}
  </div>
  const leaveClass = async () => {
    if (busy || !confirm) return
    setBusy(true); setConfirmError('')
    try { await memberService.cancelClassRegistration(confirm.item.id); setConfirm(null); setNotice('Đã hủy đăng ký lớp. Các buổi học sắp tới của lớp cũng được gỡ khỏi lịch của bạn.') }
    catch (err) { setConfirmError(err.message) } finally { setBusy(false) }
  }
  const destroy = async () => {
    if (busy || !confirm) return
    setBusy(true); setConfirmError('')
    try {
      if (confirm.kind === 'class') { await deleteClass(confirm.item.id); setSelected(null) } else await deleteSchedule(confirm.item.id)
      setConfirm(null)
    } catch (err) { setConfirmError(err.message) } finally { setBusy(false) }
  }
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
    {notice && <div className="alert alert-success" role="status">{notice}</div>}
    <p className="small muted">Tìm thấy {visible.length} / {items.length} lớp</p>
    {!visible.length ? <div className="card member-empty"><p>Không có lớp phù hợp bộ lọc.</p></div> : <div className="catalog-grid">
      {visible.map(({ cls, status, next, firstDate, lastDate, canRegister, classStat, canJoin }) => <article className="catalog-card" key={cls.id}>
        <div className="catalog-top"><span className="badge badge-green">{cls.subject || '—'}</span><span className={`badge ${STATUS[status].badge}`}>{STATUS[status].label}</span></div>
        <h3>{cls.name}</h3>
        <p>Mã lớp: {cls.classCode || '—'}</p>
        <p>HLV: {coachName(cls.coachId)}</p>
        {status === 'upcoming'
          ? <>
            <p>Mở đăng ký sớm: {stamp(cls.registrationOpenAt) || '—'}</p>
            <p>Kết thúc đăng ký sớm: {stamp(cls.registrationCloseAt) || '—'}</p>
            {isMember && <p className="small"><strong>{canRegister ? 'Đang trong thời gian đăng ký sớm' : 'Chưa tới ngày mở đăng ký sớm'}</strong></p>}
          </>
          : <>
            <p>Bắt đầu lớp: {dmy(cls.startDate || firstDate) || '—'}</p>
            <p>Kết thúc lớp: {dmy(cls.endDate || lastDate) || '—'}</p>
          </>}
        <p>{classStat ? seatText({ remaining: classStat.remainingSlots }, cls.capacity) : next ? seatText(next, cls.capacity) : `Sĩ số tối đa ${cls.capacity}`}</p>
        {isMember && classStat?.registeredByMe && <p className="small"><strong>{status === 'upcoming' ? 'Bạn đã đăng ký sớm lớp này' : 'Bạn đã đăng ký lớp này'}</strong></p>}
        <div className="catalog-actions">
          <button className="btn btn-sm" onClick={() => { setSelected(cls.id); setError(''); setNotice(''); setSessionMsg(null); setClassMsg(null) }}>Xem chi tiết</button>
          {isMember && canJoin && <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => joinClass(cls)}>Đăng ký lớp</button>}
          {canManage && <button className="btn btn-sm" onClick={() => setClassForm({ cls })}>Sửa</button>}
          {canManage && <button className="btn btn-sm btn-ghost" onClick={() => { setConfirm({ kind: 'class', item: cls }); setConfirmError('') }}>Xóa</button>}
        </div>
        {!detail && classMsgBox(cls.id)}
      </article>)}
    </div>}
    {detail && <Modal title={detail.cls.name} onClose={() => setSelected(null)} width={640}>
      <div className="stack">
        <div className="catalog-top"><span className="badge badge-green">{detail.cls.subject}</span><span className={`badge ${STATUS[detail.status].badge}`}>{STATUS[detail.status].label}</span></div>
        {detail.cls.description && <p>{detail.cls.description}</p>}
        {(detail.cls.startDate || detail.cls.registrationOpenAt) && <div className="catalog-dates">
          <div><span>Bắt đầu lớp</span>{dmy(detail.cls.startDate) || '—'}</div>
          <div><span>Kết thúc lớp</span>{dmy(detail.cls.endDate) || '—'}</div>
          <div><span>Mở đăng ký sớm</span>{stamp(detail.cls.registrationOpenAt) || '—'}</div>
          <div><span>Kết thúc đăng ký sớm</span>{stamp(detail.cls.registrationCloseAt) || '—'}</div>
        </div>}
        <p className="small muted">Mã lớp {detail.cls.classCode} · HLV {coachName(detail.cls.coachId)} · Sĩ số tối đa {detail.cls.capacity}</p>
        {notice && <div className="alert alert-success" role="status">{notice}</div>}
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {isMember && detail.status === 'upcoming' && <div className="alert alert-info" role="status">{!detail.canRegister
          ? `Chưa tới giờ mở đăng ký sớm${detail.cls.registrationOpenAt ? ` (${stamp(detail.cls.registrationOpenAt)})` : ''}.`
          : `Lớp đang trong thời gian đăng ký sớm.${detail.classStat ? (detail.classStat.registeredByMe ? ' Bạn đã đăng ký lớp.' : ' Bạn có thể đăng ký lớp ngay.') : ''} Đăng ký buổi học sẽ mở khi đăng ký sớm kết thúc${detail.cls.registrationCloseAt ? ` (${stamp(detail.cls.registrationCloseAt)})` : ''}.`}</div>}
        {isMember && detail.classStat && <div className="catalog-actions">
          {detail.classStat.registeredByMe
            ? <><span className="badge badge-green">{detail.status === 'upcoming' ? 'Bạn đã đăng ký sớm lớp này' : 'Bạn đã đăng ký lớp này'}</span><button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => { setConfirm({ kind: 'unregister', item: detail.cls }); setConfirmError('') }}>Hủy đăng ký lớp</button></>
            : detail.canJoin ? <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => joinClass(detail.cls)}>Đăng ký lớp</button>
              : <span className="small muted">{detail.classStat.remainingSlots === 0 ? 'Lớp đã đủ sĩ số.' : detail.status === 'closed' ? 'Lớp đã đóng.' : 'Chưa thể đăng ký lớp.'}</span>}
          {!detail.classStat.registeredByMe && detail.canJoin && <span className="small muted">Cần đăng ký lớp trước khi đăng ký từng buổi học.</span>}
          {classMsgBox(detail.cls.id)}
        </div>}
        {detail.sessions.length > 0 && <p className="small"><strong>Tổng số buổi: {detail.sessions.length}</strong>{detail.sessions.some(s => s.unscheduled) && <span className="muted"> · {detail.sessions.filter(s => s.unscheduled).length} buổi chưa xếp giờ</span>}</p>}
        {!detail.sessions.length ? <p className="muted">Lớp chưa có lịch học.</p> : <ul className="catalog-sessions">
          {detail.sessions.map(s => {
            const mine = enrolledIds.includes(Number(s.id))
            const blocked = !detail.sessionsOpen
            const needClass = Boolean(detail.classStat) && !detail.classStat.registeredByMe
            // Buổi chưa xếp giờ: khóa nút đăng ký với chú thích "Chưa xếp giờ".
            const label = s.unscheduled && !s.closed ? 'Chưa xếp giờ' : blocked ? STATUS[detail.status].label : needClass ? 'Cần đăng ký lớp' : s.closed ? 'Đã đóng' : s.full ? 'Đã đầy' : mine ? 'Đã đăng ký' : 'Đăng ký'
            return <li key={s.id}>
              <span><strong>{weekdayName(s.startTime)}, {formatDate(s.startTime)}</strong> {sessionTime(s)} · {roomName(s.roomId)} · HLV {coachName(s.coachId ?? detail.cls.coachId)}<br /><span className="muted">{s.closed ? (s.unscheduled ? 'Buổi học đã qua' : 'Buổi học đã bắt đầu') : s.unscheduled ? 'Giờ và phòng sẽ được cập nhật sau' : seatText(s, detail.cls.capacity)}</span>
                {FEATURES.sessionDescription && s.description && <span className="catalog-session-desc small muted" title={s.description}>{s.description}</span>}</span>
              {canManage && <span className="catalog-session-actions"><button className="btn btn-sm" onClick={() => setSessionForm({ session: s })}>Sửa</button><button className="btn btn-sm btn-ghost" onClick={() => { setConfirm({ kind: 'session', item: s }); setConfirmError('') }}>Xóa</button></span>}
              {isMember && <button className="btn btn-primary btn-sm" disabled={busy || s.unscheduled || needClass || blocked || s.closed || s.full || mine} onClick={() => enroll(s)}>{label}</button>}
              {sessionMsg?.id === s.id && <div className={`alert alert-${sessionMsg.type} catalog-session-msg`} role={sessionMsg.type === 'error' ? 'alert' : 'status'}>{sessionMsg.text}
                {sessionMsg.needPackage && <div><button className="btn btn-primary btn-sm" onClick={() => { setSessionMsg(null); setSelected(null); goTo?.('buy') }}>Mua gói tập</button></div>}
              </div>}
            </li>
          })}
        </ul>}
        {canManage && <div className="catalog-actions"><button className="btn btn-sm" onClick={() => setSessionForm({ session: null })}>+ Thêm buổi học</button></div>}
      </div>
    </Modal>}
    {needPackage && <Modal title="Cần có gói tập" onClose={() => setNeedPackage(false)}>
      <div className="stack">
        <p>Bạn chưa mua gói hoặc gói tập đã hết hạn. Xin vui lòng mua gói tập!</p>
        <div className="form-actions"><button className="btn" onClick={() => setNeedPackage(false)}>Để sau</button><button className="btn btn-primary" onClick={() => { setNeedPackage(false); setSelected(null); goTo?.('buy') }}>Mua gói tập</button></div>
      </div>
    </Modal>}
    {classForm && <ClassFormModal cls={classForm.cls} onClose={() => setClassForm(null)} />}
    {sessionForm && detail && <SessionFormModal cls={detail.cls} session={sessionForm.session} onClose={() => setSessionForm(null)} />}
    {confirm && <Modal title={confirm.kind === 'unregister' ? 'Hủy đăng ký lớp' : 'Xác nhận xóa'} onClose={() => { if (!busy) setConfirm(null) }}>
      <div className="stack">
        <p>{confirm.kind === 'unregister' ? <>Hủy đăng ký lớp <strong>{confirm.item.name}</strong>? Các buổi học sắp tới của lớp trong lịch của bạn cũng sẽ bị gỡ.</> : confirm.kind === 'class' ? <>Xóa lớp <strong>{confirm.item.name}</strong>? Lớp phải không còn buổi học nào.</> : <>Xóa buổi học ngày <strong>{formatDate(confirm.item.startTime)} {isUnscheduled(confirm.item) ? '(chưa xếp giờ)' : formatTime(confirm.item.startTime)}</strong>?</>}</p>
        {confirmError && <div className="alert alert-error" role="alert">{confirmError}</div>}
        <div className="form-actions"><button className="btn" disabled={busy} onClick={() => setConfirm(null)}>Hủy</button><button className="btn btn-primary" disabled={busy} onClick={confirm.kind === 'unregister' ? leaveClass : destroy}>{busy ? 'Đang xử lý...' : confirm.kind === 'unregister' ? 'Hủy đăng ký lớp' : 'Xóa'}</button></div>
      </div>
    </Modal>}
  </div>
}

function MemberCatalog({ goTo }) {
  const { data, error, retry } = useMemberPortal()
  if (!data || error) return <MemberDataState error={error} retry={retry} />
  return <CatalogView available={data.sessions} enrolledIds={data.enrollments.map(e => Number(e.sessionId))} classStats={data.classStats} membership={data.status} goTo={goTo} />
}

export default function ClassCatalog({ goTo }) {
  const { currentUser } = useStore()
  return currentUser.role === 'member' ? <MemberCatalog goTo={goTo} /> : <CatalogView available={null} />
}