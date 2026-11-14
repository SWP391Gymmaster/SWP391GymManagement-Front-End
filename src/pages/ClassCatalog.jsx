import { useEffect, useState } from 'react'
import '../catalog.css'
import { useStore } from '../store/context'
import { useMemberPortal } from '../services/useMemberPortal'
import MemberDataState from '../components/MemberDataState'
import Modal from '../components/Modal'
import ClassFormModal from './catalog/ClassFormModal'
import SessionFormModal from './catalog/SessionFormModal'
import SessionBatchModal from './catalog/SessionBatchModal'
import { formatDate, formatTime } from '../store/utils'
import { FEATURES } from '../config/features'
import { STATUS, TIME_SLOTS, EMPTY_FILTERS, buildCatalog, filterCatalog, hasActiveFilter } from '../catalog/catalogRules'
import { classIdFromHash } from '../catalog/classRoute'

const dmy = v => formatDate(v)
// Mốc đăng ký sớm: có giờ thì hiện cả giờ.
const stamp = v => v && String(v).length > 10 ? `${formatDate(v)} ${String(v).slice(11, 16)}` : dmy(v)
const seatText = (s, capacity) => s.remaining == null ? `Sĩ số tối đa ${capacity}` : `Còn ${s.remaining}/${capacity} chỗ`

// Lỗi do chưa có gói / gói không còn hiệu lực (BE trả "Membership package ...", bản demo trả câu tiếng Việt có "gói tập")
const isPackageError = err => /membership package/i.test(err.code || '') || /gói tập/i.test(err.message || '')

