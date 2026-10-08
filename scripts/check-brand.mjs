#!/usr/bin/env node
/* ============================================================
   Real Zero — identity guard.

   Since 2026-10-08 the brand site wears the Real Zero identity kit: Ink
   #1E2226, White, Dark Blue #1D2D3D (the only accent) on Paper #F2F2F3, the
   outlined wordmark and the zero in /assets, all copy in self-hosted
   PP Right Grotesk. Before that each stylesheet carried its own palette,
   every page loaded a Word-set PNG logo and the main site pulled Google
   Fonts, and a re-colour is exactly the kind of change where one footer or
   one inline style nobody rechecked keeps an old colour alive.

   The in-studio pages are the exception, on purpose: /velazquez (the station
   page) and the QR landing pages /fuerza, /proteina, /recuperacion are
   Orangetheory co-branded surfaces that match the vinyl and the splat, so
   they keep OTF's Orange / Bone / Dark paint. Everywhere else that palette is
   a retired accent. Real Zero's own mark on those pages is still the kit's
   (the favicon), never the old PNG.

   This fails the build if a shipped page, stylesheet or script reaches for
   a retired colour, a retired logo file or Google Fonts. Orangetheory's PNG
   assets (the splat, the line icons) are binary and are not scanned.

     node scripts/check-brand.mjs      # exits 1 on any retired reference
   ============================================================ */

import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SKIP_DIRS = new Set(['.git', 'node_modules', '.vercel', '.claude', 'fonts', 'testing', 'scripts', 'Context', 'Branding Guide']);
const SCAN_EXTS = new Set(['.html', '.css', '.js', '.svg', '.json', '.xml', '.txt']);

// Retired everywhere: the Word-set two-word block the kit replaced, and the
// Google Fonts call the main site made before it set its type in /fonts/.
const RETIRED_FILES = ['realzero-logo-dark.png', 'realzero-logo-light.png', 'fonts.googleapis.com', 'fonts.gstatic.com'];

// Retired everywhere: the main site's pre-kit palette (Carbon / Soft White /
// Steel / Ice Blue and its form-status colours).
const SITE_HEX = ['#111318', '#1A1C22', '#15181F', '#F7F7F5', '#8D8D8D', '#5DA9E9', '#41D48A', '#FF6B6B'];
const SITE_RGB = ['247,247,245', '17,19,24', '93,169,233'];

// Orangetheory's palette and the QR pages' own surfaces: allowed on the
// in-studio pages only, a retired accent anywhere else.
const OTF_HEX = ['#FF6F0D', '#FDF7EA', '#0A0A0A', '#141414', '#1B1B1B', '#2A2A2A', '#1DD0FD', '#D7D7D7', '#079B4A', '#DD1F1F'];
const OTF_RGB = ['255,111,13', '253,247,234'];
const IN_STUDIO = [/^velazquez\//, /^css\/qr-landing\.css$/, /^(?:fuerza|proteina|recuperacion)\/index\.html$/];

const hexPattern = (list) => new RegExp(`(?<![0-9a-f])(?:${list.map(h => h.slice(1)).join('|')})(?![0-9a-f])`, 'gi');
const rgbPattern = (list) => new RegExp(`rgba?\\(\\s*(?:${list.map(t => t.split(',').join('\\s*,\\s*')).join('|')})\\s*[,)]`, 'g');
const RULES = {
  site: { hex: hexPattern(SITE_HEX), rgb: rgbPattern(SITE_RGB), label: 'retired colour' },
  otf:  { hex: hexPattern(OTF_HEX),  rgb: rgbPattern(OTF_RGB),  label: 'Orangetheory colour outside the in-studio pages' },
};

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
let inStudio = 0;

for await (const absolute of walk(ROOT)) {
  const file = relative(ROOT, absolute);
  const text = readFileSync(absolute, 'utf8');
  checked++;
  for (const name of RETIRED_FILES) {
    if (text.includes(name)) failures.push(`${file}: references retired resource ${name}`);
  }
  const studio = IN_STUDIO.some(re => re.test(file));
  if (studio) inStudio++;
  const rules = studio ? [RULES.site] : [RULES.site, RULES.otf];
  text.split('\n').forEach((line, i) => {
    for (const rule of rules) {
      // '#' + 6 hex chars only — a CSS id selector cannot collide with these values.
      for (const m of line.matchAll(rule.hex)) {
        if (line[m.index - 1] === '#' || line.slice(m.index - 3, m.index) === '%23') failures.push(`${file}:${i + 1}: ${rule.label} #${m[0]}`);
      }
      for (const m of line.matchAll(rule.rgb)) failures.push(`${file}:${i + 1}: ${rule.label} ${m[0]}`);
    }
  });
}

console.log(`brand: checked ${checked} file(s) for retired colours, logo files and font hosts (${inStudio} in-studio file(s) may carry Orangetheory's palette)`);

if (failures.length) {
  for (const failure of failures) console.error(`brand: ${failure}`);
  console.error('\nbrand: FAIL — the brand site wears the identity kit (Ink / White / Dark Blue on Paper); only the in-studio pages carry OTF orange. See BRAND_MANUAL.md §8.');
  process.exit(1);
}

console.log('brand: OK');
