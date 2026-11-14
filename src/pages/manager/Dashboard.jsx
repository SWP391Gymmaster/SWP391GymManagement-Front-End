import { usePreferences } from '../../preferences/context'
import { useStore } from '../../store/context'
import Icon from '../../components/Icon'
import { useEffect, useState } from 'react'

export default function Dashboard({ goTo }) {
  const { t } = usePreferences()
  const { users, classes, packages, rooms, schedules, refresh, api } = useStore()
  const [health, setHealth] = useState('Đang kiểm tra kết nối…')
  useEffect(() => { let active = true; api.health().then(value => { if (active) setHealth(value) }).catch(error => { if (active) setHealth(error.message) }); return () => { active = false } }, [api])
  const stats = [['ticket', 'Gói thành viên', packages.length], ['room', 'Phòng tập', rooms.length], ['calendar', 'Buổi học theo ngày', schedules.length], ['users', 'Huấn luyện viên', users.filter(u => u.role === 'coach').length]]
  return <div className="stack"><div className="dashboard-banner"><div><span className="eyebrow">{t('TỔNG QUAN HOẠT ĐỘNG')}</span><h3>{t('Tập trung vào điều quan trọng.')}</h3><p>{t('Dữ liệu được tải từ máy chủ.')}</p></div><button className="btn" onClick={refresh}>{t('Tải lại dữ liệu')}</button></div>
    <div className="stats">{stats.map(([icon, label, count]) => <div className="stat" key={label}><div className="stat-icon"><Icon name={icon} /></div><span>{t(label)}</span><strong>{count}</strong></div>)}</div>
    <div className="card"><div className="card-head"><h3>{t('Thao tác nhanh')}</h3></div><div className="quick"><button className="btn" onClick={() => goTo('packages')}>{t('+ Tạo gói thành viên')}</button><button className="btn" onClick={() => goTo('rooms')}>{t('+ Thêm phòng tập')}</button><button className="btn btn-primary" onClick={() => goTo('catalog')}>{t('Lớp học')} ({classes.length})</button></div></div>
    <div className="alert alert-info">{t('Báo cáo doanh thu và thống kê hội viên chưa khả dụng.')}</div>
    <div className="small muted" role="status">{t('Kiểm tra kết nối Back-End')}: {health}</div>
  </div>
}
