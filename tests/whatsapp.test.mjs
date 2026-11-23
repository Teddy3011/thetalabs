// Which order changes send a WhatsApp update. Node strips the TypeScript types.
import assert from 'node:assert/strict';
import { decide } from '../supabase/functions/whatsapp-notify/decide.ts';

const o = (over = {}) => ({ id: 'part-1', cart_id: 'abcd1234-ffff', status: 'quote', filename: 'bracket.stl',
  final_price: null, currency: 'USD', fulfillment: 'pickup', ...over });

// priced: only once every live part in the cart has a price, with the cart total
const a = o({ status: 'priced', final_price: 20 }), b = o({ id: 'part-2', status: 'quote', filename: 'gear.stl' });
assert.equal(decide(a, o(), [a, b]), null, 'one part still waiting for a price');
const b2 = { ...b, status: 'priced', final_price: 5.5 };
assert.deepEqual(decide(b2, b, [a, b2]), { key: 'abcd1234-ffff:priced', template: 'order_priced', params: ['ABCD1234', '$25.50'] });
assert.deepEqual(decide(b2, b, [a, b2, o({ id: 'x', status: 'cancelled', final_price: 99 })]).params[1], '$25.50', 'cancelled parts are left out');
assert.equal(decide(o({ status: 'priced', final_price: 300, currency: 'INR' }), o(), [o({ status: 'priced', final_price: 300, currency: 'INR' })]).params[1], '₹300');

// printing: one message per cart (same key whichever part starts first)
assert.equal(decide(o({ status: 'printing' }), o({ status: 'accepted' }), []).key, 'abcd1234-ffff:printing');
assert.equal(decide(o({ id: 'part-2', status: 'printing' }), o({ id: 'part-2', status: 'accepted' }), []).key, 'abcd1234-ffff:printing');

// ready: one message per part, saying pickup or delivery
assert.deepEqual(decide(o({ status: 'ready' }), o({ status: 'printing' }), []), { key: 'part-1:ready', template: 'order_ready', params: ['bracket.stl', 'pickup'] });
assert.equal(decide(o({ status: 'ready', fulfillment: 'delivery' }), o({ status: 'printing' }), []).params[1], 'delivery');

// nothing for other changes, or when the status didn't change
for (const [to, from] of [['open', 'priced'], ['accepted', 'open'], ['completed', 'ready'], ['cancelled', 'quote']])
  assert.equal(decide(o({ status: to }), o({ status: from }), []), null, `${from} → ${to}`);
assert.equal(decide(o({ status: 'printing' }), o({ status: 'printing' }), []), null);
assert.equal(decide(o({ status: 'printing' }), null, []), null, 'inserts are ignored');
console.log('whatsapp tests passed');
