// Supabase → Project Settings → API Keys. The publishable key is public by design (RLS protects the data).
// Never put a secret (sb_secret_…) or service_role key here.
export const SUPABASE_URL = 'https://idbyxkpqjwnyksxtcyeo.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_N72T_G9xnDkTiY5dpcDxxw_pPyHKWkT';  // publishable key
// Card payments: set to true once the two Stripe functions are deployed (README, "Payments"). Until then
// customers can only choose pay on pickup.
export const CARD_PAYMENTS = false;
// WhatsApp updates: set to true once whatsapp-notify is deployed and Meta approved the templates (README section 10).
// Until then checkout doesn't ask for a WhatsApp number, because nothing could be sent to it.
export const WHATSAPP_UPDATES = false;
