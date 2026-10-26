import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

assert.equal(process.env.NEXUS_HASH_PROBE, "disposable-ci");
assert.equal(process.cwd(), "/app/apps/web");
const control = await mkdtemp("/tmp/nexus-hash-probe-");
const port = 3001;
const report = { commit: process.env.GITHUB_SHA, status: "FAIL", limitations:
  "Real TCP disconnect against a secondary production Next.js server with an injected pause after the first actual file read. Uses the same DB/storage and download route. Does not exercise Caddy/TLS for the pre-response disconnect; normal-speed TLS delivery is covered separately." };
const server = spawn(process.execPath, ["--import", "/tmp/nexus-hash-preload.mjs", "server.js"], {
  env: { ...process.env, PORT: String(port), HOSTNAME: "127.0.0.1", NEXUS_HASH_PROBE_CONTROL: control },
  stdio: ["ignore", "ignore", "pipe"],
});
server.stderr.on("data", () => {}); // Never print runtime configuration or session data.
let childError;
let serverStopped = false;
const serverExited = new Promise(resolve => {
  server.once("exit", () => { serverStopped = true; resolve(); });
  server.once("error", error => { childError = error; serverStopped = true; resolve(); });
});
async function waitFor(check) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (childError) throw childError;
    if (serverStopped) throw new Error("Probe server exited early");
    const value = await check();
    if (value) return value;
    await delay(20);
  }
  throw new Error("Probe timed out waiting for expected state");
}
async function marker(name) {
  try { return JSON.parse(await readFile(join(control, name), "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}
let cookie;
async function post(path, input) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST", signal: AbortSignal.timeout(10_000),
    headers: {
      "Content-Type": "application/json",
      Origin: process.env.NEXUS_BROWSER_BASE_URL || "https://nexus-ci.test:8443",
      "x-nexus-proxy-secret": process.env.TRUSTED_PROXY_SECRET,
      "x-real-ip": "127.0.0.7",
      ...(cookie ? { Cookie: cookie } : {}),
    }, body: JSON.stringify(input),
  });
  assert.equal(response.status, 201, `Expected successful ${path}`);
  await response.json();
  return response;
}
try {
  await waitFor(async () => {
    try { return (await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1000) })).ok; }
    catch { return false; }
  });
  const nonce = randomBytes(6).toString("hex");
  const registered = await post("/api/auth/register", { email: `hash-${nonce}@example.invalid`,
    username: `hash_${nonce}`, password: `Ci-${randomBytes(24).toString("hex")}` });
  cookie = registered.headers.getSetCookie().find(value => value.startsWith("nexus_session=")).split(";")[0];
  const productId = process.env.NEXUS_RESOURCE_BROWSER_PRODUCT_ID;
  await post("/api/resources/claim", { productId });
  let responded = false;
  const req = request({ hostname: "127.0.0.1", port, path: `/api/products/${productId}/download`, headers: { Cookie: cookie } }, res => {
    responded = true; res.resume();
  });
  req.on("error", () => {});
  req.end();
  try {
    report.firstRead = await waitFor(() => marker("started.json"));
    assert.equal(report.firstRead.reads, 1);
    assert.equal(report.firstRead.bytesRead, 64 * 1024);
    assert.equal(responded, false, "Hash phase must precede HTTP headers");
    const closed = new Promise(resolve => req.once("close", resolve));
    req.destroy();
    await closed;
    // Observe the server-side close while the actual file read is held open.
    report.socketClose = await waitFor(() => marker("socket-closed.json"));
    await writeFile(join(control, "release"), "release");
    report.cleanup = await waitFor(() => marker("closed.json"));
    assert.equal(report.cleanup.reads, 1, "Cancellation must stop hashing before the second read");
  } finally { req.destroy(); await writeFile(join(control, "release"), "release"); }
  const response = await fetch(`http://127.0.0.1:${port}/api/products/${productId}/download`, {
    headers: { Cookie: cookie }, signal: AbortSignal.timeout(20_000),
  });
  assert.equal(response.status, 200);
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const chunk of response.body) { bytes += chunk.length; hash.update(chunk); }
  assert.equal(bytes, 64 * 1024 * 1024);
  assert.equal(hash.digest("hex"), process.env.NEXUS_RESOURCE_BROWSER_EXPECTED_SHA256);
  report.retryBytes = bytes;
  report.status = "PASS";
} finally {
  if (!serverStopped) {
    server.kill("SIGTERM");
    await Promise.race([serverExited, delay(2000)]);
    if (!serverStopped) {
      server.kill("SIGKILL");
      await Promise.race([serverExited, delay(2000)]);
    }
  }
  report.serverStopped = serverStopped;
  if (!serverStopped) report.status = "FAIL";
  await writeFile("/tmp/nexus-hash-results.json", JSON.stringify(report, null, 2));
  await rm(control, { recursive: true, force: true });
  console.log(JSON.stringify(report));
  assert(serverStopped, "Probe server must stop within the cleanup deadline");
}
