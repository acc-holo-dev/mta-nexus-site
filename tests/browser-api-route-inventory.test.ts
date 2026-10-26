import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");
const apiRoot = path.join(repoRoot, "apps/web/src/app/api");
const allowlistPath = path.join(
  repoRoot,
  "tests/fixtures/browser-api-proxy-only-mutations.txt",
);

const MUTATION =
  /export\s+(?:async\s+)?function\s+(POST|PUT|PATCH|DELETE)\b|export\s+const\s+(POST|PUT|PATCH|DELETE)\s*=/;
const BROWSER_MARKERS = [
  "withBrowserMutation",
  "rejectUnsafeBrowserRequest",
  "BROWSER_ROUTE_ADAPTER",
] as const;
const BEARER_MARKERS = [
  "withLicenseBearerRoute",
  "licenseRuntimeRequest",
  "LICENSE_BEARER_ROUTE_ADAPTER",
] as const;

const REQUIRED_BROWSER = [
  "apps/web/src/app/api/auth/login/route.ts",
  "apps/web/src/app/api/auth/register/route.ts",
  "apps/web/src/app/api/auth/session/route.ts",
  "apps/web/src/app/api/auth/sessions/route.ts",
  "apps/web/src/app/api/auth/password/route.ts",
  "apps/web/src/app/api/auth/context/route.ts",
  "apps/web/src/app/api/auth/email-verification/route.ts",
  "apps/web/src/app/api/auth/password-reset/route.ts",
  "apps/web/src/app/api/account/profile/route.ts",
  "apps/web/src/app/api/account/privacy/route.ts",
  "apps/web/src/app/api/account/developer/route.ts",
  "apps/web/src/app/api/products/[id]/builds/route.ts",
  "apps/web/src/app/api/products/[id]/media/route.ts",
  "apps/web/src/app/api/resources/inspect-meta/route.ts",
  "apps/web/src/app/api/licenses/[id]/actions/route.ts",
  "apps/web/src/app/api/resources/claim/route.ts",
  "apps/web/src/app/api/servers/[id]/claim-challenge/route.ts",
  "apps/web/src/app/api/servers/[id]/claim-challenge/verify/route.ts",
  "apps/web/src/app/api/products/[id]/lifecycle/route.ts",
  "apps/web/src/app/api/products/[id]/builds/[buildId]/route.ts",
  "apps/web/src/app/api/products/route.ts",
  "apps/web/src/app/api/products/[id]/route.ts",
  "apps/web/src/app/api/products/[id]/compatibility/route.ts",
  "apps/web/src/app/api/products/[id]/variants/route.ts",
  "apps/web/src/app/api/products/[id]/copy/route.ts",
  "apps/web/src/app/api/products/[id]/reviews/route.ts",
  "apps/web/src/app/api/products/[id]/reviews/[reviewId]/report/route.ts",
  "apps/web/src/app/api/library/review/[id]/route.ts",
  "apps/web/src/app/api/servers/route.ts",
  "apps/web/src/app/api/servers/[id]/route.ts",
  "apps/web/src/app/api/workspace/servers/[id]/content/route.ts",
  "apps/web/src/app/api/workspace/servers/[id]/content/[contentId]/route.ts",
  "apps/web/src/app/api/workspace/servers/[id]/content/[contentId]/restore/route.ts",
  "apps/web/src/app/api/library/[id]/collections/route.ts",
  "apps/web/src/app/api/library/collections/route.ts",
  "apps/web/src/app/api/library/collections/[id]/route.ts",
  "apps/web/src/app/api/library/collections/[id]/import-preview/route.ts",
  "apps/web/src/app/api/library/collections/[id]/reconcile-preview/route.ts",
  "apps/web/src/app/api/library/collections/[id]/versions/route.ts",
  "apps/web/src/app/api/library/collections/[id]/versions/preview/route.ts",
  "apps/web/src/app/api/library/collections/[id]/watches/route.ts",
  "apps/web/src/app/api/admin/actions/route.ts",
  "apps/web/src/app/api/admin/reports/[id]/route.ts",
  "apps/web/src/app/api/admin/resources/[id]/route.ts",
  "apps/web/src/app/api/admin/verification/[id]/route.ts",
  "apps/web/src/app/api/admin/licenses/[id]/route.ts",
  "apps/web/src/app/api/admin/community/[id]/route.ts",
  "apps/web/src/app/api/admin/community/[id]/reports/batch/route.ts",
  "apps/web/src/app/api/admin/community/[id]/reports/batch/preview/route.ts",
  "apps/web/src/app/api/admin/community/[id]/discussion/[commentId]/route.ts",
  "apps/web/src/app/api/admin/community/[id]/discussion/[commentId]/reports/batch/route.ts",
  "apps/web/src/app/api/admin/community/[id]/discussion/[commentId]/reports/batch/preview/route.ts",
] as const;

const REQUIRED_BEARER = [
  "apps/web/src/app/api/licenses/check/route.ts",
  "apps/web/src/app/api/licenses/check-release/route.ts",
] as const;

function listRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listRouteFiles(full));
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}

function classify(rel: string, source: string) {
  if (!MUTATION.test(source)) return "safe-only" as const;
  if (BROWSER_MARKERS.some((marker) => source.includes(marker))) return "browser" as const;
  if (BEARER_MARKERS.some((marker) => source.includes(marker))) return "bearer" as const;
  return "proxy-only" as const;
}

function parseAllowlist(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

describe("browser API route adapter inventory", () => {
  const routes = listRouteFiles(apiRoot).map((full) => {
    const rel = path.relative(repoRoot, full).split(path.sep).join("/");
    const source = readFileSync(full, "utf8");
    return { rel, source, kind: classify(rel, source) };
  });

  it("keeps auth, account, uploads, license owner actions, resource publish and claim, product editing, reviews, server registration, server content, library collections, and staff moderation on the shared browser adapter", () => {
    for (const rel of REQUIRED_BROWSER) {
      const route = routes.find((entry) => entry.rel === rel);
      expect(route, rel).toBeTruthy();
      expect(route?.kind).toBe("browser");
      expect(route?.source).toContain("withBrowserMutation");
    }
  });

  it("keeps exact license runtime checks on the independent bearer adapter", () => {
    for (const rel of REQUIRED_BEARER) {
      const route = routes.find((entry) => entry.rel === rel);
      expect(route, rel).toBeTruthy();
      expect(route?.kind).toBe("bearer");
      expect(route?.source).toContain("withLicenseBearerRoute");
      expect(route?.source).not.toContain("withBrowserMutation");
    }
  });

  it("inventories Proxy-only mutation handlers without growing the allowlist silently", () => {
    const allowlist = parseAllowlist(readFileSync(allowlistPath, "utf8"));
    const proxyOnly = routes
      .filter((entry) => entry.kind === "proxy-only")
      .map((entry) => entry.rel)
      .sort();
    expect(proxyOnly).toEqual([...allowlist].sort());
    // Guardrail: new mutation endpoints must use withBrowserMutation (or the bearer adapter),
    // not extend this Proxy-only list.
    expect(proxyOnly.length).toBeLessThanOrEqual(allowlist.length);
  });
});
