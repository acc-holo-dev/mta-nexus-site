import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  authEntryHref,
  parseAuthReturnPath,
  resolveAuthReturnPath,
} from "../site/src/components/auth-return-path";

const authFormSource = readFileSync(
  resolve(process.cwd(), "site/src/components/auth-form.tsx"),
  "utf8",
);

describe("auth return path contract (FLOW-01)", () => {
  it("accepts internal paths with query and hash", () => {
    expect(parseAuthReturnPath("/acquire?productId=prd_a")).toBe("/acquire?productId=prd_a");
    expect(parseAuthReturnPath("/market/detail#reviews")).toBe("/market/detail#reviews");
    expect(parseAuthReturnPath("/workspace/library")).toBe("/workspace/library");
  });

  it("rejects external, protocol-relative, empty, and auth-loop targets", () => {
    expect(parseAuthReturnPath("https://evil.example/phish")).toBeNull();
    expect(parseAuthReturnPath("//evil.example/phish")).toBeNull();
    expect(parseAuthReturnPath("")).toBeNull();
    expect(parseAuthReturnPath("   ")).toBeNull();
    expect(parseAuthReturnPath("/auth/login")).toBeNull();
    expect(parseAuthReturnPath("/auth/register?next=%2Fworkspace")).toBeNull();
    expect(parseAuthReturnPath(null)).toBeNull();
  });

  it("falls back to workspace when the next target is unsafe", () => {
    expect(resolveAuthReturnPath("https://evil.example")).toBe("/workspace");
    expect(resolveAuthReturnPath(undefined)).toBe("/workspace");
  });

  it("builds login and register entry hrefs that preserve a safe next target", () => {
    expect(authEntryHref("login", "/acquire?productId=prd_a")).toBe(
      "/auth/login?next=%2Facquire%3FproductId%3Dprd_a",
    );
    expect(authEntryHref("register", "/acquire?productId=prd_a")).toBe(
      "/auth/register?next=%2Facquire%3FproductId%3Dprd_a",
    );
    expect(authEntryHref("login", "https://evil.example")).toBe("/auth/login");
  });

  it("replaces the document to the safe next path without auto-mutating after auth", () => {
    expect(authFormSource).toContain("window.location.replace(next)");
    expect(authFormSource).toContain("resolveAuthReturnPath");
    expect(authFormSource).not.toContain('window.location.replace("/workspace")');
    expect(authFormSource).not.toMatch(/\/api\/resources\/claim/);
    expect(authFormSource).not.toMatch(/\/api\/follow/);
    expect(authFormSource).not.toMatch(/\/reactions/);
  });
});
