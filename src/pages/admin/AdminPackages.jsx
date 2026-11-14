import { useState } from 'react'
import { useStore } from '../../store/context'
import { usePreferences } from '../../preferences/context'
import Modal from '../../components/Modal'
import { formatMoney } from '../../store/utils'
import { mapPackage } from '../../services/api'
import PackageSubjects from '../../components/PackageSubjects'

const EMPTY = { packageCode: '', name: '', price: '', days: 30, description: '', allowedSubjects: [], active: true }

/**
 * T3.3: CRUD Package & MembershipPackage
 * - Báo trùng tên (server-side validation)
 * - Ẩn/disable Sửa–Xoá với gói đã phát sinh giao dịch (hasTransactions)
 * - Chỉ hiện nút Tạm ngưng cho gói đã có giao dịch
 */
export default function AdminPackages() {
  const { t } = usePreferences()
  const { packages, savePackage, togglePackage, deletePackage, api } = useStore()

  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const perform = async (task) => {
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await task()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const submit = (e) => {
    e.preventDefault()
    if (!editing.allowedSubjects?.length) { setError('Vui lòng chọn ít nhất một bộ môn.'); return }
    void perform(async () => {
      // Validate tên trùng ở client (hỗ trợ thêm, server sẽ validate chính xác)
      const duplicate = packages.find(
        (p) => p.id !== editing.id && p.name.trim().toLowerCase() === editing.name.trim().toLowerCase()
      )
      if (duplicate) {
        setError('Tên gói đã tồn tại. Vui lòng chọn tên khác.')
        return
      }
      await savePackage(editing)
      setEditing(null)
      setNotice('Đã lưu thay đổi trên máy chủ.')
    })
  }

  const set = (key) => (e) => setEditing({ ...editing, [key]: e.target.value })

  const canEditDelete = pkg => !pkg.hasTransactions

  // Group packages by status
  const activePackages = packages.filter((p) => p.active)
  const suspendedPackages = packages.filter((p) => !p.active)

  return (
    <div className="stack">
      <div className="section-intro">
        <span className="eyebrow">{t('QUẢN LÝ GÓI TẬP')}</span>
        <h2>{t('Package & MembershipPackage')}</h2>
        <p>{t('Tạo và quản lý gói thành viên. Gói đã có giao dịch không thể sửa hoặc xóa; gói có hội viên đang học lớp cũng không thể tạm ngưng.')}</p>
      </div>

      <div className="toolbar">
        <div>
          <span className="muted small">
            {t('Đang bán')}: {activePackages.length} · {t('Tạm ngưng')}: {suspendedPackages.length}
          </span>
        </div>
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={() => {
            setEditing({ ...EMPTY })
            setError('')
          }}
        >
          {t('+ Tạo gói mới')}
        </button>
      </div>

      {notice && (
        <div className="alert alert-success" role="status">
          {t(notice)}
        </div>
      )}
      {error && !editing && !deleting && (
        <div className="alert alert-error" role="alert">
          {t(error)}
        </div>
      )}

      {/* Active packages */}
      {activePackages.length > 0 && (
        <>
          <h3 className="pkg-section-title">{t('Gói đang bán')}</h3>
          <div className="grid-cards">
            {activePackages.map((p) => (
              <div key={p.id} className="pkg-card featured">
                <div className="pkg-top">
                  <h3>{p.name}</h3>
                  <span className="badge badge-green">{t('Đang bán')}</span>
                </div>
                <div className="pkg-price">{formatMoney(p.price)}</div>
                <div className="muted small">
                  {t('Thời hạn')} {p.days} {t('ngày')}
                </div>
                <p>{p.description}</p>
                <div className="pkg-actions">
                  <button
                    className="btn btn-sm"
                    disabled={busy || !canEditDelete(p)}
                    onClick={() =>
                      perform(async () => setEditing(mapPackage(await api.packages.get(p.id))))
                    }
                  >
                    {t('Sửa')}
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    disabled={busy}
                    onClick={() =>
                      perform(async () => {
                        await togglePackage(p.id)
                        setNotice('Đã tạm ngưng gói trên máy chủ.')
                      })
                    }
                  >
                    {t('Tạm ngưng')}
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    disabled={busy || !canEditDelete(p)}
                    onClick={() => {
                      setDeleting(p)
                      setError('')
                    }}
                  >
                    {t('Xóa')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Suspended packages */}
      {suspendedPackages.length > 0 && (
        <>
          <h3 className="pkg-section-title">{t('Gói tạm ngưng')}</h3>
          <div className="grid-cards">
            {suspendedPackages.map((p) => (
              <div key={p.id} className="pkg-card disabled">
                <div className="pkg-top">
                  <h3>{p.name}</h3>
                  <span className="badge badge-gray">{t('Tạm ngưng')}</span>
                </div>
                <div className="pkg-price">{formatMoney(p.price)}</div>
                <div className="muted small">
                  {t('Thời hạn')} {p.days} {t('ngày')}
                </div>
                <p>{p.description}</p>
                <div className="pkg-actions">
                  <button
                    className="btn btn-sm"
                    disabled={busy || !canEditDelete(p)}
                    onClick={() =>
                      perform(async () => setEditing(mapPackage(await api.packages.get(p.id))))
                    }
                  >
                    {t('Sửa')}
                  </button>
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={busy}
                    onClick={() =>
                      perform(async () => {
                        await togglePackage(p.id)
                        setNotice('Đã mở bán lại gói trên máy chủ.')
                      })
                    }
                  >
                    {t('Mở bán')}
                  </button>
                  <button
                    className="btn btn-sm btn-ghost"
                    disabled={busy || !canEditDelete(p)}
                    onClick={() => {
                      setDeleting(p)
                      setError('')
                    }}
                  >
                    {t('Xóa')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!packages.length && (
        <div className="card member-empty">
          {t('Chưa có gói thành viên nào. Hãy tạo gói mới để bắt đầu.')}
        </div>
      )}

      {/* Edit/Create Modal */}
      {editing && (
        <Modal
          title={editing.id ? 'Sửa gói thành viên' : 'Tạo gói thành viên'}
          onClose={() => {
            if (!busy) setEditing(null)
          }}
        >
          <form className="form" onSubmit={submit}>
            <fieldset className="form api-fieldset" disabled={busy}>
              <label>Mã gói <input value={editing.packageCode || ''} onChange={set('packageCode')} required maxLength={32} /></label>
              <label>
                {t('Tên gói')} <span className="danger">*</span>
                <input value={editing.name} onChange={set('name')} required placeholder="VD: Gold 3 tháng" />
              </label>
              <div className="row-2">
                <label>
                  {t('Học phí (VNĐ)')} <span className="danger">*</span>
                  <input type="number" min="0" step="1000" value={editing.price} onChange={set('price')} required />
                </label>
                <label>
                  {t('Thời hạn (ngày)')} <span className="danger">*</span>
                  <input type="number" min="1" step="1" value={editing.days} onChange={set('days')} required />
                </label>
              </div>
              <PackageSubjects value={editing.allowedSubjects} onChange={allowedSubjects => setEditing({ ...editing, allowedSubjects })} />
              <label>
                {t('Mô tả quyền lợi')}
                <textarea rows="3" value={editing.description || ''} onChange={set('description')} placeholder="Mô tả quyền lợi gói tập..." />
              </label>
            </fieldset>
            {error && (
              <div className="alert alert-error" role="alert">
                {t(error)}
              </div>
            )}
            <div className="form-actions">
              <button type="button" className="btn" disabled={busy} onClick={() => setEditing(null)}>
                {t('Hủy')}
              </button>
              <button className="btn btn-primary" disabled={busy}>
                {t(busy ? 'Đang xử lý...' : 'Lưu gói')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleting && (
        <Modal
          title="Xác nhận xóa"
          onClose={() => {
            if (!busy) setDeleting(null)
          }}
        >
          <div className="stack">
            <p>
              {t('Bạn muốn xóa gói này?')} <strong>{deleting.name}</strong>
            </p>
            <div className="alert alert-info">
              {t('Lưu ý: Nếu gói đã có giao dịch, bạn chỉ có thể Tạm ngưng thay vì Xóa. Server sẽ từ chối nếu gói đã phát sinh giao dịch.')}
            </div>
            {error && (
              <div className="alert alert-error" role="alert">
                {t(error)}
              </div>
            )}
            <div className="form-actions">
              <button className="btn" disabled={busy} onClick={() => setDeleting(null)}>
                {t('Hủy')}
              </button>
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={() =>
                  perform(async () => {
                    await deletePackage(deleting.id)
                    setDeleting(null)
                    setNotice('Đã xóa trên máy chủ.')
                  })
                }
              >
                {t(busy ? 'Đang xử lý...' : 'Xóa')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
