// Stripe webhook signature check (https://docs.stripe.com/webhooks#verify-manually):
// header "t=<unix time>,v1=<hex HMAC-SHA256 of `${t}.${body}`>,v1=…"; reject anything older than 5 minutes.
// Plain Web Crypto, so it runs in Deno (Supabase) and in Node (tests/webhook.test.mjs).
export async function verifyStripeSignature(body: string, header: string | null, secret: string, now = Date.now()): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = header.split(',').map(p => p.split('='));
  const t = parts.find(([k]) => k === 't')?.[1];
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || !sigs.length || Math.abs(now / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${body}`)));
  const expected = Array.from(mac, b => b.toString(16).padStart(2, '0')).join('');
  return sigs.some(sig => sig.length === expected.length && [...sig].reduce((d, c, i) => d | (c.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0);
}
