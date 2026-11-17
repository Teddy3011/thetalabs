/* Estimate-slip printer: a small thermal printer that feeds out the estimate on paper you can tear off.
   Plain JS + CSS (estimate.css, ".rp"). It only decorates a slip that is already on the page as ordinary text,
   so the estimate stays readable if this file fails to load, and with reduced motion nothing animates.

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
  const move = (y, ms, steps) => {
    paper.style.transition = ms && motion ? `transform ${ms}ms ${steps ? `steps(${steps}, end)` : 'cubic-bezier(.16, 1, .3, 1)'}` : 'none';
    paper.style.transform = y;
  };

  function print() {
    if (!html) return;
    slip.innerHTML = html;
    move('translateY(100%)');
    paper.offsetHeight;  // commit the hidden position before feeding
    set('printing');
    const rows = Math.min(count || 1, 28), ms = motion ? rows * 85 : 0;
    move('translateY(0)', ms, rows);  // stepped, so the paper advances a line at a time like a thermal head
    setTimeout(() => { if (state === 'printing') set('printed'); }, ms + 30);
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
