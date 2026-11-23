// Guest identity: an illustrated face and a name like "Carbon-13", both worked out from the account id, so the same
// guest always gets the same ones and nothing extra is stored. No DOM, so tests/avatar.test.mjs runs it in Node.
//
// Faces: DiceBear's "Lorelei" style by Lisa Wischofsky (CC0 1.0, no credit required), served as an image by
// api.dicebear.com. It gets a scrambled seed, never the account id, so the face can't be linked back to the account;
// it does see the visitor's IP address (privacy.html). If it can't be reached, the background colour shows instead.

const BACKGROUNDS = ['c8ff00', 'efeadd', 'ff5a1f', '8ecbe0'];  // light site colours (the faces are drawn in black), no leading #
// All 118 elements in order, so an element's position + 1 is its atomic number.
const ELEMENTS = ('Hydrogen,Helium,Lithium,Beryllium,Boron,Carbon,Nitrogen,Oxygen,Fluorine,Neon,Sodium,Magnesium,Aluminium,' +
  'Silicon,Phosphorus,Sulfur,Chlorine,Argon,Potassium,Calcium,Scandium,Titanium,Vanadium,Chromium,Manganese,Iron,Cobalt,' +
  'Nickel,Copper,Zinc,Gallium,Germanium,Arsenic,Selenium,Bromine,Krypton,Rubidium,Strontium,Yttrium,Zirconium,Niobium,' +
  'Molybdenum,Technetium,Ruthenium,Rhodium,Palladium,Silver,Cadmium,Indium,Tin,Antimony,Tellurium,Iodine,Xenon,Caesium,' +
  'Barium,Lanthanum,Cerium,Praseodymium,Neodymium,Promethium,Samarium,Europium,Gadolinium,Terbium,Dysprosium,Holmium,' +
  'Erbium,Thulium,Ytterbium,Lutetium,Hafnium,Tantalum,Tungsten,Rhenium,Osmium,Iridium,Platinum,Gold,Mercury,Thallium,Lead,' +
  'Bismuth,Polonium,Astatine,Radon,Francium,Radium,Actinium,Thorium,Protactinium,Uranium,Neptunium,Plutonium,Americium,' +
  'Curium,Berkelium,Californium,Einsteinium,Fermium,Mendelevium,Nobelium,Lawrencium,Rutherfordium,Dubnium,Seaborgium,' +
  'Bohrium,Hassium,Meitnerium,Darmstadtium,Roentgenium,Copernicium,Nihonium,Flerovium,Moscovium,Livermorium,Tennessine,' +
  'Oganesson').split(',');

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
  const z = 1 + r(ELEMENTS.length);
  // Isotope ("mass") number = protons + neutrons. Light elements have about as many neutrons as protons, heavy ones
  // about 1.5 times as many, so this lands near real isotopes (Carbon-12…14, Iron-55…57, Uranium-~235).
  const mass = z === 1 ? 1 + r(3) : z + Math.round(z * (1 + 0.6 * z / 118)) + r(3) - 1;
  const name = `${ELEMENTS[z - 1]}-${mass}`;
  const bg = BACKGROUNDS[r(BACKGROUNDS.length)];
  const seed = [r(1e9), r(1e9)].map(n => n.toString(36)).join('');  // scrambled: not the account id
  const src = `https://api.dicebear.com/9.x/lorelei/svg?seed=${seed}&backgroundColor=${bg}&radius=20`;
  // alt '' when the name is already shown next to the picture, so screen readers don't read it twice
  const img = (size = 40, alt = name) =>
    `<img class="avatar" src="${src}" width="${size}" height="${size}" alt="${alt}" loading="lazy" style="background:#${bg}">`;
  return { name, img, color: `#${bg}`, z, mass };
}
