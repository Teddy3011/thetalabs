// What a checked-out cart looks like to its customer: its stage, and the lines printed on the paper slip.
// Pure (no DOM, no database), so it can be checked on its own. bill.html does the fetching and drawing.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
export const money = (n, cur) => new Intl.NumberFormat(cur === 'INR' ? 'en-IN' : 'en-US',
  { style: 'currency', currency: cur || 'USD', minimumFractionDigits: cur === 'INR' ? 0 : 2, maximumFractionDigits: cur === 'INR' ? 0 : 2 }).format(n);
const day = d => new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

// checking: we haven't priced every part yet · priced: waiting for the customer to pay or pick pay-on-pickup
// paid: paid by card, or pay on pickup chosen (orders are then open to print) · cancelled: nothing left to make
export function stage(orders) {
  const live = orders.filter(o => o.status !== 'cancelled');
  if (!live.length) return 'cancelled';
  if (live.every(o => o.payment)) return 'paid';
  if (live.every(o => o.status === 'priced')) return 'priced';
  return 'checking';
}
export const total = orders => Math.round(orders.filter(o => o.status !== 'cancelled').reduce((t, o) => t + +(o.final_price || 0), 0) * 100) / 100;

// The slip, as lines for assets/receipt.js. Only states the system has actually reached: no "paid" until paid_at is set.
export function slip(orders) {
  const live = orders.filter(o => o.status !== 'cancelled'), cur = live[0]?.currency, st = stage(orders), sum = total(orders);
  const paidCard = live.find(o => o.payment === 'card' && o.paid_at), pickup = live.length && live.every(o => o.payment === 'pickup');
  const head = paidCard ? 'RECEIPT · PAID BY CARD' : pickup ? 'BILL · PAY ON PICKUP' : 'FINAL PRICE';
  const lines = [
    { type: 'title', text: 'Theta Labs 3D' },
    { type: 'text', text: head },
    { type: 'text', text: `Order ${String(live[0]?.cart_id || '').slice(0, 8).toUpperCase()} · ${day(paidCard?.paid_at || live[0]?.created_at || Date.now())}` },
    { type: 'divider' },
  ];
  for (const o of live) {
    lines.push({ type: 'row', label: o.filename, value: o.final_price != null ? money(o.final_price, cur) : '…' });
    lines.push({ type: 'text', text: `${o.quantity} × ${(o.material || 'pla').toUpperCase()} · ${(o.color_choices || []).join(', ')}${o.rush ? ' · rush' : ''}` });
  }
  lines.push({ type: 'divider' }, { type: 'total', label: 'Total', value: money(sum, cur) });
  if (paidCard) lines.push({ type: 'row', label: 'Paid by card', value: money(live.reduce((t, o) => t + +(o.amount_paid || 0), 0) || sum, cur) },
    { type: 'text', text: 'Thank you. Your parts are in the print queue.' });
  else if (pickup) lines.push({ type: 'row', label: 'Due on pickup', value: money(sum, cur) },
    { type: 'text', text: 'Not paid yet. Pay when you collect your parts.' });
  else if (st === 'priced') lines.push({ type: 'text', text: 'Confirmed price. Not paid yet.' });
  return lines;
}

export function slipHtml(lines) {
  return lines.map(l =>
    l.type === 'title' ? `<p class="slip-title">${esc(l.text)}</p>`
    : l.type === 'text' ? `<p class="slip-text">${esc(l.text)}</p>`
    : l.type === 'divider' ? '<hr class="slip-rule">'
    : `<p class="slip-row${l.type === 'total' ? ' slip-total' : ''}"><span>${esc(l.label)}</span><span>${esc(l.value)}</span></p>`).join('');
}
