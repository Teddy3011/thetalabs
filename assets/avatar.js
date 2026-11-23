// Guest identity: an illustrated face and a name like "Orange Gear 47", both worked out from the account id, so the same
// guest always gets the same ones and nothing extra is stored. No DOM, so tests/avatar.test.mjs runs it in Node.
//
// Faces: DiceBear's "Lorelei" style by Lisa Wischofsky (CC0 1.0, no credit required), served as an image by
// api.dicebear.com. It gets a scrambled seed, never the account id, so the face can't be linked back to the account;
// it does see the visitor's IP address (privacy.html). If it can't be reached, the background colour shows instead.

// The faces are drawn in black, so only the light site colours: [name used in the guest's name, hex without #]
const BACKGROUNDS = [['Lime', 'c8ff00'], ['Bone', 'efeadd'], ['Orange', 'ff5a1f'], ['Sky', '8ecbe0']];
const THINGS = ['Gear', 'Bracket', 'Hinge', 'Spool', 'Nozzle', 'Layer', 'Vase', 'Clip', 'Knob', 'Mount', 'Tag', 'Bolt'];

// FNV-1a: a small, stable string hash, then xorshift32 so each draw takes fresh bits.
function bits(id) {
  let h = 0x811c9dc5;
  for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  let x = h || 1;
  return n => {
    x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    return x % n;
  };
}

export function identity(id) {
  const r = bits(id);
  // [colour] + [3D-printing word] + [10–99], e.g. "Orange Gear 47". The colour is the face's background.
  const [colour, bg] = BACKGROUNDS[r(BACKGROUNDS.length)];
  const name = `${colour} ${THINGS[r(THINGS.length)]} ${10 + r(90)}`;
  const seed = [r(1e9), r(1e9)].map(n => n.toString(36)).join('');  // scrambled: not the account id
  const src = `https://api.dicebear.com/9.x/lorelei/svg?seed=${seed}&backgroundColor=${bg}&radius=20`;
  // alt '' when the name is already shown next to the picture, so screen readers don't read it twice
  const img = (size = 40, alt = name) =>
    `<img class="avatar" src="${src}" width="${size}" height="${size}" alt="${alt}" loading="lazy" style="background:#${bg}">`;
  return { name, img, color: `#${bg}` };
}
