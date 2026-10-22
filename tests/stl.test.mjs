// node tests/stl.test.mjs
import assert from 'node:assert/strict';
import { parseSTL, measure, estimateWeight, priceRange, DEFAULT_SETTINGS } from '../assets/stl.js';

// 20 mm cube, 12 outward-facing triangles
const P = [[0,0,0],[20,0,0],[20,20,0],[0,20,0],[0,0,20],[20,0,20],[20,20,20],[0,20,20]];
const F = [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]];

function binary() {
  const buf = new ArrayBuffer(84 + F.length * 50), dv = new DataView(buf);
  dv.setUint32(80, F.length, true);
  F.forEach((f, i) => f.forEach((p, j) => P[p].forEach((c, k) => dv.setFloat32(84 + i * 50 + 12 + j * 12 + k * 4, c, true))));
  return buf;
}
const ascii = new TextEncoder().encode('solid cube\n' + F.map(f =>
  ' facet normal 0 0 0\n  outer loop\n' + f.map(p => `   vertex ${P[p].join(' ')}\n`).join('') + '  endloop\n endfacet\n').join('') +
  'endsolid cube\n').buffer;

for (const buf of [binary(), ascii]) {
  const m = measure(parseSTL(buf));
  assert.equal(m.triangles, 12);
  assert.ok(Math.abs(m.volume - 8000) < 1e-6, `volume ${m.volume}`);
  assert.ok(Math.abs(m.area - 2400) < 1e-6, `area ${m.area}`);
  assert.deepEqual(m.size, [20, 20, 20]);
}

// weight: shell = min(8000, 2400*1.2=2880) = 2880; interior 5120
const m = measure(parseSTL(binary()));
assert.equal(estimateWeight(m, 100), 9.9);                 // 8000 mm³ × 1.24 = 9.92 g
assert.equal(estimateWeight(m, 0), 3.6);                   // 2880 × 1.24 / 1000 = 3.57
assert.equal(estimateWeight(m, 20), Math.round((2880 + 1024) * 1.24 / 100) / 10);  // 4.8

// pricing
const us = DEFAULT_SETTINGS.US, inr = DEFAULT_SETTINGS.IN;
assert.deepEqual(priceRange(5, 1, 1, false, us), [15, 15]);        // minimum applies
assert.deepEqual(priceRange(10, 1, 1, false, us), [15, 20]);
assert.deepEqual(priceRange(10, 2, 2, false, us), [25, 45]);       // 20 g + $5 multicolor
assert.deepEqual(priceRange(10, 2, 2, true, us), [31.25, 56.25]);  // +25% rush
assert.deepEqual(priceRange(40, 1, 3, true, inr), [562.5, 587.5]); // ₹240→300 min +150, ×1.25 / ₹320+150 ×1.25

assert.throws(() => parseSTL(new TextEncoder().encode('hello').buffer), /Not a valid STL/);
console.log('stl tests passed');
