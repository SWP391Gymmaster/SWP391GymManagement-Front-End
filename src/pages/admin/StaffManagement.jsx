import { useEffect, useState, useRef } from 'react'
import { useStore } from '../../store/context'
import { usePreferences } from '../../preferences/context'
import Modal from '../../components/Modal'
import Icon from '../../components/Icon'
import { PASSWORD_HINT } from '../../services/publicService'

const ROLE_OPTIONS = [
  { value: 'MANAGER', label: 'Manager' },
  { value: 'COACH', label: 'Coach' },
  { value: 'RECEPTIONIST', label: 'Receptionist' },
]

const ROLE_LABELS = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  COACH: 'Coach',
  RECEPTIONIST: 'Receptionist',
  MEMBER: 'Member',
}

const EMPTY_FORM = {
  userName: '',
  fullName: '',
  email: '',
  password: '',
  confirm: '',
  phone: '',
  role: 'MANAGER',
}

// Bộ môn của coach do manager phân công ở trang "Phân công bộ môn" (pages/manager/CoachSubjects.jsx).
export default function StaffManagement() {
  const { request } = useStore()
  const { t } = usePreferences()

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [formErrors, setFormErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const [statusModal, setStatusModal] = useState(null)
  const lock = useRef(false)

  // Load users
  const loadUsers = async (p = page) => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: p, size: 20 })
      if (search.trim()) params.set('q', search.trim())
      if (roleFilter) params.set('role', roleFilter)
      if (statusFilter === 'enabled') params.set('enabled', 'true')
      if (statusFilter === 'disabled') params.set('enabled', 'false')
      const result = await request(`/api/admin/users?${params}`)
      setUsers(result.content || [])
      setTotalPages(result.totalPages || 1)
      setPage(result.number ?? p)
      setLoading(false)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers(0)
  }, [search, roleFilter, statusFilter])

  // Validate form
  const validateForm = () => {
    const errors = {}
    if (!/^[A-Za-z0-9_.]{3,50}$/.test(form.userName.trim()))
      errors.userName = 'Tên đăng nhập gồm 3–50 ký tự: chữ không dấu, số, dấu _ hoặc .'
    if (form.fullName.trim().length < 2 || form.fullName.trim().length > 100)
      errors.fullName = 'Họ tên phải có từ 2 đến 100 ký tự.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      errors.email = 'Vui lòng nhập email hợp lệ.'
    if (form.phone.trim() && !/^0\d{9}$/.test(form.phone.trim()))
      errors.phone = 'Số điện thoại phải gồm 10 số, bắt đầu bằng 0.'
    if (
      form.password.length < 8 ||
      !/[A-Z]/.test(form.password) ||
      !/[a-z]/.test(form.password) ||
      !/\d/.test(form.password) ||
      !/[^A-Za-z0-9\s]/.test(form.password)
    )
      errors.password = PASSWORD_HINT
    if (form.confirm !== form.password) errors.confirm = 'Mật khẩu xác nhận không khớp.'
    return errors
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (lock.current) return
    const errors = validateForm()
    setFormErrors(errors)
    if (Object.keys(errors).length) return

    lock.current = true
    setBusy(true)
    setFormError('')
    try {
      await request('/api/admin/users', {
        method: 'POST',
        body: {
          userName: form.userName.trim(),
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim() || null,
          role: form.role,
        },
      })
      setCreating(false)
      setForm({ ...EMPTY_FORM })
      setFormErrors({})
      setNotice(`Tạo tài khoản ${ROLE_LABELS[form.role]} thành công!`)
      loadUsers(0)
    } catch (err) {
      setFormError(err.message)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  const handleToggleStatus = async (user) => {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setFormError('')
    try {
      await request(`/api/admin/users/${user.id}/status`, {
        method: 'PATCH',
        body: { enabled: !user.enabled },
      })
      setStatusModal(null)
      setNotice(`Đã ${user.enabled ? 'khoá' : 'mở khoá'} tài khoản ${user.fullName}.`)
      loadUsers()
    } catch (err) {
      setFormError(err.message)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value })
    setFormErrors({ ...formErrors, [key]: '' })
  }

  const filteredUsers = users

  return (
    <div className="stack">
      <div className="section-intro">
        <span className="eyebrow">{t('QUẢN LÝ NHÂN SỰ')}</span>
        <h2>{t('Tạo và quản lý tài khoản nhân viên')}</h2>
        <p>{t('Tạo tài khoản Manager, Coach, Receptionist. Khoá/mở khoá tài khoản khi cần.')}</p>
      </div>

      {notice && (
        <div className="alert alert-success" role="status">
          {t(notice)}
        </div>
      )}

      <div className="toolbar">
        <div className="staff-filters form" style={{ flexDirection: 'row', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
          <label style={{ flex: 1, minWidth: '200px' }}>
            <input
              placeholder={t('Tìm theo tên, email, username...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label style={{ minWidth: '140px' }}>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">{t('Tất cả vai trò')}</option>
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Manager</option>
              <option value="COACH">Coach</option>
              <option value="RECEPTIONIST">Receptionist</option>
              <option value="MEMBER">Member</option>
            </select>
          </label>
          <label style={{ minWidth: '140px' }}>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">{t('Tất cả trạng thái')}</option>
              <option value="enabled">{t('Đang hoạt động')}</option>
              <option value="disabled">{t('Đã khoá')}</option>
            </select>
          </label>
        </div>
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={() => {
            setCreating(true)
            setFormError('')
            setFormErrors({})
            setForm({ ...EMPTY_FORM })
          }}
        >
          {t('+ Tạo tài khoản')}
        </button>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {t(error)}{' '}
          <button className="btn btn-sm" onClick={() => loadUsers(0)}>
            {t('Thử lại')}
          </button>
        </div>
      )}

      {loading && <p role="status">{t('Đang tải dữ liệu…')}</p>}

      <div className="card stack">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>{t('ID')}</th>
                <th>{t('Tên đăng nhập')}</th>
                <th>{t('Họ tên')}</th>
                <th>{t('Email')}</th>
                <th>{t('SĐT')}</th>
                <th>{t('Vai trò')}</th>
                <th>{t('Trạng thái')}</th>
                <th>{t('Email xác minh')}</th>
                <th>{t('Thao tác')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>#{user.id}</strong>
                  </td>
                  <td>{user.userName}</td>
                  <td>
                    <strong>{user.fullName}</strong>
                  </td>
                  <td>
                    <span className="small">{user.email}</span>
                  </td>
                  <td>{user.phone || '—'}</td>
                  <td>
                    <span
                      className={`badge ${
                        user.role === 'ADMIN'
                          ? 'badge-red'
                          : user.role === 'MANAGER'
                            ? 'badge-amber'
                            : user.role === 'COACH'
                              ? 'badge-green'
                              : user.role === 'MEMBER'
                                ? 'badge-gray'
                                : 'badge-blue'
                      }`}
                    >
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${user.enabled ? 'badge-green' : 'badge-red'}`}>
                      {t(user.enabled ? 'Hoạt động' : 'Đã khoá')}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${user.emailVerified ? 'badge-green' : 'badge-gray'}`}>
                      {t(user.emailVerified ? 'Đã xác minh' : 'Chưa xác minh')}
                    </span>
                  </td>
                  <td className="nowrap">
                    {user.role !== 'ADMIN' && (
                      <button
                        className={`btn btn-sm ${user.enabled ? 'btn-ghost' : 'btn-primary'}`}
                        disabled={busy}
                        onClick={() => {
                          setStatusModal(user)
                          setFormError('')
                        }}
                      >
                        {t(user.enabled ? 'Khoá' : 'Mở khoá')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && !filteredUsers.length && (
                <tr>
                  <td colSpan={9} className="center muted">
                    {t('Không tìm thấy tài khoản phù hợp.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button className="btn btn-sm" disabled={page === 0 || busy} onClick={() => loadUsers(page - 1)}>
              {t('← Trước')}
            </button>
            <span className="muted small">
              {t('Trang')} {page + 1} / {totalPages}
            </span>
            <button
              className="btn btn-sm"
              disabled={page >= totalPages - 1 || busy}
              onClick={() => loadUsers(page + 1)}
            >
              {t('Tiếp →')}
            </button>
          </div>
        )}
      </div>

      {/* Modal tạo tài khoản */}
      {creating && (
        <Modal title="Tạo tài khoản nhân sự" onClose={() => !busy && setCreating(false)} width={560}>
          <form className="form" onSubmit={handleCreate}>
            <fieldset className="form api-fieldset" disabled={busy}>
              <label>
                {t('Vai trò')} <span className="danger">*</span>
                <select value={form.role} onChange={set('role')}>
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="admin-role-info">
                <Icon name="shield" size={16} />
                <span>
                  {form.role === 'MANAGER'
                    ? t('Manager: Quản lý gói tập, phòng, lớp học, xem báo cáo doanh thu.')
                    : form.role === 'COACH'
                      ? t('Coach: Xem lịch dạy, quản lý buổi học được phân công.')
                      : t('Receptionist: Thu tiền tại quầy, tra cứu hội viên, quản lý hóa đơn.')}
                </span>
              </div>

              <div className="row-2">
                <label>
                  {t('Tên đăng nhập')} <span className="danger">*</span>
                  <input value={form.userName} onChange={set('userName')} placeholder="vd: coach_nguyen" required />
                  {formErrors.userName && <span className="field-error">{t(formErrors.userName)}</span>}
                </label>
                <label>
                  {t('Họ tên')} <span className="danger">*</span>
                  <input value={form.fullName} onChange={set('fullName')} placeholder="Nguyễn Văn A" required />
                  {formErrors.fullName && <span className="field-error">{t(formErrors.fullName)}</span>}
                </label>
              </div>

              <div className="row-2">
                <label>
                  {t('Email')} <span className="danger">*</span>
                  <input type="email" value={form.email} onChange={set('email')} placeholder="email@example.com" required />
                  {formErrors.email && <span className="field-error">{t(formErrors.email)}</span>}
                </label>
                <label>
                  {t('Số điện thoại')}
                  <input value={form.phone} onChange={set('phone')} placeholder="0901234567" />
                  {formErrors.phone && <span className="field-error">{t(formErrors.phone)}</span>}
                </label>
              </div>

              <div className="row-2">
                <label>
                  {t('Mật khẩu')} <span className="danger">*</span>
                  <input type="password" value={form.password} onChange={set('password')} required />
                  {formErrors.password && <span className="field-error">{t(formErrors.password)}</span>}
                </label>
                <label>
                  {t('Xác nhận mật khẩu')} <span className="danger">*</span>
                  <input type="password" value={form.confirm} onChange={set('confirm')} required />
                  {formErrors.confirm && <span className="field-error">{t(formErrors.confirm)}</span>}
                </label>
              </div>

              <p className="small muted">{t(PASSWORD_HINT)}</p>
            </fieldset>

            {formError && (
              <div className="alert alert-error" role="alert">
                {t(formError)}
              </div>
            )}

            <div className="form-actions">
              <button type="button" className="btn" disabled={busy} onClick={() => setCreating(false)}>
                {t('Hủy')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {t(busy ? 'Đang xử lý...' : 'Tạo tài khoản')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal xác nhận khoá/mở khoá */}
      {statusModal && (
        <Modal title={statusModal.enabled ? 'Khoá tài khoản' : 'Mở khoá tài khoản'} onClose={() => !busy && setStatusModal(null)}>
          <div className="stack">
            <p>
              {t(statusModal.enabled ? 'Bạn muốn khoá tài khoản này?' : 'Bạn muốn mở khoá tài khoản này?')}{' '}
              <strong>
                {statusModal.fullName} ({ROLE_LABELS[statusModal.role]})
              </strong>
            </p>
            {statusModal.enabled && (
              <div className="alert alert-info">
                {t('Tài khoản bị khoá sẽ không thể đăng nhập. Bạn có thể mở khoá lại bất cứ lúc nào.')}
              </div>
            )}
            {formError && (
              <div className="alert alert-error" role="alert">
                {t(formError)}
              </div>
            )}
            <div className="form-actions">
              <button className="btn" disabled={busy} onClick={() => setStatusModal(null)}>
                {t('Hủy')}
              </button>
              <button
                className={`btn ${statusModal.enabled ? '' : 'btn-primary'}`}
                style={statusModal.enabled ? { background: 'var(--danger)', color: '#fff', borderColor: 'var(--danger)' } : {}}
                disabled={busy}
                onClick={() => handleToggleStatus(statusModal)}
              >
                {t(busy ? 'Đang xử lý...' : statusModal.enabled ? 'Khoá tài khoản' : 'Mở khoá')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
