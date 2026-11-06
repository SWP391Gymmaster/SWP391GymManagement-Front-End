import { useState } from 'react'
import BarChart from '../../components/BarChart'
import { Delta, ShareList } from '../../components/Revenue'
import { ErrorBox, Loading } from '../../components/Status'
import { classApi, coachApi, paymentApi, scheduleApi } from '../../api/services'
import useApi from '../../api/useApi'
import { isUnscheduled } from '../../validation/sessionPattern'
import {
  addMonths,
  completedPayments,
  daysInMonth,
  downloadCsv,
  formatDate,
  formatDateTime,
  formatMoney,
  formatTime,
  groupSum,
  monthLabel,
  nowVN,
  PAYMENT_METHOD,
  printSection,
  sessionHours,
  sumAmount,
  vnDate,
  vnDateTime,
  vnMonth,
} from '../../store/utils'

const fmtHours = (h) => h.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

export default function Reports() {
  const [tab, setTab] = useState('revenue')
  const [month, setMonth] = useState(() => nowVN().slice(0, 7))

  return (
    <div className="stack">
      <div className="toolbar no-print">
        <div className="tabs">
          <button className={'tab' + (tab === 'revenue' ? ' on' : '')} onClick={() => setTab('revenue')}>Doanh thu theo tháng</button>
          <button className={'tab' + (tab === 'progress' ? ' on' : '')} onClick={() => setTab('progress')}>Tiến độ lớp & Coach</button>
        </div>
        <div className="filters">
          <button className="btn btn-sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Tháng trước">←</button>
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          <button className="btn btn-sm" onClick={() => setMonth(addMonths(month, 1))} aria-label="Tháng sau">→</button>
        </div>
      </div>
      {tab === 'revenue' ? <RevenueReport month={month} /> : <ProgressReport month={month} />}
    </div>
  )
}

