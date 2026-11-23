// Guest identity: a periodic-table tile and a name like "Carbon-13", both worked out from the account id,
// so the same guest always gets the same ones and nothing extra is stored. No DOM, so tests/avatar.test.mjs runs it in Node.

const COLORS = [  // filament colours from the site palette: [fill, ink that reads on it]
  ['#c8ff00', '#090a09'], ['#efeadd', '#090a09'], ['#ff5a1f', '#090a09'],
  ['#8ecbe0', '#090a09'], ['#2a2d29', '#efeadd'], ['#090a09', '#c8ff00'],
];
// All 118 elements in order, so an element's position + 1 is its atomic number.
const ELEMENTS = ('H Hydrogen,He Helium,Li Lithium,Be Beryllium,B Boron,C Carbon,N Nitrogen,O Oxygen,F Fluorine,Ne Neon,' +
  'Na Sodium,Mg Magnesium,Al Aluminium,Si Silicon,P Phosphorus,S Sulfur,Cl Chlorine,Ar Argon,K Potassium,Ca Calcium,' +
  'Sc Scandium,Ti Titanium,V Vanadium,Cr Chromium,Mn Manganese,Fe Iron,Co Cobalt,Ni Nickel,Cu Copper,Zn Zinc,' +
  'Ga Gallium,Ge Germanium,As Arsenic,Se Selenium,Br Bromine,Kr Krypton,Rb Rubidium,Sr Strontium,Y Yttrium,Zr Zirconium,' +
  'Nb Niobium,Mo Molybdenum,Tc Technetium,Ru Ruthenium,Rh Rhodium,Pd Palladium,Ag Silver,Cd Cadmium,In Indium,Sn Tin,' +
  'Sb Antimony,Te Tellurium,I Iodine,Xe Xenon,Cs Caesium,Ba Barium,La Lanthanum,Ce Cerium,Pr Praseodymium,Nd Neodymium,' +
  'Pm Promethium,Sm Samarium,Eu Europium,Gd Gadolinium,Tb Terbium,Dy Dysprosium,Ho Holmium,Er Erbium,Tm Thulium,Yb Ytterbium,' +
  'Lu Lutetium,Hf Hafnium,Ta Tantalum,W Tungsten,Re Rhenium,Os Osmium,Ir Iridium,Pt Platinum,Au Gold,Hg Mercury,' +
  'Tl Thallium,Pb Lead,Bi Bismuth,Po Polonium,At Astatine,Rn Radon,Fr Francium,Ra Radium,Ac Actinium,Th Thorium,' +
  'Pa Protactinium,U Uranium,Np Neptunium,Pu Plutonium,Am Americium,Cm Curium,Bk Berkelium,Cf Californium,Es Einsteinium,Fm Fermium,' +
  'Md Mendelevium,No Nobelium,Lr Lawrencium,Rf Rutherfordium,Db Dubnium,Sg Seaborgium,Bh Bohrium,Hs Hassium,Mt Meitnerium,Ds Darmstadtium,' +
  'Rg Roentgenium,Cn Copernicium,Nh Nihonium,Fl Flerovium,Mc Moscovium,Lv Livermorium,Ts Tennessine,Og Oganesson').split(',').map(e => e.split(' '));

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
  const i = r(ELEMENTS.length), [symbol, element] = ELEMENTS[i], z = i + 1;
  // Isotope ("mass") number = protons + neutrons. Light elements have about as many neutrons as protons, heavy ones
  // about 1.5 times as many, so this lands near real isotopes (Carbon-12…14, Iron-55…57, Uranium-~235).
  const mass = z === 1 ? 1 + r(3) : z + Math.round(z * (1 + 0.6 * z / 118)) + r(3) - 1;
  const bg = r(COLORS.length);
  let band = r(COLORS.length - 1); if (band >= bg) band++;  // the bottom band is always a different colour
  const [fill, ink] = COLORS[bg], name = `${element}-${mass}`;
  const small = 'font-family="Space Mono, ui-monospace, monospace" font-size="6"';
  const svg = (size = 40, label = name) =>
    `<svg class="avatar" width="${size}" height="${size}" viewBox="0 0 40 40" role="img" aria-label="${label}">` +
    `<rect width="40" height="40" rx="8" fill="${fill}"/>` +
    `<path d="M0 31h40v3H0z" fill="${COLORS[band][0]}"/>` +
    `<text x="4" y="8.5" fill="${ink}" ${small}>${z}</text>` +
    `<text x="36" y="8.5" fill="${ink}" ${small} text-anchor="end">${mass}</text>` +
    `<text x="20" y="${symbol.length > 1 ? 25.5 : 26}" fill="${ink}" font-family="Fraunces, Georgia, serif" font-weight="600" ` +
    `font-size="${symbol.length > 1 ? 16 : 19}" text-anchor="middle">${symbol}</text></svg>`;
  return { name, svg, color: fill, symbol, z, mass };
}
