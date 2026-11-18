import assert from 'node:assert/strict';
import { stage, total, slip, steps } from '../assets/bill.js';

const o = (over = {}) => ({ cart_id: 'abcd1234-0000', filename: 'part.stl', quantity: 1, material: 'pla', color_choices: ['Black'],
  currency: 'USD', status: 'quote', final_price: null, payment: null, paid_at: null, amount_paid: null,
  created_at: '2026-11-17T10:00:00Z', fulfillment: 'pickup', ...over });
const text = lines => lines.map(l => [l.text, l.label, l.value].filter(Boolean).join(' ')).join('\n');

// stages follow what the database says, never ahead of it
assert.equal(stage([o(), o({ status: 'priced', final_price: 20 })]), 'checking');
assert.equal(stage([o({ status: 'priced', final_price: 20 }), o({ status: 'priced', final_price: 5.5 })]), 'priced');
assert.equal(stage([o({ status: 'open', final_price: 20, payment: 'card', paid_at: '2026-11-17T12:00:00Z' })]), 'paid');
assert.equal(stage([o({ status: 'cancelled' })]), 'cancelled');
assert.equal(stage([o({ status: 'cancelled' }), o({ status: 'priced', final_price: 9 })]), 'priced');

// totals skip cancelled parts and avoid float drift
assert.equal(total([o({ final_price: 0.1 }), o({ final_price: 0.2 }), o({ status: 'cancelled', final_price: 99 })]), 0.3);

// the slip never says "paid" before paid_at is set
const priced = text(slip([o({ status: 'priced', final_price: 20 }), o({ status: 'priced', final_price: 5.5, filename: 'b.stl' })]));
assert.match(priced, /FINAL PRICE/); assert.match(priced, /Total \$25\.50/); assert.doesNotMatch(priced, /PAID|Paid/);
const card = text(slip([o({ status: 'open', final_price: 20, payment: 'card', paid_at: '2026-11-17T12:00:00Z', amount_paid: 20 })]));
assert.match(card, /RECEIPT · PAID BY CARD/); assert.match(card, /Paid by card \$20\.00/);
const pickup = text(slip([o({ status: 'open', final_price: 300, payment: 'pickup', currency: 'INR' })]));
assert.match(pickup, /BILL · PAY ON PICKUP/); assert.match(pickup, /Due on pickup ₹300/); assert.match(pickup, /Not paid yet/);
const cardNoTimestamp = text(slip([o({ status: 'priced', final_price: 20, payment: 'card' })]));
assert.doesNotMatch(cardNoTimestamp, /PAID/);

// status steps
assert.deepEqual(steps(o({ status: 'accepted' })).map(s => s.now), [true, false, false, false]);
assert.deepEqual(steps(o({ status: 'completed', fulfillment: 'delivery' })).map(s => s.done), [true, true, true, true]);
assert.equal(steps(o({ status: 'completed', fulfillment: 'delivery' }))[3].name, 'Delivered');
console.log('bill tests passed');
