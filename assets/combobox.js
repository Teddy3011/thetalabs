// Themed combobox over a native <select>, following the SmoothUI Combobox spec: role="combobox" trigger with
// aria-expanded / aria-haspopup="listbox", a listbox of options with a check on the selected one,
// Arrow Up/Down to move, Enter/Space to open or pick, Escape to close (focus back on the trigger),
// and a filter input when there are more than 6 options.
// The hidden <select> stays the source of truth, so FormData, form.x.value and 'input'/'change'
// listeners keep working. Option changes to the select (innerHTML, appendChild) re-sync automatically.

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
let uid = 0;

export function enhanceSelect(select, { swatches } = {}) {
  if (select.nextElementSibling?.classList.contains('combo')) return;
  const id = `combo-${++uid}`;
  const label = select.closest('label');
  const name = (label ? [...label.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ') : select.name).trim();
  const wrap = document.createElement('div');
  wrap.className = 'combo';
  wrap.innerHTML = `
    <button type="button" class="combo-trigger" role="combobox" aria-haspopup="listbox" aria-expanded="false"
      aria-controls="${id}-list" aria-label="${esc(name)}"><span class="combo-value"></span></button>
    <div class="combo-pop" hidden>
      ${select.options.length > 6 ? `<input class="combo-search" type="text" placeholder="Type to filter" autocomplete="off"
        aria-label="Filter ${esc(name)}" aria-controls="${id}-list">` : ''}
      <ul class="combo-list" role="listbox" id="${id}-list" aria-label="${esc(name)}"></ul>
    </div>`;
  select.after(wrap);
  select.hidden = true;
  const trigger = wrap.querySelector('.combo-trigger');
  const pop = wrap.querySelector('.combo-pop');
  const list = wrap.querySelector('.combo-list');
  const search = wrap.querySelector('.combo-search');
  const focusEl = search || trigger;  // the element that holds focus, and so aria-activedescendant, while open
  let active = -1;

  const dot = v => swatches?.[v] ? `<span class="combo-dot" style="background:${swatches[v]}" aria-hidden="true"></span>` : '';
  const items = () => [...list.children].filter(li => !li.hidden && li.getAttribute('aria-disabled') !== 'true');

  function sync() {
    list.innerHTML = [...select.options].map((o, i) => `
      <li role="option" id="${id}-${i}" data-value="${esc(o.value)}" aria-selected="${o.selected}"${o.disabled ? ' aria-disabled="true"' : ''}>
        ${dot(o.value)}<span>${esc(o.text)}</span></li>`).join('');
    const o = select.selectedOptions[0];
    wrap.querySelector('.combo-value').innerHTML = o ? `${dot(o.value)}<span>${esc(o.text)}</span>` : '';
    trigger.disabled = select.disabled;
  }

  function highlight(i) {
    const all = items();
    if (!all.length) { active = -1; focusEl.removeAttribute('aria-activedescendant'); return; }
    active = (i + all.length) % all.length;
    all.forEach((li, k) => li.classList.toggle('is-active', k === active));
    focusEl.setAttribute('aria-activedescendant', all[active].id);
    all[active].scrollIntoView({ block: 'nearest' });
  }

  function open() {
    pop.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    if (search) { search.value = ''; filter(''); search.focus(); }
    highlight(Math.max(0, items().findIndex(li => li.getAttribute('aria-selected') === 'true')));
  }

  function close(returnFocus = true) {
    if (pop.hidden) return;
    pop.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    focusEl.removeAttribute('aria-activedescendant');
    if (returnFocus) trigger.focus();
  }

  function choose(li) {
    if (select.value !== li.dataset.value) {
      select.value = li.dataset.value;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    sync();
    close();
  }

  function filter(q) {
    q = q.trim().toLowerCase();
    for (const li of list.children) li.hidden = !!q && !li.textContent.toLowerCase().includes(q);
    highlight(0);
  }

  function onKey(e) {
    const isOpen = !pop.hidden;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) open();
      else highlight(active + (e.key === 'ArrowDown' ? 1 : -1));
    } else if (e.key === 'Enter' || (e.key === ' ' && e.target === trigger)) {
      e.preventDefault();
      if (!isOpen) return open();
      const li = items()[active];
      if (li) choose(li);
    } else if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab' && isOpen) {
      close(false);
    }
  }

  trigger.addEventListener('click', () => (pop.hidden ? open() : close()));
  trigger.addEventListener('keydown', onKey);
  search?.addEventListener('keydown', onKey);
  search?.addEventListener('input', () => filter(search.value));
  list.addEventListener('mousedown', e => e.preventDefault());  // keep focus where it is while clicking
  list.addEventListener('click', e => {
    const li = e.target.closest('li[role="option"]');
    if (li && li.getAttribute('aria-disabled') !== 'true') choose(li);
  });
  list.addEventListener('mousemove', e => {
    const li = e.target.closest('li[role="option"]');
    const i = items().indexOf(li);
    if (i >= 0 && i !== active) highlight(i);
  });
  document.addEventListener('pointerdown', e => { if (!wrap.contains(e.target)) close(false); });
  select.addEventListener('change', sync);
  new MutationObserver(sync).observe(select, { childList: true, subtree: true, attributes: true });
  sync();
}
