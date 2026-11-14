import assert from 'node:assert/strict'
import { createBackendStore } from '../src/services/backendStore.js'
import { membershipStatus } from '../src/services/membershipStatus.js'
const memory = () => { const m = new Map(); return { getItem: k => m.get(k), setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) } }
const token = `header.${btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 }))}.signature`
const calls = []
let payment = { paymentId: 10, invoiceId: 20, memberId: 2, packageId: 3, amount: 500000, paymentMethod: 'PAYOS', status: 'PENDING' }
let memberships = []
let fail = false, release = null, slow = false
const json = (value, status = 200) => new Response(JSON.stringify(value), { status })
const backend = async (url, options) => {
  const path = url.replace('/backend', '')
  const body = options.body ? JSON.parse(options.body) : undefined
  calls.push({ path, body, method: options.method })
  if (path === '/auth/login') return json({ token, userId: 2, fullName: 'Test', email: body.email, role: body.email.split('@')[0].toUpperCase() })
  assert.equal(options.headers.Authorization, `Bearer ${token}`)
  if (path.endsWith('/dashboard')) return new Response('Hello')
  if (fail) return json({ message: 'Payment is already completed' }, 400)
  if (slow && path === '/api/member/payments/10') return new Promise(resolve => { release = () => resolve(json({ message: 'Authentication required' }, 401)) })
  if (path.endsWith('/checkout') || path.endsWith('/cash-checkout')) {
    payment = { ...payment, ...body, status: path.endsWith('/cash-checkout') ? 'COMPLETED' : 'PENDING' }
    return json(payment, 201)
  }
  if (path === '/api/payos/create-payment-link') return json({ paymentId: 10, paymentUrl: 'https://pay.payos.vn/web/demo' })
  if (path === '/api/payos/payments/10/retry') return json({ paymentId: 10, paymentUrl: 'https://pay.payos.vn/web/retry' })
  if (path === '/api/payos/payments/10/reconcile') return json({ paymentId: 10 })
  if (path.endsWith('/confirm')) {
    payment = { ...payment, status: 'COMPLETED' }
    memberships = [{ id: 30, memberId: 2, packageId: 3, startDate: '2026-10-08', endDate: '2026-11-06', active: true, daysRemaining: 30 }]
    return json(payment)
  }
  if (path.endsWith('/cancel')) return json({ ...payment, status: 'CANCELLED' })
  if (path.endsWith('/payments/10')) return json(payment)
  if (path.endsWith('/invoices/20')) return json({ invoiceId: 20, status: payment.status === 'COMPLETED' ? 'PAID' : 'PENDING' })
  if (path.endsWith('/payments')) return json([payment])
  if (path.endsWith('/invoices')) return json([{ invoiceId: 20 }])
  if (path.endsWith('/memberships')) return json(memberships)
  return json([])
}
const store = createBackendStore({ sessionStorage: memory(), localStorage: memory(), fetchImpl: backend })
await store.login('member@example.com', 'password123')
await store.refresh()
const service = store.paymentService
const revision = store.getSnapshot().memberRevision
assert.equal((await service.checkout({ packageId: '3', paymentMethod: 'PAYOS', memberId: 999 })).status, 'PENDING')
assert.deepEqual(calls.at(-1), { path: '/api/member/payments/checkout', method: 'POST', body: { packageId: 3, paymentMethod: 'PAYOS', note: '' } })
assert.equal(store.getSnapshot().memberRevision, revision + 1)
assert.equal((await store.memberService.getOverview()).status.status, 'none', 'checkout alone does not activate membership')
await service.list()
assert(calls.some(c => c.path === '/api/member/payments'))
assert(calls.some(c => c.path === '/api/member/invoices'))
await service.getPayment(10)
assert.equal(calls.at(-1).path, '/api/member/payments/10')
await service.getInvoice(20)
assert.equal(calls.at(-1).path, '/api/member/invoices/20')
const link = await service.createPayosLink({ packageId: '3' })
assert.equal(link.paymentId, 10)
assert.equal(link.paymentUrl, 'https://pay.payos.vn/web/demo')
assert.equal(calls.at(-1).path, '/api/payos/create-payment-link')
assert.equal((await service.retryPayosPayment(10)).paymentId, 10)
assert.deepEqual(calls.at(-1), { path: '/api/payos/payments/10/retry', method: 'POST', body: undefined })
await service.reconcilePayosPayment(10)
assert.deepEqual(calls.at(-1), { path: '/api/payos/payments/10/reconcile', method: 'POST', body: undefined })
assert.equal((await store.memberService.getOverview()).status.status, 'none')
payment = { ...payment, status: 'COMPLETED' }
memberships = [{ id: 30, memberId: 2, packageId: 3, startDate: '2026-10-08', endDate: '2026-11-06', active: true, daysRemaining: 30 }]
assert.equal((await store.memberService.getOverview()).status.status, 'active')
assert.equal((await service.getInvoice(20)).status, 'PAID')
fail = true
const failedRevision = store.getSnapshot().memberRevision
await assert.rejects(service.createPayosLink({ packageId: '3' }), e => e.status === 400)
assert.equal(store.getSnapshot().memberRevision, failedRevision, 'failed mutation does not publish success')
fail = false
// A delayed 401 must not log out a newly authenticated session, even if BE returns the same JWT.
slow = true
const stale = service.getPayment(10)
store.logout()
await store.login('manager@example.com', 'password123')
release()
await assert.rejects(stale)
await store.refresh()
assert.equal(store.getSnapshot().currentUser.role, 'manager')
slow = false
for (const role of ['manager', 'receptionist']) {
  await store.login(`${role}@example.com`, 'password123')
  await store.refresh()
  await service.list()
  assert(calls.slice(-2).every(c => !c.path.includes('/member/')))
  await service.getPayment(10)
  assert.equal(calls.at(-1).path, '/api/payments/10')
  await service.getInvoice(20)
  assert.equal(calls.at(-1).path, '/api/invoices/20')
  await service.cashCheckout({ memberId: '2', packageId: '3', note: 'Cash' })
  assert.deepEqual(calls.at(-1), { path: '/api/payments/cash-checkout', method: 'POST', body: { memberId: 2, packageId: 3, note: 'Cash' } })
  await service.confirm(10, { transactionReference: 'REF', note: 'Received' })
  assert.equal(calls.at(-1).path, '/api/payments/10/confirm')
  assert.equal(calls.at(-1).body.transactionReference, 'REF')
  await service.cancel(10, 'Duplicate')
  assert.deepEqual(calls.at(-1), { path: '/api/payments/10/cancel', method: 'POST', body: { reason: 'Duplicate' } })
}
const today = '2026-10-08'
const m = (startDate, endDate, active = false, daysRemaining = 0) => ({ startDate, endDate, active, daysRemaining })
assert.equal(membershipStatus([], today).status, 'none')
assert.equal(membershipStatus([m('2026-09-01', '2026-10-07')], today).status, 'expired')
assert.equal(membershipStatus([m('2026-10-09', '2026-11-07')], today).status, 'upcoming')
assert.equal(membershipStatus([m('2026-10-01', today, true, 1)], today).daysLeft, 0)
assert.equal(membershipStatus([m('2026-10-01', '2026-10-14', true, 7)], today).expiringSoon, true)
assert.equal(membershipStatus([m('2026-10-01', '2026-10-15', true, 8)], today).expiringSoon, false)
assert.equal(membershipStatus([m('2026-11-01', '2026-11-30'), m('2026-10-01', '2026-10-31', true, 24)], today).status, 'active', 'future renewal does not mask currently active membership')
console.log('PASS: payment and invoice routes for all roles, payloads, pending checkout, confirmed membership, failed writes, stale 401, expiry boundaries. No real transactions created.')
