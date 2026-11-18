// Supabase → Project Settings → API. The anon key is public by design (RLS protects the data).
// Never put the service_role key here.
export const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
export const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
// Card payments: set to true once the two Stripe functions are deployed (README, "Payments"). Until then
// customers can only choose pay on pickup.
export const CARD_PAYMENTS = false;
