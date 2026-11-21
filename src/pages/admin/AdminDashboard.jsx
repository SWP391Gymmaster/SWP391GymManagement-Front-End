import { useEffect, useState } from 'react'
import { usePreferences } from '../../preferences/context'
import { useStore } from '../../store/context'
import Icon from '../../components/Icon'
import './admin-ui.css'

const ROLES = [
  ['MANAGER', '🛡️', 'Manager'],
  ['COACH', '🏋️', 'Coach'],
  ['RECEPTIONIST', '📝', 'Receptionist'],
  ['MEMBER', '👤', 'Member'],
]

export default function AdminDashboard({ goTo }) {
  const { t } = usePreferences()
  const { api, classes, packages, rooms, refresh } = useStore()
  const [attempt, setAttempt] = useState(0)
  const [counts, setCounts] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all(['', ...ROLES.map(([role]) => role)].map((role) => api.adminUsers.list({ size: 1, role })))
      .then((pages) => {
        if (active) {
          setCounts(pages.map((page) => page.totalElements))
          setError('')
        }
      })
      .catch((err) => { if (active) setError(err.message) })
    return () => { active = false }
  }, [api, attempt])

  const reload = () => { void refresh(); setAttempt((n) => n + 1) }
  const total = counts?.[0] ?? '…'
  const stats = [
    ['users', 'Tài khoản quản lý', total],
    ['ticket', 'Gói thành viên', packages.length],
    ['room', 'Phòng tập', rooms.length],
    ['calendar', 'Lớp học', classes.length],
  ]

  return (
    <div className="stack admin-page admin-dashboard">
      <div className="dashboard-banner">
        <div>
          <span className="eyebrow">{t('BẢNG ĐIỀU KHIỂN ADMIN')}</span>
          <h3>{t('Quản lý hệ thống trung tâm thể thao')}</h3>
          <p>{t('Tạo tài khoản nhân sự, quản lý gói tập và theo dõi hoạt động.')}</p>
        </div>
        <button className="btn" onClick={reload}>{t('Tải lại dữ liệu')}</button>
      </div>

      <div className="stats">
        {stats.map(([icon, label, count]) => (
          <div className="stat" key={label}>
            <div className="stat-icon"><Icon name={icon} /></div>
            <span>{t(label)}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </div>

      {error && <div className="alert alert-error" role="alert">{t('Không tải được thống kê tài khoản')}: {error} <button className="btn" onClick={() => setAttempt((n) => n + 1)}>{t('Thử lại')}</button></div>}
      <div className="admin-grid">
        <div className="card stack">
          <div className="card-head"><h3>{t('Phân bố tài khoản theo vai trò')}</h3></div>
          <div className="role-summary">
            {ROLES.map(([role, emoji, label], index) => {
              const count = counts?.[index + 1] ?? '…'
              return (
                <div className="role-summary-item" key={role}>
                  <span className="role-emoji">{emoji}</span>
                  <div><strong>{count}</strong><span>{t(label)}</span></div>
                  <div className="role-bar-track">
                    <div className="role-bar-fill" style={{ width: `${counts?.[0] ? (count / counts[0]) * 100 : 0}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card stack">
          <div className="card-head"><h3>{t('Thao tác nhanh')}</h3></div>
          <div className="quick">
            <button className="btn btn-primary" onClick={() => goTo('staff')}>{t('+ Tạo tài khoản nhân sự')}</button>
            <button className="btn" onClick={() => goTo('packages')}>{t('Quản lý gói tập')}</button>
            <button className="btn" onClick={() => goTo('payments')}>{t('Thanh toán & Hóa đơn')}</button>
          </div>
          <div className="admin-info-cards">
            <div className="admin-info-card"><Icon name="shield" size={18} /><div><strong>{t('Phân quyền')}</strong><p>{t('Admin có toàn quyền quản lý tài khoản và cấu hình hệ thống.')}</p></div></div>
            <div className="admin-info-card"><Icon name="users" size={18} /><div><strong>{t('Tạo tài khoản')}</strong><p>{t('Chỉ Admin mới có quyền tạo tài khoản Manager, Coach, Receptionist.')}</p></div></div>
          </div>
        </div>
      </div>

      <div className="alert alert-info">{t('Lưu ý: Admin chỉ nên tạo tài khoản nhân sự (Manager, Coach, Receptionist). Hội viên tự đăng ký qua trang công khai.')}</div>
    </div>
  )
}
