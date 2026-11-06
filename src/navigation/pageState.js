// Điều hướng trang không dùng router (App.jsx: goTo(pageKey, params)). Hàm thuần để test bằng node --test.

// Trang không có mục menu riêng → mục menu được làm sáng khi đang ở trang đó.
export const DETAIL_PAGES = { 'class-detail': 'catalog' }
export const menuKeyOf = (page) => DETAIL_PAGES[page] || page

// Lưu trang chi tiết đang xem vào sessionStorage để F5 vẫn ở đúng lớp. Mọi truy cập storage đều bọc try/catch.
export const PAGE_STATE_KEY = 'gymmaster-page-v1'
export function readPageState(storage) {
  try {
    const value = JSON.parse(storage?.getItem(PAGE_STATE_KEY) ?? 'null')
    if (!value || typeof value.page !== 'string') return null
    return { page: value.page, params: value.params && typeof value.params === 'object' ? value.params : {}, userId: value.userId }
  } catch { return null }
}
// state = null → xóa (đang ở trang thường, F5 về trang đầu của menu như trước).
export function writePageState(storage, state) {
  try {
    if (!state) storage?.removeItem(PAGE_STATE_KEY)
    else storage?.setItem(PAGE_STATE_KEY, JSON.stringify(state))
  } catch { /* storage bị chặn: bỏ qua, chỉ mất tính năng giữ trang khi F5 */ }
}

// Trang khôi phục khi tải lại: chỉ trang chi tiết, của đúng người dùng, và role có mục menu cha. Không hợp lệ → null.
export function restorePage(saved, { userId, menuKeys = [] } = {}) {
  if (!saved || String(saved.userId) !== String(userId)) return null
  const parent = DETAIL_PAGES[saved.page]
  if (!parent || !menuKeys.includes(parent)) return null
  return { page: saved.page, params: saved.params || {} }
}

// Lớp đang mở ở trang chi tiết; null = không còn tồn tại (bị xóa / id sai) → quay về danh sách.
export const findDetailClass = (classId, classes = []) =>
  (classId == null || classId === '' ? null : classes.find((c) => String(c.id) === String(classId)) || null)
