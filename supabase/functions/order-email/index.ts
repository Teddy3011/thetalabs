// Supabase Database Webhook (orders, UPDATE) → an email to the customer through Resend, if they have an email.
// Deploy: supabase functions deploy order-email --no-verify-jwt
// Secrets: WEBHOOK_SECRET (also sent by the webhook as header x-webhook-secret), RESEND_API_KEY,
// EMAIL_FROM (e.g. "Theta Labs 3D <orders@thetalab3d.shop>", a domain verified in Resend). See README, "Order emails".
// Guests without an email get nothing; their order page is how they follow the order.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { decide } from './decide.ts';

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

Deno.serve(async req => {
  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) return new Response('Forbidden', { status: 403 });

  const { type, table, record, old_record } = await req.json();
  if (type !== 'UPDATE' || table !== 'orders' || !record?.cart_id) return new Response('ignored');

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: cart } = await admin.from('orders').select('*').eq('cart_id', record.cart_id);
  const email = decide(record, old_record, cart ?? []);
  if (!email) return new Response('nothing to send');

  const { data: u } = await admin.auth.admin.getUserById(record.customer_id);
  const to = u?.user?.email;
  if (!to) return new Response('no email on file');

  // Claim it first, so a repeated delivery of the same change can't send it twice.
  const { error: dup } = await admin.from('email_sent').insert({ key: email.key });
  if (dup) return new Response('already sent');

  const link = `https://thetalab3d.shop/bill.html?cart=${record.cart_id}`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('EMAIL_FROM') ?? 'Theta Labs 3D <orders@thetalab3d.shop>',
      reply_to: 'info@thetalab3d.shop',
      to, subject: email.subject,
      text: [...email.lines, '', `Your order: ${link}`, '', 'Theta Labs 3D · Tempe, Arizona'].join('\n'),
      html: `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#111">
        ${email.lines.map(l => `<p>${esc(l)}</p>`).join('')}
        <p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#c8ff00;color:#000;text-decoration:none;border-radius:6px;font-weight:600">Open your order</a></p>
        <p style="color:#666;font-size:13px">Theta Labs 3D · Tempe, Arizona. You get these emails about orders you placed.</p></div>`,
    }),
  });
  if (!res.ok) {
    await admin.from('email_sent').delete().eq('key', email.key);  // let a later delivery try again
    console.error(`email ${email.key} failed: ${await res.text()}`);
    return new Response('send failed', { status: 502 });
  }
  return new Response(`sent ${email.key}`);
});
