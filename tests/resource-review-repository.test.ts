import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createResourceReviewRepositoryDbMock } = await import(
    "./helpers/resource-review-repository-harness"
  );
  return createResourceReviewRepositoryDbMock();
});

import { resourceReviewsRepository as repo } from "../packages/db/src/repositories/resource-reviews";
import {
  installResourceReviewRepositoryHooks,
  resourceReviewRepositoryInput as input,
  resourceReviewRepositoryProduct as product,
  resourceReviewRepositoryState as state,
} from "./helpers/resource-review-repository-harness";

installResourceReviewRepositoryHooks();

it("locks live acquired access and records source without changing metadata revision", async () => {
  state.rows = [
    [product],
    [["user"]],
    [["ent_a", null]],
    [],
    [["bld_a"]],
    [],
    [[1, 50]],
    [],
    [],
    [
      [
        "cmt_a",
        "Useful resource",
        5,
        "published",
        1,
        "entitlement",
        "2026-10-11T00:00:00Z",
        null,
        "alice",
        "Alice",
      ],
    ],
  ];
  const result = await repo.command(input);
  expect(result).toMatchObject({ id: "cmt_a", revision: 1, ratingCount: 1, ratingAverage: 50 });
  expect(state.queries[0].sql).toContain("for no key update");
  expect(state.queries[1].sql).toContain('from "users"');
  expect(state.queries[2].sql).toContain('from "entitlements"');
  expect(state.queries[2].params).toContain("usr_a");
  expect(state.queries[2].sql).toContain("for share");
  expect(state.queries[4].sql).toContain('"builds"."scanned_at" is not null');
  expect(state.queries.find((q) => q.sql.startsWith('update "products"'))?.sql).not.toContain(
    '"updated_at"',
  );
  expect(state.queries.find((q) => q.sql.startsWith('insert into "comments"'))?.params).toContain(
    "entitlement",
  );
  expect(
    state.queries.find((q) => q.sql.startsWith('insert into "audit_events"'))?.params,
  ).not.toContain("Useful resource");
});

it("supports active licenses without converting them into permanent grants", async () => {
  state.rows = [
    [product],
    [["user"]],
    [],
    [["lic_a", null]],
    [],
    [["bld_a"]],
    [],
    [[1, 50]],
    [],
    [],
    [],
  ];
  await repo.command(input);
  expect(state.queries.find((q) => q.sql.startsWith('insert into "comments"'))?.params).toContain(
    "license",
  );
  expect(
    state.queries.some((q) => /^(insert|update).*"(?:licenses|entitlements)"/u.test(q.sql)),
  ).toBe(false);
});

it.each(["publisher", "admin", "organization_owner", "delegated_manager"])(
  "rejects self-interested reviewer %s under locked authority",
  async (role) => {
    if (role === "publisher") state.rows = [[product], [["user"]], [], [["bld_a"]]];
    if (role === "admin") state.rows = [[product], [["admin"]], [], [["bld_a"]]];
    if (role === "organization_owner")
      state.rows = [
        [product.slice(0, 5).concat("org_a")],
        [["usr_a"]],
        [["user"]],
        [],
        [],
        [["bld_a"]],
      ];
    if (role === "delegated_manager")
      state.rows = [
        [product.slice(0, 5).concat("org_a")],
        [["owner"]],
        [["user"]],
        [["member", ["manage_products"]]],
        [],
        [["bld_a"]],
      ];
    const actorId = role === "publisher" ? "usr_publisher" : "usr_a";
    await expect(repo.command({ ...input, actorId })).rejects.toMatchObject({
      code: "REVIEW_ACCESS_REQUIRED",
    });
    expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
  },
);

it("rechecks expiry after waiting for build locks", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-11T00:00:00Z"));
  state.rows = [[product], [["user"]], [["ent_a", "2026-10-11T00:00:01Z"]], [], [["bld_a"]]];
  state.clock = () => {
    if (state.queries.length === 5) vi.setSystemTime(new Date("2026-10-11T00:00:02Z"));
  };
  await expect(repo.command(input)).rejects.toMatchObject({ code: "REVIEW_ACCESS_REQUIRED" });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});

it("stale revision cannot overwrite a newer edit", async () => {
  state.rows = [[product], [["user"]], [["ent_a", null]], [["cmt_a", "published", 2]]];
  await expect(repo.command(input)).rejects.toMatchObject({ code: "REVIEW_CHANGED" });
  expect(state.queries.some((q) => q.sql.startsWith("update"))).toBe(false);
});

it("moderation removal blocks republishing even with valid access", async () => {
  state.rows = [[product], [["user"]], [["ent_a", null]], [["cmt_a", "removed", 2]]];
  await expect(
    repo.command({ ...input, command: { ...input.command, expectedRevision: 2 } }),
  ).rejects.toMatchObject({ code: "REVIEW_MODERATED" });
});

it("withdrawal remains possible after access expires and excludes the rating", async () => {
  state.rows = [[product], [["user"]], [], [], [["cmt_a", "published", 2]], [], [], [[0, 0]], []];
  expect(
    await repo.command({ ...input, command: { action: "withdraw", expectedRevision: 2 } }),
  ).toMatchObject({ revision: 3, status: "withdrawn", ratingCount: 0 });
  expect(state.queries.find((q) => q.sql.includes("avg("))?.params).toContain("published");
  expect(state.queries.some((q) => q.sql.startsWith('delete from "comments"'))).toBe(false);
});
