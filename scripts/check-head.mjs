#!/usr/bin/env node
/* ============================================================
   Real Zero — <meta charset> position guard.

   The HTML spec requires the character encoding declaration to appear
   within the first 1024 bytes of the document. A large inline <script>
   pasted at the top of <head> (an analytics or consent block, say) pushes
   it past that limit, and the page then depends on the server's
   Content-Type header to render accented Spanish correctly.

   This has already happened once, site-wide, so it is worth a guard.

     node scripts/check-head.mjs      # exits 1 if any page is over budget
   ============================================================ */

import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const LIMIT = 1024;
const SKIP_DIRS = new Set(['.git', 'node_modules', '.vercel', 'assets', 'fonts', 'testing', 'Context']);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(path);
    } else if (entry.isFile() && extname(entry.name) === '.html') {
      yield path;
    }
  }
}

const failures = [];
let checked = 0;

for await (const absolute of walk(ROOT)) {
  const file = relative(ROOT, absolute);
  const buffer = readFileSync(absolute);
  const offset = buffer.indexOf('<meta charset');
  checked++;

  if (offset === -1) {
    failures.push(`${file}: no <meta charset> declaration`);
  } else if (offset >= LIMIT) {
    failures.push(`${file}: <meta charset> at byte ${offset}, must be < ${LIMIT}`);
  }
}

console.log(`head: checked ${checked} page(s) for <meta charset> within the first ${LIMIT} bytes`);

if (failures.length) {
  for (const failure of failures) console.error(`head: ${failure}`);
  console.error('\nhead: FAIL — move large inline <script> blocks below <meta charset>.');
  process.exit(1);
}

console.log('head: OK');
