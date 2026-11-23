import assert from 'node:assert/strict';
import { identity } from '../assets/avatar.js';

const ids = Array.from({ length: 500 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
const all = ids.map(identity);

// the same account always gets the same face and name
assert.equal(identity(ids[7]).name, all[7].name);
assert.equal(identity(ids[7]).img(), all[7].img());

for (const [i, a] of all.entries()) {
  assert.match(a.name, /^(Lime|Bone|Orange|Sky) (Gear|Bracket|Hinge|Spool|Nozzle|Layer|Vase|Clip|Knob|Mount|Tag|Bolt) [1-9]\d$/);
  assert.ok(a.img().includes('backgroundColor=' + { Lime: 'c8ff00', Bone: 'efeadd', Orange: 'ff5a1f', Sky: '8ecbe0' }[a.name.split(' ')[0]]), 'the colour word matches the background');
  const tag = a.img(40), src = tag.match(/src="([^"]+)"/)[1];
  assert.ok(src.startsWith('https://api.dicebear.com/9.x/lorelei/svg?seed='));
  assert.ok(!src.includes(ids[i]) && !src.includes(ids[i].replace(/-/g, '')), 'the account id is never sent');
  assert.match(tag, /alt="[A-Za-z]+ [A-Za-z]+ \d\d"/);
}

// 4 × 12 × 90 = 4,320 names, so some repeat among many guests; faces (seed × background) almost never do
assert.ok(new Set(all.map(a => a.name)).size > 450, 'names vary');
assert.ok(new Set(all.map(a => a.img())).size === all.length, 'faces vary');
assert.ok(all.every(a => !/[<>"&]/.test(a.name)));
console.log('avatar tests passed');
