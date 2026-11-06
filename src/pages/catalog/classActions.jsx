// Phần dùng chung (hiển thị + thao tác) giữa trang Danh sách lớp (ClassCatalog) và trang Chi tiết lớp (ClassDetail):
// helper hiển thị, đăng ký lớp/buổi và các hộp xác nhận. Chuyển nguyên từ ClassCatalog.jsx, không đổi nghiệp vụ.
import { useState } from 'react'
import { useStore } from '../../store/context'
import Modal from '../../components/Modal'
import { formatDate, formatTime } from '../../store/utils'
import { isUnscheduled } from '../../validation/sessionPattern'

// Giờ của buổi: buổi BE tự sinh chưa có giờ thì ghi "Chưa xếp giờ" thay cho 00:00–00:00.
export const sessionTime = s => isUnscheduled(s) ? 'Chưa xếp giờ' : `${formatTime(s.startTime)}–${formatTime(s.endTime)}`
export const dmy = v => formatDate(v)
// Hạn đăng ký: có giờ thì hiện dd/MM/yyyy HH:mm. registrationOpenAt của lớp cũ bị bỏ qua.
export const stamp = v => v && String(v).length > 10 ? `${formatDate(v)} ${String(v).slice(11, 16)}` : dmy(v)
// Lý do không đăng ký lớp được (theo trạng thái lớp).
export const closedReason = status => status === 'started' ? 'Lớp đã bắt đầu' : status === 'closed' ? 'Lớp đã đóng' : 'Đã hết hạn đăng ký'
export const seatText = (s, capacity) => s.remaining == null ? `Sĩ số tối đa ${capacity}` : `Còn ${s.remaining}/${capacity} chỗ`
// Hạn đăng ký theo trạng thái lớp (deadlineDisplay, khớp điều kiện nút "Gia hạn"): quá hạn thì nổi bật
// "Đã hết hạn đăng ký (dd/MM/yyyy HH:mm)"; lớp đã bắt đầu thì kèm "Lớp đã bắt đầu, không nhận đăng ký".
export const deadlineLine = display => display.kind === 'expired' ? <strong className="catalog-deadline-expired">{display.text}</strong>
  : <>{display.text}{display.note && <> · <strong>{display.note}</strong></>}</>

// Lỗi do chưa có gói / gói không còn hiệu lực (BE trả "Membership package ...", bản demo trả câu tiếng Việt có "gói tập")
const isPackageError = err => /membership package/i.test(err.code || '') || /gói tập/i.test(err.message || '')

