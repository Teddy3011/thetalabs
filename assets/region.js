// Which prices to show: United States (USD) or India (INR).
// 1. The visitor's own earlier choice wins (saved in this browser when they switch).
// 2. Otherwise their country from their IP address, looked up once per visit at country.is (no key, no cookies;
//    the service sees the IP address, which privacy.html says).
// 3. If that lookup is slow or blocked: their time zone. Countries other than India get US pricing.
const KEY = 'theta-region', IP_KEY = 'theta-ip-country';
const store = (s, k, v) => { try { return v === undefined ? s.getItem(k) : s.setItem(k, v); } catch { return null; } };

export const remember = region => store(localStorage, KEY, region);
const byTimezone = () => /^Asia\/(Kolkata|Calcutta)$/.test(Intl.DateTimeFormat().resolvedOptions().timeZone) ? 'IN' : 'US';

// → { region: 'US' | 'IN', how: 'choice' | 'ip' | 'timezone' }
export async function detect() {
  const chosen = store(localStorage, KEY);
  if (chosen === 'US' || chosen === 'IN') return { region: chosen, how: 'choice' };
  let country = store(sessionStorage, IP_KEY);
  if (!country) {
    try {
      const res = await fetch('https://api.country.is/', { signal: AbortSignal.timeout(1500) });
      country = (await res.json()).country;
      if (/^[A-Z]{2}$/.test(country)) store(sessionStorage, IP_KEY, country);
      else country = null;
    } catch { country = null; }
  }
  return country ? { region: country === 'IN' ? 'IN' : 'US', how: 'ip' } : { region: byTimezone(), how: 'timezone' };
}
