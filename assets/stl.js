// Pure STL math and pricing. No DOM, so tests/stl.test.mjs runs it in Node.

export const PLA_DENSITY = 1.24;  // g/cm³
export const SHELL_MM = 1.2;      // walls + top/bottom, approximated as surface area × 1.2 mm

// Returns a Float32Array of triangle vertices: [x1,y1,z1, x2,y2,z2, x3,y3,z3, ...]
export function parseSTL(buffer) {
  const dv = new DataView(buffer);
  if (buffer.byteLength >= 84) {
    const n = dv.getUint32(80, true);
    if (84 + n * 50 === buffer.byteLength) {
      const out = new Float32Array(n * 9);
      for (let i = 0; i < n; i++) {
        const o = 84 + i * 50 + 12;  // skip the normal
        for (let k = 0; k < 9; k++) out[i * 9 + k] = dv.getFloat32(o + k * 4, true);
      }
      return out;
    }
  }
  const text = new TextDecoder().decode(buffer);
  if (!/^\s*solid/.test(text)) throw new Error('Not a valid STL file');
  const nums = [];
  const re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/g;
  for (let m; (m = re.exec(text));) nums.push(+m[1], +m[2], +m[3]);
  if (!nums.length || nums.length % 9 || nums.some(Number.isNaN)) throw new Error('Not a valid STL file');
  return new Float32Array(nums);
}

// Volume (mm³, signed tetrahedra), surface area (mm²), bounding box size (mm), triangle count.
export function measure(v) {
  let vol = 0, area = 0;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < v.length; i += 9) {
    const ax = v[i], ay = v[i + 1], az = v[i + 2];
    const bx = v[i + 3], by = v[i + 4], bz = v[i + 5];
    const cx = v[i + 6], cy = v[i + 7], cz = v[i + 8];
    vol += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
    const ux = bx - ax, uy = by - ay, uz = bz - az, wx = cx - ax, wy = cy - ay, wz = cz - az;
    area += Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx) / 2;
    for (let k = 0; k < 9; k++) {
      const a = k % 3;
      if (v[i + k] < min[a]) min[a] = v[i + k];
      if (v[i + k] > max[a]) max[a] = v[i + k];
    }
  }
  return {
    volume: Math.abs(vol), area, triangles: v.length / 9,
    size: max.map((m, a) => m - min[a]), min, max,
  };
}

// Grams of PLA for one part at the given infill (0–100).
export function estimateWeight({ volume, area }, infill) {
  const shell = Math.min(volume, area * SHELL_MM);
  const mm3 = shell + (volume - shell) * infill / 100;
  return Math.round(mm3 / 1000 * PLA_DENSITY * 10) / 10;
}

// s = one settings row: { rate_min, rate_max, minimum, multicolor, rush_pct }. Same formula as order_price() in SQL.
export function priceRange(grams, qty, colors, rush, s) {
  const calc = rate => {
    let p = Math.max(s.minimum, grams * qty * rate) + (colors > 1 ? s.multicolor : 0);
    if (rush) p *= 1 + s.rush_pct / 100;
    return Math.round(p * 100) / 100;
  };
  return [calc(+s.rate_min), calc(+s.rate_max)];
}

export const DEFAULT_SETTINGS = {
  US: { region: 'US', currency: 'USD', rate_min: 1, rate_max: 2, minimum: 15, multicolor: 5, rush_pct: 25 },
  IN: { region: 'IN', currency: 'INR', rate_min: 6, rate_max: 8, minimum: 300, multicolor: 150, rush_pct: 25 },
};
