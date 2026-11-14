import { useStore } from '../../store/context'
import { usePreferences } from '../../preferences/context'
import { useRef, useState } from 'react'
import Modal from '../../components/Modal'
import { formatMoney } from '../../store/utils'

const paymentOptions = [
  ['BANK_TRANSFER', 'Chuyển khoản'],
  ['VNPAY', 'VNPay'],
  ['MOMO', 'MoMo'],
  ['CREDIT_CARD', 'Thẻ tín dụng'],
]

export default function BuyPackage({ goTo }) {
  const { packages, paymentService } = useStore()
  const { t } = usePreferences()

  const [selected, setSelected] = useState(null)
  const [method, setMethod] = useState('BANK_TRANSFER')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)

  const activePackages = packages.filter((p) => p.active)

  async function checkout(event) {
    event.preventDefault()
    if (lock.current) return

    lock.current = true
    setBusy(true)
    setError('')

    try {
      if (method === 'VNPAY') {
        const paymentUrl = await paymentService.createVnpayUrl({ packageId: selected.id, orderInfo: note })
        window.location.assign(paymentUrl)
        return
      }
      await paymentService.checkout({
        packageId: selected.id,
        paymentMethod: method,
        note,
      })
      goTo('payments')
    } catch (e) {
      setError(e.message)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  const handleSelectPackage = (pkg) => {
    setSelected(pkg)
    setError('')
    setNote('')
  }

  return (
    <div className="stack">
      <div className="section-intro">
        <span className="eyebrow">{t('ĐẦU TƯ CHO CHÍNH BẠN')}</span>
        <h2>{t('Một gói tập. Nhiều khởi đầu mới.')}</h2>
        <p>{t('So sánh thời hạn và quyền lợi để tìm gói tập phù hợp với bạn.')}</p>
      </div>

      <div className="alert alert-info">
        {t('Gói có hiệu lực sau khi thanh toán được xác nhận. Ngày bắt đầu và kết thúc dự kiến được hiển thị trước khi thanh toán.')}
      </div>

      <div className="grid-cards">
        {activePackages.map((pkg) => (
          <article className="pkg-card" key={pkg.id}>
            <h3>{pkg.name}</h3>
            <div className="pkg-price">{formatMoney(pkg.price)}</div>
            <div className="muted small">
              {pkg.days} {t('ngày')}
            </div>
            <p>{pkg.description}</p>
            <p className="muted small">Bộ môn: {(pkg.allowedSubjects || []).join(', ') || 'Chưa xác định'}</p>
            <button
              className="btn btn-primary full"
              onClick={() => handleSelectPackage(pkg)}
            >
              {t('Chọn gói tập')}
            </button>
          </article>
        ))}

        {!activePackages.length && (
          <div className="card member-empty">
            {t('Chưa có gói tập đang mở bán.')}
          </div>
        )}
      </div>

      <button className="btn" onClick={() => goTo('payments')}>
        {t('Thanh toán & Hóa đơn')}
      </button>

      {selected && (
        <Modal
          title="Xác nhận chọn gói"
          onClose={() => {
            if (!busy) setSelected(null)
          }}
        >
          <form className="form stack" onSubmit={checkout}>
            <h3>
              {selected.name} · {formatMoney(selected.price)}
            </h3>

            <label>
              {t('Phương thức thanh toán')}
              <select value={method} disabled={busy} onChange={(e) => setMethod(e.target.value)}>
                {paymentOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              {t('Ghi chú')}
              <textarea
                value={note}
                disabled={busy}
                maxLength={500}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>

            <p className="small muted">
              {method === 'VNPAY' ? t('Bạn sẽ được chuyển sang cổng VNPay Sandbox để thanh toán.') : t('Tạo yêu cầu chưa trừ tiền và chưa kích hoạt gói. Phương thức này hiện hỗ trợ mô phỏng.')}
            </p>

            {error && (
              <div className="alert alert-error" role="alert">
                {t(error)}
              </div>
            )}

            <button className="btn btn-primary" disabled={busy}>
              {t(busy ? 'Đang xử lý...' : 'Tạo yêu cầu thanh toán')}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

