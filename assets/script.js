/* Theta Labs 3D — progressive enhancements. The page is complete without this file.
   html.js is set in <head>; html.motion is set there too unless the visitor prefers reduced motion. */
const root = document.documentElement;
const motion = root.classList.contains('motion');

/* ---------- Staggered menu: opens/closes the off-canvas nav. The layer/panel/item animation is CSS. ---------- */
const header = document.querySelector('.site-header');
const nav = document.getElementById('site-nav');
const toggle = document.querySelector('.menu-toggle');
if (header && nav && toggle) {
  nav.querySelectorAll('li').forEach((li, i) => li.style.setProperty('--i', i));

  // Label rolls Menu -> Close -> Menu -> Close and settles (same sequence as the original GSAP component).
  const lines = toggle.querySelector('.menu-toggle-lines');
  const rollLabel = open => {
    const seq = open ? ['Menu', 'Close', 'Menu', 'Close', 'Close'] : ['Close', 'Menu', 'Close', 'Menu', 'Menu'];
    lines.replaceChildren(...seq.map(t => Object.assign(document.createElement('span'), { textContent: t })));
    lines.style.transition = 'none';
    lines.style.transform = 'translateY(0)';
    lines.offsetHeight;  // commit the start position before transitioning
    lines.style.transition = `transform ${0.5 + seq.length * 0.07}s cubic-bezier(.23, 1, .32, 1)`;
    lines.style.transform = `translateY(${-((seq.length - 1) / seq.length) * 100}%)`;
  };

  const isOpen = () => header.classList.contains('menu-open');
  const setOpen = (open, returnFocus) => {
    if (open !== isOpen()) rollLabel(open);
    header.classList.toggle('menu-open', open);
    root.classList.toggle('menu-locked', open);
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (open) nav.querySelector('a').focus({ preventScroll: true });
    else if (returnFocus) toggle.focus();
  };

  toggle.addEventListener('click', () => setOpen(!isOpen()));
  nav.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen()) setOpen(false, true); });
  // composedPath, not contains(): the label roll replaces the clicked <span>, detaching e.target mid-click
  document.addEventListener('click', e => { if (isOpen() && !e.composedPath().includes(header)) setOpen(false); });
  // Tabbing out of the menu closes it, so focus is never trapped.
  header.addEventListener('focusout', e => { if (isOpen() && e.relatedTarget && !header.contains(e.relatedTarget)) setOpen(false); });

  // Active section: the nav link for the section crossing the middle of the viewport gets aria-current.
  const links = [...nav.querySelectorAll('li a')];
  const spy = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      for (const a of links) {
        if (a.hash === '#' + e.target.id) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      }
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  for (const a of links) { const s = document.querySelector(a.hash); if (s) spy.observe(s); }
}

/* ---------- Intro: title -> print (same choreography as the original scroll intro) -> printed logo flies into
   the header logo while the backdrop fades, revealing the page. Any scroll, tap, click or key skips it. ---------- */
