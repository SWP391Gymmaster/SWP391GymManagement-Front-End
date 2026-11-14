import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../../store/context'
import { usePreferences } from '../../preferences/context'
import { formatMoney } from '../../store/utils'

const PAYMENT_METHODS = [{ value: 'PAYOS', label: 'PayOS', icon: '💳' }]

/**
 * T3.4: Trang Checkout đầy đủ
 * - Chọn gói → chọn phương thức → xác nhận → kết quả
 * - Trang kết quả: thành công / thất bại / huỷ
 * - Chuyển đến lịch sử giao dịch
 */
export default function Checkout({ goTo }) {
  const { packages, paymentService, api, memberRevision } = useStore()
  const { t } = usePreferences()

  const returnQuery = new URLSearchParams(window.location.search)
  const returnId = Number(returnQuery.get('paymentId'))
  const returnPaymentId = returnQuery.has('payos') && Number.isSafeInteger(returnId) && returnId > 0 ? returnId : null
  const [step, setStep] = useState(returnPaymentId ? 'result' : 'select') // select | method | confirm | result
  const [selected, setSelected] = useState(null)
  const [quote, setQuote] = useState(null)
  const [method, setMethod] = useState('PAYOS')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(returnPaymentId ? { status: 'pending', paymentId: returnPaymentId } : null) // { status: 'success' | 'failed' | 'cancelled' }
  const [checking, setChecking] = useState(Boolean(returnPaymentId))
  const [ownedResult, setOwnedResult] = useState(null)
  const [ownedAttempt, setOwnedAttempt] = useState(0)
  const lock = useRef(false)

  const activePackages = packages.filter((p) => p.active)
  const ownedReady = ownedResult?.revision === memberRevision && ownedResult.attempt === ownedAttempt && !ownedResult.error
  const ownedPackageIds = new Set(ownedReady ? ownedResult.data.map(m => Number(m.packageId)) : [])

  useEffect(() => {
    let active = true
    api.myMemberships().then(
      data => { if (active) setOwnedResult({ data, revision: memberRevision, attempt: ownedAttempt }) },
      e => { if (active) setOwnedResult({ error: e.message, revision: memberRevision, attempt: ownedAttempt }) },
    )
    return () => { active = false }
  }, [api, memberRevision, ownedAttempt])

  const handleSelectPackage = async (pkg) => {
    if (!ownedReady || ownedPackageIds.has(Number(pkg.id))) return
    setSelected(pkg)
    setQuote(null)
    setError('')
    setNote('')
    setStep('method')
    try {
      setQuote(await paymentService.getMembershipQuote(pkg.id))
    } catch (e) {
      setError(e.message)
    }
  }

  const handleConfirm = () => {
    setStep('confirm')
    setError('')
  }

  const checkPayment = useCallback(async paymentId => {
    setChecking(true)
    let syncError = ''
    try { await paymentService.reconcilePayosPayment(paymentId) }
    catch (e) { syncError = e.message }
    try {
      const payment = await paymentService.getPayment(paymentId)
      setResult({ ...payment, status: payment.status.toLowerCase(), paymentId, message: syncError })
      return payment.status
    } catch (e) {
      setResult({ status: 'failed', message: e.message, paymentId })
      return 'ERROR'
    } finally { setChecking(false) }
  }, [paymentService])

  useEffect(() => {
    if (!returnPaymentId) return
    let active = true
    let timer
    let attempts = 0
    const check = async () => {
      const status = await checkPayment(returnPaymentId)
      if (active && status === 'PENDING' && ++attempts < 6) timer = setTimeout(check, 2000)
    }
    void check()
    return () => {
      active = false
      clearTimeout(timer)
      if (window.location.hash !== '#/buy')
        window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`)
    }
  }, [checkPayment, returnPaymentId])
  const openPayos = async createLink => {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const link = await createLink()
      if (!link?.paymentUrl || !link?.paymentId) throw new Error('PayOS did not return a checkout link')
      window.location.assign(link.paymentUrl)
    } catch (e) {
      setError(e.message)
      lock.current = false
      setBusy(false)
    }
  }
  const handleCheckout = () => {
    if (quote && ownedReady && !ownedPackageIds.has(Number(selected.id)))
      void openPayos(() => paymentService.createPayosLink({ packageId: selected.id, note }))
  }
  const handleRetry = () => void openPayos(() => paymentService.retryPayosPayment(result.paymentId))
  const leaveResult = page => {
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`)
    if (page === 'select') { setStep('select'); setResult(null) }
    else goTo(page)
  }
  const handleBack = () => {
    if (step === 'method') setStep('select')
    else if (step === 'confirm') setStep('method')
  }

  // Step 1: Select Package
  if (step === 'select') {
    return (
      <div className="stack">
        <div className="section-intro">
          <span className="eyebrow">{t('THANH TOÁN')}</span>
          <h2>{t('Chọn gói tập phù hợp với bạn')}</h2>
          <p>{t('So sánh thời hạn và quyền lợi, sau đó tiến hành thanh toán.')}</p>
        </div>

        <div className="checkout-steps">
          <div className="checkout-step active">
            <span className="checkout-step-num">1</span>
            <span>{t('Chọn gói')}</span>
          </div>
          <div className="checkout-step-line" />
          <div className="checkout-step">
            <span className="checkout-step-num">2</span>
            <span>{t('Thanh toán')}</span>
          </div>
          <div className="checkout-step-line" />
          <div className="checkout-step">
            <span className="checkout-step-num">3</span>
            <span>{t('Xác nhận')}</span>
          </div>
        </div>

        <div className="grid-cards">
          {activePackages.map((pkg) => (
            <article className="pkg-card checkout-pkg" key={pkg.id}>
              <h3>{pkg.name}</h3>
              <div className="pkg-price">{formatMoney(pkg.price)}</div>
              <div className="muted small">
                {pkg.days} {t('ngày')}
              </div>
              <p>{pkg.description}</p>
              <p className="muted small">Bộ môn: {(pkg.allowedSubjects || []).join(', ') || 'Chưa xác định'}</p>
              <button className="btn btn-primary full" disabled={!ownedReady || ownedPackageIds.has(Number(pkg.id))} onClick={() => handleSelectPackage(pkg)}>
                {ownedPackageIds.has(Number(pkg.id)) ? 'Đã mua gói này' : ownedReady ? t('Chọn gói này') : 'Đang kiểm tra gói đã mua…'}
              </button>
            </article>
          ))}
          {!activePackages.length && (
            <div className="card member-empty">{t('Chưa có gói tập đang mở bán.')}</div>
          )}
        </div>

        {ownedResult?.revision === memberRevision && ownedResult.attempt === ownedAttempt && ownedResult.error && <div className="alert alert-error" role="alert">Không tải được danh sách gói đã mua: {ownedResult.error} <button className="btn btn-sm" onClick={() => setOwnedAttempt(n => n + 1)}>Thử lại</button></div>}

        <button className="btn" onClick={() => goTo('payments')}>
          {t('Xem lịch sử giao dịch →')}
        </button>
      </div>
    )
  }

  // Step 2: Choose payment method
  if (step === 'method') {
    return (
      <div className="stack">
        <div className="section-intro">
          <span className="eyebrow">{t('THANH TOÁN')}</span>
          <h2>{t('Chọn phương thức thanh toán')}</h2>
        </div>

        <div className="checkout-steps">
          <div className="checkout-step done">
            <span className="checkout-step-num">✓</span>
            <span>{t('Chọn gói')}</span>
          </div>
          <div className="checkout-step-line active" />
          <div className="checkout-step active">
            <span className="checkout-step-num">2</span>
            <span>{t('Thanh toán')}</span>
          </div>
          <div className="checkout-step-line" />
          <div className="checkout-step">
            <span className="checkout-step-num">3</span>
            <span>{t('Xác nhận')}</span>
          </div>
        </div>

        <div className="checkout-layout">
          <div className="checkout-main">
            <div className="card stack">
              <h3>{t('Phương thức thanh toán')}</h3>
              <div className="payment-methods">
                {PAYMENT_METHODS.map((m) => (
                  <label
                    key={m.value}
                    className={`payment-method-card ${method === m.value ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={m.value}
                      checked={method === m.value}
                      onChange={() => setMethod(m.value)}
                    />
                    <span className="payment-method-icon">{m.icon}</span>
                    <span className="payment-method-label">{t(m.label)}</span>
                  </label>
                ))}
              </div>

              <label className="form">
                {t('Ghi chú (tuỳ chọn)')}
                <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder={t('Ghi chú cho giao dịch...')} />
              </label>
            </div>
          </div>

          <div className="checkout-sidebar">
            <div className="card stack">
              <h3>{t('Đơn hàng của bạn')}</h3>
              <div className="summary">
                <div>
                  <span>{t('Gói tập')}</span>
                  <strong>{selected?.name}</strong>
                </div>
                <div>
                  <span>{t('Thời hạn')}</span>
                  <strong>
                    {selected?.days} {t('ngày')}
                  </strong>
                </div>
                <div className="total">
                  <span>{t('Tổng cộng')}</span>
                  <strong>{formatMoney(selected?.price)}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="form-actions">
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <button className="btn" onClick={handleBack}>
            {t('← Quay lại')}
          </button>
          <button className="btn btn-primary" disabled={!quote} onClick={handleConfirm}>
            {t('Tiếp tục →')}
          </button>
        </div>
      </div>
    )
  }

  // Step 3: Confirm
  if (step === 'confirm') {
    const methodLabel = PAYMENT_METHODS.find((m) => m.value === method)?.label || method

    return (
      <div className="stack">
        <div className="section-intro">
          <span className="eyebrow">{t('THANH TOÁN')}</span>
          <h2>{t('Xác nhận đơn hàng')}</h2>
        </div>

        <div className="checkout-steps">
          <div className="checkout-step done">
            <span className="checkout-step-num">✓</span>
            <span>{t('Chọn gói')}</span>
          </div>
          <div className="checkout-step-line active" />
          <div className="checkout-step done">
            <span className="checkout-step-num">✓</span>
            <span>{t('Thanh toán')}</span>
          </div>
          <div className="checkout-step-line active" />
          <div className="checkout-step active">
            <span className="checkout-step-num">3</span>
            <span>{t('Xác nhận')}</span>
          </div>
        </div>

        <div className="card stack" style={{ maxWidth: '600px' }}>
          {quote && <div className="alert alert-info">Gói dự kiến có hiệu lực từ {quote.startDate} đến {quote.endDate}. Thời gian được tính lại khi thanh toán được xác nhận.</div>}
          <h3>{t('Tóm tắt đơn hàng')}</h3>
          <div className="summary">
            <div>
              <span>{t('Gói tập')}</span>
              <strong>{selected?.name}</strong>
            </div>
            <div>
              <span>{t('Thời hạn')}</span>
              <strong>
                {selected?.days} {t('ngày')}
              </strong>
            </div>
            <div>
              <span>{t('Mô tả')}</span>
              <strong>{selected?.description || '—'}</strong>
            </div>
            <div>
              <span>{t('Phương thức')}</span>
              <strong>{t(methodLabel)}</strong>
            </div>
            {note && (
              <div>
                <span>{t('Ghi chú')}</span>
                <strong>{note}</strong>
              </div>
            )}
            <div className="total">
              <span>{t('Tổng cộng')}</span>
              <strong>{formatMoney(selected?.price)}</strong>
            </div>
          </div>

          <div className="alert alert-info">
            {t('Bạn sẽ chuyển sang PayOS. Gói chỉ kích hoạt khi PayOS xác nhận.')}
          </div>

          {error && (
            <div className="alert alert-error" role="alert">
              {t(error)}
            </div>
          )}

          <div className="form-actions">
            <button className="btn" disabled={busy} onClick={handleBack}>
              {t('← Quay lại')}
            </button>
            <button className="btn btn-primary" disabled={busy || !quote} onClick={handleCheckout}>
              {t(busy ? 'Đang xử lý...' : 'Tạo yêu cầu thanh toán')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Payment state always comes from the authenticated API, never from PayOS query parameters.
  if (step === 'result') {
    const completed = result?.status === 'completed'
    const pending = result?.status === 'pending'
    const cancelled = result?.status === 'cancelled'
    return <div className="card checkout-result" role="status" aria-live="polite">
      <div className={`checkout-result-icon ${completed ? 'success' : pending ? 'pending' : cancelled ? 'cancelled' : 'failed'}`} aria-hidden="true">{completed ? '✓' : pending ? '…' : '!'}</div>
      <h2>{completed ? 'Thanh toán thành công!' : pending ? 'Đang xác nhận thanh toán' : cancelled ? 'Thanh toán đã hủy' : 'Chưa xác định được kết quả thanh toán'}</h2>
      <p>{completed ? 'PayOS đã xác nhận giao dịch. Gói tập của bạn đã được ghi nhận.' : pending ? 'Hệ thống đang kiểm tra với PayOS. Vui lòng chờ trong giây lát.' : result?.message || 'Bạn có thể xem lại giao dịch hoặc chọn gói khác.'}</p>
      {result?.paymentCode && <div className="summary"><div><span>Mã giao dịch</span><strong>{result.paymentCode}</strong></div><div><span>Gói tập</span><strong>{result.packageName}</strong></div><div><span>Số tiền</span><strong>{formatMoney(result.amount)}</strong></div></div>}
      {pending && result?.message && <div className="alert alert-error" role="alert">{result.message}</div>}
      <div className="checkout-result-actions">
        {pending && <button className="btn btn-primary" disabled={checking} onClick={() => void checkPayment(result.paymentId)}>{checking ? 'Đang kiểm tra…' : 'Kiểm tra lại'}</button>}
        {cancelled && <button className="btn btn-primary" disabled={busy} onClick={handleRetry}>Thanh toán lại</button>}
        {completed && <button className="btn btn-primary" onClick={() => leaveResult('home')}>Về trang của tôi</button>}
        <button className="btn" onClick={() => leaveResult('payments')}>Xem lịch sử giao dịch</button>
        {!completed && <button className="btn" onClick={() => leaveResult('select')}>Chọn gói khác</button>}
      </div>
    </div>
  }
  return null
}
