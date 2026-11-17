/* Estimate-slip printer: a small thermal printer that feeds out the estimate on paper you can tear off.
   Plain JS + CSS (estimate.css, ".rp"). It only decorates a slip that is already on the page as ordinary text,
   so the estimate stays readable if this file fails to load.
   The paper always feeds out of the slot (it is the point of the thing, and it's a short, slow, one-way movement);
   with reduced motion the extras are off: no curl as it rises and no printer hum (estimate.css).

   The page builds the slip's HTML from a list of lines (title / text / row / divider), the same idea as the `lines`
   prop of React Bits Pro's Receipt Printer, so that component can take this one's place later: see README. */

// root: an element containing .slip (the static estimate). Returns { update(html | null, rows), tear(), print() }.
export function mount(root) {
  const motion = document.documentElement.classList.contains('motion');
  const slip = root.querySelector('.slip');
  root.classList.add('rp');
  root.innerHTML = `
    <div class="rp-well"><div class="rp-paper">
      <span class="rp-grip" aria-hidden="true">pull up to tear</span>
    </div></div>
    <div class="rp-machine" aria-hidden="true"><span class="rp-slot"></span><span class="rp-led"></span><span class="rp-name">Theta Labs · estimate printer</span></div>
    <button class="rp-btn" type="button" hidden>Tear off your estimate</button>`;
  const paper = root.querySelector('.rp-paper'), btn = root.querySelector('.rp-btn'), grip = root.querySelector('.rp-grip');
  paper.append(slip);
  let state = 'empty', html = null, count = 0;  // empty → printing → printed → torn

  const set = s => { state = root.dataset.state = s; btn.hidden = s === 'empty' || s === 'printing'; btn.textContent = s === 'torn' ? 'Print a fresh slip' : 'Tear off your estimate'; };
  let feed = null;
  const move = (y, ms) => {
    feed?.cancel();
    paper.style.transition = ms ? `transform ${ms}ms cubic-bezier(.16, 1, .3, 1)` : 'none';
    paper.style.transform = y;
  };

  function print() {
    if (!html) return;
    slip.innerHTML = html;
    move('translateY(0)');  // resting place once fed
    set('printing');
    // Feed from inside the printer (100% = fully below the slot) one line at a time: every keyframe is a short
    // eased pulse, like a thermal printer's stepper motor. The paper leans back a little while it rises.
    const lines = Math.min(Math.max(count || 1, 6), 28) * 2, ms = Math.min(3200, lines * 55), curl = motion ? 9 : 0;
    const frames = Array.from({ length: lines + 1 }, (_, i) => {
      const k = i / lines;
      return { offset: k, easing: 'cubic-bezier(.2, .9, .3, 1)',
        transform: `perspective(700px) translateY(${(1 - k) * 100}%) rotateX(${curl * (1 - k) * k * 4}deg)` };
    });
    feed = paper.animate(frames, { duration: ms });
    feed.onfinish = () => { feed = null; if (state === 'printing') set('printed'); };
  }
  function tear() {
    if (state !== 'printed') return;
    set('torn');
    move('translateY(-1.4rem) rotate(-1.6deg)', 420);
  }
  btn.addEventListener('click', () => state === 'torn' ? print() : tear());

  // Pull the grip upward (mouse or touch) to tear. The button above does the same thing from the keyboard.
  let start = null, t0 = 0;
  grip.addEventListener('pointerdown', e => { if (state !== 'printed') return; start = e.clientY; t0 = e.timeStamp; grip.setPointerCapture(e.pointerId); });
  grip.addEventListener('pointermove', e => { if (start !== null) move(`translateY(${Math.min(0, e.clientY - start) * 0.6}px)`); });
  const release = e => {
    if (start === null) return;
    const dy = e.clientY - start, fast = dy < -12 && e.timeStamp - t0 < 220;
    start = null;
    dy < -50 || fast ? tear() : move('translateY(0)', 300);
  };
  grip.addEventListener('pointerup', release);
  grip.addEventListener('pointercancel', release);

  set('empty');
  return {
    print, tear,
    // New values: the first slip feeds out; after that the text just updates in place so options never re-trigger the animation.
    update(next, rows) {
      html = next; count = rows;
      if (!next) { set('empty'); move('translateY(100%)'); slip.innerHTML = ''; return; }
      if (state === 'empty') print(); else slip.innerHTML = next;
    },
  };
}
