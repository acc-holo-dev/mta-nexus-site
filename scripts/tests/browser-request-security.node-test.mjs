import assert from "node:assert/strict";
import { test } from "node:test";
import { browserRequestDecision, isLicenseRuntimeRequest } from "../../apps/web/src/lib/browser-request-policy.ts";
import { sessionCookieOptions } from "../../apps/web/src/lib/session-cookie.ts";
import { SESSION_LIFETIME_SECONDS } from "../../apps/web/src/lib/session-policy.ts";

const env = { NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "https://nexus.test" };
const decide = (headers = {}, method = "POST", overrides = {}) => browserRequestDecision(
  new Request("http://internal-app:3000/api/auth/login", { method, headers }),
  { ...env, ...overrides },
);

for (const method of ["GET", "HEAD", "OPTIONS"]) {
  test(`safe ${method} remains usable without origin/configuration`, () => {
    assert.deepEqual(decide({}, method, { NEXT_PUBLIC_APP_URL: undefined }), { allowed: true });
  });
}
for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
  test(`${method} accepts canonical origin behind an internal reverse proxy`, () => {
    assert.equal(decide({ origin: "https://nexus.test", "sec-fetch-site": "same-origin" }, method).allowed, true);
  });
  test(`${method} rejects missing browser provenance, including without a cookie`, () => {
    assert.deepEqual(decide({}, method), { allowed: false, status: 403, code: "CSRF_REJECTED" });
  });
}
for (const origin of ["https://evil.test", "https://sub.nexus.test", "http://nexus.test", "https://nexus.test:444", "null", "https://nexus.test/", "https://user@nexus.test", "https://nexus.test https://evil.test"]) {
  test(`rejects untrusted or malformed origin ${origin}`, () => {
    assert.equal(decide({ origin, "sec-fetch-site": "same-origin" }).allowed, false);
  });
}
for (const site of ["cross-site", "same-site", "none", "unexpected", "same-origin, cross-site"]) {
  test(`Fetch Metadata ${site} cannot be overridden by a matching Origin`, () => {
    assert.equal(decide({ origin: "https://nexus.test", "sec-fetch-site": site }).allowed, false);
  });
}
test("supports legacy same-origin Referer and modern metadata-only requests", () => {
  assert.equal(decide({ referer: "https://nexus.test/settings?tab=security" }).allowed, true);
  assert.equal(decide({ "sec-fetch-site": "same-origin" }).allowed, true);
  assert.equal(decide({ origin: "https://nexus.test" }).allowed, true);
});
test("published non-default HTTPS ports must match the canonical origin exactly", () => {
  const ci = { NEXT_PUBLIC_APP_URL: "https://nexus-ci.test:8443" };
  assert.equal(decide({ origin: "https://nexus-ci.test:8443" }, "POST", ci).allowed, true);
  assert.equal(decide({ origin: "https://nexus-ci.test" }, "POST", ci).allowed, false);
  assert.equal(decide({ origin: "https://nexus-ci.test:8443" }).allowed, false);
});
for (const referer of ["https://evil.test/settings", "null", "https://nexus.test.evil.test", "https://user@nexus.test/path"]) {
  test(`rejects invalid Referer fallback ${referer}`, () => {
    assert.equal(decide({ referer, "sec-fetch-site": "same-origin" }).allowed, false);
  });
}
test("an invalid explicit Origin never falls back to a valid Referer", () => {
  assert.equal(decide({ origin: "null", referer: "https://nexus.test/" }).allowed, false);
});
test("Host, forwarded host and bearer headers do not grant browser trust", () => {
  assert.equal(decide({ origin: "https://evil.test", host: "evil.test", "x-forwarded-host": "evil.test", authorization: "Bearer anything" }).allowed, false);
});
for (const url of [undefined, "", "not-a-url", "http://nexus.test", "https://user:password@nexus.test", "https://nexus.test/app", "https://nexus.test?override=1", "https://nexus.test/#fragment"]) {
  test(`production fails closed for canonical URL ${String(url)}`, () => {
    assert.deepEqual(decide({ origin: "https://nexus.test" }, "POST", { NEXT_PUBLIC_APP_URL: url }), { allowed: false, status: 503, code: "CSRF_CONFIG_INVALID" });
  });
}
test("development can use the local request URL when no canonical URL is set", () => {
  assert.equal(browserRequestDecision(new Request("http://localhost:3000/api/auth/login", { method: "POST", headers: { origin: "http://localhost:3000" } }), { NODE_ENV: "development" }).allowed, true);
});
test("development supports bounded local aliases on the configured HTTP port", () => {
  for (const host of ["127.0.0.1", "[::1]", "app", "nexus-local-app-1"]) {
    const origin = `http://${host}:3000`;
    assert.equal(browserRequestDecision(new Request(`${origin}/api/auth/login`, { method: "POST", headers: { origin } }), { NODE_ENV: "development", NEXT_PUBLIC_APP_URL: "http://localhost:3000" }).allowed, true);
  }
  const request = new Request("http://evil.test:3000/api/auth/login", { method: "POST", headers: { origin: "http://evil.test:3000" } });
  assert.equal(browserRequestDecision(request, { NODE_ENV: "development", NEXT_PUBLIC_APP_URL: "http://localhost:3000" }).allowed, false);
});
test("machine exceptions are exact paths, not a prefix or a header", () => {
  assert.equal(isLicenseRuntimeRequest("/api/licenses/check"), true);
  assert.equal(isLicenseRuntimeRequest("/api/licenses/check-release"), true);
  for (const path of ["/api/licenses/check/extra", "/api/licenses/check-release-admin", "/api/licenses/check/", "/api/admin/licenses/maintenance", "/api/auth/login"]) {
    assert.equal(isLicenseRuntimeRequest(path), false);
  }
});
test("cookie issuance and deletion share host-only scope and production security", () => {
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    assert.deepEqual(sessionCookieOptions(), { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    process.env.NODE_ENV = "development";
    assert.equal(sessionCookieOptions().secure, false);
    assert.equal(SESSION_LIFETIME_SECONDS, 14 * 24 * 60 * 60);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
