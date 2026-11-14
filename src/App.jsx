import { useEffect, useMemo, useState } from 'react'
import Layout from './components/Layout'
import { useStore } from './store/context'
import MemberDataState from './components/MemberDataState'
import Unavailable from './components/Unavailable'
import PublicApp from './pages/public/PublicApp'
import ManagerDashboard from './pages/manager/Dashboard'
import Reports from './pages/manager/Reports'
import Packages from './pages/manager/Packages'
import Rooms from './pages/manager/Rooms'
import ClassCatalog from './pages/ClassCatalog'
import MemberHome from './pages/member/MemberHome'
import Checkout from './pages/member/Checkout'
import MemberSchedule from './pages/member/MemberSchedule'
import Profile from './pages/member/Profile'
import CoachSchedule from './pages/coach/CoachSchedule'
import AdminUsers from './pages/admin/AdminUsers'
import CoachDashboard from './pages/coach/CoachOverview'
import Payments, { Invoices } from './pages/Payments'
import AdminDashboard from './pages/admin/AdminDashboard'
import StaffManagement from './pages/admin/StaffManagement'
import AdminPackages from './pages/admin/AdminPackages'
import { classIdFromHash } from './catalog/classRoute'

const MENUS = {
  coach: [
    { key: 'dashboard', label: 'Tổng quan', icon: 'dashboard', el: CoachDashboard },
    { key: 'schedule', label: 'Lịch dạy', icon: 'schedule', el: CoachSchedule },
  ],
  admin: [
    { key: 'dashboard', label: 'Bảng điều khiển', icon: '📊', el: AdminDashboard },
    { key: 'staff', label: 'Quản lý nhân sự', icon: '👥', el: StaffManagement },
    { key: 'packages', label: 'Gói thành viên', icon: '🎫', el: AdminPackages },
    { key: 'payments', label: 'Thanh toán & Hóa đơn', icon: '🧾', el: Payments },
    { key: 'users', label: 'Accounts & verification', icon: 'users', el: AdminUsers },
  ],
  manager: [
    { key: 'dashboard', label: 'Tổng quan doanh thu', icon: '📊', el: ManagerDashboard },
    { key: 'reports', label: 'Báo cáo & Tiến độ', icon: '📈', el: Reports },
    { key: 'packages', label: 'Gói thành viên', icon: '🎫', el: Packages },
    { key: 'rooms', label: 'Phòng tập', icon: '🏢', el: Rooms },
    { key: 'catalog', label: 'Danh sách lớp', icon: '🗂️', el: ClassCatalog },
    { key: 'payments', label: 'Thanh toán & Hóa đơn', icon: '🧾', el: Payments },
  ],
  receptionist: [
    { key: 'counter', label: 'Thanh toán tại quầy', icon: '📝', el: Payments },
    { key: 'search', label: 'Tra cứu hội viên', icon: '🔎', el: Unavailable },
    { key: 'invoices', label: 'Hóa đơn', icon: '🧾', el: Invoices },
  ],
  member: [
    { key: 'home', label: 'Trang của tôi', icon: '🏠', el: MemberHome },
    { key: 'buy', label: 'Gói tập', icon: '🎫', el: Checkout },
    { key: 'payments', label: 'Thanh toán & Hóa đơn', icon: '🧾', el: Payments },
    { key: 'catalog', label: 'Danh sách lớp', icon: '🗂️', el: ClassCatalog },
    { key: 'schedule', label: 'Lịch tập cá nhân', icon: '📅', el: MemberSchedule },
    { key: 'profile', label: 'Hồ sơ', icon: '👤', el: Profile },
  ],
}

function RoleApp({ user, initialPage }) {
  const { loading, loadError, refresh } = useStore()
  const menu = useMemo(() => user.role === 'member' || user.role === 'admin'
    ? MENUS[user.role] : [...MENUS[user.role], { key: 'profile', label: 'Hồ sơ', el: Profile }], [user.role])
  const [page, setPage] = useState(initialPage)
  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash
      if (classIdFromHash(hash) && menu.some(item => item.key === 'catalog')) setPage('catalog')
      else {
        const key = hash.slice(2)
        if (menu.some(item => item.key === key)) setPage(key)
        else {
          window.history.replaceState(null, '', `#/${menu[0].key}`)
          setPage(menu[0].key)
        }
      }
    }
    if (!(classIdFromHash(window.location.hash) && menu.some(item => item.key === 'catalog'))
      && !menu.some(item => window.location.hash === `#/${item.key}`)) {
      window.history.replaceState(null, '', `#/${initialPage}`)
    }
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync) }
  }, [initialPage, menu])
  const navigate = next => {
    if (window.location.hash !== `#/${next}`) window.history.pushState(null, '', `#/${next}`)
    setPage(next)
  }
  const Page = (menu.find((m) => m.key === page) || menu[0]).el
  return (
    <Layout menu={menu} page={page} setPage={navigate}>
      {loading || loadError ? <MemberDataState error={loadError} retry={refresh} /> : <Page goTo={navigate} />}
    </Layout>
  )
}

function AuthScreens() {
  useEffect(() => {
    const ensurePublicRoute = () => {
      const route = window.location.hash.split('?')[0]
      if (route && !['#/home', '#/login', '#/register', '#/verify-email', '#/payment-result'].includes(route)) {
        window.location.hash = '#/login'
      }
    }
    ensurePublicRoute()
    window.addEventListener('hashchange', ensurePublicRoute)
    return () => window.removeEventListener('hashchange', ensurePublicRoute)
  }, [])
  return <PublicApp />
}

export default function App() {
  const { currentUser } = useStore()

  if (!currentUser) return <AuthScreens />

  const initialPage = currentUser.role === 'member' && new URLSearchParams(window.location.search).has('payos')
    ? 'buy' : classIdFromHash(window.location.hash) && MENUS[currentUser.role]?.some(item => item.key === 'catalog')
      ? 'catalog' : MENUS[currentUser.role]?.find(item => window.location.hash === `#/${item.key}`)?.key
        || (window.location.hash === '#/profile' && !['member', 'admin'].includes(currentUser.role) ? 'profile' : null)
        || MENUS[currentUser.role]?.[0]?.key || 'dashboard'

  return <RoleApp key={currentUser.id} user={currentUser} initialPage={initialPage} />
}
