# scripts

## contact.mjs

`contact.config.json` is the single source of truth for the public Real Zero
phone number. The number is deliberately kept inline in the HTML (rather than
injected by JavaScript) because it is legally required contact data under LSSI
34/2002 art. 10 and needs to be present for crawlers and no-JS visitors.

The script keeps those 78 inline copies honest.

```bash
node scripts/contact.mjs          # check only, exits 1 on drift
node scripts/contact.mjs --write  # rewrite every occurrence from the config
```

It derives all three renderings used across the site from one E.164 value:

| form         | example          | where                                  |
| ------------ | ---------------- | -------------------------------------- |
| display      | `+34 623 345 790`| footers, body copy, `llms.txt`         |
| tel/JSON-LD  | `+34623345790`   | `tel:` hrefs, JSON-LD `telephone`      |
| wa.me        | `34623345790`    | `wa.me` hrefs, `CONFIG.whatsapp` in JS |

### Swapping the number

1. Move the outgoing number's `e164` into `phone.retired`.
2. Set the new number as `phone.current`.
3. `node scripts/contact.mjs --write`
4. Commit.

CI (`.github/workflows/contact-guard.yml`) then fails permanently if a retired
number ever reappears, so a stale copy cannot be reintroduced by hand.

Numbers found in the repo that are in neither `current` nor `retired` are
reported as warnings, not failures, to keep the gate free of false positives.

## check-brand.mjs

Since 2026-10-08 the brand site wears the Real Zero identity kit: Ink
`#1E2226`, White, Dark Blue `#1D2D3D` as the only accent, on Paper `#F2F2F3`,
with the outlined wordmark and the zero in `assets/`, and all copy in the
self-hosted PP Right Grotesk. The main site's pre-kit palette (Carbon / Ice
Blue), the retired `realzero-logo-*.png` files and any Google Fonts call must
not come back anywhere.

The in-studio pages are the deliberate exception: `/velazquez` and the QR
landing pages `/fuerza`, `/proteina`, `/recuperacion` are Orangetheory
co-branded surfaces that match the vinyl and the splat, so they keep OTF's
Orange / Bone / Dark paint. Outside those files that palette is a retired
accent and fails the build.

```bash
node scripts/check-brand.mjs      # exits 1 on any retired colour or logo reference
```

Orangetheory's own PNG assets (splat, line icons) are binary and not scanned.
CI runs this as `.github/workflows/brand-guard.yml`.
