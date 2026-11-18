// The Stripe webhook only marks a cart paid when Stripe's signature checks out. Node strips the TypeScript types.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyStripeSignature } from '../supabase/functions/stripe-webhook/verify.ts';

const secret = 'whsec_test_example', body = '{"type":"checkout.session.completed"}', now = 1_800_000_000_000, t = now / 1000;
const sign = (b, ts = t, s = secret) => createHmac('sha256', s).update(`${ts}.${b}`).digest('hex');

assert.equal(await verifyStripeSignature(body, `t=${t},v1=${sign(body)}`, secret, now), true);
assert.equal(await verifyStripeSignature(body, `t=${t},v1=bad,v1=${sign(body)}`, secret, now), true, 'any listed v1 may match (secret rotation)');
assert.equal(await verifyStripeSignature(body + ' ', `t=${t},v1=${sign(body)}`, secret, now), false, 'tampered body');
assert.equal(await verifyStripeSignature(body, `t=${t},v1=${sign(body, t, 'whsec_other')}`, secret, now), false, 'wrong secret');
assert.equal(await verifyStripeSignature(body, `t=${t - 301},v1=${sign(body, t - 301)}`, secret, now), false, 'older than 5 minutes');
assert.equal(await verifyStripeSignature(body, null, secret, now), false, 'no header');
assert.equal(await verifyStripeSignature(body, `t=${t},v1=${sign(body)}`, '', now), false, 'no secret configured');
console.log('webhook tests passed');
