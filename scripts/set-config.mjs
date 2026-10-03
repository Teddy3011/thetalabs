// Change a site-wide value (email, prices, business name...) everywhere at once.
//   node scripts/set-config.mjs                      -> list current values
//   node scripts/set-config.mjs email hello@thetalab3d.shop
// It replaces every literal occurrence of the current value (as recorded in site.config.json)
// in the site's .html/.xml/.txt files, then updates site.config.json. Review with `git diff`.
// No dependencies; the deployed site never runs this.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = join(root, 'site.config.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const [key, value] = process.argv.slice(2);

if (!key) {
  console.table(config);
  process.exit(0);
}
if (!(key in config)) {
  console.error(`Unknown key "${key}". Keys: ${Object.keys(config).join(', ')}`);
  process.exit(1);
}
if (!value) {
  console.error('Missing new value.');
  process.exit(1);
}

const oldValue = config[key];
// URLs inside HTML attributes have & escaped as &amp;
const variants = [[oldValue, value], [oldValue.replaceAll('&', '&amp;'), value.replaceAll('&', '&amp;')]];
let total = 0;

for (const file of readdirSync(root).filter(f => /\.(html|xml|txt)$/.test(f))) {
  const path = join(root, file);
  let text = readFileSync(path, 'utf8');
  let count = 0;
  for (const [from, to] of new Map(variants)) {
    count += text.split(from).length - 1;
    text = text.replaceAll(from, to);
  }
  if (count) {
    writeFileSync(path, text);
    console.log(`${file}: ${count} replaced`);
    total += count;
  }
}

if (!total) {
  console.error(`"${oldValue}" was not found in any file; nothing changed.`);
  process.exit(1);
}
config[key] = value;
writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log(`site.config.json: ${key} = ${value}`);