// Đăng ký lớp / buổi (hội viên), xóa lớp / buổi (manager) và các hộp xác nhận.
// items = kết quả buildCatalog; onClassDeleted chạy sau khi xóa lớp thành công; leaving = đang rời trang (vd mua gói).
export function useClassActions({ items = [], membership = null, goTo, onClassDeleted, leaving }) {
  const { currentUser, memberService, deleteClass, deleteSchedule } = useStore()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  // Kết quả đăng ký buổi học hiển thị ngay dưới buổi được nhấn: { id, type: 'success' | 'error', text }
  const [sessionMsg, setSessionMsg] = useState(null)
  const [classMsg, setClassMsg] = useState(null) // tương tự sessionMsg, cho đăng ký lớp
  const [confirm, setConfirm] = useState(null) // { kind: 'class' | 'session' | 'unregister', item }
  const [confirmError, setConfirmError] = useState('')
  // Chưa mua gói hoặc gói đã hết hạn: báo và đưa hội viên tới trang Gói tập thay vì gọi BE.
  const [needPackage, setNeedPackage] = useState(false)
  const isMember = currentUser.role === 'member'
  const lacksPackage = isMember && (membership?.status === 'none' || membership?.status === 'expired')
  const toBuy = () => { leaving?.(); goTo?.('buy') }
  const clearMessages = () => { setNotice(''); setSessionMsg(null); setClassMsg(null) }
  const enroll = async session => {
    if (busy) return
    if (lacksPackage) { setNeedPackage(true); return }
    setBusy(true); setNotice(''); setSessionMsg(null)
    try { await memberService.enroll(session.id); setSessionMsg({ id: session.id, type: 'success', text: 'Đăng ký thành công. Buổi học đã được thêm vào lịch cá nhân.' }) }
    catch (err) { setSessionMsg({ id: session.id, type: 'error', text: err.message, needPackage: isPackageError(err) }) } finally { setBusy(false) }
  }
  // Đăng ký LỚP (chỉ khi bật FEATURES.classRegistration)
  const joinClass = async cls => {
    if (busy) return
    if (lacksPackage) { setNeedPackage(true); return }
    setBusy(true); setNotice(''); setClassMsg(null)
    const sessionsLater = !items.find(i => i.cls.id === cls.id)?.sessionsOpen
    try { await memberService.registerClass(cls.id); setClassMsg({ id: cls.id, type: 'success', text: sessionsLater ? `Đã đăng ký lớp ${cls.name}. Đăng ký từng buổi học sẽ mở sau hạn đăng ký lớp.` : `Đã đăng ký lớp ${cls.name}. Bạn có thể đăng ký các buổi học của lớp.` }) }
    catch (err) { setClassMsg({ id: cls.id, type: 'error', text: err.message, needPackage: isPackageError(err) }) } finally { setBusy(false) }
  }
  // Kết quả đăng ký lớp / buổi hiện ngay tại chỗ, kèm nút mua gói khi lỗi do gói tập
  const classMsgBox = id => classMsg?.id === id && <div className={`alert alert-${classMsg.type} catalog-session-msg`} role={classMsg.type === 'error' ? 'alert' : 'status'}>{classMsg.text}
    {classMsg.needPackage && <div><button className="btn btn-primary btn-sm" onClick={() => { setClassMsg(null); toBuy() }}>Mua gói tập</button></div>}
  </div>
  const sessionMsgBox = id => sessionMsg?.id === id && <div className={`alert alert-${sessionMsg.type} catalog-session-msg`} role={sessionMsg.type === 'error' ? 'alert' : 'status'}>{sessionMsg.text}
    {sessionMsg.needPackage && <div><button className="btn btn-primary btn-sm" onClick={() => { setSessionMsg(null); toBuy() }}>Mua gói tập</button></div>}
  </div>
  const ask = (kind, item) => { setConfirm({ kind, item }); setConfirmError('') }
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
      if (confirm.kind === 'class') { await deleteClass(confirm.item.id); setConfirm(null); onClassDeleted?.(confirm.item); return }
      await deleteSchedule(confirm.item.id)
      setConfirm(null)
    } catch (err) { setConfirmError(err.message) } finally { setBusy(false) }
  }
  const dialogs = <>
    {needPackage && <Modal title="Cần có gói tập" onClose={() => setNeedPackage(false)}>
      <div className="stack">
        <p>Bạn chưa mua gói hoặc gói tập đã hết hạn. Xin vui lòng mua gói tập!</p>
        <div className="form-actions"><button className="btn" onClick={() => setNeedPackage(false)}>Để sau</button><button className="btn btn-primary" onClick={() => { setNeedPackage(false); toBuy() }}>Mua gói tập</button></div>
      </div>
    </Modal>}
    {confirm && <Modal title={confirm.kind === 'unregister' ? 'Hủy đăng ký lớp' : 'Xác nhận xóa'} onClose={() => { if (!busy) setConfirm(null) }}>
      <div className="stack">
        <p>{confirm.kind === 'unregister' ? <>Hủy đăng ký lớp <strong>{confirm.item.name}</strong>? Các buổi học sắp tới của lớp trong lịch của bạn cũng sẽ bị gỡ.</> : confirm.kind === 'class' ? <>Xóa lớp <strong>{confirm.item.name}</strong>? Lớp phải không còn buổi học nào.</> : <>Xóa buổi học ngày <strong>{formatDate(confirm.item.startTime)} {isUnscheduled(confirm.item) ? '(chưa xếp giờ)' : formatTime(confirm.item.startTime)}</strong>?</>}</p>
        {confirmError && <div className="alert alert-error" role="alert">{confirmError}</div>}
        <div className="form-actions"><button className="btn" disabled={busy} onClick={() => setConfirm(null)}>Hủy</button><button className="btn btn-primary" disabled={busy} onClick={confirm.kind === 'unregister' ? leaveClass : destroy}>{busy ? 'Đang xử lý...' : confirm.kind === 'unregister' ? 'Hủy đăng ký lớp' : 'Xóa'}</button></div>
      </div>
    </Modal>}
  </>
  return { busy, notice, sessionMsg, enroll, joinClass, classMsgBox, sessionMsgBox, ask, clearMessages, dialogs }
}