function CatalogView({ available, classStats = null, membership = null, goTo }) {
  const { classes, schedules, rooms, users, currentUser, memberService, deleteClass, deleteSchedule, transferSessionCoach } = useStore()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [selected, setSelected] = useState(() => classIdFromHash(window.location.hash))
  useEffect(() => {
    const sync = () => setSelected(classIdFromHash(window.location.hash))
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync) }
  }, [])
  const showClass = id => {
    window.history.pushState(null, '', `#/classes/${id}`)
    setSelected(id)
  }
  const showList = () => {
    window.history.pushState(null, '', '#/catalog')
    setSelected(null)
  }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [classMsg, setClassMsg] = useState(null)
  // Quản lý (chỉ Manager, BE chỉ cho Manager ghi): form lớp, form buổi học, xác nhận xóa
  const [classForm, setClassForm] = useState(null) // { cls } — cls = null nghĩa là tạo mới
  const [sessionForm, setSessionForm] = useState(null) // { session } — session = null nghĩa là thêm mới
  const [batchForm, setBatchForm] = useState(false)
  const [transfer, setTransfer] = useState(null)
  const [transferCoachId, setTransferCoachId] = useState('')
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
  const roomName = id => rooms.find(r => r.id === id)?.name || '—'
  const isMember = currentUser.role === 'member'
    // Chưa mua gói hoặc gói đã hết hạn: báo và đưa hội viên tới trang Gói tập thay vì gọi BE.
  const [needPackage, setNeedPackage] = useState(false)
  const lacksPackage = isMember && (membership?.status === 'none' || membership?.status === 'expired')
  const canManage = currentUser.role === 'manager'
  // Đăng ký / hủy đăng ký LỚP (chỉ khi bật FEATURES.classRegistration)
  const joinClass = async cls => {
    if (busy) return
    if (lacksPackage) { setNeedPackage(true); return }
    setBusy(true); setError(''); setNotice(''); setClassMsg(null)
    try { await memberService.registerClass(cls.id); setClassMsg({ id: cls.id, type: 'success', text: `Đã đăng ký lớp ${cls.name}. Lộ trình đã được thêm vào lịch của bạn.` }) }
    catch (err) { setClassMsg({ id: cls.id, type: 'error', text: err.message, needPackage: isPackageError(err) }) } finally { setBusy(false) }
  }
  // Kết quả đăng ký lớp hiện ngay trên thẻ lớp / trong chi tiết lớp, kèm nút mua gói khi lỗi do gói tập
  const classMsgBox = id => classMsg?.id === id && <div className={`alert alert-${classMsg.type} catalog-session-msg`} role={classMsg.type === 'error' ? 'alert' : 'status'}>{classMsg.text}
    {classMsg.needPackage && <div><button className="btn btn-primary btn-sm" onClick={() => { setClassMsg(null); goTo?.('buy') }}>Mua gói tập</button></div>}
  </div>
  const leaveClass = async () => {
    if (busy || !confirm) return
    setBusy(true); setConfirmError('')
    try { await memberService.cancelClassRegistration(confirm.item.id); setConfirm(null); setNotice('Đã hủy đăng ký lớp. Lộ trình lớp đã được gỡ khỏi lịch của bạn.') }
    catch (err) { setConfirmError(err.message) } finally { setBusy(false) }
  }
  const destroy = async () => {
    if (busy || !confirm) return
    setBusy(true); setConfirmError('')
    try {
      if (confirm.kind === 'class') { await deleteClass(confirm.item.id); showList() } else await deleteSchedule(confirm.item.id)
      setConfirm(null)
    } catch (err) { setConfirmError(err.message) } finally { setBusy(false) }
  }
  const submitTransfer = async () => {
    if (!transferCoachId || busy) return
    setBusy(true); setError('')
    try { await transferSessionCoach(transfer.id, transferCoachId); setTransfer(null) }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return <div className="stack">
    {!selected && <>
    {canManage && <div className="catalog-toolbar"><h3>Danh sách lớp ({items.length})</h3><button className="btn btn-primary" onClick={() => setClassForm({ cls: null })}>+ Tạo lớp mới</button></div>}
    <div className="card"><div className="form catalog-filters">
      <label>Bộ môn<select value={filters.subject} onChange={e => set('subject', e.target.value)}><option value="">Tất cả</option>{subjects.map(s => <option key={s}>{s}</option>)}</select></label>
      <label>Huấn luyện viên<select value={filters.coachId} onChange={e => set('coachId', e.target.value)}><option value="">Tất cả</option>{coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Ngày học<input type="date" value={filters.date} onChange={e => set('date', e.target.value)} /></label>
      <label>Khung giờ<select value={filters.slot} onChange={e => set('slot', e.target.value)}><option value="">Cả ngày</option>{TIME_SLOTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
      <label>Trạng thái<select value={filters.status} onChange={e => set('status', e.target.value)}><option value="">Tất cả</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
      <label className="check"><input type="checkbox" checked={filters.showClosed} onChange={e => set('showClosed', e.target.checked)} />Hiện lớp đã đóng</label>
      <label className="check"><input type="checkbox" checked={filters.hasSeats} disabled={!classStats} onChange={e => set('hasSeats', e.target.checked)} />Chỉ lớp còn chỗ</label>
      <button className="btn" disabled={!hasActiveFilter(filters)} onClick={() => setFilters(EMPTY_FILTERS)}>Xóa bộ lọc</button>
    </div>
    {!classStats && <p className="small muted">Số chỗ còn lại chỉ hiển thị với tài khoản hội viên.</p>}</div>
    {notice && <div className="alert alert-success" role="status">{notice}</div>}
    <p className="small muted">Tìm thấy {visible.length} / {items.length} lớp</p>
    {!visible.length ? <div className="card member-empty"><p>Không có lớp phù hợp bộ lọc.</p></div> : <div className="catalog-grid">
      {visible.map(({ cls, status, firstDate, lastDate, classStat, canJoin, sessionCount }) => <article className="catalog-card" key={cls.id}>
        <div className="catalog-top"><span className="badge badge-green">{cls.subject || '—'}</span><span className={`badge ${STATUS[status].badge}`}>{STATUS[status].label}</span></div>
        <h3>{cls.name}</h3>
        <p>Mã lớp: {cls.classCode || '—'}</p>
        <p>HLV: {coachName(cls.coachId)}</p>
        <p>Tổng số buổi học: {sessionCount}</p>
        <p>Hạn đăng ký: {stamp(cls.registrationCloseAt) || dmy(cls.startDate || firstDate) || '—'}</p>
        <p>Bắt đầu lớp: {dmy(cls.startDate || firstDate) || '—'}</p>
        <p>Kết thúc lớp: {dmy(cls.endDate || lastDate) || '—'}</p>
        <p>{classStat ? seatText({ remaining: classStat.remainingSlots }, cls.capacity) : `Sĩ số tối đa ${cls.capacity}`}</p>
        {isMember && classStat?.registeredByMe && <p className="small"><strong>Bạn đã đăng ký lớp này</strong></p>}
        <div className="catalog-actions">
          <button className="btn btn-sm" onClick={() => { showClass(cls.id); setError(''); setNotice(''); setClassMsg(null) }}>Xem chi tiết</button>
          {isMember && canJoin && <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => joinClass(cls)}>Đăng ký lớp</button>}
          {canManage && <button className="btn btn-sm" onClick={() => setClassForm({ cls })}>Sửa</button>}
          {canManage && <button className="btn btn-sm btn-ghost" onClick={() => { setConfirm({ kind: 'class', item: cls }); setConfirmError('') }}>Xóa</button>}
        </div>
        {!detail && classMsgBox(cls.id)}
      </article>)}
    </div>}
    </>}
    {selected && !detail && <section className="card stack"><button className="btn" onClick={showList}>Danh sách lớp</button><p>Không tìm thấy lớp học.</p></section>}
    {detail && <section className="card stack" aria-label={`Thông tin lớp ${detail.cls.name}`}>
      <div className="toolbar"><button className="btn" onClick={showList}>← Danh sách lớp</button><h2>{detail.cls.name}</h2></div>
      <div className="stack">
        <div className="catalog-top"><span className="badge badge-green">{detail.cls.subject}</span><span className={`badge ${STATUS[detail.status].badge}`}>{STATUS[detail.status].label}</span></div>
        {detail.cls.description && <p>{detail.cls.description}</p>}
        {(detail.cls.startDate || detail.cls.registrationCloseAt) && <div className="catalog-dates">
          <div><span>Bắt đầu lớp</span>{dmy(detail.cls.startDate) || '—'}</div>
          <div><span>Kết thúc lớp</span>{dmy(detail.cls.endDate) || '—'}</div>
          <div><span>Hạn đăng ký</span>{stamp(detail.cls.registrationCloseAt) || dmy(detail.cls.startDate) || '—'}</div>
        </div>}
        <p className="small muted">Mã lớp {detail.cls.classCode} · HLV {coachName(detail.cls.coachId)} · Sĩ số tối đa {detail.cls.capacity}</p>
        <p><strong>Tổng số buổi học: {detail.sessionCount}</strong></p>
        {notice && <div className="alert alert-success" role="status">{notice}</div>}
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        {isMember && detail.classStat && <div className="catalog-actions">
          {detail.classStat.registeredByMe
            ? <><span className="badge badge-green">Bạn đã đăng ký lớp này</span><button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => { setConfirm({ kind: 'unregister', item: detail.cls }); setConfirmError('') }}>Hủy đăng ký lớp</button></>
            : detail.canJoin ? <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => joinClass(detail.cls)}>Đăng ký lớp</button>
              : <span className="small muted">{detail.classStat.remainingSlots === 0 ? 'Lớp đã đủ sĩ số.' : detail.status === 'closed' ? 'Lớp đã đóng.' : detail.status === 'pending' ? 'Chưa đến giờ mở đăng ký.' : 'Chưa thể đăng ký lớp.'}</span>}
          {classMsgBox(detail.cls.id)}
        </div>}
        {!detail.sessions.length ? <p className="muted">Lớp chưa có lịch học.</p> : <ul className="catalog-sessions">
          {detail.sessions.map(s => {
            return <li key={s.id}>
              <span><strong>{formatDate(s.startTime)}</strong> {formatTime(s.startTime)}–{formatTime(s.endTime)} · {roomName(s.roomId)}<br /><span className="muted">{detail.classStat ? seatText({ remaining: detail.classStat.remainingSlots }, detail.cls.capacity) : `Sĩ số tối đa ${detail.cls.capacity}`}</span>
                {FEATURES.sessionDescription && s.description && <span className="catalog-session-desc small muted" title={s.description}>{s.description}</span>}</span>
              {canManage && <span className="catalog-session-actions"><button className="btn btn-sm" onClick={() => setSessionForm({ session: s })}>Sửa</button><button className="btn btn-sm" onClick={() => { setTransfer(s); setTransferCoachId(String(s.coachId || '')); setError('') }}>Chuyển HLV</button><button className="btn btn-sm btn-ghost" onClick={() => { setConfirm({ kind: 'session', item: s }); setConfirmError('') }}>Xóa</button></span>}
            </li>
          })}
        </ul>}
        {canManage && <div className="catalog-actions"><button className="btn btn-sm" onClick={() => setSessionForm({ session: null })}>+ Thêm buổi học</button><button className="btn btn-sm" onClick={() => setBatchForm(true)}>Tạo nhiều buổi / Import CSV</button></div>}
      </div>
    </section>}
    {needPackage && <Modal title="Cần có gói tập" onClose={() => setNeedPackage(false)}>
      <div className="stack">
        <p>Bạn chưa mua gói hoặc gói tập đã hết hạn. Xin vui lòng mua gói tập!</p>
        <div className="form-actions"><button className="btn" onClick={() => setNeedPackage(false)}>Để sau</button><button className="btn btn-primary" onClick={() => { setNeedPackage(false); goTo?.('buy') }}>Mua gói tập</button></div>
      </div>
    </Modal>}
    {classForm && <ClassFormModal cls={classForm.cls} onClose={id => { setClassForm(null); if (id) showClass(id) }} />}
    {sessionForm && detail && <SessionFormModal cls={detail.cls} session={sessionForm.session} onClose={() => setSessionForm(null)} />}
    {batchForm && detail && <SessionBatchModal cls={detail.cls} onClose={() => setBatchForm(false)} />}
    {transfer && <Modal title="Chuyển huấn luyện viên cho buổi học" onClose={() => setTransfer(null)}><div className="form"><label>Huấn luyện viên mới<select value={transferCoachId} onChange={e => setTransferCoachId(e.target.value)}><option value="">Chọn huấn luyện viên</option>{coaches.filter(c => c.subjects?.includes(detail?.cls.subject)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>{error && <div className="alert alert-error" role="alert">{error}</div>}<div className="form-actions"><button className="btn" onClick={() => setTransfer(null)}>Hủy</button><button className="btn btn-primary" disabled={!transferCoachId || busy} onClick={submitTransfer}>Xác nhận chuyển</button></div></div></Modal>}
    {confirm && <Modal title={confirm.kind === 'unregister' ? 'Hủy đăng ký lớp' : 'Xác nhận xóa'} onClose={() => { if (!busy) setConfirm(null) }}>
      <div className="stack">
        <p>{confirm.kind === 'unregister' ? <>Hủy đăng ký lớp <strong>{confirm.item.name}</strong>? Lộ trình lớp sẽ bị gỡ khỏi lịch của bạn.</> : confirm.kind === 'class' ? <>Xóa lớp <strong>{confirm.item.name}</strong>? Lớp phải không còn buổi học nào.</> : <>Xóa buổi học ngày <strong>{formatDate(confirm.item.startTime)} {formatTime(confirm.item.startTime)}</strong>?</>}</p>
        {confirmError && <div className="alert alert-error" role="alert">{confirmError}</div>}
        <div className="form-actions"><button className="btn" disabled={busy} onClick={() => setConfirm(null)}>Hủy</button><button className="btn btn-primary" disabled={busy} onClick={confirm.kind === 'unregister' ? leaveClass : destroy}>{busy ? 'Đang xử lý...' : confirm.kind === 'unregister' ? 'Hủy đăng ký lớp' : 'Xóa'}</button></div>
      </div>
    </Modal>}
  </div>
}

function MemberCatalog({ goTo }) {
  const { data, error, retry } = useMemberPortal()
  if (!data || error) return <MemberDataState error={error} retry={retry} />
  return <CatalogView available={null} classStats={data.classStats} membership={data.status} goTo={goTo} />
}

export default function ClassCatalog({ goTo }) {
  const { currentUser } = useStore()
  return currentUser.role === 'member' ? <MemberCatalog goTo={goTo} /> : <ManagerCatalog />
}

function ManagerCatalog() {
  const { reloadCatalog } = useStore()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null)
  useEffect(() => {
    let active = true
    reloadCatalog().then(() => { if (active) setResult({ attempt }) }, error => {
      if (active) setResult({ attempt, error: error.message })
    })
    return () => { active = false }
  }, [reloadCatalog, attempt])
  if (!result || result.attempt !== attempt || result.error)
    return <MemberDataState error={result?.error} retry={() => setAttempt(n => n + 1)} />
  return <CatalogView available={null} />
}
