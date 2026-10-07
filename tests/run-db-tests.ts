/**
 * Full production-like verification on a disposable embedded PostgreSQL cluster.
 *
 *   npm run test:db
 *
 * The embedded cluster only exists for the duration of the run: no hosted or
 * production database is ever contacted, and no data is reset anywhere else.
 * Coverage: migration concurrency (bootstrap/occupied/partial/rollback modes),
 * build-time migration, a real `next start`, a fresh-store deployment, repeated
 * and concurrent storefront requests, admin login/password rotation, and the
 * additive-only guarantee for committed SQL.
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "pg";

const ROOT = path.resolve(__dirname, "..");
const HOST = "127.0.0.1";
const DB_PORT = Number(process.env.ZAVRUNE_EMBEDDED_PG_PORT ?? 55433);
const APP_PORT = Number(process.env.ZAVRUNE_TEST_APP_PORT ?? 3117);
// Next normalises its own request origin to "localhost"; keep client requests identical.
const BASE_URL = `http://localhost:${APP_PORT}`;
const DB_PASSWORD = "postgres";
const ADMIN_EMAIL = "owner@zavrune.test";
const ADMIN_PASSWORD = "ZavruneLaunch2026a";
const ROTATED_PASSWORD = "ZavruneRotated2026b";
const RESET_TOKEN = "zavrune-test-reset-token";

const DATABASES = {
  bootstrap: "zavrune_test_bootstrap",
  occupied: "zavrune_test_occupied",
  partial: "zavrune_test_partial",
  rollback: "zavrune_test_rollback",
  build: "zavrune_test_build",
  app: "zavrune_test_app",
} as const;

const databaseUrl = (name: string) =>
  `postgresql://postgres:${DB_PASSWORD}@${HOST}:${DB_PORT}/${name}`;

/** Every child gets a clean database environment; only the intended URL is set. */
function databaseEnvironment(name?: string, extra: Record<string, string | undefined> = {}) {
  const env: Record<string, string | undefined> = { ...process.env };
  for (const key of ["ZAVRUNE_DATABASE_URL", "DATABASE_URL", "POSTGRES_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"]) {
    delete env[key];
  }
  if (name) env.DATABASE_URL = databaseUrl(name);
  return { ...env, ...extra } as NodeJS.ProcessEnv;
}

function run(label: string, command: string, args: string[], env: NodeJS.ProcessEnv, timeoutMs: number) {
  const result = spawnSync(command, args, { cwd: ROOT, env, encoding: "utf8", timeout: timeoutMs });
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
  }
  assert.equal(result.status, 0, `${label} exited with ${result.status} (signal ${result.signal})`);
  return result;
}

/**
 * Sandboxes without outbound access to fonts.googleapis.com cannot run the
 * production build. Next.js ships NEXT_FONT_GOOGLE_MOCKED_RESPONSES for exactly
 * that case; it is only used here, never committed and never part of the app.
 */
async function offlineFontEnvironment(): Promise<Record<string, string>> {
  if (process.env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES) return {};
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    await fetch("https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap", { signal: controller.signal });
    clearTimeout(timer);
    return {};
  } catch {
    const mockDir = mkdtempSync(path.join(os.tmpdir(), "zavrune-font-mock-"));
    const mockFile = path.join(mockDir, "mocked-google-fonts.json");
    // Turbopack parses this as JSON and matches the requested Google Fonts URL,
    // so cover the variable-weight URL used by src/app/layout.tsx plus fallbacks.
    const css =
      "@font-face { font-family: 'Inter'; font-style: normal; font-weight: 100 900; font-display: swap; src: local('Inter'); unicode-range: U+0000-00FF; }";
    const weights = Array.from({ length: 9 }, (_, index) => (index + 1) * 100);
    const urls = [
      "https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap",
      `https://fonts.googleapis.com/css2?family=Inter:wght@${weights.join(";")}&display=swap`,
      "https://fonts.googleapis.com/css2?family=Inter&display=swap",
      "https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,100..900&display=swap",
    ];
    writeFileSync(mockFile, `${JSON.stringify(Object.fromEntries(urls.map((url) => [url, css])), null, 2)}\n`);
    console.log("[db-tests] Google Fonts is unreachable; using Next's offline font test hook for the build.");
    return { NEXT_FONT_GOOGLE_MOCKED_RESPONSES: mockFile };
  }
}

