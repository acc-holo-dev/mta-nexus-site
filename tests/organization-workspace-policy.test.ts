import { expect, it } from "vitest";
import { canChangeOrganizationMember, withServerManagementPermission } from "@nexus/domain";
import {
  organizationCreateSchema,
  organizationUpdateSchema,
  memberAddSchema,
  memberUpdateSchema,
  parseOrganizationPage,
} from "../apps/web/src/lib/organization-workspace-contract";
import {
  getOrganizationCopy,
  organizationError,
} from "../apps/web/src/lib/organization-workspace-copy";
const fields = { name: "Team", description: "", logoUrl: "", websiteUrl: "" };
it.each(["owner", "admin", "developer", "member"])("protects ownership for actor %s", (actor) => {
  expect(canChangeOrganizationMember(actor, "owner", null, false, true)).toBe(false);
  expect(canChangeOrganizationMember(actor, "member", "owner", false, false)).toBe(false);
});
it("limits administrators to other regular members", () => {
  expect(canChangeOrganizationMember("admin", "member", "developer", false, false)).toBe(true);
  expect(canChangeOrganizationMember("admin", "developer", null, false, false)).toBe(true);
  for (const target of ["admin", "owner", "legacy"])
    expect(canChangeOrganizationMember("admin", target, "member", false, false)).toBe(false);
  expect(canChangeOrganizationMember("admin", "member", "admin", false, false)).toBe(false);
  expect(canChangeOrganizationMember("admin", "admin", "member", true, false)).toBe(false);
  expect(canChangeOrganizationMember("developer", "member", null, false, false)).toBe(false);
  expect(canChangeOrganizationMember("owner", "admin", "member", false, false)).toBe(true);
});
it("preserves unrelated permissions exactly while toggling server delegation", () => {
  const existing = ["manage_products", "custom_grant", "manage_servers", "manage_servers"];
  expect(withServerManagementPermission(existing, false)).toEqual([
    "manage_products",
    "custom_grant",
  ]);
  expect(withServerManagementPermission(existing, true)).toEqual([
    "manage_products",
    "custom_grant",
    "manage_servers",
  ]);
  expect(existing).toHaveLength(4);
});
it("rejects injected authority, ownership and commercial grants", () => {
  expect(
    organizationCreateSchema.safeParse({ ...fields, slug: "team", ownerId: "victim" }).success,
  ).toBe(false);
  expect(
    organizationCreateSchema.safeParse({ ...fields, slug: "team", isVerified: true }).success,
  ).toBe(false);
  expect(
    organizationUpdateSchema.safeParse({
      ...fields,
      expectedUpdatedAt: "2026-10-10T12:00:00.000Z",
      slug: "new",
    }).success,
  ).toBe(false);
  expect(
    memberAddSchema.safeParse({
      username: "member",
      role: "owner",
      managesServers: false,
      expectedUpdatedAt: "2026-10-10T12:00:00.000Z",
    }).success,
  ).toBe(false);
  expect(
    memberUpdateSchema.safeParse({
      role: "member",
      managesServers: true,
      expectedUpdatedAt: "2026-10-10T12:00:00.000Z",
      permissions: ["manage_products"],
    }).success,
  ).toBe(false);
});
it.each(["javascript:alert(1)", "https://user:pass@example.com/a", "data:text/plain,logo"])(
  "rejects unsafe organization URL %s",
  (logoUrl) =>
    expect(organizationCreateSchema.safeParse({ ...fields, slug: "team", logoUrl }).success).toBe(
      false,
    ),
);
it("bounds query pages and ignores duplicates", () => {
  expect(parseOrganizationPage(new URLSearchParams("page=2&q=%25_"))).toEqual({
    page: 2,
    query: "%_",
  });
  expect(parseOrganizationPage(new URLSearchParams("page=2&page=3&q=a&q=b"))).toEqual({
    page: 1,
    query: "",
  });
  expect(parseOrganizationPage({ page: "999999", q: "a".repeat(1000) })).toEqual({
    page: 1,
    query: "a".repeat(120),
  });
});
it.each(["en", "ru"] as const)("localizes organization errors in %s", (locale) => {
  const copy = getOrganizationCopy(locale);
  expect(organizationError(locale, "MEMBER_PROTECTED")).toBe(copy.errorProtected);
  expect(organizationError(locale, "CONFLICT")).toBe(copy.errorConflict);
  expect(organizationError(locale, "SLUG_CONFLICT")).toBe(copy.errorSlug);
  expect(Object.keys(getOrganizationCopy("ru"))).toEqual(Object.keys(getOrganizationCopy("en")));
});
