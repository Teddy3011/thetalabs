// Every database status has one customer label and next step, and nothing promises contact we can't make.
import assert from 'node:assert/strict';
import { customerStatus, STEPS } from '../assets/status.js';

const o = (status, over = {}) => ({ status, fulfillment: 'pickup', payment: null, paid_at: null, ...over });
const ALL = ['quote', 'priced', 'open', 'accepted', 'printing', 'ready', 'completed', 'cancelled'];

for (const s of ALL) {
  const c = customerStatus(o(s));
  assert.ok(c.label && c.next, `${s} has a label and a next step`);
  assert.ok(c.step >= -1 && c.step < STEPS.length);
}
// the timeline only moves forward through the real statuses
assert.deepEqual(['quote', 'priced', 'open', 'printing', 'ready', 'completed'].map(s => customerStatus(o(s)).step), [0, 1, 2, 3, 4, 5]);
// a printer accepting the job is not news to the customer: it still reads "Booked"
assert.equal(customerStatus(o('accepted')).label, customerStatus(o('open')).label);
// pickup and delivery wording stays consistent
assert.equal(customerStatus(o('ready')).label, 'Ready for pickup');
assert.equal(customerStatus(o('ready', { fulfillment: 'delivery' })).label, 'Ready for delivery');
assert.equal(customerStatus(o('completed', { fulfillment: 'delivery' })).label, 'Delivered');
assert.equal(customerStatus(o('completed')).label, 'Picked up');
// payment is only described as paid once paid_at is set
assert.match(customerStatus(o('open', { payment: 'card', paid_at: '2026-11-23' })).next, /Paid by card/);
assert.doesNotMatch(customerStatus(o('open', { payment: 'card' })).next, /Paid by card/);
assert.match(customerStatus(o('printing', { payment: 'pickup' })).next, /pay at pickup/);
// no promise to contact someone we have no way to reach
assert.match(customerStatus(o('ready'), { contact: true }).next, /We'll contact you/);
assert.doesNotMatch(customerStatus(o('ready'), { contact: false }).next, /We'll contact you/);
assert.match(customerStatus(o('ready'), { contact: false }).next, /info@thetalab3d\.shop/);
// nothing before payment says printing has started or money was taken
for (const s of ['quote', 'priced']) assert.doesNotMatch(customerStatus(o(s)).next, /Paid|Printing now/);
console.log('status tests passed');
