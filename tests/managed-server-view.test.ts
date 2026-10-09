import { expect, it } from "vitest";
import {
  managedServerHref,
  parseManagedServerQuery,
} from "../apps/web/src/lib/managed-server-view";

it("parses supported independent filters and bounds text search", () => {
  expect(
    parseManagedServerQuery({
      page: "3",
      q: "  203.0.113  ",
      status: "maintenance",
      visibility: "private",
      verification: "unverified",
    }),
  ).toEqual({
    page: 3,
    filters: {
      query: "203.0.113",
      status: "maintenance",
      visibility: "private",
      verification: "unverified",
    },
  });
  expect(parseManagedServerQuery({ q: "x".repeat(500) }).filters.query).toHaveLength(120);
});
it.each(["0", "-2", "1e2", "1.5", "Infinity", "9999999", "", undefined, ["2", "3"]])(
  "rejects malformed or ambiguous page %s",
  (page) => {
    expect(parseManagedServerQuery({ page }).page).toBe(1);
  },
);
it("ignores unknown and duplicated filters rather than forwarding SQL choices", () => {
  expect(
    parseManagedServerQuery({
      status: "DROP TABLE",
      visibility: ["public", "private"],
      verification: "yes",
      q: ["secret", "all"],
    }),
  ).toEqual({ page: 1, filters: {} });
});
it("preserves active filters safely in pagination and omits page one", () => {
  const filters = {
    query: "name & %_",
    visibility: "private" as const,
    verification: "verified" as const,
    status: "active" as const,
  };
  const url = new URL(managedServerHref(filters, 3), "https://nexus.test");
  expect(Object.fromEntries(url.searchParams)).toEqual({
    q: "name & %_",
    visibility: "private",
    verification: "verified",
    status: "active",
    page: "3",
  });
  expect(managedServerHref()).toBe("/workspace/servers");
  expect(
    new URL(managedServerHref(filters, 1), "https://nexus.test").searchParams.has("page"),
  ).toBe(false);
});
