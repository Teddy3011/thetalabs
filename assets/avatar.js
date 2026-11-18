// Guest identity: a geometric avatar and a name like "Orange Gear 42", both worked out from the account id,
// so the same guest always gets the same ones and nothing extra is stored. No DOM, so tests/avatar.test.mjs runs it in Node.

const COLORS = [  // filament colours from the site palette: [name, fill, ink that reads on it]
  ['Lime', '#c8ff00', '#090a09'], ['Bone', '#efeadd', '#090a09'], ['Orange', '#ff5a1f', '#090a09'],
  ['Sky', '#8ecbe0', '#090a09'], ['Graphite', '#2a2d29', '#efeadd'], ['Ink', '#090a09', '#c8ff00'],
];
const THINGS = ['Gear', 'Bracket', 'Hinge', 'Spool', 'Nozzle', 'Layer', 'Vase', 'Clip', 'Knob', 'Mount', 'Tag', 'Bolt'];

// FNV-1a: a small, stable string hash. Each draw takes the next few bits.
function bits(id) {
  let h = 0x811c9dc5;
  for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  let x = h || 1;
  return n => {  // xorshift32, so we never run out of bits
    x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    return x % n;
  };
}

export function identity(id) {
  const r = bits(id);
  const bg = r(COLORS.length);
  let fg = r(COLORS.length - 1); if (fg >= bg) fg++;  // always two different colours
  const name = `${COLORS[fg][0]} ${THINGS[r(THINGS.length)]} ${10 + r(90)}`;
  // A 4 × 4 grid of tiles, mirrored left to right like an identicon. Each tile is one of five shapes, rotated.
  const [, back] = COLORS[bg], [, front] = COLORS[fg];
  const tiles = [];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 2; x++) {
    const shape = r(5), turn = r(4) * 90;
    for (const cx of [x, 3 - x]) tiles.push(tile(shape, cx * 10, y * 10, cx === x ? turn : (360 - turn) % 360, front));
  }
  const svg = (size = 40, label = name) =>
    `<svg class="avatar" width="${size}" height="${size}" viewBox="0 0 40 40" role="img" aria-label="${label}">` +
    `<rect width="40" height="40" rx="8" fill="${back}"/>${tiles.join('')}</svg>`;
  return { name, svg, color: back };
}

function tile(shape, x, y, turn, fill) {
  const t = `transform="rotate(${turn} ${x + 5} ${y + 5})" fill="${fill}"`;
  return [
    '',                                                                        // empty
    `<path d="M${x} ${y}h10L${x} ${y + 10}z" ${t}/>`,                          // triangle
    `<path d="M${x} ${y}h10a10 10 0 0 1 -10 10z" ${t}/>`,                      // quarter circle
    `<circle cx="${x + 5}" cy="${y + 5}" r="3.2" fill="${fill}"/>`,            // dot
    `<path d="M${x} ${y}h10v3.3h-10zM${x} ${y + 6.7}h10v3.3h-10z" ${t}/>`,     // two layer lines
  ][shape];
}
