import { usePreferences } from '../../preferences/context'
import { useMemberPortal } from '../../services/useMemberPortal'
import { useState } from 'react'
import MemberDataState from '../../components/MemberDataState'
import MembershipNotice from '../../components/MembershipNotice'
import Icon from '../../components/Icon'
import { formatDate } from '../../store/utils'
import { SUBJECTS } from '../../data/seed'

const subjectLabel = code => SUBJECTS.find(subject => subject.toUpperCase().replaceAll(' ', '_') === code) || code

export default function MemberHome({ goTo }) {
  const { t } = usePreferences()
  const { data, error, retry, memberService } = useMemberPortal()
  const [noticeError, setNoticeError] = useState('')
  const [reading, setReading] = useState(null)
  const readNotice = async scheduleId => {
    setReading(scheduleId)
    setNoticeError('')
    try { await memberService.markAttendanceRead(scheduleId) }
    catch (e) { setNoticeError(e.message) }
    finally { setReading(null) }
  }

  if (!data || error) {
    return <MemberDataState error={error} retry={retry} />
  }

  const { user, enrollments, status, memberships, packages, attendance = [] } = data
  const upcoming = [...enrollments]
    .filter((e) => new Date(e.session.endTime) > new Date())
    .sort((a, b) => a.session.startTime.localeCompare(b.session.startTime))

  const getMembershipBadgeText = (membership) => {
    if (membership.active) return t('Đang có hiệu lực')
    const today = new Date().toLocaleDateString('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
    })
    return t(membership.startDate > today ? 'Chưa có hiệu lực' : 'Đã hết hạn')
  }

  return (
    <div className="stack">
      <div className="membership-card">
        <div>
          <div className="muted small">{t('Hội viên')}</div>
          <h2>{user.name}</h2>
          <div className="small">{user.email}</div>
        </div>

        <div className="right">
          <span className="badge">{t('Lịch của tôi')}</span>
          <strong>
            {upcoming.length} {t('Buổi học sắp tới')}
          </strong>
        </div>
      </div>

      <MembershipNotice status={status} />

      <section className="card stack" aria-label="Thông báo điểm danh"><h3>Thông báo điểm danh ({attendance.filter(item => !item.read).length} chưa xem)</h3>
        {noticeError && <div className="alert alert-error" role="alert">{noticeError}</div>}
        {!attendance.length && <p className="muted small">Chưa có thông báo điểm danh.</p>}
        {attendance.map(item => <div className="summary" key={item.scheduleId}><strong>{item.className} · {formatDate(item.startTime)}</strong><span>{item.present ? 'Có mặt' : 'Vắng mặt'} · Ghi nhận {formatDate(item.markedAt)}</span>{!item.read && <button className="btn btn-sm" disabled={reading != null} onClick={() => readNotice(item.scheduleId)}>{reading === item.scheduleId ? 'Đang lưu...' : 'Đánh dấu đã xem'}</button>}</div>)}
      </section>

      <div className="two-col wide-left">
        <section className="card">
          <div className="toolbar card-head">
            <h3>{t('Buổi học sắp tới')}</h3>
            <button className="link small" onClick={() => goTo('schedule')}>
              {t('Xem tất cả')} →
            </button>
          </div>

          {!upcoming.length ? (
            <div className="member-empty">
              <Icon name="calendar" size={32} />
              <p>{t('Bạn chưa có buổi học nào sắp tới.')}</p>
              <button className="btn" onClick={() => goTo('catalog')}>
                {t('Khám phá lớp học')}
              </button>
            </div>
          ) : (
            upcoming.slice(0, 3).map(({ id, session }) => (
              <div className="upcoming-row" key={id}>
                <div className="session-date">
                  <strong>{session.date.slice(8)}</strong>
                  <span>
                    {session.date.slice(5, 7)} / {session.date.slice(0, 4)}
                  </span>
                </div>

                <div>
                  <strong>{session.name}</strong>
                  <p>
                    {session.time} · {session.roomName}
                  </p>
                  <span className="small muted">{session.coachName}</span>
                </div>
              </div>
            ))
          )}
        </section>

        <section className="card stack">
          <h3>{t('Gói tập của tôi')}</h3>

          {!memberships.length && (
            <p className="muted small">{t('Bạn chưa có gói tập đã kích hoạt.')}</p>
          )}
          {/* Hiển thị danh sách các gói tập của người dùng */}
          {memberships.map((membership) => (
            <div className="summary" key={membership.id}>
              <h4>{membership.packageName}</h4>
              <p>
                {formatDate(membership.startDate)} – {formatDate(membership.endDate)}
              </p>
              <span className="badge">{getMembershipBadgeText(membership)}</span>
              <p>{membership.active ? 'Bộ môn có thể tham gia' : 'Bộ môn trong gói'}: {(packages.find(pkg => Number(pkg.id) === Number(membership.packageId))?.allowedSubjects || []).map(subjectLabel).join(', ') || 'Chưa xác định'}</p>

              {membership.active && (
                <p>
                  {membership.daysRemaining} {t('ngày còn lại')} · {t('Bao gồm hôm nay')}
                </p>
              )}
            </div>
          ))}

          <button className="btn btn-primary" onClick={() => goTo('buy')}>
            {t('Xem các gói tập')}
          </button>
          <button className="btn" onClick={() => goTo('payments')}>
            {t('Thanh toán & Hóa đơn')}
          </button>
        </section>
      </div>
    </div>
  )
}

