// Lấy dữ liệu cho trang Danh sách lớp / Chi tiết lớp rồi gọi render(data).
import { useStore } from '../../store/context'
import { useMemberPortal } from '../../services/useMemberPortal'
import MemberDataState from '../../components/MemberDataState'

// Dữ liệu hội viên (buổi còn chỗ, buổi đã đăng ký, sĩ số lớp, gói tập). Role khác: không có số chỗ (available = null).
function MemberData({ render }) {
  const { data, error, retry } = useMemberPortal()
  if (!data || error) return <MemberDataState error={error} retry={retry} />
  return render({ available: data.sessions, enrolledIds: data.enrollments.map(e => Number(e.sessionId)), classStats: data.classStats, membership: data.status })
}
export default function CatalogData({ render }) {
  const { currentUser } = useStore()
  return currentUser.role === 'member' ? <MemberData render={render} /> : render({ available: null, enrolledIds: [], classStats: null, membership: null })
}

