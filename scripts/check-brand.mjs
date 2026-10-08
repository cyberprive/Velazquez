#!/usr/bin/env node
/* ============================================================
   Real Zero — identity guard.

   Since 2026-10-08 the site wears the Real Zero identity kit: Ink #1E2226,
   White, Dark Blue #1D2D3D (the only accent) on Paper #F2F2F3, with the
   outlined wordmark and the zero in /assets. Before that each stylesheet
   carried its own palette and every page loaded a Word-set PNG logo, and a
   re-colour is exactly the kind of change where one footer or one inline
   style nobody rechecked keeps the old orange alive.

   This fails the build if any shipped page, stylesheet or script still
   reaches for a retired colour or a retired logo file. Orangetheory's own
   assets (the splat, the line icons) are PNGs and are not scanned — they
   are OTF's and keep their colours.

     node scripts/check-brand.mjs      # exits 1 on any retired reference
   ============================================================ */

import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SKIP_DIRS = new Set(['.git', 'node_modules', '.vercel', '.claude', 'fonts', 'testing', 'scripts', 'Context', 'Branding Guide']);
const SCAN_EXTS = new Set(['.html', '.css', '.js', '.svg', '.json', '.xml', '.txt']);

// The Word-set two-word block the kit replaced.
const RETIRED_FILES = ['realzero-logo-dark.png', 'realzero-logo-light.png'];

// The site's own pre-kit palettes (Carbon / Soft White / Steel / Ice Blue on the
// main site, Bone / Dark / surfaces on the QR pages) and Orangetheory's orange,
// which is never a Real Zero accent. #0A0A0A is not listed: the QR vinyl crop on
// /velazquez has that ground baked in, and the intro overlay has to match it.
const RETIRED_HEX = [
  '#111318', '#1A1C22', '#15181F', '#F7F7F5', '#8D8D8D', '#5DA9E9',
  '#FF6F0D', '#FDF7EA', '#141414', '#1B1B1B', '#2A2A2A', '#1DD0FD',
  '#41D48A', '#FF6B6B', '#079B4A', '#DD1F1F',
];
const RETIRED_RGB = ['255,111,13', '247,247,245', '253,247,234', '17,19,24', '93,169,233'];

const hexPattern = new RegExp(`(?<![0-9a-f])(?:${RETIRED_HEX.map(h => h.slice(1)).join('|')})(?![0-9a-f])`, 'gi');
const rgbPattern = new RegExp(`rgba?\\(\\s*(?:${RETIRED_RGB.map(t => t.split(',').join('\\s*,\\s*')).join('|')})\\s*[,)]`, 'g');

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(path);
    } else if (entry.isFile() && SCAN_EXTS.has(extname(entry.name))) {
      yield path;
    }
  }
}

const failures = [];
let checked = 0;

for await (const absolute of walk(ROOT)) {
  const file = relative(ROOT, absolute);
  const text = readFileSync(absolute, 'utf8');
  checked++;
  for (const name of RETIRED_FILES) {
    if (text.includes(name)) failures.push(`${file}: references retired logo ${name}`);
  }
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    // '#' + 6 hex chars only — a CSS id selector cannot collide with these values.
    for (const m of line.matchAll(hexPattern)) {
      if (line[m.index - 1] === '#' || line.slice(m.index - 3, m.index) === '%23') failures.push(`${file}:${i + 1}: retired colour #${m[0]}`);
    }
    for (const m of line.matchAll(rgbPattern)) failures.push(`${file}:${i + 1}: retired colour ${m[0]}`);
  });
}

console.log(`brand: checked ${checked} file(s) for retired colours and logo files`);

if (failures.length) {
  for (const failure of failures) console.error(`brand: ${failure}`);
  console.error('\nbrand: FAIL — the site wears the identity kit (Ink / White / Dark Blue on Paper); see BRAND_MANUAL.md §8.');
  process.exit(1);
}

console.log('brand: OK');
