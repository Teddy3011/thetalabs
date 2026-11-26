// Which order changes email the customer, and that each email has a stable key (sent once).
import assert from 'node:assert/strict';
import { decide } from '../supabase/functions/order-email/decide.ts';

const o = (over = {}) => ({ id: 'part-1', cart_id: 'abcd1234-ffff', status: 'quote', filename: 'bracket.stl', final_price: null,
  currency: 'USD', fulfillment: 'pickup', ready_by: null, printer_note: null, note_at: null, photos: [], ...over });

// price ready: only when the last live part is priced, with the cart total
const a = o({ status: 'priced', final_price: 20 }), b = o({ id: 'part-2', filename: 'gear.stl' });
assert.equal(decide(a, o(), [a, b]), null, 'one part still waiting');
const b2 = { ...b, status: 'priced', final_price: 5.5 };
const priced = decide(b2, b, [a, b2, o({ id: 'x', status: 'cancelled', final_price: 99 })]);
assert.equal(priced.key, 'abcd1234-ffff:priced');
assert.match(priced.lines[0], /\$25\.50/);

// ready: per part, pickup or delivery
assert.equal(decide(o({ status: 'ready' }), o({ status: 'printing' }), []).key, 'part-1:ready');
assert.match(decide(o({ status: 'ready', fulfillment: 'delivery' }), o({ status: 'printing' }), []).lines[1], /delivery/);

// printer update: a new note_at sends one email; the same update again doesn't
const note = o({ status: 'printing', printer_note: 'Printing tonight', ready_by: '2026-11-28', note_at: 't2' });
const e = decide(note, o({ status: 'printing', note_at: 't1' }), []);
assert.equal(e.key, 'part-1:note:t2');
assert.match(e.lines.join(' '), /Saturday, November 28.*Printing tonight/);
assert.equal(decide(note, note, []), null, 'nothing changed');

// finished photo: once, only for "done"
assert.equal(decide(o({ status: 'ready', photos: ['start', 'done'] }), o({ status: 'ready', photos: ['start'] }), []).key, 'part-1:photo');
assert.equal(decide(o({ status: 'printing', photos: ['start'] }), o({ status: 'printing' }), []), null, 'no email for first-layer photos');

// nothing else, nothing for cancelled parts or inserts
for (const [to, from] of [['open', 'priced'], ['accepted', 'open'], ['printing', 'accepted'], ['completed', 'ready']])
  assert.equal(decide(o({ status: to }), o({ status: from }), []), null, `${from} → ${to}`);
assert.equal(decide(o({ status: 'cancelled' }), o(), []), null);
assert.equal(decide(o({ status: 'ready' }), null, []), null);
console.log('email tests passed');
