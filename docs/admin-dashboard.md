# ZAVRUNE admin dashboard

Private operations console for the storefront. Everything below is enforced
**server-side**; the UI never receives data it is not allowed to see.

## Entry point and sessions

- URL: `/mohamedbdr` (no link is rendered anywhere in the public storefront).
- Unauthenticated visitors to any `/mohamedbdr/*` page are redirected to
  `/mohamedbdr/login?next=<original path>`; anonymous `/api/admin/*` requests get
  `401 {"success":false,"error":"Unauthorized"}`.
- Session cookies are `httpOnly`, `SameSite=Strict`, `Secure` in production and
  scoped to `/`. Tokens are 256-bit random values (`zvr_secure_…`); only their
  SHA-256 hash is stored. Sessions expire after 14 days and the `lastSeenAt`
  timestamp is refreshed at most hourly.
- Sign-in is rate limited per account and per source address (5 failures in 15
  minutes → 15 minute lockout, HTTP 429 with `Retry-After`).
- Every state-changing admin request is rejected unless it comes from the same
  origin (`Origin`/`Referer`/`Sec-Fetch-Site` checked against the request host).
- Logout, password change and "sign out all devices" revoke the session rows in
  the database, so a stolen cookie stops working immediately. Changing the
  password invalidates every previously issued session.

## Admin provisioning

Set these environment variables (see `.env.example`):

| Variable | Required | Purpose |
| --- | --- | --- |
| `ZAVRUNE_ADMIN_EMAIL` | yes | First admin login. |
| `ZAVRUNE_ADMIN_PASSWORD` | yes | Initial password (bcrypt-hashed, min 10 chars with letters and digits). |
| `ZAVRUNE_ADMIN_NAME` | no | Display name. |
| `ZAVRUNE_ADMIN_RESET_TOKEN` | no | One-time recovery token: when set, the next request rotates the admin password to `ZAVRUNE_ADMIN_PASSWORD` and revokes all sessions. Remove it afterwards. |

Passwords are never stored in plaintext: only the bcrypt hash is written to the
`admin_users` table.

## Features

- **Products** – full CRUD, duplicate, archive, ordering, multilingual copy,
  pricing (price + sale price), SKU, images/video, tags, SEO fields, featured and
  New Drop membership.
- **Variants** – arbitrary option types (Size, Color, Material, Fit, Style, …)
  with arbitrary values, per-variant stock/price/sale price/SKU/image/status. The
  public product page renders those axes automatically and disables combinations
  that are out of stock or non-existent.
- **Categories, New Drop, Featured, Homepage** – managed collections with ordered
  product assignment, draft/publish, per-section visibility, ordering and
  rollback (rollback restores the newest saved revision).
- **Orders** – search, status filters, per-status totals, detail view with
  immutable product/variant/delivery price snapshots, status transitions,
  internal notes, cancel + restock (idempotent through `orders.restocked_at`).
- **Customers** – list, search, order history, order counts and lifetime spend.
- **Media** – database-backed uploads (Postgres `bytea`, served from
  `/api/media/<uuid>`) because Vercel's filesystem is ephemeral. Images and
  videos are validated by MIME type and a 4 MB per-file limit; on mobile the
  upload buttons open the normal gallery/file picker.
- **Delivery** – all 58 Algerian wilayas with editable home/stop-desk prices and
  per-method availability. Checkout prices are computed and re-validated on the
  server; each order stores a delivery snapshot so later rate changes never alter
  historical orders.
- **Store settings / design / security / inventory / health / size guides** –
  identity (name, logo, favicon), contact and social links, currency, free
  shipping threshold, order and delivery settings, music, SEO, theme tokens,
  password management, session inventory, stock ledger and a storefront audit.

## Verification in this repository

```bash
npm run typecheck                 # tsc --noEmit
npm run lint                      # eslint . (0 errors)
npx next build --webpack          # production build
node --test tests/migration-runner.cjs
```

Anonymous access can be re-checked against a running build:

```bash
curl -i http://localhost:3000/mohamedbdr            # 307 -> /mohamedbdr/login
curl -i http://localhost:3000/api/admin/products    # 401 Unauthorized
```
