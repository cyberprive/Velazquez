#!/usr/bin/env node
/* ============================================================
   Real Zero — contact number guard / sync.

   The public phone number is rendered three different ways across
   the static site:

     display   +34 623 345 790   (footers, body copy, llms.txt)
     tel/JSON  +34623345790      (tel: hrefs, JSON-LD "telephone")
     wa.me     34623345790       (wa.me hrefs, JS CONFIG.whatsapp)

   contact.config.json is the single source of truth. This script
   derives all three renderings from it and either checks or rewrites
   every occurrence in the repo.

     node scripts/contact.mjs            # check (exit 1 on drift)
     node scripts/contact.mjs --write    # rewrite files in place

   Swapping the number is therefore: edit contact.config.json, run
   --write, commit. No hand-editing 26 files.
   ============================================================ */

import { readFileSync, writeFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WRITE = process.argv.includes('--write');

const SCAN_EXTENSIONS = new Set(['.html', '.js', '.txt', '.xml', '.json', '.md']);
// scripts/ and .github/ are not served to the web, so their example numbers
// are documentation, not published contact data.
const SKIP_DIRS = new Set([
  '.git', 'node_modules', '.vercel', 'assets', 'fonts', 'testing', 'Context',
  'scripts', '.github',
]);
const SKIP_FILES = new Set(['contact.config.json']);

// Spanish national numbers are 9 digits, conventionally grouped 3-3-3.
function renderings(e164) {
  const match = /^\+34(\d{9})$/.exec(e164);
  if (!match) throw new Error(`Unsupported number "${e164}". Expected +34 followed by 9 digits.`);
  const national = match[1];
  const grouped = national.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
  return { display: `+34 ${grouped}`, tel: `+34${national}`, wa: `34${national}` };
}

const config = JSON.parse(readFileSync(join(ROOT, 'contact.config.json'), 'utf8'));
const current = renderings(config.phone.current.e164);
const retired = (config.phone.retired ?? []).map((entry) =>
  renderings(typeof entry === 'string' ? entry : entry.e164)
);

// Longest rendering first, so rewriting the display form cannot leave a
// half-rewritten tel form behind.
const FORMS = ['display', 'tel', 'wa'];

// Any Spanish mobile-shaped number, used only to surface numbers that are
// in neither the current nor the retired set (typos, stale hand-edits).
const LOOSE = /\+?34[\s.-]?[67]\d{2}[\s.-]?\d{3}[\s.-]?\d{3}/g;
const KNOWN = new Set([current, ...retired].flatMap((r) => FORMS.map((f) => r[f])));

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(path);
    } else if (entry.isFile() && !SKIP_FILES.has(entry.name) && SCAN_EXTENSIONS.has(extname(entry.name))) {
      yield path;
    }
  }
}

const staleHits = [];
const changedFiles = [];
const unknownHits = [];
const counts = { display: 0, tel: 0, wa: 0 };

// The wa.me form (34623345790) is a substring of the tel form
// (+34623345790), so count longest-first and mask each match out before
// counting the next form. Otherwise every tel: href is counted twice.
function tally(body) {
  let rest = body;
  for (const form of FORMS) {
    const parts = rest.split(current[form]);
    counts[form] += parts.length - 1;
    rest = parts.join('');
  }
}

for await (const absolute of walk(ROOT)) {
  const file = relative(ROOT, absolute);
  const original = readFileSync(absolute, 'utf8');
  let updated = original;

  for (const stale of retired) {
    for (const form of FORMS) {
      if (!updated.includes(stale[form])) continue;
      staleHits.push(`${file}: retired ${form} form ${stale[form]}`);
      updated = updated.split(stale[form]).join(current[form]);
    }
  }

  for (const hit of updated.match(LOOSE) ?? []) {
    if (!KNOWN.has(hit)) unknownHits.push(`${file}: ${hit}`);
  }

  tally(updated);

  if (updated !== original) {
    if (WRITE) writeFileSync(absolute, updated);
    changedFiles.push(file);
  }
}

const total = counts.display + counts.tel + counts.wa;

console.log(`contact: current ${config.phone.current.e164} (${config.phone.current.role})`);
console.log(
  `contact: ${total} occurrence(s) published ` +
  `(${counts.display} display, ${counts.tel} tel/JSON-LD, ${counts.wa} wa.me)`
);

if (unknownHits.length) {
  console.warn(`\ncontact: WARNING — ${unknownHits.length} number(s) not in contact.config.json:`);
  for (const hit of unknownHits) console.warn(`  ${hit}`);
  console.warn('  If one of these is a real Real Zero line, add it to contact.config.json.');
}

if (staleHits.length) {
  for (const hit of staleHits) console.error(`contact: ${hit}`);
  if (WRITE) {
    console.log(`\ncontact: rewrote ${changedFiles.length} file(s):`);
    for (const file of changedFiles) console.log(`  ${file}`);
  } else {
    console.error('\ncontact: FAIL — retired number(s) still published. Run: node scripts/contact.mjs --write');
    process.exit(1);
  }
} else {
  console.log('contact: OK — no retired numbers published.');
}
