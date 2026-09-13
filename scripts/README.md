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
