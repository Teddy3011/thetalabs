// POST { cart_id } with the customer's login → { url } of a Stripe Checkout page for that cart's confirmed prices.
// Deploy: supabase functions deploy create-checkout   Secrets: STRIPE_SECRET_KEY, SITE_URL (README, "Payments").
// One open checkout per cart: if there is one with time left, its link is returned instead of a new session, so the
// customer can't end up with two payable checkouts. Needs supabase/006_payment_safety.sql.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const SESSION_MINUTES = 30;  // Stripe's shortest allowed expiry; prices are locked for this long (006)

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { cart_id } = await req.json();
    // Use the customer's own login, so row level security only returns their orders.
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: 'Please log in again.' }, 401);
    const { data: orders, error } = await sb.from('orders').select('*')
      .eq('cart_id', cart_id).eq('customer_id', user.id).neq('status', 'cancelled');
    if (error) return json({ error: error.message }, 400);
    if (!orders?.length || orders.some(o => o.status !== 'priced' || o.payment)) return json({ error: "This order isn't ready to pay." }, 400);
    if (orders.some(o => o.currency !== 'USD')) return json({ error: 'Card payment is only available for USD orders.' }, 400);

    // Reuse an open checkout with at least 2 minutes left.
    const open = orders[0];
    if (open.stripe_checkout_url && orders.every(o => o.stripe_session === open.stripe_session)
        && new Date(open.stripe_expires_at).getTime() - Date.now() > 120_000) return json({ url: open.stripe_checkout_url });

    // Return addresses are fixed to our own site, never taken from the request.
    const site = Deno.env.get('SITE_URL') ?? 'https://thetalab3d.shop';
    const expires = Math.floor(Date.now() / 1000) + SESSION_MINUTES * 60 + 60;
    const form = new URLSearchParams({
      mode: 'payment',
      success_url: `${site}/bill.html?cart=${cart_id}&paid=1`,
      cancel_url: `${site}/bill.html?cart=${cart_id}`,
      client_reference_id: cart_id,
      expires_at: String(expires),
      'metadata[cart_id]': cart_id,
      'payment_intent_data[metadata][cart_id]': cart_id,
    });
    if (user.email) form.set('customer_email', user.email);
    const cents = orders.map(o => Math.round(+o.final_price * 100));
    orders.forEach((o, i) => {
      form.set(`line_items[${i}][quantity]`, '1');
      form.set(`line_items[${i}][price_data][currency]`, 'usd');
      form.set(`line_items[${i}][price_data][unit_amount]`, String(cents[i]));
      form.set(`line_items[${i}][price_data][product_data][name]`, `3D print: ${o.filename} (×${o.quantity})`);
    });
    // Two clicks at the same moment get the same session from Stripe (same key, same prices, same half hour).
    const key = `${cart_id}-${cents.join('.')}-${Math.floor(Date.now() / (SESSION_MINUTES * 60_000))}`;
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': key },
      body: form,
    });
    const session = await res.json();
    if (!res.ok) return json({ error: session.error?.message ?? 'Stripe error' }, 502);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const rec = await admin.rpc('record_checkout', { cart: cart_id, session: session.id, url: session.url, expires: new Date(session.expires_at * 1000).toISOString() });
    if (rec.error) console.warn(`cart ${cart_id}: checkout opened but not recorded: ${rec.error.message}`);
    return json({ url: session.url });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
