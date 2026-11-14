import { api } from './client'

export const authApi = {
  login: (email, password) => api('/auth/login', { method: 'POST', body: { email, password } }),
  register: (data) => api('/auth/register', { method: 'POST', body: data }),
}

const crud = (base) => ({
  list: () => api(base),
  get: (id) => api(`${base}/${id}`),
  create: (data) => api(base, { method: 'POST', body: data }),
  update: (id, data) => api(`${base}/${id}`, { method: 'PUT', body: data }),
  remove: (id) => api(`${base}/${id}`, { method: 'DELETE' }),
})

export const packageApi = crud('/api/membership-packages')
export const roomApi = crud('/api/rooms')
export const classApi = crud('/api/classes')
export const scheduleApi = {
  ...crud('/api/schedules'),
  byCoach: (coachId) => api(`/api/schedules?coachId=${coachId}`),
}
export const coachApi = { list: () => api('/api/coaches') }

export const invoiceApi = {
  list: () => api('/api/invoices'),
  get: (id) => api(`/api/invoices/${id}`),
  mine: () => api('/api/member/invoices'),
}

export const paymentApi = {
  list: () => api('/api/payments'),
  get: (id) => api(`/api/payments/${id}`),
  cashCheckout: (data) => api('/api/payments/cash-checkout', { method: 'POST', body: data }),
  confirm: (id, data = {}) => api(`/api/payments/${id}/confirm`, { method: 'POST', body: data }),
  cancel: (id, reason) => api(`/api/payments/${id}/cancel`, { method: 'POST', body: { reason } }),
  checkout: (data) => api('/api/member/payments/checkout', { method: 'POST', body: data }),
  simulatePayment: (paymentId) => api(`/api/member/payments/${paymentId}/simulate-pay`, { method: 'POST' }),
  myPayments: () => api('/api/member/payments'),
  myInvoices: () => api('/api/member/invoices'),
  myMemberships: () => api('/api/member/memberships'),
  invoices: () => api('/api/invoices'),
}

export const memberPaymentApi = {
  checkout: paymentApi.checkout,
  simulatePay: paymentApi.simulatePayment,
  payments: paymentApi.myPayments,
  invoice: (id) => api(`/api/member/invoices/${id}`),
  memberships: paymentApi.myMemberships,
}

export const adminApi = {
  listUsers: (params = '') => api(`/api/admin/users${params ? '?' + params : ''}`),
  getUser: (id) => api(`/api/admin/users/${id}`),
  createUser: (data) => api('/api/admin/users', { method: 'POST', body: data }),
  updateUser: (id, data) => api(`/api/admin/users/${id}`, { method: 'PATCH', body: data }),
  setUserStatus: (id, enabled) => api(`/api/admin/users/${id}/status`, { method: 'PATCH', body: { enabled } }),
  deactivateUser: (id) => api(`/api/admin/users/${id}`, { method: 'DELETE' }),
  resendVerification: (id) => api(`/api/admin/users/${id}/verification-email`, { method: 'POST' }),
}
