import assert from 'node:assert/strict';
import { identity } from '../assets/avatar.js';

const ids = Array.from({ length: 500 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
const all = ids.map(identity);

// the same account always gets the same face and name
assert.equal(identity(ids[7]).name, all[7].name);
assert.equal(identity(ids[7]).img(), all[7].img());

for (const [i, a] of all.entries()) {
  assert.match(a.name, /^[A-Z][a-z]+-\d{1,3}$/);
  assert.ok(a.z >= 1 && a.z <= 118 && a.mass >= a.z, 'isotope numbers make chemical sense');
  const tag = a.img(40), src = tag.match(/src="([^"]+)"/)[1];
  assert.ok(src.startsWith('https://api.dicebear.com/9.x/lorelei/svg?seed='));
  assert.ok(!src.includes(ids[i]) && !src.includes(ids[i].replace(/-/g, '')), 'the account id is never sent');
  assert.match(tag, /alt="[A-Za-z]+-\d+"/);
}

// ~350 realistic names repeat among many guests; faces (seed × background) rarely do
assert.ok(new Set(all.map(a => a.name)).size > 200, 'names vary');
assert.ok(new Set(all.map(a => a.img())).size === all.length, 'faces vary');
assert.ok(all.every(a => !/[<>"&]/.test(a.name)));
console.log('avatar tests passed');
