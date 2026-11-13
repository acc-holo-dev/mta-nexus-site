import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parseSync } from "@swc/core";
import { describe, expect, it } from "vitest";

let repoRoot = import.meta.dirname;
while (!existsSync(path.join(repoRoot, "pnpm-workspace.yaml"))) repoRoot = path.dirname(repoRoot);
const apiRoot = path.join(repoRoot, "site/src/app/api");
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const REQUIRED_BROWSER = [
  "site/src/app/api/auth/login/route.ts",
  "site/src/app/api/auth/register/route.ts",
  "site/src/app/api/auth/session/route.ts",
  "site/src/app/api/auth/sessions/route.ts",
  "site/src/app/api/auth/password/route.ts",
  "site/src/app/api/auth/context/route.ts",
  "site/src/app/api/auth/email-verification/route.ts",
  "site/src/app/api/auth/password-reset/route.ts",
  "site/src/app/api/account/profile/route.ts",
  "site/src/app/api/account/privacy/route.ts",
  "site/src/app/api/account/developer/route.ts",
  "site/src/app/api/products/[id]/builds/route.ts",
  "site/src/app/api/products/[id]/media/route.ts",
  "site/src/app/api/resources/inspect-meta/route.ts",
  "site/src/app/api/licenses/[id]/actions/route.ts",
  "site/src/app/api/resources/claim/route.ts",
  "site/src/app/api/servers/[id]/claim-challenge/route.ts",
  "site/src/app/api/servers/[id]/claim-challenge/verify/route.ts",
  "site/src/app/api/products/[id]/lifecycle/route.ts",
  "site/src/app/api/products/[id]/builds/[buildId]/route.ts",
  "site/src/app/api/products/route.ts",
  "site/src/app/api/products/[id]/route.ts",
  "site/src/app/api/products/[id]/compatibility/route.ts",
  "site/src/app/api/products/[id]/variants/route.ts",
  "site/src/app/api/products/[id]/copy/route.ts",
  "site/src/app/api/products/[id]/reviews/route.ts",
  "site/src/app/api/products/[id]/reviews/[reviewId]/report/route.ts",
  "site/src/app/api/library/review/[id]/route.ts",
  "site/src/app/api/servers/route.ts",
  "site/src/app/api/servers/[id]/route.ts",
  "site/src/app/api/workspace/servers/[id]/content/route.ts",
  "site/src/app/api/workspace/servers/[id]/content/[contentId]/route.ts",
  "site/src/app/api/workspace/servers/[id]/content/[contentId]/restore/route.ts",
  "site/src/app/api/library/[id]/collections/route.ts",
  "site/src/app/api/library/collections/route.ts",
  "site/src/app/api/library/collections/[id]/route.ts",
  "site/src/app/api/library/collections/[id]/import-preview/route.ts",
  "site/src/app/api/library/collections/[id]/reconcile-preview/route.ts",
  "site/src/app/api/library/collections/[id]/versions/route.ts",
  "site/src/app/api/library/collections/[id]/versions/preview/route.ts",
  "site/src/app/api/library/collections/[id]/watches/route.ts",
  "site/src/app/api/library/releases/[id]/route.ts",
  "site/src/app/api/library/watches/[id]/route.ts",
  "site/src/app/api/library/watches/disable/route.ts",
  "site/src/app/api/library/watches/resume/route.ts",
  "site/src/app/api/workspace/organizations/route.ts",
  "site/src/app/api/workspace/organizations/[id]/route.ts",
  "site/src/app/api/workspace/organizations/[id]/leave/route.ts",
  "site/src/app/api/workspace/organizations/[id]/ownership/route.ts",
  "site/src/app/api/workspace/organizations/[id]/members/route.ts",
  "site/src/app/api/workspace/organizations/[id]/members/[userId]/route.ts",
  "site/src/app/api/workspace/organizations/[id]/members/batch/route.ts",
  "site/src/app/api/workspace/organizations/[id]/members/batch/preview/route.ts",
  "site/src/app/api/workspace/organizations/[id]/content/route.ts",
  "site/src/app/api/workspace/organizations/[id]/content/[contentId]/route.ts",
  "site/src/app/api/workspace/organizations/[id]/content/[contentId]/restore/route.ts",
  "site/src/app/api/workspace/servers/visibility/preview/route.ts",
  "site/src/app/api/workspace/servers/visibility/route.ts",
  "site/src/app/api/follow/route.ts",
  "site/src/app/api/notifications/inbox/route.ts",
  "site/src/app/api/notifications/mark-read/route.ts",
  "site/src/app/api/notifications/preferences/route.ts",
  "site/src/app/api/notifications/push/route.ts",
  "site/src/app/api/content/route.ts",
  "site/src/app/api/content/[slug]/comments/route.ts",
  "site/src/app/api/content/[slug]/comments/[id]/route.ts",
  "site/src/app/api/content/[slug]/reactions/route.ts",
  "site/src/app/api/workspace/content/route.ts",
  "site/src/app/api/workspace/content/[id]/route.ts",
  "site/src/app/api/workspace/content/[id]/restore/route.ts",
  "site/src/app/api/workspace/discussions/[id]/route.ts",
  "site/src/app/api/workspace/reactions/[id]/route.ts",
  "site/src/app/api/reports/route.ts",
  "site/src/app/api/workspace/reports/route.ts",
  "site/src/app/api/support/route.ts",
  "site/src/app/api/support/[id]/route.ts",
  "site/src/app/api/verification/route.ts",
  "site/src/app/api/workspace/verification/route.ts",
  "site/src/app/api/workspace/verification/[id]/route.ts",
  "site/src/app/api/admin/storage/discovery/route.ts",
  "site/src/app/api/admin/storage/objects/[id]/cleanup/route.ts",
  "site/src/app/api/admin/actions/route.ts",
  "site/src/app/api/admin/reports/[id]/route.ts",
  "site/src/app/api/admin/resources/[id]/route.ts",
  "site/src/app/api/admin/verification/[id]/route.ts",
  "site/src/app/api/admin/licenses/[id]/route.ts",
  "site/src/app/api/admin/community/[id]/route.ts",
  "site/src/app/api/admin/community/[id]/reports/batch/route.ts",
  "site/src/app/api/admin/community/[id]/reports/batch/preview/route.ts",
  "site/src/app/api/admin/community/[id]/discussion/[commentId]/route.ts",
  "site/src/app/api/admin/community/[id]/discussion/[commentId]/reports/batch/route.ts",
  "site/src/app/api/admin/community/[id]/discussion/[commentId]/reports/batch/preview/route.ts",
] as const;

