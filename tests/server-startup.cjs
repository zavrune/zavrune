/**
 * Production startup resilience: `next start` must boot and serve unrelated
 * routes even when no database is configured at all. Every database-backed
 * response must fail closed with a clear ZAVRUNE_DB_ERROR instead of crashing
 * the server process. Run after `npm run build`.
 */
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const PORT = Number(process.env.ZAVRUNE_TEST_STARTUP_PORT ?? 3119);
// Next normalises its own request origin to "localhost"; keep client requests identical.
const base = `http://localhost:${PORT}`;

function startServer() {
  const env = { ...process.env, NODE_ENV: "production", PORT: String(PORT), HOSTNAME: "127.0.0.1" };
  for (const name of ["ZAVRUNE_DATABASE_URL", "DATABASE_URL", "POSTGRES_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING"]) {
    delete env[name];
  }
  const child = spawn(process.execPath, [path.join(root, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(PORT)], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (chunk) => (log += chunk));
  child.stderr.on("data", (chunk) => (log += chunk));
  return { child, log: () => log };
}

async function waitForServer(log) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(base, { redirect: "manual" });
      if (response.status > 0) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`the production server never became reachable:\n${log()}`);
}

async function main() {
  const server = startServer();
  try {
    await waitForServer(server.log);

    // Unrelated, static routes must render during a total database outage.
    for (const attempt of [1, 2, 3]) {
      const login = await fetch(`${base}/mohamedbdr/login`);
      assert.equal(login.status, 200, `attempt ${attempt}: the login page must render without a database`);
      assert((await login.text()).includes("ZAVRUNE ADMIN"));
    }

    // Database-backed requests fail closed with a clear, redacted error.
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 500);
    const healthBody = await health.json();
    assert.equal(healthBody.ok, false);
    assert.match(healthBody.databaseError, /ZAVRUNE_DB_ERROR/);
    // No credentials or connection strings may leak; the fail-closed reason is explicit.
    assert.doesNotMatch(JSON.stringify(healthBody), /postgresql:\/\/|ECONNREFUSED|:[0-9]{4}\b/);
    assert.match(healthBody.databaseError, /required|Refusing to use a localhost database fallback/);

    const adminLogin = await fetch(`${base}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: base, "Sec-Fetch-Site": "same-origin" },
      body: JSON.stringify({ email: "owner@example.invalid", password: "unused-password-123" }),
    });
    assert.equal(adminLogin.status, 500);
    assert.match(await adminLogin.text(), /ZAVRUNE_DB_ERROR|Database request failed/);

    // Repeated requests to / stay consistent: the process never crashes.
    const first = await fetch(`${base}/`, { redirect: "manual" });
    const second = await fetch(`${base}/`, { redirect: "manual" });
    const third = await fetch(`${base}/`, { redirect: "manual" });
    assert.equal(first.status, second.status, "repeated requests to / must behave identically");
    assert.equal(second.status, third.status);
    assert.ok([200, 500].includes(first.status));

    // The server is still healthy and alive after all of those failures.
    const after = await fetch(`${base}/mohamedbdr/login`);
    assert.equal(after.status, 200);
    assert.equal(server.child.exitCode, null, `the server process must not exit:\n${server.log()}`);
    assert.doesNotMatch(server.log(), /unhandledRejection|UnhandledPromiseRejection/);

    console.log("PASS: production server starts and isolates database failures without crashing");
  } finally {
    server.child.kill("SIGTERM");
    await new Promise((resolve) => server.child.once("exit", resolve));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Startup resilience checks failed");
  process.exitCode = 1;
});
