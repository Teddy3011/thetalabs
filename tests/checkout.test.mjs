// Cart checkout: partial failures are recoverable, retries join the same order, nothing is sent twice.
import assert from 'node:assert/strict';
import { checkout } from '../assets/checkout.js';

function world({ failUpload = new Set(), failInsert = new Set(), dropAfterInsert = new Set() } = {}) {
  const storage = new Set(), orders = [], cart = new Map(), state = { pending: null, n: 0 };
  const deps = {
    uuid: () => `id-${++state.n}`,
    pending: { get: () => state.pending, set: v => { state.pending = v; }, clear: () => { state.pending = null; } },
    savePath: async (id, path) => { cart.get(id).uploadPath = path; },
    remove: async id => { cart.delete(id); },
    upload: async (path, file) => {
      if (failUpload.has(file)) { failUpload.delete(file); return { error: { message: 'Network error' } }; }
      if (storage.has(path)) return { error: { statusCode: '409', message: 'The resource already exists' } };
      storage.add(path); return { error: null };
    },
    insert: async row => {
      if (failInsert.has(row.filename)) { failInsert.delete(row.filename); return { error: { message: 'Guest accounts can have 10 parts in progress.' } }; }
      if (orders.some(o => o.file_path === row.file_path)) return { error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
      orders.push(row);
      if (dropAfterInsert.has(row.filename)) { dropAfterInsert.delete(row.filename); return { error: { message: 'Failed to fetch' } }; }
      return { error: null };
    },
  };
  const add = name => cart.set(name, { id: name, filename: name, file: name, order: { filename: name } });
  return { deps, storage, orders, cart, state, add, items: () => [...cart.values()] };
}

// all good: one order, cart emptied, pending cleared
{
  const w = world(); ['a.stl', 'b.stl'].forEach(w.add);
  const r = await checkout(w.items(), 'u1', w.deps);
  assert.deepEqual(r.sent, ['a.stl', 'b.stl']); assert.equal(r.failed.length, 0);
  assert.equal(new Set(w.orders.map(o => o.cart_id)).size, 1, 'one order number');
  assert.equal(w.cart.size, 0); assert.equal(w.state.pending, null);
}

// partial failure: the good parts go through, the failed one stays, and the retry joins the SAME order
{
  const w = world({ failUpload: new Set(['b.stl']) }); ['a.stl', 'b.stl', 'c.stl'].forEach(w.add);
  const r1 = await checkout(w.items(), 'u1', w.deps);
  assert.deepEqual(r1.sent, ['a.stl', 'c.stl']);
  assert.deepEqual(r1.failed.map(f => f.filename), ['b.stl']);
  assert.match(r1.failed[0].message, /Network error/);
  assert.deepEqual([...w.cart.keys()], ['b.stl'], 'only the failed part stays in the cart');
  assert.equal(w.state.pending.cartId, r1.cartId, 'the order number is remembered');
  const r2 = await checkout(w.items(), 'u1', w.deps);
  assert.deepEqual(r2.sent, ['b.stl']); assert.equal(r2.cartId, r1.cartId, 'retry adds to the same order');
  assert.equal(w.orders.length, 3); assert.equal(new Set(w.orders.map(o => o.cart_id)).size, 1);
  assert.equal(w.state.pending, null);
}

// upload worked but the order row failed: the retry reuses the uploaded file, no second copy
{
  const w = world({ failInsert: new Set(['a.stl']) }); w.add('a.stl');
  await checkout(w.items(), 'u1', w.deps);
  const path = w.cart.get('a.stl').uploadPath;
  assert.ok(path && w.storage.has(path));
  const r = await checkout(w.items(), 'u1', w.deps);
  assert.deepEqual(r.sent, ['a.stl']); assert.equal(w.storage.size, 1, 'one file in storage'); assert.equal(w.orders[0].file_path, path);
}

// the order was saved but the reply was lost: the retry sees "already ordered" and doesn't create a duplicate
{
  const w = world({ dropAfterInsert: new Set(['a.stl']) }); w.add('a.stl');
  const r1 = await checkout(w.items(), 'u1', w.deps);
  assert.equal(r1.failed.length, 1);
  const r2 = await checkout(w.items(), 'u1', w.deps);
  assert.deepEqual(r2.sent, ['a.stl']); assert.equal(w.orders.length, 1, 'still one order row'); assert.equal(w.cart.size, 0);
}

// a different customer never joins someone else's pending order, and never reuses their file path
{
  const w = world({ failUpload: new Set(['a.stl']) }); w.add('a.stl');
  const r1 = await checkout(w.items(), 'u1', w.deps);
  const r2 = await checkout(w.items(), 'u2', w.deps);
  assert.notEqual(r2.cartId, r1.cartId);
  assert.ok(w.orders[0].file_path.startsWith('u2/'));
}

// double click: a second checkout while one is running does nothing
{
  const w = world(); w.add('a.stl');
  const [r1, r2] = await Promise.all([checkout(w.items(), 'u1', w.deps), checkout(w.items(), 'u1', w.deps)]);
  assert.ok(r2.busy && !r1.busy); assert.equal(w.orders.length, 1);
}
console.log('checkout tests passed');
