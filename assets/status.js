// What an order's status means to the customer: one label, one place on the timeline, one next step.
// Every customer page (order page, My orders, tracker) uses this, so the wording can't drift. Pure, so
// tests/status.test.mjs checks it. Printer owners and the admin see the raw statuses (app.js STATUS).
//
// Database status → customer timeline:
//   quote → priced → open / accepted → printing → ready → completed      (cancelled: off the timeline)
//   Checking file · Price ready · Booked · Printing · Ready · Picked up / Delivered

export const STEPS = ['Checking file', 'Price ready', 'Booked', 'Printing', 'Ready', 'Picked up'];
const AT = { quote: 0, priced: 1, open: 2, accepted: 2, printing: 3, ready: 4, completed: 5 };

// o: an order row. contact: does the customer have a way for us to reach them (email, or WhatsApp turned on)?
export function customerStatus(o, { contact = true } = {}) {
  if (o.status === 'cancelled') return { label: 'Cancelled', step: -1, steps: STEPS, next: 'Email info@thetalab3d.shop with your order number if you have questions.' };
  const step = AT[o.status] ?? 0, delivery = o.fulfillment === 'delivery';
  const steps = delivery ? [...STEPS.slice(0, 5), 'Delivered'] : STEPS;
  const pay = o.payment === 'pickup' ? 'You pay at pickup.' : o.payment === 'card' && o.paid_at ? 'Paid by card.' : '';
  const reach = contact ? 'We\'ll contact you' : 'Email info@thetalab3d.shop with your order number';
  const next = [
    'We\'re checking your file and setting the final price. Nothing is charged yet.',
    'Your final price is ready. Choose how to pay on your order page to start printing.',
    `Paid for and waiting for a printer. ${pay}`.trim(),
    `Printing now. ${pay}`.trim(),
    delivery ? `Ready. ${reach} to arrange delivery.` : `Ready for pickup near ASU's Tempe campus. ${reach} to arrange a time.`,
    delivery ? 'Delivered.' : 'Picked up.',
  ][step];
  const label = step === 4 ? (delivery ? 'Ready for delivery' : 'Ready for pickup') : steps[step];
  return { label, step, steps, next };
}
