// Which email (if any) an order change should send the customer. Pure, so tests/email.test.mjs runs it in Node.
// row / old: the order after and before the change. cart: every order in the same cart, after the change.
// Emails: the price is ready (once per cart, when the last part is priced), a part is ready, the printer sent a
// note or ready date, the printer added the "finished" photo. Each has a key, so it's sent once.

export type Email = { key: string; subject: string; lines: string[] } | null;
type Order = {
  id: string; cart_id: string; status: string; filename: string; final_price: number | null; currency: string;
  fulfillment: string; ready_by?: string | null; printer_note?: string | null; note_at?: string | null; photos?: string[];
};

const money = (n: number, cur: string) => new Intl.NumberFormat(cur === 'INR' ? 'en-IN' : 'en-US',
  { style: 'currency', currency: cur, maximumFractionDigits: cur === 'INR' ? 0 : 2 }).format(n);
const day = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

export function decide(row: Order, old: Order | null, cart: Order[]): Email {
  if (!row?.cart_id || !old || row.status === 'cancelled') return null;
  const ref = row.cart_id.slice(0, 8).toUpperCase();

  if (row.status !== old.status) {
    const live = cart.filter(o => o.status !== 'cancelled');
    if (row.status === 'priced' && live.length && live.every(o => o.status === 'priced')) {
      const total = Math.round(live.reduce((t, o) => t + +(o.final_price ?? 0), 0) * 100) / 100;
      return { key: `${row.cart_id}:priced`, subject: `Your price is ready: order ${ref}`, lines: [
        `We checked your file${live.length > 1 ? 's' : ''}. The final price for order ${ref} is ${money(total, row.currency)}.`,
        'Open your order page to choose how to pay. Nothing is printed or charged until you do.'] };
    }
    if (row.status === 'ready') {
      const pickup = row.fulfillment !== 'delivery';
      return { key: `${row.id}:ready`, subject: `${row.filename} is ready${pickup ? ' for pickup' : ''}`, lines: [
        `${row.filename} from order ${ref} is printed and ready.`,
        pickup ? 'Reply to this email to arrange a pickup time.' : 'Reply to this email to arrange delivery.'] };
    }
    return null;
  }

  if (!['accepted', 'printing', 'ready'].includes(row.status)) return null;
  if (row.note_at && row.note_at !== old.note_at && (row.printer_note || row.ready_by)) {
    return { key: `${row.id}:note:${row.note_at}`, subject: `Update on ${row.filename}`, lines: [
      ...(row.ready_by ? [`Expected ready: ${day(row.ready_by)}.`] : []),
      ...(row.printer_note ? [`Your printer says: "${row.printer_note}"`] : [])] };
  }
  if (row.photos?.includes('done') && !old.photos?.includes('done')) {
    return { key: `${row.id}:photo`, subject: `Photo of your finished ${row.filename}`, lines: [
      `Your printer added a photo of ${row.filename} from order ${ref}. See it on your order page.`] };
  }
  return null;
}
