// Stripe → "checkout.session.completed" → mark that cart paid, which opens its parts to printers.
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt   Secret: STRIPE_WEBHOOK_SECRET (README, "Payments").
// Stripe can't send a Supabase login, so instead every request is checked against Stripe's signature.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { verifyStripeSignature } from './verify.ts';

Deno.serve(async req => {
  const body = await req.text();
  const ok = await verifyStripeSignature(body, req.headers.get('stripe-signature'), Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '');
  if (!ok) return new Response('Bad signature', { status: 400 });

  const event = JSON.parse(body);
  const s = event.data?.object;
  if (event.type === 'checkout.session.completed' && s?.payment_status === 'paid' && s.metadata?.cart_id) {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: orders } = await admin.from('orders').select('final_price').eq('cart_id', s.metadata.cart_id).eq('status', 'priced');
    const expected = Math.round((orders ?? []).reduce((t, o) => t + +o.final_price, 0) * 100);
    if (expected !== s.amount_total) console.warn(`cart ${s.metadata.cart_id}: Stripe charged ${s.amount_total}, prices add up to ${expected}`);
    const { error } = await admin.rpc('mark_cart_paid', { cart: s.metadata.cart_id, session: s.id });
    if (error) return new Response(error.message, { status: 500 });  // Stripe retries failed deliveries
  }
  return new Response('ok');
});