// ================= BÁO CÁO DOANH THU THÁNG =================
function RevenueReport({ month }) {
  const { data: payments, loading, error, reload } = useApi(() => paymentApi.list())
  if (loading && !payments) return <Loading />
  if (!payments) return <ErrorBox error={error} onRetry={reload} />

  const done = completedPayments(payments)
  const list = done
    .filter((p) => vnMonth(p.completedAt) === month)
    .sort((a, b) => String(a.completedAt).localeCompare(String(b.completedAt)))
  const total = sumAmount(list)
  const prevTotal = sumAmount(done.filter((p) => vnMonth(p.completedAt) === addMonths(month, -1)))
  const members = new Set(list.map((p) => p.memberId)).size
  const notCollected = payments.filter((p) => p.status !== 'COMPLETED' && vnMonth(p.createdAt) === month)

  const n = daysInMonth(month)
  const byDay = groupSum(list, (p) => vnDate(p.completedAt))
  const chart = Array.from({ length: n }, (_, i) => {
    const d = `${month}-${String(i + 1).padStart(2, '0')}`
    const v = byDay.find((x) => x.key === d)
    return { key: d, label: String(i + 1), value: v?.amount || 0, title: `${formatDate(d)}: ${formatMoney(v?.amount || 0)} (${v?.count || 0} giao dịch)` }
  })
  const best = [...byDay].sort((a, b) => b.amount - a.amount)[0]
  const byPackage = groupSum(list, (p) => p.packageName)
  const byMethod = groupSum(list, (p) => p.paymentMethod)

  const exportCsv = () =>
    downloadCsv(`bao-cao-doanh-thu-${month}.csv`, [
      [`Báo cáo doanh thu thực thu ${monthLabel(month)}`],
      [],
      ['Thời điểm thu', 'Mã hóa đơn', 'Mã giao dịch', 'Hội viên', 'Gói tập', 'Hình thức', 'Số tiền (VNĐ)'],
      ...list.map((p) => [
        vnDateTime(p.completedAt).replace('T', ' '),
        p.invoiceCode,
        p.paymentCode,
        p.memberName,
        p.packageName,
        PAYMENT_METHOD[p.paymentMethod] || p.paymentMethod,
        p.amount,
      ]),
      [],
      ['Tổng cộng', '', '', '', '', `${list.length} giao dịch`, total],
    ])

  return (
    <div className="stack report">
      <div className="report-head">
        <div>
          <h2>Báo cáo doanh thu {monthLabel(month)}</h2>
          <div className="muted small">Chỉ tính tiền đã thực thu · Lập lúc {formatDateTime(new Date())}</div>
        </div>
        <div className="no-print quick">
          <button className="btn" onClick={exportCsv} disabled={!list.length}>Xuất CSV (Excel)</button>
          <button className="btn btn-primary" onClick={() => printSection('report')}>In báo cáo</button>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><span>Tổng thực thu</span><strong>{formatMoney(total)}</strong><Delta cur={total} prev={prevTotal} /></div>
        <div className="stat"><span>Số giao dịch</span><strong>{list.length}</strong><em>{members} hội viên thanh toán</em></div>
        <div className="stat"><span>Trung bình / giao dịch</span><strong>{formatMoney(list.length ? Math.round(total / list.length) : 0)}</strong><em>Tháng trước: {formatMoney(prevTotal)}</em></div>
        <div className="stat"><span>Ngày thu cao nhất</span><strong>{best ? formatDate(best.key).slice(0, 5) : '—'}</strong><em>{best ? formatMoney(best.amount) : 'Chưa có khoản thu'}</em></div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Doanh thu theo ngày</h3></div>
        <BarChart data={chart} labelEvery={n > 20 ? 3 : 1} emptyText="Tháng này chưa có khoản thu nào" />
      </div>

      <div className="two-col even">
        <div className="card">
          <div className="card-head"><h3>Theo gói tập</h3></div>
          <ShareList items={byPackage} total={total} />
        </div>
        <div className="card">
          <div className="card-head"><h3>Theo hình thức thanh toán</h3></div>
          <ShareList items={byMethod} total={total} labelOf={(k) => PAYMENT_METHOD[k] || k} />
        </div>
      </div>

      <div className="card">
        <div className="card-head row-between">
          <h3>Chi tiết các khoản thu ({list.length})</h3>
          {notCollected.length > 0 && (
            <span className="muted small">Không tính {notCollected.length} đơn chưa thu / đã hủy, tổng {formatMoney(sumAmount(notCollected))}</span>
          )}
        </div>
        <table className="table">
          <thead><tr><th>Thời điểm thu</th><th>Mã hóa đơn</th><th>Hội viên</th><th>Gói</th><th>Hình thức</th><th className="right">Số tiền</th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.paymentId}>
                <td>{formatDateTime(p.completedAt)}</td>
                <td className="mono">{p.invoiceCode}</td>
                <td>{p.memberName}</td>
                <td>{p.packageName}</td>
                <td>{PAYMENT_METHOD[p.paymentMethod] || p.paymentMethod}</td>
                <td className="right">{formatMoney(p.amount)}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan="6" className="center muted">Không có khoản thu trong {monthLabel(month).toLowerCase()}</td></tr>}
          </tbody>
          {list.length > 0 && (
            <tfoot>
              <tr><td colSpan="5"><strong>Tổng cộng</strong></td><td className="right"><strong>{formatMoney(total)}</strong></td></tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

// ================= TIẾN ĐỘ LỚP & COACH =================
function ProgressReport({ month }) {
  const { data, loading, error, reload } = useApi(() =>
    Promise.all([classApi.list(), scheduleApi.list(), coachApi.list()]).then(([classes, schedules, coaches]) => ({ classes, schedules, coaches })),
  )
  if (loading && !data) return <Loading />
  if (!data) return <ErrorBox error={error} onRetry={reload} />

  const now = nowVN()
  // Buổi chưa xếp giờ (FEATURES.sessionPattern, startTime === endTime) không tính là đã diễn ra / đã bắt đầu;
  // nếu ngày đó đã qua mà vẫn chưa xếp giờ thì cũng không còn là buổi sắp tới.
  const today = now.slice(0, 10)
  const isDone = (s) => !isUnscheduled(s) && s.endTime <= now
  const isStarted = (s) => !isUnscheduled(s) && s.startTime <= now
  const isUpcoming = (s) => (isUnscheduled(s) ? s.startTime.slice(0, 10) >= today : s.endTime > now)
  const coachName = (id) => data.coaches.find((c) => c.id === id)?.fullName || (id ? 'Coach #' + id : '—')

  const classRows = data.classes.map((c) => {
    const own = data.schedules.filter((s) => s.classId === c.id).sort((a, b) => a.startTime.localeCompare(b.startTime))
    const doneCount = own.filter(isDone).length
    const pct = own.length ? Math.round((doneCount / own.length) * 100) : 0
    const state = !own.length ? 'empty' : doneCount === own.length ? 'finished' : own.some(isStarted) ? 'running' : 'notstarted'
    return { c, own, doneCount, pct, state }
  })
  const STATE = {
    empty: { label: 'Chưa xếp lịch', badge: 'badge-gray' },
    notstarted: { label: 'Chưa bắt đầu', badge: 'badge-amber' },
    running: { label: 'Đang diễn ra', badge: 'badge-green' },
    finished: { label: 'Đã kết thúc', badge: 'badge-gray' },
  }

  // ---- Tiến độ Coach trong tháng đã chọn ----
  const coachRows = data.coaches.map((co) => {
    const own = data.schedules.filter((s) => s.coachId === co.id)
    const inMonth = own.filter((s) => s.startTime.slice(0, 7) === month)
    const doneInMonth = inMonth.filter(isDone)
    const upcoming = own.filter(isUpcoming).sort((a, b) => a.startTime.localeCompare(b.startTime))
    return {
      co,
      classes: new Set(own.map((s) => s.classId)).size,
      inMonth: inMonth.length,
      doneInMonth: doneInMonth.length,
      hours: doneInMonth.reduce((h, s) => h + sessionHours(s), 0),
      plannedHours: inMonth.reduce((h, s) => h + sessionHours(s), 0),
      upcoming,
    }
  })

  const exportCsv = () =>
    downloadCsv(`tien-do-${month}.csv`, [
      ['Tiến độ lớp học'],
      ['Lớp', 'Bộ môn', 'Coach', 'Tổng buổi', 'Đã diễn ra', 'Còn lại', 'Tiến độ (%)', 'Bắt đầu', 'Kết thúc'],
      ...classRows.map(({ c, own, doneCount, pct }) => [
        c.name, c.subject, coachName(c.coachId), own.length, doneCount, own.length - doneCount, pct,
        own[0] ? formatDate(own[0].startTime) : '', own.length ? formatDate(own[own.length - 1].startTime) : '',
      ]),
      [],
      [`Tiến độ Coach ${monthLabel(month)}`],
      ['Coach', 'Số lớp', 'Buổi trong tháng', 'Buổi đã dạy', 'Giờ đã dạy', 'Giờ theo lịch', 'Buổi sắp tới'],
      ...coachRows.map((r) => [r.co.fullName, r.classes, r.inMonth, r.doneInMonth, fmtHours(r.hours), fmtHours(r.plannedHours), r.upcoming.length]),
    ])

  return (
    <div className="stack report">
      <div className="report-head">
        <div>
          <h2>Tiến độ lớp học & Coach</h2>
          <div className="muted small">Tính theo lịch đã xếp · Cập nhật lúc {formatDateTime(new Date())}</div>
        </div>
        <div className="no-print quick">
          <button className="btn" onClick={exportCsv}>Xuất CSV (Excel)</button>
          <button className="btn btn-primary" onClick={() => printSection('report')}>In báo cáo</button>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Tiến độ lớp học ({classRows.length})</h3></div>
        <table className="table">
          <thead><tr><th>Lớp</th><th>Coach</th><th>Thời gian</th><th>Buổi</th><th style={{ width: '24%' }}>Tiến độ</th><th>Trạng thái</th><th>Sĩ số</th></tr></thead>
          <tbody>
            {classRows.map(({ c, own, doneCount, pct, state }) => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong><div className="small muted">{c.subject}</div></td>
                <td>{coachName(c.coachId)}</td>
                <td className="nowrap">{own.length ? `${formatDate(own[0].startTime)} → ${formatDate(own[own.length - 1].startTime)}` : '—'}</td>
                <td className="nowrap">{doneCount}/{own.length}<div className="small muted">còn {own.length - doneCount} buổi</div></td>
                <td>
                  <div className="progress"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
                  <span className="small muted">{pct}%</span>
                </td>
                <td><span className={'badge ' + STATE[state].badge}>{STATE[state].label}</span></td>
                <td><span className="muted" title="Chờ Back-End có API sĩ số (G4)">— / {c.capacity ?? '—'}</span></td>
              </tr>
            ))}
            {classRows.length === 0 && <tr><td colSpan="7" className="center muted">Chưa có lớp nào</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-head"><h3>Tiến độ Coach · {monthLabel(month)}</h3></div>
        <table className="table">
          <thead><tr><th>Coach</th><th>Lớp phụ trách</th><th>Buổi đã dạy / theo lịch</th><th>Giờ đã dạy</th><th>Buổi sắp tới</th><th>Buổi kế tiếp</th></tr></thead>
          <tbody>
            {coachRows.map((r) => (
              <tr key={r.co.id}>
                <td><strong>{r.co.fullName}</strong><div className="small muted">{r.co.email}</div></td>
                <td>{r.classes}</td>
                <td>{r.doneInMonth}/{r.inMonth}</td>
                <td>{fmtHours(r.hours)} / {fmtHours(r.plannedHours)} giờ</td>
                <td>{r.upcoming.length}</td>
                <td className="nowrap">{r.upcoming[0] ? `${formatDate(r.upcoming[0].startTime)} ${isUnscheduled(r.upcoming[0]) ? '(chưa xếp giờ)' : formatTime(r.upcoming[0].startTime)}` : '—'}</td>
              </tr>
            ))}
            {coachRows.length === 0 && <tr><td colSpan="6" className="center muted">Chưa có Coach nào</td></tr>}
          </tbody>
        </table>
      </div>

      <p className="small muted">
        Sĩ số đăng ký và điểm danh từng buổi sẽ được bổ sung khi Back-End có API tương ứng (G4, G5 trong kế hoạch).
      </p>
    </div>
  )
}
