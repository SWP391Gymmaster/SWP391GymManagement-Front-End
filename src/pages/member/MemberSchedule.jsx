import { useState } from 'react'
import { usePreferences } from '../../preferences/context'
import { useMemberPortal } from '../../services/useMemberPortal'
import { formatDate } from '../../store/utils'
import MemberDataState from '../../components/MemberDataState'
import Icon from '../../components/Icon'

export default function MemberSchedule({ goTo }) {
  const { t } = usePreferences()
  const { data, error, retry } = useMemberPortal()
  const [tab, setTab] = useState('mine')
  const [subject, setSubject] = useState('all')
  const [date, setDate] = useState('')
  if (!data || error) return <MemberDataState error={error} retry={retry} />

  const now = new Date()
  const sessions = data.enrollments.map(e => e.session)
  const upcoming = sessions.filter(s => new Date(s.endTime) > now)
  const records = tab === 'past' ? sessions.filter(s => new Date(s.endTime) <= now) : upcoming
  const visible = records.filter(s => (subject === 'all' || s.subject === subject) && (!date || s.date === date)).sort((a, b) => a.startTime.localeCompare(b.startTime))
  const subjects = [...new Set(sessions.map(s => s.subject))]
  return <div className="stack">
    <div className="section-intro"><span className="eyebrow">{t('LỘ TRÌNH CỦA BẠN')}</span><h2>{t('Lịch học của tôi')}</h2><p>{t('Các buổi thuộc lớp bạn đã đăng ký.')}</p></div>
    <div className="card">
      <div className="member-tabs" role="group" aria-label={t('Lọc lịch tập')}>
        {[['mine', 'Sắp tới'], ['past', 'Đã qua']].map(([key, label]) => <button key={key} aria-pressed={tab === key} className={tab === key ? 'selected' : ''} onClick={() => { setTab(key); setDate(''); setSubject('all') }}>{t(label)}{key === 'mine' && <span>{upcoming.length}</span>}</button>)}
      </div>
      <div className="session-filters form"><label>{t('Bộ môn')}<select value={subject} onChange={e => setSubject(e.target.value)}><option value="all">{t('Tất cả bộ môn')}</option>{subjects.map(s => <option key={s} value={s}>{s}</option>)}</select></label><label>{t('Ngày tập')}<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label><button className="btn btn-ghost" onClick={() => { setSubject('all'); setDate('') }}>{t('Xóa bộ lọc')}</button></div>
      {!visible.length ? <div className="member-empty"><Icon name="calendar" size={36} /><h3>{t('Không có buổi học phù hợp.')}</h3><button className="btn btn-primary" onClick={() => goTo('catalog')}>{t('Khám phá lớp học')} →</button></div> : <div className="session-grid">
        {visible.map(session => <article className="session-card" key={session.id}>
          <div className="session-card-top"><span className="badge badge-green">{session.subject}</span><span className="small muted">{formatDate(session.date)}</span></div>
          <h3>{session.name}</h3><div className="session-time"><Icon name="calendar" size={17} />{session.time}</div>
          <p><Icon name="user" size={15} />{session.coachName}</p><p><Icon name="room" size={15} />{session.roomName}</p>
          {session.description && <p className="small">{session.description}</p>}
        </article>)}
      </div>}
    </div>
  </div>
}
