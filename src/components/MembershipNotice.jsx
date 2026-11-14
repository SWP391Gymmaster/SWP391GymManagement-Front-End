import { usePreferences } from '../preferences/context'
import { formatDate } from '../store/utils'
import Icon from './Icon'

export default function MembershipNotice({ status, onChoose }) {
  const { t } = usePreferences()
  if (status.status === 'unknown') return <div className="alert alert-info" role="status">{t('Chưa có thông tin thời hạn gói. Máy chủ sẽ kiểm tra điều kiện khi xác nhận đăng ký hoặc hủy buổi học.')}</div>
  if (status.status === 'active' && !status.expiringSoon) return null
  const message = status.status === 'none' ? 'Bạn cần có gói tập còn hiệu lực để đăng ký.'
    : status.status === 'expired' ? 'Gói tập đã hết hạn. Vui lòng gia hạn trước khi đăng ký.'
      : status.status === 'upcoming' ? 'Gói tập chưa có hiệu lực. Bạn chưa thể đăng ký lớp.'
        : 'Gói tập sắp hết hạn. Hãy gia hạn để không gián đoạn lịch tập.'
  return <div className={`membership-notice ${status.status === 'expired' ? 'notice-danger' : ''}`} role="status">
    <Icon name="calendar" size={24} />
    <div><strong>{t(message)}</strong>{status.membership && <p>{t(status.status === 'upcoming' ? 'Bắt đầu: ' : 'Hết hạn: ')}{formatDate(status.status === 'upcoming' ? status.membership.startDate : status.membership.endDate)}{status.status === 'active' && <> · {status.daysLeft === 0 ? t('Hết hạn hôm nay') : <>{status.daysLeft} {t('ngày còn lại')}</>}</>}</p>}</div>
    {onChoose && status.status !== 'upcoming' && <button className="btn btn-sm" onClick={onChoose}>{t(status.status === 'none' ? 'Chọn gói tập' : 'Gia hạn')}</button>}
  </div>
}
