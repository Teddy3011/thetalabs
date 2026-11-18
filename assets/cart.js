// The cart lives in this browser (IndexedDB, because STL files can be up to 50 MB). Nothing is uploaded until checkout.
// An item is everything one order row needs, plus the file and a few strings for showing it:
// { id, file, filename, order: {...columns for public.orders}, lo, hi, currency, summary, added }
const DB = 'theta-cart', STORE = 'items';

function open() {
  return new Promise((ok, fail) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error);
  });
}
async function run(mode, fn) {
  const db = await open();
  return new Promise((ok, fail) => {
    const tx = db.transaction(STORE, mode), req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); ok(req?.result); };
    tx.onerror = tx.onabort = () => { db.close(); fail(tx.error); };
  });
}

export const list = async () => ((await run('readonly', s => s.getAll())) || []).sort((a, b) => a.added - b.added);
export const remove = id => run('readwrite', s => s.delete(id));
export const clear = () => run('readwrite', s => s.clear());
export async function add(item) {
  const items = await list();
  // One checkout is one payment in one currency, so a cart holds one region's parts at a time.
  if (items.length && items[0].currency !== item.currency)
    throw new Error(`Your cart has ${items[0].currency} parts. Check out or empty it before adding ${item.currency} parts.`);
  if (items.length >= 10) throw new Error('Your cart holds up to 10 parts. Check out these first.');
  await run('readwrite', s => s.put({ ...item, id: crypto.randomUUID(), added: Date.now() }));
  count();
}
// Keeps every [data-cart-count] badge (in the nav) up to date.
export async function count() {
  let n = 0;
  try { n = (await list()).length; } catch {}
  for (const el of document.querySelectorAll('[data-cart-count]')) { el.textContent = n; el.hidden = !n; }
  return n;
}
