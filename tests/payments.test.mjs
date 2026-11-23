// Stripe payment reconciliation: repeats are ignored, mismatches are recorded (never dropped), stale expiries ignored.
import assert from 'node:assert/strict';
import { reconcile } from '../supabase/functions/stripe-webhook/reconcile.ts';

const o = (over = {}) => ({ status: 'priced', payment: null, final_price: 20, stripe_session: 'cs_1', currency: 'USD', ...over });
const s = (over = {}) => ({ id: 'cs_1', amount_total: 2550, currency: 'usd', payment_status: 'paid', metadata: { cart_id: 'cart-1' }, ...over });
const cart = [o(), o({ final_price: 5.5 })];

// the normal case
assert.deepEqual(reconcile('checkout.session.completed', s(), cart), { action: 'paid', cart: 'cart-1', session: 'cs_1', amount: 25.5, issue: null });
// idempotent: Stripe resends the same event after it was recorded
assert.equal(reconcile('checkout.session.completed', s(), cart.map(x => ({ ...x, payment: 'card', status: 'open' }))).action, 'ignore');
// price changed after the checkout opened: still recorded, flagged for the admin
const changed = reconcile('checkout.session.completed', s(), [o(), o({ final_price: 9 })]);
assert.equal(changed.action, 'paid'); assert.match(changed.issue, /charged 25\.50, prices add up to 29\.00/);
// paid on an older session (e.g. a second tab): recorded and flagged, never dropped
assert.match(reconcile('checkout.session.completed', s({ id: 'cs_old' }), cart).issue, /older checkout session/);
// wrong currency is flagged
assert.match(reconcile('checkout.session.completed', s({ currency: 'eur' }), cart).issue, /paid in eur/);
// cancelled parts don't count toward what's due
assert.equal(reconcile('checkout.session.completed', s({ amount_total: 2000 }), [o(), o({ status: 'cancelled', final_price: 5.5 })]).issue, null);
// not paid yet (bank payments that settle later): nothing happens until async_payment_succeeded
assert.equal(reconcile('checkout.session.completed', s({ payment_status: 'unpaid' }), cart).action, 'ignore');
assert.equal(reconcile('checkout.session.async_payment_succeeded', s(), cart).action, 'paid');
// expiry clears only the checkout still on file, and never after payment
assert.deepEqual(reconcile('checkout.session.expired', s(), cart), { action: 'expired', cart: 'cart-1', session: 'cs_1' });
assert.equal(reconcile('checkout.session.expired', s({ id: 'cs_old' }), cart).action, 'ignore');
assert.equal(reconcile('checkout.session.expired', s(), cart.map(x => ({ ...x, payment: 'card' }))).action, 'ignore');
// junk
assert.equal(reconcile('checkout.session.completed', s({ metadata: {} }), cart).action, 'ignore');
assert.equal(reconcile('checkout.session.completed', s(), []).action, 'ignore');
console.log('payments tests passed');