const intro = document.getElementById('intro');
if (intro && !root.classList.contains('intro')) intro.remove();
else if (intro) {
  const $ = s => intro.querySelector(s);
  const copy = $('.intro-copy'), printer = $('.intro-printer'), logo = $('.p-logo'), head = $('.p-head'),
        glow = $('.p-glow'), statusText = $('.intro-status-text'), bar = $('.intro-status .p-bar span'),
        layer = $('.intro-layer');
  const target = document.querySelector('.site-header .brand-mark');
  const COPY_MS = 500, PRINT_MS = 1800, FLY_MS = 600, SKIP_MS = 350;  // 2.9 s in total
  const tri = x => { const w = x % 2; return w <= 1 ? w : 2 - w; };  // 0→1→0 sweep
  let raf, done = false;

  const render = p => {
    const fade = Math.min(1, p / 0.14);
    copy.style.opacity = 1 - fade;
    copy.style.transform = `translateY(${-fade * 34}px) scale(${1 - fade * 0.06})`;
    printer.style.opacity = fade;
    head.style.translate = `calc(var(--u) * ${(tri(p * 10) - 0.5) * 6}) calc(var(--u) * ${(tri(p * 14) - 0.5) * 1.6})`;
    glow.style.opacity = p < 1 ? 1 : 0;
    logo.style.clipPath = `inset(${(1 - p) * 100}% 0 0 0)`;
    bar.style.transform = `scaleX(${p})`;
    statusText.textContent = p < 1 ? `Printing · ${Math.round(p * 100)}%` : 'Ready';
    layer.textContent = `Layer ${Math.round(p * 316)}/316`;
  };

  const finish = fast => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    removeEventListener('keydown', onKey);
    render(1);
    const ms = fast ? SKIP_MS : FLY_MS;
    const ease = 'cubic-bezier(.4, 0, .2, 1)';
    const from = logo.getBoundingClientRect();
    const to = target && target.getBoundingClientRect();
    // the machine fades out quickly so only the logo travels; the backdrop fades over the whole flight
    const quick = [$('.intro-status'), layer, $('.intro-skip'), ...printer.querySelectorAll(':scope > :not(.p-logo)')];
    if (to && to.width && to.bottom > 0) {
      logo.animate([{ transform: 'none' }, { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width})` }],
        { duration: ms, easing: ease, fill: 'forwards' });
    } else {
      quick.push(logo);
    }
    quick.forEach(el => el.animate([{}, { opacity: 0 }], { duration: ms * 0.4, easing: 'ease-out', fill: 'forwards' }));
    $('.intro-bg').animate([{}, { opacity: 0 }], { duration: ms, easing: 'ease-in', fill: 'forwards' });
    const heroCopy = document.querySelector('.hero-copy');
    if (heroCopy) heroCopy.animate([{ opacity: 0, transform: 'translateY(16px)' }, {}], { duration: ms + 400, easing: 'cubic-bezier(.16, 1, .3, 1)' });
    setTimeout(() => { root.classList.remove('intro'); intro.remove(); }, ms);
  };

  const skip = () => finish(true);
  const onKey = e => { if (e.key === 'Tab') e.preventDefault(); skip(); };
  intro.addEventListener('pointerdown', skip);
  addEventListener('keydown', onKey);
  addEventListener('wheel', skip, { once: true, passive: true });
  addEventListener('touchmove', skip, { once: true, passive: true });

  const start = performance.now();
  const tick = now => {
    const p = Math.min(1, Math.max(0, (now - start - COPY_MS) / PRINT_MS));
    render(p);
    if (p >= 1) finish(false); else raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

/* ---------- Pricing market switch (real buttons, aria-pressed). Without JS both markets show side by side. ---------- */
const marketSwitch = document.querySelector('.market-switch');
const priceGrid = document.querySelector('.price-grid');
if (marketSwitch && priceGrid) {
  const buttons = marketSwitch.querySelectorAll('button');
  const select = market => {
    buttons.forEach(b => b.setAttribute('aria-pressed', b.dataset.market === market));
    priceGrid.querySelectorAll('[data-market]').forEach(card => card.classList.toggle('is-active', card.dataset.market === market));
  };
  buttons.forEach(b => b.addEventListener('click', () => select(b.dataset.market)));
  select('us');
  priceGrid.classList.add('has-switch');
  marketSwitch.hidden = false;
}

/* ---------- Footer year ---------- */
document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

/* ---------- Motion-only enhancements (skipped entirely with reduced motion) ---------- */
if (motion) {
  // Decrypt: monospace labels scramble and resolve left to right (vanilla port of React Bits' DecryptedText).
  // Only used on Space Mono text so the width never changes. Screen readers get the real text throughout.
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=<>';
  const KEEP = /[\s/·,.\-]/;  // spacing and punctuation stay put so the label keeps its shape while scrambling
  const decrypt = el => {
    if (!el || el.dataset.decrypting) return;
    const text = (el.dataset.text ??= el.textContent);
    const chars = [...text];
    el.dataset.decrypting = '1';
    const real = Object.assign(document.createElement('span'), { className: 'sr-only', textContent: text });
    const shown = document.createElement('span'), noise = document.createElement('span');
    const visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    noise.className = 'decrypt-noise';
    visual.append(shown, noise);
    el.replaceChildren(real, visual);
    const step = Math.max(1, Math.ceil(chars.length / 18));  // ~18 frames whatever the length
    let revealed = 0;
    const frame = () => {
      shown.textContent = chars.slice(0, revealed).join('');
      noise.textContent = chars.slice(revealed).map(c => KEEP.test(c) ? c : GLYPHS[Math.random() * GLYPHS.length | 0]).join('');
      if (revealed < chars.length) {
        revealed = Math.min(chars.length, revealed + step);
        setTimeout(frame, 40);
      } else {
        el.textContent = text;
        delete el.dataset.decrypting;
      }
    };
    frame();
  };
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (finePointer) {
    for (const el of document.querySelectorAll('main .eyebrow, .p-status-text')) el.addEventListener('pointerenter', () => decrypt(el));
  }

  // Hero labels decrypt as the page appears; with the intro, as soon as it hands over to the page.
  const startHero = () => {
    decrypt(document.querySelector('.hero .eyebrow'));
    // the CSS print finishes ~3.1 s after load; after the intro the hero print is already complete
    setTimeout(() => decrypt(document.querySelector('.printer .p-status-text')),
      root.classList.contains('intro-played') ? 300 : Math.max(0, 3100 - performance.now()));
  };
  if (root.classList.contains('intro')) {
    new MutationObserver((_, obs) => { if (!root.classList.contains('intro')) { obs.disconnect(); startHero(); } })
      .observe(root, { attributes: true, attributeFilter: ['class'] });
  } else {
    startHero();
  }

  // Section reveals: blocks rise 24px and fade in once (CSS in styles.css, "reveal"). Only blocks below the fold
  // are hidden, so nothing visible on load flashes out and back. Grid items stagger via --i.
  const GRIDS = '.cards, .split, .cat-grid';
  const blocks = [...document.querySelectorAll(`main .section .wrap > :not(${GRIDS}), main .section :is(${GRIDS}) > *`)];
  const reveal = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target;
      reveal.unobserve(el);
      el.classList.add('is-in');
      if (el.classList.contains('eyebrow')) decrypt(el);
      // hand the element back to its own hover transitions once revealed
      setTimeout(() => el.classList.remove('reveal', 'is-in'), 1600);
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  for (const el of blocks) {
    if (el.getBoundingClientRect().top < innerHeight) continue;
    if (el.parentElement.matches(GRIDS)) el.style.setProperty('--i', [...el.parentElement.children].indexOf(el));
    el.classList.add('reveal');
    reveal.observe(el);
  }

  // Printer pointer parallax: a few pixels per layer, desktop pointers only, rAF-throttled, resets on leave.
  const printer = document.querySelector('.printer');
  if (printer && finePointer) {
    let x = 0, y = 0, raf = 0;
    const apply = () => { raf = 0; printer.style.setProperty('--px', x.toFixed(3)); printer.style.setProperty('--py', y.toFixed(3)); };
    printer.addEventListener('pointermove', e => {
      const r = printer.getBoundingClientRect();
      x = (e.clientX - r.left) / r.width * 2 - 1;
      y = (e.clientY - r.top) / r.height * 2 - 1;
      raf ||= requestAnimationFrame(apply);
    });
    printer.addEventListener('pointerleave', () => { x = y = 0; raf ||= requestAnimationFrame(apply); });
  }
}
