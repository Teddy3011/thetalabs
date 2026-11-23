// Stripe → checkout.session.completed / async_payment_succeeded / expired → record the payment or clear the checkout.
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt   Secret: STRIPE_WEBHOOK_SECRET (README, "Payments").
// Stripe can't send a Supabase login, so instead every request is checked against Stripe's signature.
// What to do is decided by reconcile.ts (tested); the database calls only ever change unpaid parts, so a repeated
// event can't record a payment twice.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { verifyStripeSignature } from './verify.ts';
import { reconcile } from './reconcile.ts';

Deno.serve(async req => {
  const body = await req.text();
  const ok = await verifyStripeSignature(body, req.headers.get('stripe-signature'), Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '');
  if (!ok) return new Response('Bad signature', { status: 400 });

  const event = JSON.parse(body), s = event.data?.object;
  const cart = s?.metadata?.cart_id;
  if (!cart) return new Response('ignored: no cart');
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: orders, error: readError } = await admin.from('orders').select('*').eq('cart_id', cart);
  if (readError) return new Response(readError.message, { status: 500 });  // Stripe retries failed deliveries

  const act = reconcile(event.type, s, orders ?? []);
  let error = null;
  if (act.action === 'paid') {
    if (act.issue) console.warn(`cart ${cart}: ${act.issue}`);
    ({ error } = await admin.rpc('mark_cart_paid', { cart, session: act.session, amount: act.amount, issue: act.issue }));
  } else if (act.action === 'expired') {
    ({ error } = await admin.rpc('clear_checkout', { cart, session: act.session }));
  }
  if (error) return new Response(error.message, { status: 500 });
  return new Response(act.action === 'ignore' ? `ignored: ${act.reason}` : act.action);
});
