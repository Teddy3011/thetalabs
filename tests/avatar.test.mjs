import assert from 'node:assert/strict';
import { identity } from '../assets/avatar.js';

const ids = Array.from({ length: 500 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
const all = ids.map(identity);

// the same account always gets the same tile and name
assert.equal(identity(ids[7]).name, all[7].name);
assert.equal(identity(ids[7]).svg(), all[7].svg());

// names look like "Carbon-13"; the numbers make chemical sense
for (const a of all) {
  assert.match(a.name, /^[A-Z][a-z]+-\d{1,3}$/);
  assert.ok(a.z >= 1 && a.z <= 118);
  assert.ok(a.mass >= a.z, 'an isotope has at least as many nucleons as protons');
  const svg = a.svg(40);
  assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
  assert.ok(svg.includes(`>${a.symbol}</text>`) && svg.includes(`>${a.z}</text>`) && svg.includes(`>${a.mass}</text>`));
}
const carbon = all.find(a => a.symbol === 'C');
if (carbon) assert.equal(carbon.z, 6);

// ~350 realistic names (118 elements × ~3 isotopes) repeat among many guests; the tiles (× colour pairs) rarely do
assert.ok(new Set(all.map(a => a.name)).size > 200, 'names vary');
assert.ok(new Set(all.map(a => a.svg())).size > 470, 'tiles vary');

// names and labels only use fixed words and digits, so no markup can get in
assert.ok(all.every(a => !/[<>"&]/.test(a.name)));
console.log('avatar tests passed');
