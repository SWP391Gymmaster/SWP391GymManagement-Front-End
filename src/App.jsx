import { useCallback, useState } from 'react'
import Layout from './components/Layout'
import { useStore } from './store/context'
import MemberDataState from './components/MemberDataState'
import Unavailable from './components/Unavailable'
import PublicApp from './pages/public/PublicApp'
import ManagerDashboard from './pages/manager/Dashboard'
import Reports from './pages/manager/Reports'
import Packages from './pages/manager/Packages'
import Rooms from './pages/manager/Rooms'
import CoachSubjects from './pages/manager/CoachSubjects'
import ClassCatalog from './pages/ClassCatalog'
import ClassDetail from './pages/ClassDetail'
import { DETAIL_PAGES, menuKeyOf, readPageState, restorePage, writePageState } from './navigation/pageState'
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

const MENUS = {
  coach: [
    { key: 'dashboard', label: 'Tổng quan', icon: 'dashboard', el: CoachDashboard },
    { key: 'schedule', label: 'Lịch dạy', icon: 'schedule', el: CoachSchedule },
  ],
  admin: [
    { key: 'dashboard', label: 'Bảng điều khiển', icon: '📊', el: AdminDashboard },
    { key: 'staff', label: 'Quản lý nhân sự', icon: '👥', el: StaffManagement },
    { key: 'packages', label: 'Gói thành viên', icon: '🎫', el: AdminPackages },
    { key: 'rooms', label: 'Phòng tập', icon: '🏢', el: Rooms },
    { key: 'catalog', label: 'Danh sách lớp', icon: '🗂️', el: ClassCatalog },
    { key: 'payments', label: 'Thanh toán & Hóa đơn', icon: '🧾', el: Payments },
    { key: 'users', label: 'Accounts & verification', icon: 'users', el: AdminUsers },
  ],
  manager: [
    { key: 'dashboard', label: 'Tổng quan doanh thu', icon: '📊', el: ManagerDashboard },
    { key: 'reports', label: 'Báo cáo & Tiến độ', icon: '📈', el: Reports },
    { key: 'packages', label: 'Gói thành viên', icon: '🎫', el: Packages },
    { key: 'rooms', label: 'Phòng tập', icon: '🏢', el: Rooms },
    { key: 'catalog', label: 'Danh sách lớp', icon: '🗂️', el: ClassCatalog },
    { key: 'coach-subjects', label: 'Phân công bộ môn', icon: '🏷️', el: CoachSubjects },
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

// Trang không có mục menu riêng; chỉ mở được khi role có mục menu cha (DETAIL_PAGES trong navigation/pageState.js).
const DETAIL_ROUTES = [{ key: 'class-detail', el: ClassDetail }]
const sessionStore = () => { try { return window.sessionStorage } catch { return null } }

function RoleApp({ user, initialPage }) {
  const { loading, loadError, refresh } = useStore()
  const menu = user.role === 'member' || user.role === 'admin' ? MENUS[user.role] : [...MENUS[user.role], { key: 'profile', label: 'Hồ sơ', el: Profile }]
  const menuKeys = menu.map((m) => m.key)
  // Trang hiện tại + tham số (vd { classId }). F5 khi đang ở trang chi tiết thì quay lại đúng trang đó.
  const [nav, setNav] = useState(() => restorePage(readPageState(sessionStore()), { userId: user.id, menuKeys }) || { page: initialPage, params: {} })
  // goTo(pageKey, params): điều hướng; chỉ lưu sessionStorage cho trang chi tiết.
  const goTo = useCallback((page, params = {}) => {
    setNav({ page, params })
    writePageState(sessionStore(), DETAIL_PAGES[page] ? { page, params, userId: user.id } : null)
  }, [user.id])
  const pages = [...menu, ...DETAIL_ROUTES.filter((r) => menuKeys.includes(DETAIL_PAGES[r.key]))]
  const Page = (pages.find((m) => m.key === nav.page) || menu[0]).el
  return (
    <Layout menu={menu} page={menuKeyOf(nav.page)} setPage={goTo}>
      {loading || loadError ? <MemberDataState error={loadError} retry={refresh} /> : <Page key={`${nav.page}:${nav.params.classId ?? ''}`} goTo={goTo} params={nav.params} />}
    </Layout>
  )
}

function AuthScreens() {
  return <PublicApp />
}

export default function App() {
  const { currentUser } = useStore()

  if (!currentUser) return <AuthScreens />

  const initialPage = MENUS[currentUser.role]?.[0]?.key || 'dashboard'

  return <RoleApp key={currentUser.id} user={currentUser} initialPage={initialPage} />
}
