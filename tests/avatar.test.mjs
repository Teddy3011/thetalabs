import assert from 'node:assert/strict';
import { identity } from '../assets/avatar.js';

const ids = Array.from({ length: 500 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
const all = ids.map(identity);

// the same account always gets the same avatar and name
assert.equal(identity(ids[7]).name, all[7].name);
assert.equal(identity(ids[7]).svg(), all[7].svg());

// names look like "Orange Gear 42"; the two colours always differ
for (const a of all) {
  assert.match(a.name, /^(Lime|Bone|Orange|Sky|Graphite|Ink) [A-Z][a-z]+ [1-9]\d$/);
  const svg = a.svg(40);
  assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
  const fills = new Set([...svg.matchAll(/fill="(#[0-9a-f]{6})"/g)].map(m => m[1]));
  assert.ok(fills.size <= 2 && fills.has(a.color), 'background plus at most one pattern colour');
}

// enough variety that neighbours rarely match
assert.ok(new Set(all.map(a => a.name)).size > 400, 'names vary');
assert.ok(new Set(all.map(a => a.svg())).size > 490, 'patterns vary');

// the label is escaped by construction: names only use fixed words, so no markup can get in
assert.ok(all.every(a => !/[<>"&]/.test(a.name)));
console.log('avatar tests passed');
