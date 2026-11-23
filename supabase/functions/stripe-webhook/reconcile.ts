// What to do with a Stripe Checkout event, given the cart's orders as they are now. Pure, so tests/payments.test.mjs
// runs it in Node. The rules:
// - Record a payment once: if every live part already has a payment, the event is a repeat and is ignored.
// - Money received is never dropped. If the amount or the checkout session doesn't match what we expect, the payment
//   is still recorded, with a payment_issue the admin sees, so the customer isn't asked to pay twice.
// - An expired session only clears the checkout if it is still the one on file.

type Order = { status: string; payment: string | null; final_price: number | null; stripe_session: string | null; currency: string };
type Session = { id: string; amount_total: number; currency: string; payment_status: string; metadata?: { cart_id?: string } };
export type Action =
  | { action: 'paid'; cart: string; session: string; amount: number; issue: string | null }
  | { action: 'expired'; cart: string; session: string }
  | { action: 'ignore'; reason: string };

const cents = (n: number) => Math.round(n * 100);

export function reconcile(type: string, s: Session, orders: Order[]): Action {
  const cart = s?.metadata?.cart_id;
  if (!cart) return { action: 'ignore', reason: 'no cart on this session' };
  const live = orders.filter(o => o.status !== 'cancelled');
  if (!live.length) return { action: 'ignore', reason: 'cart not found or cancelled' };

  if (type === 'checkout.session.expired') {
    return live.some(o => o.stripe_session === s.id && !o.payment)
      ? { action: 'expired', cart, session: s.id }
      : { action: 'ignore', reason: 'not the current checkout' };
  }
  const paidEvent = (type === 'checkout.session.completed' && s.payment_status === 'paid') || type === 'checkout.session.async_payment_succeeded';
  if (!paidEvent) return { action: 'ignore', reason: `nothing to do for ${type} (${s.payment_status})` };
  if (live.every(o => o.payment)) return { action: 'ignore', reason: 'already recorded' };

  const due = live.filter(o => o.status === 'priced' && !o.payment);
  const expected = due.reduce((t, o) => t + cents(+(o.final_price ?? 0)), 0);
  const issues: string[] = [];
  if (!due.length) issues.push('paid, but no part was waiting for payment');
  if (s.amount_total !== expected) issues.push(`charged ${(s.amount_total / 100).toFixed(2)}, prices add up to ${(expected / 100).toFixed(2)}`);
  if ((s.currency || '').toUpperCase() !== (due[0]?.currency || live[0].currency)) issues.push(`paid in ${s.currency}, order is in ${live[0].currency}`);
  if (due.length && due.some(o => o.stripe_session !== s.id)) issues.push('paid on an older checkout session');
  return { action: 'paid', cart, session: s.id, amount: s.amount_total / 100, issue: issues.length ? issues.join('; ') : null };
}
