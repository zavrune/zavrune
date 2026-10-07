# Safe official storefront bootstrap

## Schema initialization (Vercel-safe)

Committed additive migrations are applied by the **deployment build**
(`npm run build` -> `node src/db/migrate-runner.cjs --if-configured` -> `next build`)
and by the explicit CLI (`npm run db:migrate`). Serverless cold starts never run
DDL, so a request can never be queued behind another instance's migration lock.

- `src/instrumentation.ts` does no schema work. Optional `ZAVRUNE_DB_WARMUP=1`
  performs one ping bounded by a 1.5s deadline, and every failure path is caught:
  a database problem can never crash the instrumentation hook or unrelated routes.
- `src/db/migrate-runner.cjs` reads the cheap migration state first and returns
  immediately when the database is current. Otherwise it acquires
  `pg_try_advisory_lock` (**non-blocking**, never `pg_advisory_lock`), re-checks the
  state after acquiring the lock, runs the committed Drizzle SQL on that same
  connection, verifies the schema, and releases the lock before closing the
  session. Contention polls with bounded retries (`waitTimeoutMs`, default 15s)
  instead of occupying a connection. Every pool is bounded: `max=1`,
  `min=0`, 5s connect timeout, 30s statement/query timeout, 5s lock timeout.
  Pool, clock, state reader and DDL executor are injectable for tests.
- `src/db/initialize.ts` (request readiness) only performs two cheap reads
  (`to_regclass('drizzle.__drizzle_migrations')` and the newest `created_at`) on
  the shared application pool, memoizes success per process, single-flights the
  check, and polls with a bounded deadline while a deployment commits migrations.
  Failure messages are redacted `ZAVRUNE_DB_ERROR`s and can be retried.
- `src/db/index.ts` builds one Vercel-safe pool per process lazily
  (`max=3`, `min=0`, 5s connect timeout, 10s idle timeout, 30s query timeout,
  5s lock timeout, bounded connection lifetime/use, keep-alive). Drizzle is
  instantiated on first use, so a plain import never connects.
- Database URL resolution is centralized in `src/lib/database-url.ts`
  (`ZAVRUNE_DATABASE_URL` -> `DATABASE_URL` -> `POSTGRES_URL`). Without a
  configured URL the app **fails closed** with a clear message; `pg` is never
  constructed, so it can never silently fall back to localhost.
- Bulk bootstrap writes are gated by cheap read-only checks: the official seed
  marker is read before any transaction (`pg_try_advisory_xact_lock`, non-blocking,
  then a double-check), `ensureDeliveryRates` reads the existing wilaya rows and
  only inserts missing ones (the 58 Algerian wilayas and their rates are
  unchanged), and `ensureProductGroups` only inserts the managed New Drop /
  Featured keys that are absent.

Application queries and the seed use the application URL resolved above; the
migration runner additionally prefers `DATABASE_URL_UNPOOLED` /
`POSTGRES_URL_NON_POOLING` (with the direct-Neon-host conversion) so schema work
is not attempted through a transaction pooler. No connection strings are returned
to clients; failures log redacted `ZAVRUNE_DB_ERROR` messages and are propagated,
not treated as an empty store.

After schema validation, a genuinely empty storefront receives the official data
already committed in `src/db/seed.ts`: 16 categories, 4 collections, 6 products
and their variants, design settings, oversized size guide and measurements,
10 published + 10 draft homepage sections, 9 navigation links, 2 shipping zones
and 3 shipping methods. No new/random catalog data or demo admin is generated.

Eligibility is checked under a **non-blocking** PostgreSQL transaction-scoped
advisory lock (`pg_try_advisory_xact_lock`) on the same connection as all seed
writes, after a read-only marker check: a completed store never opens a
transaction, and an instance that loses the race exits instead of queueing. The
complete seed and completion marker commit atomically; a failure rolls everything
back and later initialization can retry. Existing settings are preserved with
conflict-ignore, never overwritten.

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

- `npm test` - unit and architecture regressions: URL resolution order and
  fail-closed behaviour, cheap migration-state reads only, non-blocking lock with
  bounded retries, exactly-once migration application, no blocking
  `pg_advisory_lock` anywhere in `src/`, instrumentation boundedness/isolation,
  and "no import constructs a pool or defaults to localhost".
- `npm run typecheck`, `npm run lint`
- `npm run build` (build-time migration step + Turbopack build)
- `npm run test:db` - the full production-like run on a disposable embedded
  PostgreSQL cluster: `npm run test:bootstrap -- bootstrap|occupied|partial|rollback`,
  build-time migration, `npm run db:migrate` twice (second is a cheap no-op), a
  real `next start` on a migrated-but-unseeded database, fresh-store admin login
  and provisioning, storefront smoke, repeated/concurrent `/` requests, and admin
  password rotation with session revocation.
- `npm run test:e2e` - `next start` with no database configured at all: unrelated
  routes keep serving, database-backed ones fail closed, and the process survives.
- `npm run test:bootstrap -- bootstrap|partial|occupied|rollback` (included in
  `npm run test:db`)

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
