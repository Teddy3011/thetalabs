// Runs every tests/*.test.mjs in turn (works the same on Windows, macOS and Linux). Stops at the first failure.
import { readdirSync } from 'node:fs';
for (const f of readdirSync(new URL('.', import.meta.url)).filter(f => f.endsWith('.test.mjs')).sort()) await import(`./${f}`);
