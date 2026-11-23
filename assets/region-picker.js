// First-visit country picker on the homepage: a dotted world map where the visitor taps the United States or India.
// The choice sets prices (assets/region.js, remembered) and fires a "theta-region" event the page listens to.
// Shown once: after a choice or "Skip", it stays away; the region button in the header opens it again.
// Built by script, so without JavaScript nobody is blocked; Escape, Skip and the buttons all close it.
import { detect, remember } from './region.js';

const SEEN = 'theta-map-seen';
const store = (k, v) => { try { return v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch { return null; } };
const NAME = { US: 'US', IN: 'India' };
// where the two countries' hotspots sit on the map, as % of its width/height (Tempe and Hyderabad, from make_map)
const SPOT = { US: [19.0, 33.9], IN: [71.5, 45.3] };

function setPill(region) {
  const pill = document.getElementById('region-pill');
  if (pill) pill.querySelector('span').textContent = NAME[region];
}

export async function openPicker(force = false) {
  const chosen = store('theta-region');
  const guess = await detect();
  setPill(guess.region);
  if (!force && (chosen || store(SEEN))) return;
  const svg = await fetch('assets/world-map.svg').then(r => r.ok ? r.text() : '').catch(() => '');
  const el = document.createElement('dialog');
  el.className = 'map-dialog';
  el.setAttribute('aria-labelledby', 'map-title');
  const choice = (r, title, where, note) => `<button class="map-choice" type="button" data-region="${r}">
      <strong>${title}</strong><span>${where}</span><small>${note}</small>
      ${guess.region === r ? `<em>${guess.how === 'choice' ? 'Your current choice' : 'Suggested from your location'}</em>` : ''}</button>`;
  el.innerHTML = `<div class="map-inner wrap">
    <p class="kicker">Theta Labs 3D</p>
    <h2 id="map-title">Where are you?</h2>
    <p class="map-lead">Pick your country so we show the right prices and what we can do for you there.</p>
    <div class="map-stage" data-hover="">${svg}
      ${['US', 'IN'].map(r => `<button class="map-spot" type="button" data-region="${r}" tabindex="-1" aria-hidden="true"
        style="left:${SPOT[r][0]}%;top:${SPOT[r][1]}%"><span>${NAME[r]}</span></button>`).join('')}
    </div>
    <div class="map-choices">
      ${choice('US', 'United States', 'Tempe, Arizona', 'Printing now · pickup or local delivery · prices in $')}
      ${choice('IN', 'India', 'Hyderabad', 'Planned · estimates and inquiries only · prices in ₹')}
    </div>
    <button class="map-skip" type="button">Skip for now</button>
  </div>`;
  // a modal <dialog> keeps focus inside, sends Escape as "cancel" and returns focus when it closes
  document.body.append(el);
  el.showModal();
  document.documentElement.classList.add('map-open');
  const stage = el.querySelector('.map-stage');
  el.querySelector(`.map-choice[data-region="${guess.region}"]`)?.focus();

  const close = region => {
    store(SEEN, '1');
    if (region) { remember(region); setPill(region); window.dispatchEvent(new CustomEvent('theta-region', { detail: region })); }
    el.classList.add('is-closing');
    document.documentElement.classList.remove('map-open');
    const done = () => {
      el.close(); el.remove();
      if (document.activeElement === document.body) document.getElementById('region-pill')?.focus({ preventScroll: true });
    };
    document.documentElement.classList.contains('motion') ? setTimeout(done, 350) : done();
  };
  el.addEventListener('cancel', e => { e.preventDefault(); close(); });
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-region], .map-skip');
    if (b) close(b.dataset.region);
  });
  // light up the country whose button is hovered or focused
  const hover = e => { const b = e.target.closest('[data-region]'); stage.dataset.hover = b ? b.dataset.region : ''; };
  el.addEventListener('pointerover', hover);
  el.addEventListener('focusin', hover);
}

document.getElementById('region-pill')?.addEventListener('click', () => openPicker(true));
openPicker();
