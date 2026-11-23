// Sends the cart as one order: one row per part, all sharing one cart_id. Built to survive failures:
// - the cart_id is remembered (per customer) until every part is in, so a retry adds to the SAME order;
// - each part's storage path is chosen once and saved on the cart item, so a retry never uploads a second copy;
// - "already uploaded" and "already ordered" (unique file_path) count as success, so a part sent just before a
//   dropped connection isn't duplicated;
// - one failed part doesn't stop the others; failed parts stay in the cart, sent ones are removed.
// Database and storage calls are passed in, so tests/checkout.test.mjs runs this in Node.

let busy = false;  // one checkout at a time, whatever the button says

const alreadyUploaded = e => e && (e.statusCode == 409 || /already exists|duplicate/i.test(e.message || ''));
const alreadyOrdered = e => e && (e.code === '23505' || /duplicate key/i.test(e.message || ''));

// deps: { upload(path, file), insert(row), remove(id), savePath(id, path), pending: { get(), set(v), clear() }, uuid(), onProgress? }
export async function checkout(items, userId, deps) {
  if (busy) return { busy: true };
  busy = true;
  try {
    const prev = deps.pending.get();
    const cartId = prev?.userId === userId ? prev.cartId : deps.uuid();
    deps.pending.set({ cartId, userId });
    const sent = [], failed = [];
    for (const [i, it] of items.entries()) {
      deps.onProgress?.(i, it);
      let path = it.uploadPath?.startsWith(userId + '/') ? it.uploadPath : null;
      if (!path) { path = `${userId}/${deps.uuid()}.stl`; await deps.savePath(it.id, path); }
      const up = await deps.upload(path, it.file);
      let error = alreadyUploaded(up.error) ? null : up.error;
      if (!error) {
        const ins = await deps.insert({ ...it.order, file_path: path, cart_id: cartId });
        error = alreadyOrdered(ins.error) ? null : ins.error;
      }
      if (error) { failed.push({ id: it.id, filename: it.filename, message: error.message || String(error) }); continue; }
      await deps.remove(it.id);
      sent.push(it.filename);
    }
    if (!failed.length) deps.pending.clear();
    return { cartId, sent, failed };
  } finally {
    busy = false;
  }
}
