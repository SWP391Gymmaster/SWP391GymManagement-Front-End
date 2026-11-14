import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/context'
import { usePreferences } from '../preferences/context'
import { formatDate, formatMoney } from '../store/utils'
import Modal from '../components/Modal'

const statusLabels = { PENDING: 'Chờ thanh toán', COMPLETED: 'Đã thanh toán', PAID: 'Đã thanh toán', CANCELLED: 'Đã hủy', FAILED: 'Thất bại' }
const methodLabels = { CASH: 'Tiền mặt tại quầy', BANK_TRANSFER: 'Chuyển khoản', VNPAY: 'VNPay', MOMO: 'MoMo', CREDIT_CARD: 'Thẻ tín dụng', PAYOS: 'PayOS' }

export default function Payments({ invoicesOnly = false }) {
  const { currentUser, paymentService, memberRevision, packages } = useStore()
  const { t } = usePreferences()
  const member = currentUser.role === 'member'
  const [tab, setTab] = useState(invoicesOnly ? 'invoices' : 'payments')
  const [data, setData] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [form, setForm] = useState({ memberId: '', packageId: '', note: '', transactionReference: '', reason: '' })
  const lock = useRef(false)
  useEffect(() => {
    let active = true
    paymentService.list().then(result => { if (active) { setData(result); setError(''); setLoading(false) } }, e => { if (active) { setData(null); setError(e.message); setLoading(false) } })
    return () => { active = false }
  }, [paymentService, memberRevision, attempt])
  useEffect(() => {
    const refresh = () => setAttempt(n => n + 1)
    const timer = setInterval(refresh, 60000)
    window.addEventListener('focus', refresh)
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [])
  function open(action, row = null) {
    setSelected({ action, row }); setActionError(''); setNotice('')
    setForm({ memberId: '', packageId: '', note: '', transactionReference: '', reason: '' })
  }
  async function detail(row, invoice) {
    if (lock.current) return
    lock.current = true; setBusy(true); setActionError(''); setSelected({ action: 'detail', row: null })
    try { setSelected({ action: 'detail', row: await (invoice ? paymentService.getInvoice(row.invoiceId) : paymentService.getPayment(row.paymentId)) }) }
    catch (e) { setActionError(e.message) }
    finally { lock.current = false; setBusy(false) }
  }
  async function retryPayos(row) {
    if (lock.current) return
    lock.current = true; setBusy(true); setActionError(''); setNotice('')
    try {
      const link = await paymentService.retryPayosPayment(row.paymentId)
      if (!link?.paymentUrl || !link?.paymentId) throw new Error('PayOS did not return a checkout link')
      window.location.assign(link.paymentUrl)
    } catch (e) {
      setActionError(e.message)
      lock.current = false; setBusy(false)
    }
  }
  async function checkPayos(row) {
    if (lock.current) return
    lock.current = true; setBusy(true); setActionError('')
    try {
      await paymentService.reconcilePayosPayment(row.paymentId)
      setSelected(null)
      setAttempt(n => n + 1)
    } catch (e) { setActionError(e.message) }
    finally { lock.current = false; setBusy(false) }
  }
  async function submit(event) {
    event.preventDefault()
    if (lock.current || selected.action === 'detail') return
    lock.current = true; setBusy(true); setActionError('')
    try {
      if (selected.action === 'cash') await paymentService.cashCheckout(form)
      if (selected.action === 'confirm') await paymentService.confirm(selected.row.paymentId, { transactionReference: form.transactionReference.trim(), note: form.note.trim() })
      if (selected.action === 'cancel') await paymentService.cancel(selected.row.paymentId, form.reason.trim())
      setSelected(null); setNotice('Đã cập nhật giao dịch.'); setLoading(true)
    } catch (e) { setActionError(e.message); setAttempt(n => n + 1) }
    finally { lock.current = false; setBusy(false) }
  }
  const field = (key, label, props = {}) => <label>{t(label)}<input value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} disabled={busy} {...props} /></label>
  const rows = (data?.[tab] || []).filter(row => [row.paymentCode, row.invoiceCode, row.memberName, row.memberId, row.packageName].some(v => String(v ?? '').toLocaleLowerCase().includes(query.toLocaleLowerCase())))
  const titles = { cash: 'Thu tiền mặt tại quầy', confirm: 'Xác nhận đã nhận tiền', cancel: 'Hủy thanh toán', detail: 'Chi tiết giao dịch' }
  return <div className="stack">
    <div className="section-intro"><span className="eyebrow">{t('Thanh toán & Hóa đơn')}</span><h2>{t(member ? 'Lịch sử giao dịch của tôi' : 'Quản lý thanh toán')}</h2><p>{t('Theo dõi trạng thái thanh toán và hóa đơn từ máy chủ.')}</p></div>
    <div className="toolbar"><div className="member-tabs">{['payments', 'invoices'].map(key => <button key={key} aria-pressed={tab === key} className={tab === key ? 'selected' : ''} onClick={() => setTab(key)}>{t(key === 'payments' ? 'Thanh toán' : 'Hóa đơn')}</button>)}</div><div className="form-actions"><button className="btn" disabled={busy || loading} onClick={() => { setLoading(true); setAttempt(n => n + 1) }}>{t('Tải lại')}</button>{!member && currentUser.role !== 'admin' && <button className="btn btn-primary" disabled={busy} onClick={() => open('cash')}>{t('Thu tiền mặt tại quầy')}</button>}</div></div>
    {notice && <div className="alert alert-success" role="status">{t(notice)}</div>}
    {actionError && !selected && <div className="alert alert-error" role="alert">{t(actionError)}</div>}
    {error && <div className="alert alert-error" role="alert">{t(error)} <button className="btn btn-sm" onClick={() => { setLoading(true); setAttempt(n => n + 1) }}>{t('Thử lại')}</button></div>}
    {loading && <p role="status">{t('Đang tải dữ liệu…')}</p>}
    <div className="card stack"><label className="form">{t('Tìm giao dịch')}<input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('Mã giao dịch, hội viên hoặc gói tập')} /></label>
      <div className="table-wrap"><table><thead><tr><th>{t('Mã giao dịch')}</th>{!member && <th>{t('Hội viên')}</th>}<th>{t('Gói tập')}</th><th>{t('Số tiền')}</th><th>{t('Trạng thái')}</th><th>{t('Thao tác')}</th></tr></thead><tbody>{rows.map(row => <tr key={tab === 'payments' ? row.paymentId : row.invoiceId}>
        <td><strong>{tab === 'payments' ? row.paymentCode : row.invoiceCode}</strong><div className="small muted">{formatDate(row.createdAt || row.issuedAt)}</div></td>{!member && <td>{row.memberName}<div className="small muted">ID: {row.memberId}</div></td>}<td>{row.packageName}</td><td>{formatMoney(row.amount)}</td><td><span className={`badge ${['PAID', 'COMPLETED'].includes(row.status) ? 'badge-green' : 'badge-gray'}`}>{t(statusLabels[row.status] || row.status)}</span></td>
        <td><div className="form-actions"><button className="btn btn-sm" disabled={busy} onClick={() => detail(row, tab === 'invoices')}>{t('Chi tiết')}</button>{tab === 'payments' && member && row.paymentMethod === 'PAYOS' && row.status === 'CANCELLED' && <button className="btn btn-primary btn-sm" disabled={busy || loading || !!error} onClick={() => retryPayos(row)}>Thanh toán lại</button>}{tab === 'payments' && row.status === 'PENDING' && (member ? <span className="small muted">{t(row.paymentMethod === 'PAYOS' ? 'Đang chờ PayOS xác nhận' : 'Chờ nhân viên xác nhận')}</span> : currentUser.role !== 'admin' && row.paymentMethod === 'BANK_TRANSFER' ? <><button className="btn btn-primary btn-sm" disabled={busy || loading || !!error} onClick={() => open('confirm', row)}>{t('Xác nhận')}</button><button className="btn btn-sm" disabled={busy || loading || !!error} onClick={() => open('cancel', row)}>{t('Hủy thanh toán')}</button></> : <span className="small muted">{t('Chờ PayOS xác nhận')}</span>)}</div></td>
      </tr>)}</tbody></table></div>{!loading && !error && !rows.length && <p className="member-empty">{t('Chưa có giao dịch phù hợp.')}</p>}
    </div>
    {selected && <Modal title={titles[selected.action]} onClose={() => { if (!busy) setSelected(null) }}><form className="form stack" onSubmit={submit}>
      {selected.row && <div className="summary">{[['Mã giao dịch', selected.row.paymentCode || selected.row.invoiceCode], ['Hóa đơn', selected.row.invoiceCode], ['Hội viên', `${selected.row.memberName || '—'} (#${selected.row.memberId})`], ['Gói tập', selected.row.packageName], ['Số tiền', formatMoney(selected.row.amount)], ['Trạng thái', t(statusLabels[selected.row.status] || selected.row.status)], ['Phương thức thanh toán', t(methodLabels[selected.row.paymentMethod] || '—')], ['Ngày tạo', formatDate(selected.row.createdAt || selected.row.issuedAt)], ['Ngày thanh toán', formatDate(selected.row.completedAt || selected.row.paidAt) || '—'], ['Mã tham chiếu', selected.row.transactionReference || '—'], ['Ghi chú', selected.row.note || '—']].map(([label, value]) => <div key={label}><span>{t(label)}</span><strong>{value}</strong></div>)}</div>}
      {selected.action === 'cash' && <><p className="small muted">{t('Nhập ID của hội viên đã có tài khoản. Xác nhận sẽ ghi nhận đã thu tiền và kích hoạt/gia hạn gói ngay.')}</p>{field('memberId', 'ID hội viên', { type: 'number', min: 1, step: 1, required: true })}<label>{t('Gói tập')}<select required disabled={busy} value={form.packageId} onChange={e => setForm({ ...form, packageId: e.target.value })}><option value="">{t('Chọn gói tập')}</option>{packages.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name} · {formatMoney(p.price)}</option>)}</select></label>{field('note', 'Ghi chú', { maxLength: 500 })}</>}
      {selected.action === 'confirm' && <><p>{t('Chỉ xác nhận sau khi đã nhận đủ tiền. Gói sẽ được kích hoạt hoặc gia hạn.')}</p>{field('transactionReference', 'Mã tham chiếu', { maxLength: 200 })}{field('note', 'Ghi chú', { maxLength: 500 })}</>}
      {selected.action === 'cancel' && field('reason', 'Lý do hủy', { required: true, maxLength: 500 })}
      {selected.action === 'detail' && member && selected.row?.paymentMethod === 'PAYOS' && selected.row.status === 'PENDING' && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => checkPayos(selected.row)}>Kiểm tra trạng thái PayOS</button>}
      {actionError && <div className="alert alert-error" role="alert">{t(actionError)}</div>}
      {busy && selected.action === 'detail' && <p>{t('Đang tải dữ liệu…')}</p>}
      <div className="form-actions"><button type="button" className="btn" disabled={busy} onClick={() => setSelected(null)}>{t('Đóng')}</button>{selected.action !== 'detail' && <button className="btn btn-primary" disabled={busy}>{t(busy ? 'Đang xử lý...' : selected.action === 'cash' ? 'Xác nhận đã nhận tiền' : 'Xác nhận')}</button>}</div>
    </form></Modal>}
  </div>
}

export function Invoices() { return <Payments invoicesOnly /> }