type EmbeddedCluster = {
  initialise: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

async function startCluster(dataDir: string): Promise<EmbeddedCluster> {
  const imported = (await import("embedded-postgres")) as unknown as {
    default: new (options: Record<string, unknown>) => EmbeddedCluster;
  };
  const cluster = new imported.default({
    databaseDir: dataDir,
    user: "postgres",
    password: DB_PASSWORD,
    port: DB_PORT,
    persistent: false,
  });
  await cluster.initialise();
  await cluster.start();
  return cluster;
}

function startApp(extraEnv: Record<string, string> = {}) {
  const child = spawn(
    process.execPath,
    [path.join(ROOT, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(APP_PORT)],
    {
      cwd: ROOT,
      env: databaseEnvironment(DATABASES.app, {
        NODE_ENV: "production",
        PORT: String(APP_PORT),
        HOSTNAME: HOST,
        ZAVRUNE_ADMIN_EMAIL: ADMIN_EMAIL,
        ZAVRUNE_ADMIN_PASSWORD: ADMIN_PASSWORD,
        ...extraEnv,
      }),
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  let log = "";
  child.stdout.on("data", (chunk) => (log += chunk));
  child.stderr.on("data", (chunk) => (log += chunk));
  return { child, log: () => log };
}

async function stopApp(app: { child: ReturnType<typeof spawn> }) {
  if (app.child.exitCode !== null) return;
  app.child.kill("SIGTERM");
  await new Promise((resolve) => app.child.once("exit", resolve));
}

async function waitForHealth(app: ReturnType<typeof startApp>) {
  const deadline = Date.now() + 120000;
  let lastStatus = 0;
  while (Date.now() < deadline) {
    if (app.child.exitCode !== null) throw new Error(`the app exited early:\n${app.log()}`);
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      lastStatus = response.status;
      if (response.status === 200) return;
    } catch {
      // still booting
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`/api/health never returned 200 (last status ${lastStatus}):\n${app.log()}`);
}

async function login(password: string) {
  return fetch(`${BASE_URL}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE_URL, "Sec-Fetch-Site": "same-origin" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password }),
  });
}

async function main() {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "zavrune-embedded-pg-"));
  let cluster: EmbeddedCluster | undefined;
  const app = { child: undefined as ReturnType<typeof spawn> | undefined };

  try {
    cluster = await startCluster(dataDir);
    const admin = new Client({ connectionString: databaseUrl("postgres") });
    await admin.connect();
    for (const name of Object.values(DATABASES)) {
      await admin.query(`create database ${name}`);
    }
    await admin.end();
    console.log(`[db-tests] embedded PostgreSQL cluster ready on ${HOST}:${DB_PORT}`);

    // 1. Migration/seed concurrency behaviour against genuinely fresh databases.
    for (const mode of ["bootstrap", "occupied", "partial", "rollback"] as const) {
      run(`production-bootstrap ${mode}`, process.execPath, ["--import", "tsx", "tests/production-bootstrap.ts", mode], databaseEnvironment(DATABASES[mode]), 300000);
      console.log(`[db-tests] production-bootstrap ${mode} passed`);
    }

    // 2. The deploy path: build-time migration + next build.
    run(
      "next build",
      "npm",
      ["run", "build"],
      { ...databaseEnvironment(DATABASES.build), ...(await offlineFontEnvironment()) },
      900000
    );
    console.log("[db-tests] production build passed (build-time migrations applied)");

    // 3. Migrate the app database exactly like a deployment does, then start it.
    run("db:migrate", process.execPath, ["src/db/migrate-runner.cjs"], databaseEnvironment(DATABASES.app), 120000);
    run("second db:migrate", process.execPath, ["src/db/migrate-runner.cjs"], databaseEnvironment(DATABASES.app), 120000);
    console.log("[db-tests] repeated npm run db:migrate was a cheap no-op");

    const first = startApp();
    app.child = first.child;
    await waitForHealth(first);
    console.log("[db-tests] next start is serving on a migrated, unseeded database");

    // 4. Fresh-store admin + storefront bootstrap.
    run(
      "fresh-store admin checks",
      process.execPath,
      ["tests/admin-fresh-store.cjs"],
      databaseEnvironment(DATABASES.app, {
        TEST_BASE_URL: BASE_URL,
        ZAVRUNE_ADMIN_EMAIL: ADMIN_EMAIL,
        ZAVRUNE_ADMIN_PASSWORD: ADMIN_PASSWORD,
      }),
      180000
    );

    // 5. Storefront smoke: public routes, guarded admin APIs, origin checks.
    run(
      "storefront smoke",
      process.execPath,
      ["--import", "tsx", "tests/storefront-smoke.ts"],
      databaseEnvironment(DATABASES.app, { TEST_BASE_URL: BASE_URL }),
      180000
    );

    // 6. Repeated and concurrent requests to / must stay 200 and identical.
    const bodies: string[] = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await fetch(`${BASE_URL}/`);
      assert.equal(response.status, 200, `request ${attempt + 1} to / must succeed`);
      bodies.push(await response.text());
    }
    assert.ok(bodies.every((body) => body === bodies[0]), "the homepage must be stable across repeated requests");
    assert.ok(bodies[0].includes("NEW DROP ARRIVALS"));

    const burst = await Promise.all(Array.from({ length: 20 }, () => fetch(`${BASE_URL}/`)));
    assert.ok(burst.every((response) => response.status === 200), "a concurrent burst of / requests must all succeed");
    for (let attempt = 0; attempt < 3; attempt += 1) {
      assert.equal((await fetch(`${BASE_URL}/api/health`)).status, 200);
    }
    console.log("[db-tests] repeated and concurrent storefront requests passed");

    // 7. Password management: a reset token rotates the password and revokes sessions.
    const beforeRotation = await login(ADMIN_PASSWORD);
    assert.equal(beforeRotation.status, 200);
    const oldCookie = beforeRotation.headers.get("set-cookie")?.split(";")[0];
    assert(oldCookie);
    await stopApp(app as { child: ReturnType<typeof spawn> });

    const second = startApp({ ZAVRUNE_ADMIN_PASSWORD: ROTATED_PASSWORD, ZAVRUNE_ADMIN_RESET_TOKEN: RESET_TOKEN });
    app.child = second.child;
    await waitForHealth(second);

    assert.equal((await login(ADMIN_PASSWORD)).status, 401, "the previous password must stop working after a rotation");
    assert.equal((await fetch(`${BASE_URL}/api/admin/products`, { headers: { Cookie: oldCookie } })).status, 401, "rotating a password must revoke old sessions");
    const rotated = await login(ROTATED_PASSWORD);
    assert.equal(rotated.status, 200, "the rotated password must work");
    console.log("[db-tests] admin password rotation and session revocation passed");

    console.log("PASS: production-like database, migration, startup and admin checks");
  } finally {
    if (app.child) await stopApp(app as { child: ReturnType<typeof spawn> });
    if (cluster) await cluster.stop();
    rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Database test run failed");
  process.exitCode = 1;
});
