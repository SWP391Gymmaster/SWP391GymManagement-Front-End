import { createApiClient, createControllerApi, mapPackage, mapSession, mapUser, packagePayload } from './api.js'
import { membershipStatus } from './membershipStatus.js'
import { validateRegistration } from './publicService.js'
import { normalizeCode } from '../validation/roomRules.js'
import { FEATURES } from '../config/features.js'
import { toPayloadStamp } from '../validation/classDates.js'
import { serializeWeekdays } from '../validation/sessionPattern.js'
// Lớp từ BE: giữ nguyên các trường, sessionWeekdays luôn là chuỗi ("" khi BE không trả / null).
export const mapClass = cls => ({ ...cls, sessionWeekdays: typeof cls?.sessionWeekdays === 'string' ? cls.sessionWeekdays : '' })
// Luồng đăng nhập: Login.jsx → login(email, password) → authenticate('login', body)
// → api.login(body) trong api.js → BE → lưu phiên → cập nhật giao diện.
const SESSION_KEY = 'gymmaster-api-session-v1'
// Dữ liệu ban đầu; dùng lại khi đăng xuất hoặc chuyển sang tài khoản khác.
const empty = () => ({ currentUser: null, token: null, packages: [], rooms: [], classes: [], schedules: [], users: [], memberships: [], payments: [], loading: false, loadError: '', authMessage: '', memberRevision: 0 })
// FE chỉ đọc hạn exp và kiểm tra cấu trúc phiên. BE mới xác thực chữ ký JWT/quyền.
export function validSession(session) {
  try {
    // JWT gồm header.payload.signature; payload dùng Base64URL, exp tính bằng giây.
    const payload = JSON.parse(atob(session.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.exp * 1000 > Date.now() && session.user?.id && ['admin', 'manager', 'member', 'coach', 'receptionist'].includes(session.user.role)
  } catch { return false }
}
export function createBackendStore({ baseUrl = '/backend', sessionStorage = globalThis.sessionStorage, localStorage = globalThis.localStorage, fetchImpl } = {}) {
  // Khôi phục token và user khi tải lại trang trong cùng tab.
  let saved
  try { saved = JSON.parse(sessionStorage.getItem(SESSION_KEY)) } catch { /* No saved session. */ }
  let snapshot = empty()
  const avatarKey = id => `gymmaster-api-avatar:${baseUrl}:${id}`
  const avatar = id => { try { return localStorage.getItem(avatarKey(id)) || '' } catch { return '' } }
  if (validSession(saved)) snapshot = { ...snapshot, token: saved.token, currentUser: { ...saved.user, avatarUrl: avatar(saved.user.id) }, loading: true }
  else { try { sessionStorage.removeItem(SESSION_KEY) } catch { /* unavailable */ } }
  // StoreProvider đăng ký listener để React biết lúc nào cần đọc lại snapshot.
  const listeners = new Set()
  // Mỗi lần đăng nhập/đăng xuất tăng generation: kết quả request phiên cũ bị bỏ qua.
  let generation = 0
  // Phân biệt các lần refresh để lần tải cũ không ghi đè lần tải mới hơn.
  let refreshId = 0
  // Gộp phần dữ liệu thay đổi vào snapshot rồi thông báo cho React.
  const publish = patch => { snapshot = { ...snapshot, ...patch }; listeners.forEach(fn => fn()) }
  const logout = (message = '') => {
    generation++; refreshId++
    try { sessionStorage.removeItem(SESSION_KEY) } catch { /* unavailable */ }
    snapshot = { ...empty(), authMessage: message }
    listeners.forEach(fn => fn())
  }
  // Chỉ đăng xuất khi lỗi 401 thuộc đúng phiên hiện tại, không phải request cũ.
  const request = createApiClient({ baseUrl, fetchImpl, getToken: () => snapshot.token, getSessionVersion: () => generation, onUnauthorized: (token, version) => {
    if (snapshot.token === token && generation === version) logout('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
  } })
  const api = createControllerApi(request)
  const assertCurrent = version => { if (version !== generation || !snapshot.currentUser) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng thử lại.') }
  // Tải dữ liệu dùng chung sau đăng nhập hoặc khi người dùng yêu cầu tải lại.
  // silent: tải lại ngầm sau khi ghi (vd. lưu lớp để thấy buổi BE vừa tự sinh), không bật màn hình đang tải
  // (App.jsx thay cả trang bằng MemberDataState khi loading) và lỗi tải ngầm không thay trang bằng màn hình lỗi.
  // Tham số có thể là event khi gắn trực tiếp vào onClick, nên chỉ đọc đúng thuộc tính silent.
  const refresh = async (options) => {
    if (!snapshot.currentUser) return
    const silent = options?.silent === true
    const version = generation
    const id = ++refreshId
    const user = snapshot.currentUser
    if (!silent) publish({ loading: true, loadError: '' })
    try {
      const [packages, rooms, classes, schedules, coaches] = await Promise.all([
        api.packages.list(), api.rooms.list(), api.classes.list(),
        api.schedules.list(user.role === 'coach' ? `?coachId=${user.id}` : ''), api.coaches(),
        user.role === 'admin' ? Promise.resolve(null) : api.roleDashboard(user.role),
      ])
      assertCurrent(version)
      if (id !== refreshId) return
      // Danh sách coach (kèm subjects) lấy từ GET /api/coaches. Nếu người đang đăng nhập là coach thì dùng currentUser
      // nhưng ghép subjects từ /api/coaches theo id (phản hồi đăng nhập không có subjects).
      const coachList = coaches.map(mapUser)
      const self = coachList.find(u => u.id === user.id)
      publish({ packages: packages.map(mapPackage), rooms, classes: classes.map(mapClass), schedules, users: [...coachList.filter(u => u.id !== user.id), self ? { ...snapshot.currentUser, subjects: self.subjects } : snapshot.currentUser], loading: false, loadError: '', memberRevision: snapshot.memberRevision + 1 })
    } catch (error) {
      if (version === generation && id === refreshId && !silent) publish({ loading: false, loadError: error.message })
    }
  }
  /**
   * Xử lý chung cho đăng nhập và đăng ký.
   * operation: 'login' hoặc 'register', chọn hàm tương ứng trong api.js.
   * body: dữ liệu gửi BE (email/password hoặc thông tin đăng ký).
   * newMember: true khi vừa đăng ký, để App.jsx mở trang chọn gói.
   * Lỗi được truyền về form gọi hàm này để hiển thị trong catch.
   */
  const authenticate = async (operation, body, newMember = false) => {
    // 1. Đánh dấu lần xác thực này, vô hiệu hóa kết quả của phiên trước.
    const version = ++generation
    // 2. Với operation = 'login', dòng này chính là await api.login(body).
    const result = await api[operation](body)
    // Người dùng có thể đã đăng xuất hoặc bắt đầu lần đăng nhập khác trong lúc chờ.
    if (version !== generation) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng thử lại.')
    // 3. Đổi DTO BE sang cấu trúc FE: userId → id, fullName → name, MEMBER → member.
    const user = mapUser(result)
    if (!validSession({ token: result.token, user })) throw new Error('Phản hồi đăng nhập không hợp lệ.')
    // 4. Chỉ lưu token và thông tin user, không lưu mật khẩu.
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: result.token, user }))
    // 5. Xóa dữ liệu tài khoản cũ, đặt người dùng mới và bật màn hình đang tải.
    // newMember chỉ nằm trong bộ nhớ; avatar lấy từ localStorage của tài khoản này.
    snapshot = { ...empty(), token: result.token, currentUser: { ...user, newMember, avatarUrl: avatar(user.id) }, loading: true }
    // 6. App.jsx thấy currentUser có giá trị nên chuyển khỏi màn hình Login/Register.
    listeners.forEach(fn => fn())
    // 7. Khởi chạy tải dữ liệu mà không await tại đây; refresh tự xử lý lỗi tải.
    void refresh()
    // Hoàn tất xác thực; dữ liệu danh mục có thể vẫn đang được tải.
    return { ok: true, user }
  }
  // Update cached data only after confirmed writes; no success-looking mock fallback.
  const save = async (resource, key, value, body, mapper = v => v) => {
    const version = generation
    const result = await api[resource].save(value.id, body)
    assertCurrent(version)
    const item = mapper(result)
    publish({ [key]: [...snapshot[key].filter(v => v.id !== item.id), item], memberRevision: snapshot.memberRevision + 1 })
    return item
  }
  const remove = async (resource, key, id) => {
    const version = generation
    await api[resource].remove(id)
    assertCurrent(version)
    publish({ [key]: snapshot[key].filter(v => v.id !== id), memberRevision: snapshot.memberRevision + 1 })
  }
  const unsupported = async () => { throw new Error('Chức năng này chưa khả dụng. Vui lòng liên hệ lễ tân.') }
  const financeRead = async operation => {
    const version = generation
    const result = await operation(snapshot.currentUser?.role === 'member')
    assertCurrent(version)
    return result
  }
  const financeWrite = async operation => {
    const result = await financeRead(operation)
    publish({ memberRevision: snapshot.memberRevision + 1 })
    return result
  }
  const paymentService = {
    list: () => financeRead(async member => {
      const [payments, invoices] = await Promise.all([api.payments.list(member), api.invoices.list(member)])
      return { payments, invoices }
    }),
    getPayment: id => financeRead(member => api.payments.get(id, member)),
    getInvoice: id => financeRead(member => api.invoices.get(id, member)),
    checkout: data => financeWrite(() => api.checkout({ packageId: Number(data.packageId), paymentMethod: data.paymentMethod, note: data.note || '' })),
    simulate: id => financeWrite(() => api.simulatePayment(id)),
    async createVnpayUrl(data) {
      const version = generation
      const result = await api.vnpay.createPaymentUrl({ packageId: Number(data.packageId), orderInfo: data.orderInfo || '' })
      assertCurrent(version)
      if (!result?.paymentUrl) throw new Error('Back-End không trả về đường dẫn thanh toán VNPay.')
      return result.paymentUrl
    },
    mockVnpay: code => financeWrite(() => api.vnpay.mockSuccess(code)),
    cashCheckout: data => financeWrite(() => api.payments.cashCheckout({ memberId: Number(data.memberId), packageId: Number(data.packageId), note: data.note || '' })),
    confirm: (id, data) => financeWrite(() => api.payments.confirm(id, data)),
    cancel: (id, reason) => financeWrite(() => api.payments.cancel(id, reason)),
  }
  const memberService = {
    // Register.jsx gọi hàm này: chuyển name thành fullName theo DTO BE.
    // Tham số true bật newMember; BE quyết định role.
    async register(data) {
      const form = { ...data, fullName: data.fullName ?? data.name }
      const fields = validateRegistration(form)
      if (Object.keys(fields).length) throw Object.assign(new Error('Vui lòng kiểm tra thông tin đăng ký.'), { fields })
      await api.register({ userName: form.userName.trim(), fullName: form.fullName.trim(), email: form.email.trim(), password: form.password, phone: form.phone.trim() })
      // BE hiện trả JWT; bỏ qua token để đăng ký không tự tạo phiên đăng nhập.
      return { email: form.email.trim() }
    },
    async getOverview() {
      const version = generation
      if (snapshot.currentUser?.role !== 'member') throw new Error('Vui lòng đăng nhập bằng tài khoản hội viên.')
      const user = snapshot.currentUser
      const [packages, rooms, classes, schedules, coaches, available, mine, memberships, classStats] = await Promise.all([
        api.packages.list(), api.rooms.list(), api.classes.list(), api.schedules.list(), api.coaches(), api.availableSessions(), api.enrollments(),
        api.myMemberships(), FEATURES.classRegistration ? api.classStats() : Promise.resolve(null),
      ])
      assertCurrent(version)
      const lookup = { rooms, classes, schedules, coaches: coaches.map(mapUser) }
      const enrollments = mine.map(e => ({ id: e.enrollmentId, userId: user.id, sessionId: e.scheduleId, createdAt: e.enrolledAt, session: mapSession(e, lookup) }))
      const sessions = available.map(s => {
        const session = mapSession(s, lookup)
        const conflict = enrollments.some(e => e.sessionId !== session.id && new Date(e.session.startTime) < new Date(session.endTime) && new Date(session.startTime) < new Date(e.session.endTime))
        return conflict ? { ...session, allowed: false, reason: 'Buổi học trùng với lịch tập đã đăng ký.' } : session
      })
      return { user, packages: packages.map(mapPackage), memberships, status: membershipStatus(memberships), sessions, enrollments, classStats }
    },
    purchase: paymentService.checkout,
    async enroll(id) {
      const version = generation
      const result = await api.enroll(id)
      assertCurrent(version)
      publish({ memberRevision: snapshot.memberRevision + 1 })
      return result
    },
        // Đăng ký / hủy đăng ký LỚP (FEATURES.classRegistration). Hủy lớp: BE cũng gỡ các buổi học sắp tới của lớp đó.
    async registerClass(id) {
      const version = generation
      const result = await api.registerClass(id)
      assertCurrent(version)
      publish({ memberRevision: snapshot.memberRevision + 1 })
      return result
    },
    async cancelClassRegistration(id) {
      const version = generation
      await api.cancelClassRegistration(id)
      assertCurrent(version)
      publish({ memberRevision: snapshot.memberRevision + 1 })
    },
    async cancelEnrollment(id) {
      const version = generation
      await api.cancel(id)
      assertCurrent(version)
      publish({ memberRevision: snapshot.memberRevision + 1 })
    },
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    api, request, memberService, paymentService, refresh,
    // Login.jsx dùng hàm này: nhận hai tham số, trim email và xử lý toàn bộ phiên.
    // Khác api.login(body): hàm ở api.js chỉ gửi HTTP, không lưu user/token vào store.
    login: (email, password) => authenticate('login', { email: email.trim(), password }),
    logout: () => logout(),
    savePackage: pkg => save('packages', 'packages', pkg, packagePayload(pkg), mapPackage),
    async togglePackage(id) {
      const version = generation
      const pkg = snapshot.packages.find(p => p.id === id)
      if (!pkg) throw new Error('Không tìm thấy gói tập.')
      const result = pkg.active ? await api.packages.suspend(id) : await api.packages.activate(id)
      assertCurrent(version)
      const item = mapPackage(result)
      publish({ packages: [...snapshot.packages.filter(value => value.id !== item.id), item], memberRevision: snapshot.memberRevision + 1 })
      return item
    },
    deletePackage: id => remove('packages', 'packages', id),
    saveRoom: room => save('rooms', 'rooms', room, { roomCode: normalizeCode(room.roomCode), name: room.name.trim(), capacity: Number(room.capacity), type: room.type }),    deleteRoom: id => remove('rooms', 'rooms', id),
    // Chỉ gửi hạn đăng ký registrationCloseAt (null = không đặt hạn); registrationOpenAt không còn dùng, BE luôn đặt null.
    // FEATURES.sessionPattern: gửi sessionWeekdays ("MON,WED", "" = không tự sinh). BE có thể vừa sinh/xóa buổi,
    // nên tải lại ngầm để các buổi mới xuất hiện ngay (lỗi tải ngầm không làm hỏng việc lưu lớp đã thành công).
    async saveClass(cls) {
      const item = await save('classes', 'classes', cls, { classCode: normalizeCode(cls.classCode), name: cls.name.trim(), subject: cls.subject, description: cls.description || '', level: cls.level ?? null, capacity: Number(cls.capacity), coachId: cls.coachId ? Number(cls.coachId) : null,
        ...(FEATURES.classDates && { startDate: cls.startDate || null, endDate: cls.endDate || null, registrationCloseAt: toPayloadStamp(cls.registrationCloseAt, FEATURES.registrationTimes) }),
        ...(FEATURES.sessionPattern && { sessionWeekdays: serializeWeekdays(cls.sessionWeekdays) }) }, mapClass)
      await refresh({ silent: true })
      return item
    },
    deleteClass: id => remove('classes', 'classes', id),
    saveSchedule: schedule => save('schedules', 'schedules', schedule, { classId: Number(schedule.classId), roomId: Number(schedule.roomId), coachId: schedule.coachId ? Number(schedule.coachId) : null, startTime: schedule.startTime, endTime: schedule.endTime,
      ...(FEATURES.sessionDescription && { description: String(schedule.description ?? '').trim() || null }) }),
    // FEATURES.coachSubjects: lưu bộ môn của coach rồi cập nhật coach trong danh sách users (nếu đang có).
    async saveCoachSubjects(id, subjects) {
      const version = generation
      const result = await api.saveCoachSubjects(id, subjects)
      assertCurrent(version)
      const saved = Array.isArray(result?.subjects) ? result.subjects : subjects
      publish({ users: snapshot.users.map(u => String(u.id) === String(id) ? { ...u, subjects: saved } : u) })
      return result
    },
    deleteSchedule: id => remove('schedules', 'schedules', id),
    // Avatar is intentionally browser-local until BE exposes a profile endpoint.
    updateProfile(id, data) {
      if (snapshot.currentUser?.id !== id || Object.keys(data).some(k => k !== 'avatarUrl')) throw new Error('Chưa hỗ trợ cập nhật hồ sơ trên máy chủ.')
      localStorage.setItem(avatarKey(id), data.avatarUrl || '')
      publish({ currentUser: { ...snapshot.currentUser, avatarUrl: data.avatarUrl || '' } })
    },
    purchase: paymentService.checkout, registerAtCounter: unsupported,
  }
}