const REQUIRED_BEARER = [
  "site/src/app/api/licenses/check/route.ts",
  "site/src/app/api/licenses/check-release/route.ts",
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

function mutationAdapters(source: string, file: string) {
  const ast = parseSync(source, { syntax: "typescript" });
  const imports = new Map<string, "browser" | "bearer">();
  for (const node of ast.body) {
    if (node.type !== "ImportDeclaration") continue;
    const target = path.resolve(
      path.dirname(file),
      node.source.value.endsWith(".ts") ? node.source.value : `${node.source.value}.ts`,
    );
    for (const specifier of node.specifiers) {
      if (specifier.type !== "ImportSpecifier" || specifier.isTypeOnly || node.typeOnly) continue;
      const name = specifier.imported?.value ?? specifier.local.value;
      if (
        name === "withBrowserMutation" &&
        target === path.join(repoRoot, "site/src/lib/browser-route-adapter.ts")
      )
        imports.set(specifier.local.value, "browser");
      if (
        name === "withLicenseBearerRoute" &&
        target === path.join(repoRoot, "site/src/lib/license-bearer-route-adapter.ts")
      )
        imports.set(specifier.local.value, "bearer");
    }
  }
  const handlers: { method: string; adapter: "browser" | "bearer" | null }[] = [];
  for (const node of ast.body) {
    if (node.type === "ExportAllDeclaration") handlers.push({ method: "*", adapter: null });
    if (node.type === "ExportNamedDeclaration") {
      for (const specifier of node.specifiers) {
        if (specifier.type === "ExportSpecifier") {
          const method = specifier.exported?.value ?? specifier.orig.value;
          if (MUTATION_METHODS.has(method)) handlers.push({ method, adapter: null });
        }
      }
    }
    if (node.type !== "ExportDeclaration") continue;
    const declaration = node.declaration;
    if (
      declaration.type === "FunctionDeclaration" &&
      MUTATION_METHODS.has(declaration.identifier.value)
    )
      handlers.push({ method: declaration.identifier.value, adapter: null });
    if (declaration.type !== "VariableDeclaration") continue;
    for (const variable of declaration.declarations) {
      if (variable.id.type !== "Identifier") {
        handlers.push({ method: "<destructured>", adapter: null });
        continue;
      }
      if (!MUTATION_METHODS.has(variable.id.value)) continue;
      const call = variable.init;
      const adapter =
        declaration.kind === "const" &&
        call?.type === "CallExpression" &&
        call.callee.type === "Identifier"
          ? (imports.get(call.callee.value) ?? null)
          : null;
      handlers.push({ method: variable.id.value, adapter });
    }
  }
  return handlers;
}

describe("browser API route adapter inventory", () => {
  const routes = listRouteFiles(apiRoot).map((full) => {
    const rel = path.relative(repoRoot, full).split(path.sep).join("/");
    const source = readFileSync(full, "utf8");
    const handlers = mutationAdapters(source, full);
    const kind =
      handlers.length === 0
        ? "safe-only"
        : handlers.every((handler) => handler.adapter === "browser")
          ? "browser"
          : handlers.every((handler) => handler.adapter === "bearer")
            ? "bearer"
            : "unprotected";
    return { rel, source, kind, handlers };
  });

  it("keeps auth, account, uploads, license owner actions, resource publish and claim, product editing, reviews, server registration, server content, library collections, library watches and releases, organization writes, server visibility, follow, notifications, public content, author desk, report creates, support cases, verification, admin storage, and staff moderation on the shared browser adapter", () => {
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

  it("requires every exported mutation to use its actual shared adapter without exceptions", () => {
    for (const route of routes) {
      for (const handler of route.handlers) {
        const bearer = (REQUIRED_BEARER as readonly string[]).includes(route.rel);
        expect(handler.adapter, `${route.rel} ${handler.method}`).toBe(
          bearer ? "bearer" : "browser",
        );
        if (bearer) expect(handler.method).toBe("POST");
      }
    }
  });

  it("detects mixed methods, markers in comments, fake adapters and indirect exports", () => {
    const file = path.join(apiRoot, "demo/route.ts");
    const wrapped =
      'import { withBrowserMutation as guard } from "../../../lib/browser-route-adapter"; export const POST = guard(async () => new Response());';
    expect(mutationAdapters(`${wrapped} export function DELETE() {}`, file)).toEqual([
      { method: "POST", adapter: "browser" },
      { method: "DELETE", adapter: null },
    ]);
    for (const source of [
      "// withBrowserMutation\nexport function POST() {}",
      'import { withBrowserMutation } from "./fake"; export const POST = withBrowserMutation(() => new Response());',
      'export { command as POST } from "./other";',
      'export * from "./other";',
      "export const { POST } = commands;",
    ]) {
      const handlers = mutationAdapters(source, file);
      expect(handlers.length).toBeGreaterThan(0);
      expect(handlers.every((handler) => handler.adapter === null)).toBe(true);
    }
  });
});
