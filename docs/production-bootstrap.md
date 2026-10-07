# Safe official storefront bootstrap

## Runtime behavior

Database-backed storefront pages and relevant APIs await schema initialization
before querying. Committed additive migrations use `DATABASE_URL_UNPOOLED`, then
`POSTGRES_URL_NON_POOLING`, then the existing migration runner's direct Neon
conversion/fallback. Application queries and the seed use **only `DATABASE_URL`**.
No connection strings are returned to clients; failures log redacted
`ZAVRUNE_DB_ERROR` messages and are propagated, not treated as an empty store.

After schema validation, a genuinely empty storefront receives the official data
already committed in `src/db/seed.ts`: 16 categories, 4 collections, 6 products
and their variants, design settings, oversized size guide and measurements,
10 published + 10 draft homepage sections, 9 navigation links, 2 shipping zones
and 3 shipping methods. No new/random catalog data or demo admin is generated.

Eligibility is checked under a PostgreSQL transaction-scoped advisory lock, on the
same connection as all seed writes. This works through transaction poolers and
serializes concurrent cold starts. The complete seed and completion marker commit
atomically; a failure rolls everything back and later initialization can retry.
Existing settings are preserved with conflict-ignore, never overwritten.

Unmarked stores with any catalog/content/shipping/order/customer rows are **not
automatically seeded**. An authenticated admin may explicitly resume an older
partial seed with `POST /api/seed`, or an operator may run `npm run db:seed` using
already-configured environment variables. These explicit runs add missing official
rows using natural keys and do not change existing rows, inventory, prices,
settings or content. Homepage sections match by homepage/version/display slot.
No DROP, TRUNCATE, DELETE or production reset is performed.

Once the completion marker exists, automatic and explicit seed runs are no-ops,
including if an owner subsequently removes starter content. `GET /api/seed` is
read-only and does not even initialize the schema.

## Admin authentication

Seed POST requires an unexpired authenticated session with role `admin`; browser
cross-origin requests are rejected. Login now verifies the existing bcrypt hash
rather than accepting any password and generates cryptographically random tokens.
Old sessions created by the insecure login are ignored without removing database
rows. Existing admins must sign in again. No demo credentials are provisioned.

## Verification

- `npm run typecheck`
- Targeted ESLint on changed TS/TSX files and `tests/*`
- `node --test tests/migration-runner.cjs`
- `npm run build` (also validates migration files and applies migrations if configured)
- `npm run test:bootstrap -- bootstrap|partial|occupied|rollback`
- `npx tsx tests/storefront-smoke.ts` against a production server

Database tests refuse non-local hosts and databases not prefixed `zavrune_test_`.
Bootstrap modes each require a fresh disposable database. They cover migrations,
concurrent starts, repeat seeds, partial completion, custom-row preservation,
rollback/retry and redaction. HTTP checks cover storefront routes, category sorts,
product/size-guide pages, catalog APIs and seed authorization/password verification.
Fixtures exist only in isolated test databases, never in the production seed.

In Arena's network-restricted sandbox, the normal build cannot fetch Google Fonts.
Verification used Next's `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` test hook with a local
CSS response solely for the build. The font configuration was not changed and no
font mock is committed; deployment still downloads the real Inter font.
