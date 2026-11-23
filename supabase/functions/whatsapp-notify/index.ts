// Supabase Database Webhook (orders, UPDATE) → a WhatsApp template message to the customer, if they opted in.
// Deploy: supabase functions deploy whatsapp-notify --no-verify-jwt
// Secrets: WEBHOOK_SECRET (also sent by the webhook as header x-webhook-secret), WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
// optional WHATSAPP_LANG (default en_US), WHATSAPP_API_VERSION (default v23.0). See README, "WhatsApp updates".
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { decide } from './decide.ts';

Deno.serve(async req => {
  // Only Supabase's own webhook knows this secret; anything else is turned away.
  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) return new Response('Forbidden', { status: 403 });

  const { type, table, record, old_record } = await req.json();
  if (type !== 'UPDATE' || table !== 'orders' || !record?.cart_id) return new Response('ignored');

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: contact } = await admin.from('order_contacts').select('whatsapp').eq('cart_id', record.cart_id).maybeSingle();
  if (!contact) return new Response('no opt-in');
  const { data: cart } = await admin.from('orders').select('*').eq('cart_id', record.cart_id);
  const update = decide(record, old_record, cart ?? []);
  if (!update) return new Response('nothing to send');

  // Claim the update first, so a repeated delivery of the same change can't send it twice.
  const { error: dup } = await admin.from('whatsapp_sent').insert({ key: update.key });
  if (dup) return new Response('already sent');

  const version = Deno.env.get('WHATSAPP_API_VERSION') ?? 'v23.0';
  const res = await fetch(`https://graph.facebook.com/${version}/${Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('WHATSAPP_TOKEN')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: contact.whatsapp.replace('+', ''),
      type: 'template',
      template: {
        name: update.template,
        language: { code: Deno.env.get('WHATSAPP_LANG') ?? 'en_US' },
        components: [
          { type: 'body', parameters: update.params.map(text => ({ type: 'text', text })) },
          // each template's button is a URL button: https://thetalab3d.shop/bill.html?cart={{1}}
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: record.cart_id }] },
        ],
      },
    }),
  });
  if (!res.ok) {
    await admin.from('whatsapp_sent').delete().eq('key', update.key);  // let a later delivery try again
    const err = await res.text();
    console.error(`WhatsApp ${update.template} for cart ${record.cart_id} failed: ${err}`);
    return new Response('send failed', { status: 502 });
  }
  return new Response(`sent ${update.template}`);
});
