import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { request } from "node:https";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

assert.equal(process.env.GITHUB_ACTIONS, "true");
assert.equal(process.env.RUNNER_ENVIRONMENT, "github-hosted");
assert.equal(process.env.NEXUS_BROWSER_BASE_URL, "https://nexus-ci.test:8443");
assert(!process.env.DOCKER_HOST && !process.env.DOCKER_CONTEXT);
assert.equal(execFileSync("docker", ["context", "show"], { encoding: "utf8" }).trim(), "default");
const app = process.env.NEXUS_DOWNLOAD_PROBE_APP;
assert.match(app ?? "", /^[a-f0-9]{64}$/u);
const inspected = JSON.parse(execFileSync("docker", ["inspect", app], { encoding: "utf8" }))[0];
assert.match(inspected.Config.Labels["com.docker.compose.project"], /^nexus-prod-ci-/u);
assert.equal(inspected.Config.Labels["com.docker.compose.service"], "app");
const ca = readFileSync(process.env.NEXUS_DOWNLOAD_PROBE_CA);
const size = Number(process.env.NEXUS_RESOURCE_BROWSER_EXPECTED_SIZE);
const expectedHash = process.env.NEXUS_RESOURCE_BROWSER_EXPECTED_SHA256;
assert.equal(size, 64 * 1024 * 1024);
const productId = "prd_portfolio_ci_125";
const options = {
  hostname: "nexus-ci.test", port: 8443, ca, agent: false,
  lookup: (_host, options, callback) => options.all
    ? callback(null, [{ address: "127.0.0.1", family: 4 }])
    : callback(null, "127.0.0.1", 4),
};
let cookie;
function jsonRequest(path, body) {
  return new Promise((resolve, reject) => {
    const json = JSON.stringify(body);
    const req = request({ ...options, path, method: "POST", headers: {
      "Content-Type": "application/json", "Content-Length": Buffer.byteLength(json),
      ...(cookie ? { Cookie: cookie } : {}),
    } }, res => {
      const chunks = [];
      let bytes = 0;
      res.on("data", chunk => {
        bytes += chunk.length;
        if (bytes > 64 * 1024) req.destroy(new Error("Unexpectedly large API response"));
        else chunks.push(chunk);
      });
      res.on("error", reject);
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers,
        data: JSON.parse(Buffer.concat(chunks).toString()) }));
    });
    req.setTimeout(30_000, () => req.destroy(new Error("API timeout")));
    req.on("error", reject);
    req.end(json);
  });
}

function download({ interrupt = false, slow = false } = {}) {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    let interrupted = false;
    let bytes = 0;
    let pausedAt = 0;
    let resumeTimer;
    const hash = createHash("sha256");
    const req = request({ ...options, path: `/api/products/${productId}/download`, headers: { Cookie: cookie } }, res => {
      const ttfbMs = performance.now() - started;
      try {
        assert.equal(res.statusCode, 200);
        assert.equal(Number(res.headers["content-length"]), size);
        assert.equal(res.headers["x-content-sha256"], expectedHash);
        assert.equal(res.headers["cache-control"], "private, no-store");
      } catch (error) { req.destroy(); reject(error); return; }
      res.on("data", chunk => {
        bytes += chunk.length;
        hash.update(chunk);
        if (interrupt && bytes >= 1024 * 1024) {
          interrupted = true;
          req.destroy(); // Real TLS/TCP disconnection through the production proxy.
        } else if (slow && bytes - pausedAt >= 1024 * 1024) {
          pausedAt = bytes;
          res.pause();
          resumeTimer = setTimeout(() => res.resume(), 100);
        }
      });
      res.on("error", error => { if (!interrupted) reject(error); });
      res.on("end", () => {
        clearTimeout(resumeTimer);
        try {
          assert(!interrupt, "Interrupted connection unexpectedly completed");
          assert.equal(bytes, size);
          assert.equal(hash.digest("hex"), expectedHash);
          resolve({ bytes, ttfbMs, durationMs: performance.now() - started, exactHash: true });
        } catch (error) { reject(error); }
      });
      res.on("close", () => {
        clearTimeout(resumeTimer);
        if (interrupted) resolve({ bytes, interrupted: true, complete: res.complete });
        else if (!res.complete) reject(new Error("Unplanned incomplete response"));
      });
    });
    req.setTimeout(30_000, () => req.destroy(new Error("Download timeout")));
    req.on("error", error => { if (!interrupted) reject(error); });
    req.end();
  });
}
function rssKiB() {
  const status = execFileSync("docker", ["exec", app, "cat", "/proc/1/status"], { encoding: "utf8", timeout: 5000 });
  const rss = status.match(/^VmRSS:\s+(\d+) kB$/mu);
  assert(rss, "Production HTTP process must expose VmRSS");
  return Number(rss[1]);
}
const report = { sha: process.env.GITHUB_SHA, status: "FAIL", concurrency: 4, archiveBytes: size,
  interruptions: [], downloads: [], rssSamplesKiB: [], limitations:
    "Synthetic 64 MiB fixture on hosted CI. Measures HTTP process RSS, not browser memory or total container cache. TCP interruptions happen during delivery, not during pre-response hashing. This is a regression budget, not a production capacity/SLA estimate." };
try {
  const nonce = randomBytes(6).toString("hex");
  const account = await jsonRequest("/api/auth/register", {
    email: `network-${nonce}@example.invalid`, username: `network_${nonce}`, password: `Ci-${randomBytes(24).toString("hex")}`,
  });
  assert.equal(account.status, 201);
  cookie = account.headers["set-cookie"].find(value => value.startsWith("nexus_session=")).split(";")[0];
  assert.equal((await jsonRequest("/api/resources/claim", { productId })).status, 201);
  const warmup = await download();
  report.warmup = warmup;
  for (let i = 0; i < 3; i++) {
    const aborted = await download({ interrupt: true });
    assert(aborted.interrupted && !aborted.complete && aborted.bytes < size);
    report.interruptions.push(aborted);
  }
  report.retry = await download();
  const baseline = rssKiB();
  report.baselineRssKiB = baseline;
  let sampling = true;
  const sampler = (async () => {
    while (sampling) { report.rssSamplesKiB.push(rssKiB()); await delay(150); }
  })();
  try { report.downloads = await Promise.all(Array.from({ length: 4 }, () => download({ slow: true }))); }
  finally { sampling = false; await sampler; }
  assert(report.rssSamplesKiB.length >= 3, "The slow-client rehearsal must sample ongoing transfers");
  report.peakRssKiB = Math.max(...report.rssSamplesKiB);
  report.rssGrowthKiB = Math.max(0, report.peakRssKiB - baseline);
  report.rssGrowthBudgetKiB = 128 * 1024;
  assert(report.rssGrowthKiB < report.rssGrowthBudgetKiB, "Slow downloads exceeded the RSS growth regression budget");
  report.status = "PASS";
} finally {
  writeFileSync(join(process.env.NEXUS_BROWSER_REPORT_DIR, "download-network-results.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(process.env.NEXUS_BROWSER_REPORT_DIR, "download-network-summary.md"), [
    "# Real download connection and memory rehearsal", "", `Status: ${report.status}`, `Commit: ${report.sha}`,
    `Completed parallel downloads: ${report.downloads.length}; interrupted connections: ${report.interruptions.length}.`,
    `HTTP process RSS baseline/peak/growth (KiB): ${report.baselineRssKiB}/${report.peakRssKiB}/${report.rssGrowthKiB}.`,
    "", report.limitations, "",
  ].join("\n"));
  console.log(JSON.stringify(report, null, 2));
}
