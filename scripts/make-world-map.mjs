// Builds assets/world-map.svg: a dotted world map from Natural Earth 110m (public domain, via world-atlas@2.0.2).
// Dots sit on a regular lon/lat grid; each dot is land, United States or India. Run once: node scripts/make-world-map.mjs countries-110m.json assets/world-map.svg
// (countries-110m.json: https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json, not kept in the repo)
import { readFileSync, writeFileSync } from 'node:fs';

const [, , src, out] = process.argv;
const topo = JSON.parse(readFileSync(src, 'utf8'));
const { scale: [sx, sy], translate: [tx, ty] } = topo.transform;

// TopoJSON arcs are delta-encoded, quantized integers.
const arcs = topo.arcs.map(arc => { let x = 0, y = 0; return arc.map(([dx, dy]) => [(x += dx) * sx + tx, (y += dy) * sy + ty]); });
const ring = idx => idx.flatMap((i, k) => { const a = i < 0 ? [...arcs[~i]].reverse() : arcs[i]; return k ? a.slice(1) : a; });
const polys = g => g.type === 'Polygon' ? [g.arcs.map(ring)] : g.type === 'MultiPolygon' ? g.arcs.map(p => p.map(ring)) : [];

const inRing = ([x, y], r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const inPoly = (p, rings) => inRing(p, rings[0]) && !rings.slice(1).some(h => inRing(p, h));

const countries = topo.objects.countries.geometries.map(g => ({ id: g.id, polys: polys(g), bbox: null }));
for (const c of countries) { const pts = c.polys.flat(2); c.bbox = [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))]; }

const STEP = 2.2, TOP = 80, BOTTOM = -58;  // degrees; no Antarctica
const W = Math.round(360 / STEP), H = Math.round((TOP - BOTTOM) / STEP);
const groups = { land: [], us: [], in: [] };
for (let row = 0; row < H; row++) for (let col = 0; col < W; col++) {
  const lon = -180 + (col + 0.5) * STEP, lat = TOP - (row + 0.5) * STEP, p = [lon, lat];
  const hit = countries.find(c => lon >= c.bbox[0] && lon <= c.bbox[2] && lat >= c.bbox[1] && lat <= c.bbox[3] && c.polys.some(r => inPoly(p, r)));
  if (hit) groups[hit.id === '840' ? 'us' : hit.id === '356' ? 'in' : 'land'].push([col, row]);
}
// zero-length round-capped segments draw as dots: "M3 4h0" per dot keeps the file small
const d = pts => pts.map(([x, y]) => `M${x} ${y}h0`).join('');
const px = (lon, lat) => [((lon + 180) / STEP - 0.5).toFixed(1), ((TOP - lat) / STEP - 0.5).toFixed(1)];
const [tX, tY] = px(-111.94, 33.43), [hX, hY] = px(78.49, 17.39);
const svg = `<svg class="world" viewBox="-1 -1 ${W + 1} ${H + 1}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<!-- Dotted world from Natural Earth 110m (public domain) via world-atlas 2.0.2. Generated; see README. -->
<path class="w-land" d="${d(groups.land)}"/>
<path class="w-us" d="${d(groups.us)}"/>
<path class="w-in" d="${d(groups.in)}"/>
<circle class="w-pin w-pin-us" cx="${tX}" cy="${tY}" r="1.3"/>
<circle class="w-pin w-pin-in" cx="${hX}" cy="${hY}" r="1.3"/>
</svg>
`;
writeFileSync(out, svg);
const box = pts => { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
console.log({ W, H, land: groups.land.length, us: groups.us.length, in: groups.in.length, bytes: svg.length,
  tempe: [tX, tY], hyderabad: [hX, hY], usBox: box(groups.us), inBox: box(groups.in) });
