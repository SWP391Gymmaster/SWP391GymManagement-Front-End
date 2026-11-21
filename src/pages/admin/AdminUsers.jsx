import { useEffect, useState } from 'react'
import { useStore } from '../../store/context'
import Modal from '../../components/Modal'
import './admin-ui.css'

const emptyForm = { userName: '', fullName: '', email: '', phone: '', password: '', role: 'MEMBER' }
const roles = ['MEMBER', 'COACH', 'RECEPTIONIST', 'MANAGER']

export default function AdminUsers() {
  const { api } = useStore()
  const [filters, setFilters] = useState({ q: '', role: '', enabled: '', emailVerified: '' })
  const [page, setPage] = useState(0)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)

  async function load(nextPage = page, nextFilters = filters) {
    setLoading(true); setError('')
    try { setResult(await api.adminUsers.list({ ...nextFilters, page: nextPage, size: 20 })) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    let active = true
    api.adminUsers.list({ ...filters, page: 0, size: 20 })
      .then(data => { if (active) setResult(data) })
      .catch(e => { if (active) setError(e.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [api, filters])

  function openCreate() { setEditing('new'); setForm(emptyForm); setError(''); setNotice('') }
  async function openEdit(user) {
    setBusy(true); setError(''); setNotice('')
    try {
      const full = await api.adminUsers.get(user.id)
      setForm({ userName: full.userName, fullName: full.fullName, email: full.email, phone: full.phone || '', password: '', role: full.role })
      setEditing(full)
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  async function submit(event) {
    event.preventDefault(); if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      let response
      if (editing === 'new') response = await api.adminUsers.create({ ...form, phone: form.phone || null, role: form.role })
      else {
        const body = { ...form }
        delete body.password
        response = await api.adminUsers.update(editing.id, { ...body, phone: body.phone || null })
      }
      setEditing(null)
      setNotice(response?.verificationEmailStatus === 'FAILED'
        ? 'Đã lưu tài khoản nhưng gửi email xác minh thất bại; kiểm tra cấu hình SMTP.'
        : editing === 'new' && response?.verificationEmailStatus === 'SENT'
          ? 'Đã tạo tài khoản và gửi email xác minh.' : 'Đã lưu tài khoản.')
      await load(page, filters)
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  async function setStatus(user, enabled) {
    setBusy(true); setError(''); setNotice('')
    try {
      if (!enabled) await api.adminUsers.deactivate(user.id)
      else await api.adminUsers.setStatus(user.id, true)
      setNotice(enabled ? 'Đã kích hoạt tài khoản.' : 'Đã vô hiệu hóa tài khoản.')
      await load(page, filters)
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  async function resend(user) {
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await api.adminUsers.resendVerification(user.id)
      setNotice(response.verificationEmailStatus === 'SENT' ? 'Đã gửi email xác minh.' : 'BE chưa gửi được email; kiểm tra cấu hình SMTP.')
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  function filterChange(key, value) { setFilters(current => ({ ...current, [key]: value })) }

  return <div className="stack admin-page admin-users">
    <div className="section-intro"><span className="eyebrow">ADMINISTRATION</span><h2>Quản lý tài khoản</h2><p>Tạo và quản lý hội viên, huấn luyện viên, lễ tân và quản lý trung tâm.</p></div>
    <div className="toolbar"><form className="form-actions" onSubmit={e => { e.preventDefault(); setPage(0); void load(0, filters) }}>
      <input aria-label="Tìm tài khoản" placeholder="Tên, email hoặc số điện thoại" value={filters.q} onChange={e => filterChange('q', e.target.value)} />
      <select aria-label="Lọc vai trò" value={filters.role} onChange={e => filterChange('role', e.target.value)}><option value="">Tất cả vai trò</option>{roles.map(role => <option key={role}>{role}</option>)}</select>
      <select aria-label="Lọc trạng thái" value={filters.enabled} onChange={e => filterChange('enabled', e.target.value)}><option value="">Mọi trạng thái</option><option value="true">Đang hoạt động</option><option value="false">Đã vô hiệu hóa</option></select>
      <select aria-label="Lọc email" value={filters.emailVerified} onChange={e => filterChange('emailVerified', e.target.value)}><option value="">Mọi trạng thái email</option><option value="true">Đã xác minh</option><option value="false">Chưa xác minh</option></select>
      <button className="btn" type="submit" disabled={loading}>Lọc</button>
    </form><button className="btn btn-primary" onClick={openCreate}>+ Tạo tài khoản</button></div>
    {error && <div className="alert alert-error" role="alert">{error}</div>}{notice && <div className="alert alert-success" role="status">{notice}</div>}
    <div className="card table-scroll"><table className="table"><thead><tr><th>Tài khoản</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Xác minh email</th><th>Thao tác</th></tr></thead><tbody>
      {loading && <tr><td colSpan={6}>Đang tải tài khoản…</td></tr>}
      {!loading && !result?.content?.length && <tr><td colSpan={6}>Không tìm thấy tài khoản.</td></tr>}
      {!loading && result?.content?.map(user => <tr key={user.id}><td><strong>{user.fullName}</strong><div className="small muted">{user.userName} · #{user.id}</div></td><td>{user.email}<div className="small muted">{user.phone || 'Chưa có số điện thoại'}</div></td><td>{user.role}</td><td>{user.enabled ? 'Đang hoạt động' : 'Đã vô hiệu hóa'}</td><td>{user.emailVerified ? 'Đã xác minh' : 'Chưa xác minh'}</td><td><div className="form-actions"><button className="btn btn-sm" disabled={busy} onClick={() => void openEdit(user)}>Sửa</button>{user.enabled ? <button className="btn btn-sm" disabled={busy} onClick={() => void setStatus(user, false)}>Vô hiệu hóa</button> : <button className="btn btn-sm" disabled={busy} onClick={() => void setStatus(user, true)}>Kích hoạt</button>}{!user.emailVerified && user.enabled && <button className="btn btn-sm" disabled={busy} onClick={() => void resend(user)}>Gửi lại mail</button>}</div></td></tr>)}
    </tbody></table></div>
    <div className="form-actions"><span className="muted">{result?.totalElements ?? 0} tài khoản · Trang {(result?.page ?? 0) + 1}/{Math.max(result?.totalPages ?? 1, 1)}</span><button className="btn" disabled={page <= 0 || loading} onClick={() => { const p = page - 1; setPage(p); void load(p) }}>Trang trước</button><button className="btn" disabled={loading || page + 1 >= (result?.totalPages ?? 0)} onClick={() => { const p = page + 1; setPage(p); void load(p) }}>Trang sau</button></div>
    {editing && <Modal title={editing === 'new' ? 'Tạo tài khoản' : 'Cập nhật tài khoản'} onClose={() => { if (!busy) setEditing(null) }}><form className="form" onSubmit={submit}><fieldset className="form api-fieldset" disabled={busy}>
      <label>Tên đăng nhập<input required minLength={3} maxLength={50} value={form.userName} onChange={e => setForm({ ...form, userName: e.target.value })} /></label>
      <label>Họ và tên<input required maxLength={100} value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} /></label>
      <label>Email<input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
      <label>Số điện thoại<input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
      {editing === 'new' && <label>Mật khẩu tạm<input required type="password" minLength={8} maxLength={72} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>}
      <label>Vai trò<select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{roles.map(role => <option key={role}>{role}</option>)}</select></label>
    </fieldset>{error && <div className="alert alert-error" role="alert">{error}</div>}<div className="form-actions"><button type="button" className="btn" disabled={busy} onClick={() => setEditing(null)}>Hủy</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu tài khoản'}</button></div></form></Modal>}
  </div>
}
