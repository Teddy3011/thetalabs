// Which WhatsApp update (if any) an order change should send. Pure, so tests/whatsapp.test.mjs runs it in Node.
// row / old: the order after and before the change. cart: every order in the same cart, after the change.

export type Update = { key: string; template: string; params: string[] } | null;
type Order = { id: string; cart_id: string; status: string; filename: string; final_price: number | null; currency: string; fulfillment: string };

const money = (n: number, cur: string) => new Intl.NumberFormat(cur === 'INR' ? 'en-IN' : 'en-US',
  { style: 'currency', currency: cur, maximumFractionDigits: cur === 'INR' ? 0 : 2 }).format(n);

export function decide(row: Order, old: Order | null, cart: Order[]): Update {
  if (!row?.cart_id || !old || row.status === old.status) return null;
  const live = cart.filter(o => o.status !== 'cancelled'), ref = row.cart_id.slice(0, 8).toUpperCase();
  // 1. Every part priced: tell them the total and that they can pay. Sent once, when the last part gets its price.
  if (row.status === 'priced' && live.length && live.every(o => o.status === 'priced')) {
    const total = Math.round(live.reduce((t, o) => t + +(o.final_price ?? 0), 0) * 100) / 100;
    return { key: `${row.cart_id}:priced`, template: 'order_priced', params: [ref, money(total, row.currency)] };
  }
  // 2. The first part of the order starts printing.
  if (row.status === 'printing') return { key: `${row.cart_id}:printing`, template: 'order_printing', params: [ref] };
  // 3. Each part as it becomes ready, saying whether it's for pickup or delivery.
  if (row.status === 'ready')
    return { key: `${row.id}:ready`, template: 'order_ready', params: [row.filename, row.fulfillment === 'delivery' ? 'delivery' : 'pickup'] };
  return null;
}
