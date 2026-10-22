// Shared code for the app pages. Needs the supabase-js UMD script loaded before this module.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const configured = !SUPABASE_URL.includes('YOUR_') && !!window.supabase;
export const sb = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
export const money = (n, cur) => new Intl.NumberFormat(cur === 'INR' ? 'en-IN' : 'en-US',
  { style: 'currency', currency: cur || 'USD', minimumFractionDigits: cur === 'INR' ? 0 : 2, maximumFractionDigits: cur === 'INR' ? 0 : 2 }).format(n);
export const range = (lo, hi, cur) => lo === hi ? money(lo, cur) : `${money(lo, cur)}–${money(hi, cur)}`;
export const priceText = o => range(+o.price_low, +o.price_high, o.currency);
export const sizeText = o => [o.size_x, o.size_y, o.size_z].map(n => Math.round(n)).join(' × ') + ' mm';
export const materialText = o => (o.material || 'pla').toUpperCase();
export const colorText = o => o.color_choices?.length ? o.color_choices.join(', ') : `${o.colors} color${o.colors > 1 ? 's' : ''}`;
export const date = d => new Date(d).toLocaleString();

export const STATUS = { open: 'Queued', accepted: 'Accepted', printing: 'Printing', ready: 'Ready', completed: 'Picked up', cancelled: 'Cancelled' };
export const statusText = o => o.status === 'completed' && o.fulfillment === 'delivery' ? 'Delivered' : STATUS[o.status];
export const tag = o => `<span class="tag" data-s="${o.status}">${esc(statusText(o))}</span>`;

export function msg(el, text, isError) {
  el.textContent = text || '';
  el.classList.toggle('err', !!isError);
}

// Shows a notice and returns false when the backend isn't connected yet.
export function requireConfig(el) {
  if (configured) return true;
  el.innerHTML = `<p class="msg err"><span class="preview-label">Preview</span> Accounts and orders aren't live yet: the
    site isn't connected to its database. Use the <a href="./#contact">contact options</a> to order for now.</p>`;
  return false;
}

export async function getUser() {
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user ?? null;
}

export async function getProfile(user) {
  const { data } = await sb.from('profiles').select('*').eq('id', user.id).single();
  return data;
}

// Redirects to login (and back here afterwards) when signed out.
export async function requireUser() {
  const user = await getUser();
  if (!user) location.href = 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search);
  return user;
}

// Nav: Login ↔ Account, shown only once accounts are live
getUser().then(user => {
  for (const a of document.querySelectorAll('[data-auth-link]')) {
    a.parentElement.hidden = !configured;
    a.textContent = user ? 'Account' : 'Login';
    a.href = user ? 'account.html' : 'login.html';
  }
});
