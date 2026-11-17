/* Homepage: "Ideas become objects". Draws small objects as stacks of printed layers on <canvas>.
   Everything here is an enhancement: the page reads fine without it, and nothing runs continuously
   (canvases redraw only when something changes). */
(() => {
  const root = document.documentElement;
  const motion = root.classList.contains('motion');
  const TAU = Math.PI * 2;

  /* ---------- shapes: each returns the outlines (plan view, mm) of the layer at height t (0 bottom → 1 top) ---------- */
  const ring = (n, r, cx = 0, cy = 0) => Array.from({ length: n }, (_, i) => {
    const a = i / n * TAU, rr = typeof r === 'function' ? r(a) : r;
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  });
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const arc = (r, cy, from, to, n = 14) => Array.from({ length: n + 1 }, (_, i) => {
    const a = from + (to - from) * i / n;
    return [Math.cos(a) * r, cy + Math.sin(a) * r];
  });
  const SHAPES = {
    vase: {
      name: 'Vase', height: 150, layers: 60,
      at: t => [ring(72, a => (30 + 18 * Math.sin(t * 3 + 0.5) - 10 * t) * (1 + 0.06 * Math.sin(7 * a + t * 4)))],
    },
    bracket: {
      name: 'Bracket', height: 100, layers: 44,
      at: t => {
        if (t < 0.16) return [rect(-55, -30, 55, 30), ring(20, 6, -32, 10), ring(20, 6, 32, 10)];  // base plate, two screw holes
        const d = Math.abs(t * 100 - 60), w = d < 18 ? Math.sqrt(18 * 18 - d * d) : 0;                // big hole through the wall
        return w ? [rect(-55, -30, -w, -18), rect(w, -30, 55, -18)] : [rect(-55, -30, 55, -18)];
      },
    },
    gear: {
      name: 'Gear', height: 26, layers: 13,
      at: () => [ring(144, a => Math.sin(a * 12) > 0 ? 54 : 44), ring(28, 13)],
    },
    theta: {  // the Theta mark as a flat tag: a ring with a crossbar
      name: 'θ tag', height: 16, layers: 8,
      at: () => [
        [...arc(34, -18, Math.PI, TAU), ...arc(34, 18, 0, Math.PI)],
        [[-19, -7], ...arc(19, -18, Math.PI, TAU), [19, -7]],
        [[19, 7], ...arc(19, 18, 0, Math.PI), [-19, 7]],
      ],
    },
    tower: {
      name: 'Model', height: 140, layers: 56,
      at: t => { const s = [42, 33, 24, 15][Math.min(3, t * 4 | 0)]; return [rect(-s, -s, s, s)]; },
    },
  };
  const FILAMENT = { lime: '#c8ff00', bone: '#efeadd', orange: '#ff5a1f', sky: '#8ecbe0', black: '#222522' };

  const mix = (hex, k) => {  // k < 0 darkens, k > 0 lightens
    const n = parseInt(hex.slice(1), 16), to = k < 0 ? 0 : 255, f = Math.abs(k);
    return `rgb(${[n >> 16, n >> 8 & 255, n & 255].map(c => Math.round(c + (to - c) * f)).join(',')})`;
  };

  /* ---------- renderer ---------- */
  // o: { shape, colors:[hex…] (bottom → top), progress 0–1, angle (rad), ink ('light' page or 'dark'), ruler, dims, sparse }
  function draw(canvas, o) {
    const dpr = Math.min(devicePixelRatio || 1, 2), W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return;
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
    const g = canvas.getContext('2d'), shape = SHAPES[o.shape], L = shape.layers;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const dark = o.ink !== 'light', line = dark ? 'rgba(243,244,239,' : 'rgba(9,10,9,';
    const s = Math.min(W / 190, H / (shape.height + 96)), cx = W / 2, baseY = H - 40 * s - 14;
    const cos = Math.cos(o.angle || 0), sin = Math.sin(o.angle || 0);
    const px = ([x, y], z) => [cx + (x * cos - y * sin) * s, baseY + (x * sin + y * cos) * s * 0.45 - z * s];
    const path = (polys, z) => {
      g.beginPath();
      for (const p of polys) { p.forEach((pt, i) => { const [X, Y] = px(pt, z); i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath(); }
    };

    // build plate
    g.beginPath(); g.ellipse(cx, baseY, 84 * s, 84 * s * 0.45, 0, 0, TAU);
    g.fillStyle = dark ? '#141614' : 'rgba(9,10,9,0.07)'; g.fill();
    g.strokeStyle = line + '0.22)'; g.lineWidth = 1; g.stroke();

    const printed = Math.round(Math.min(1, Math.max(0, o.progress)) * L);
    // printed layers, bottom up: each is one flat slice, so the stack shows real layer lines
    for (let i = 0; i < printed; i++) {
      const t = i / L, color = o.colors[Math.min(o.colors.length - 1, t * o.colors.length | 0)];
      path(shape.at(t), (i + 1) / L * shape.height);
      g.fillStyle = i === printed - 1 ? color : mix(color, -0.3 + 0.06 * (i % 2));
      g.fill('evenodd');
      g.strokeStyle = mix(color, -0.55); g.lineWidth = 0.75; g.stroke();
    }
    // the part still to come: outline only (the digital idea)
    g.setLineDash([3, 3]); g.strokeStyle = line + (o.sparse ? '0.5)' : '0.3)'); g.lineWidth = 1;
    const every = o.sparse ? Math.max(4, L / 5 | 0) : Math.max(2, L / 20 | 0);
    for (let i = printed; i < L; i++) {
      if ((i - printed) % every && i !== L - 1) continue;
      path(shape.at(i / L), (i + 1) / L * shape.height); g.stroke();
    }
    g.setLineDash([]);

    g.font = `${Math.max(10, 11 * Math.min(1, s * 1.2))}px "Space Mono", ui-monospace, monospace`;
    if (o.ruler) {  // height scale at the left: a tick every 10 mm, pointer at the current layer
      const x = cx - 92 * s, top = baseY - shape.height * s;
      g.strokeStyle = line + '0.45)'; g.fillStyle = line + '0.7)';
      g.beginPath(); g.moveTo(x, baseY); g.lineTo(x, top);
      for (let mm = 0; mm <= shape.height; mm += 10) { const y = baseY - mm * s; g.moveTo(x, y); g.lineTo(x - (mm % 50 ? 4 : 8), y); }
      g.stroke();
      g.textAlign = 'left'; g.fillText(`${shape.height} mm`, x - 8, top - 8);
      const zy = baseY - printed / L * shape.height * s;
      g.fillStyle = FILAMENT.lime; g.beginPath(); g.moveTo(x + 2, zy); g.lineTo(x + 10, zy - 5); g.lineTo(x + 10, zy + 5); g.fill();
    }
    if (o.dims) {  // a width measurement under the part, like a drawing callout
      const y = baseY + 84 * s * 0.45 + 10, x0 = cx - 55 * s, x1 = cx + 55 * s;
      g.strokeStyle = g.fillStyle = line + '0.75)'; g.beginPath();
      g.moveTo(x0, y); g.lineTo(x1, y); g.moveTo(x0, y - 5); g.lineTo(x0, y + 5); g.moveTo(x1, y - 5); g.lineTo(x1, y + 5); g.stroke();
      g.textAlign = 'center'; g.fillText('110 mm', cx, y + 15);
    }
  }
  const tween = (ms, step, done) => {  // eased 0 → 1; jumps straight to the end without motion
    if (!motion) { step(1); done && done(); return; }
    const t0 = performance.now();
    const tick = now => { const p = Math.min(1, (now - t0) / ms); step(1 - (1 - p) ** 3); p < 1 ? requestAnimationFrame(tick) : done && done(); };
    requestAnimationFrame(tick);
  };
  const onResize = (canvas, fn) => new ResizeObserver(fn).observe(canvas);

  /* ---------- hero: print it yourself ---------- */
  const maker = document.getElementById('maker');
  if (maker) {
    const canvas = maker.querySelector('canvas'), slider = maker.querySelector('input[type=range]'), readout = maker.querySelector('.maker-readout');
    const state = { shape: 'vase', colors: [FILAMENT.lime], progress: motion ? 0 : 1, angle: 0.5, ink: 'dark', ruler: true };
    const render = () => {
      draw(canvas, state);
      const sh = SHAPES[state.shape], n = Math.round(state.progress * sh.layers);
      slider.value = Math.round(state.progress * 100);
      slider.setAttribute('aria-valuetext', `Layer ${n} of ${sh.layers}`);
      readout.textContent = `LAYER ${String(n).padStart(2, '0')}/${sh.layers} · Z ${Math.round(state.progress * sh.height)} MM · ${n === sh.layers ? 'DONE' : n ? 'PRINTING' : 'IDEA'}`;
    };
    let playing = false;
    const print = () => { playing = true; tween(2600, p => { if (playing) { state.progress = p; state.angle = 0.5 + p * 0.5; render(); } }, () => { playing = false; }); };
    slider.addEventListener('input', () => { playing = false; state.progress = slider.value / 100; render(); });
    maker.addEventListener('change', e => {
      if (e.target.name === 'shape') { state.shape = e.target.value; print(); }
      if (e.target.name === 'filament') { state.colors = [FILAMENT[e.target.value]]; render(); }
    });
    // drag (or just move a mouse) across the object to turn it
    let last = null;
    canvas.addEventListener('pointerdown', e => { last = e.clientX; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointerup', () => { last = null; });
    canvas.addEventListener('pointermove', e => {
      if (last === null && e.pointerType !== 'mouse') return;
      if (last !== null) state.angle += (e.clientX - last) * 0.012;
      else state.angle += e.movementX * 0.006;
      if (last !== null) last = e.clientX;
      playing = false; render();
    });
    onResize(canvas, render);
    document.fonts && document.fonts.ready.then(render);
    print();
  }

  /* ---------- "what we make": one drawing per slab; the open slab is the wide one ---------- */
  const slabs = [...document.querySelectorAll('.slab')];
  for (const slab of slabs) {
    const canvas = slab.querySelector('canvas'), d = slab.dataset;
    const render = () => draw(canvas, { shape: d.shape, colors: d.colors.split(',').map(c => FILAMENT[c]), progress: 1, angle: +d.angle || 0.6, ink: d.ink });
    onResize(canvas, render);
    const btn = slab.querySelector('.slab-toggle');
    const open = () => slabs.forEach(s => { const on = s === slab; s.classList.toggle('is-open', on); s.querySelector('.slab-toggle').setAttribute('aria-expanded', on); });
    btn.addEventListener('click', open);
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) slab.addEventListener('pointerenter', open);
  }
  if (slabs.length) { root.classList.add('slabs-ready'); slabs[0].classList.add('is-open'); slabs.forEach((s, i) => s.querySelector('.slab-toggle').setAttribute('aria-expanded', !i)); }

  /* ---------- process: the same bracket as an idea, a reviewed drawing, then a printed part ---------- */
  const steps = document.getElementById('steps');
  if (steps) {
    const canvas = steps.querySelector('canvas'), caption = steps.querySelector('.stage-caption'), btns = [...steps.querySelectorAll('.step')];
    const STAGES = [
      { progress: 0, sparse: true, caption: 'An idea: a file, a sketch or a description' },
      { progress: 0, dims: true, caption: 'Reviewed: size, price and ready date agreed' },
      { progress: 1, caption: 'Printed: ready for pickup or delivery' },
    ];
    const state = { shape: 'bracket', colors: [FILAMENT.orange], angle: 0.55, ink: 'light', progress: 0 };
    let current = -1;
    const show = i => {
      if (i === current) return;
      current = i;
      btns.forEach((b, k) => b.setAttribute('aria-pressed', k === i));
      const st = STAGES[i];
      caption.textContent = st.caption;
      Object.assign(state, { sparse: !!st.sparse, dims: !!st.dims });
      if (st.progress) tween(900, p => { if (current === i) { state.progress = p; draw(canvas, state); } });
      else { state.progress = 0; draw(canvas, state); }
    };
    btns.forEach((b, i) => { b.addEventListener('click', () => show(i)); b.addEventListener('focus', () => show(i)); });
    onResize(canvas, () => draw(canvas, state));
    if (!motion) show(2);
    else {  // play idea → drawing → part once, when the section first comes into view
      show(0);
      new IntersectionObserver((es, io) => {
        if (!es[0].isIntersecting) return;
        io.disconnect();
        setTimeout(() => current === 0 && show(1), 900);
        setTimeout(() => current === 1 && show(2), 2200);
      }, { threshold: 0.5 }).observe(steps);
    }
  }
})();
