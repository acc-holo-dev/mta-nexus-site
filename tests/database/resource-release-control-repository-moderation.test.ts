import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("../../packages/db/src/client", async () => {
  const { createResourceReleaseControlRepositoryDbMock } = await import(
    "../helpers/resource-release-control-repository-harness"
  );
  return createResourceReleaseControlRepositoryDbMock();
});

import {
  classifyBuildAvailability,
  resourceLifecycleTarget,
  resourceModerationActionsFor,
  unavailableBuildSupportHref,
} from "@nexus/domain";
import { unavailableBuildGuidance } from "../../packages/db/src/repositories/builds-lifecycle";
import { ProductRepository } from "../../packages/db/src/repositories/products";
import { ResourceModerationRepository } from "../../packages/db/src/repositories/resource-moderation";
import {
  command,
  liveSession,
  modInput,
  modToken,
  now,
  product,
  resetResourceReleaseControlRepositoryState,
  stamp,
  resourceReleaseControlRepositoryState as state,
} from "../helpers/resource-release-control-repository-harness";

const moderation = new ResourceModerationRepository();

beforeEach(() => {
  resetResourceReleaseControlRepositoryState();
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
afterEach(() => vi.useRealTimers());

it("shows restore/release as draft next steps and explains unavailable builds", () => {
  expect(resourceLifecycleTarget("archived", "restore")).toBe("draft");
  expect(resourceLifecycleTarget("draft", "submit")).toBe("pending_review");
  expect(resourceModerationActionsFor("suspended")).toEqual(["release"]);
  expect(resourceModerationActionsFor("published")).toEqual(["suspend"]);
  expect(classifyBuildAvailability("quarantined")).toBe("quarantined");
  expect(unavailableBuildSupportHref()).toBe("/support?category=resource");
  expect(
    unavailableBuildGuidance({
      productId: "prd_a",
      buildId: "bld_a",
      status: "quarantined",
    }),
  ).toMatchObject({
    downloadBlocked: true,
    autoPublishedOnRestore: false,
    supportHref: "/support?category=resource",
  });
});

it("releasing a restriction drafts published/pending versions and preserves quarantine", async () => {
  state.results = [
    [product("suspended")],
    [["moderator"]],
    liveSession,
    [["bld_a"], ["bld_b"]],
    [],
    [product("draft", "2026-10-10T12:00:00.001Z")],
    [],
  ];
  expect(await moderation.command(modInput)).toMatchObject({ product: { status: "draft" } });
  const buildUpdate = state.queries.find((q) => q.sql.startsWith('update "builds"'));
  expect(buildUpdate?.params).toEqual(["draft", "prd_a", "published", "pending_review"]);
  expect(state.queries[0].sql).toContain("for no key update");
  expect(state.queries[1].sql).toContain("for share");
  expect(state.queries.at(-1)?.params).toContain("product.moderation_released");
  expect(state.queries.map((q) => q.sql).join("\n")).not.toMatch(
    /(?:delete from|update) "(?:licenses|entitlements|payments|orders)"/u,
  );
});
it.each(["developer", "user"])(
  "a revoked staff role (%s) cannot release a resource",
  async (role) => {
    state.results = [[product("suspended")], [[role]]];
    await expect(moderation.command(modInput)).rejects.toMatchObject({ statusCode: 403 });
    expect(state.queries).toHaveLength(2);
  },
);
it("rejects stale moderation before changing any builds or writing an audit", async () => {
  state.results = [[product("suspended", "2026-10-10T12:00:00.001Z")], [["admin"]], liveSession];
  await expect(moderation.command(modInput)).rejects.toMatchObject({
    code: "PRODUCT_METADATA_CONFLICT",
  });
  expect(state.queries).toHaveLength(3);
  expect(state.queries.some((query) => query.sql.startsWith("update"))).toBe(false);
});
it("suspension changes availability without destroying releases or acquired rights", async () => {
  state.results = [
    [product()],
    [["admin"]],
    liveSession,
    [product("suspended", "2026-10-10T12:00:00.001Z")],
    [],
  ];
  expect(
    await moderation.command({ ...modInput, command: { ...command, action: "suspend" } }),
  ).toMatchObject({ product: { status: "suspended" } });
  expect(state.queries.some((q) => q.sql.startsWith('update "builds"'))).toBe(false);
});
it("hides historical internal staff notes from the publisher", async () => {
  state.results = [
    [["prd_a", "usr_a", null]],
    [["usr_a", "developer"]],
    [[1]],
    [["aud_a", "admin.restore", "", stamp]],
  ];
  const result = await moderation.publisherHistory("usr_a", "prd_a");
  expect(result.events[0].reason).toBe("");
  expect(state.queries.at(-1)?.sql).toContain("else '' end");
  expect(state.queries.at(-1)?.sql).not.toContain("->>'notes'");
});
it("uses actual current admin authority for private resource reads", async () => {
  state.results = [];
  expect(
    await new ProductRepository().hasManagementAccess("prd_a", {
      id: "usr_stale_admin",
      role: "admin",
    }),
  ).toBe(false);
  const query = state.queries[0];
  expect(query.sql).toContain('"users"');
  expect(query.sql).toContain("role");
  expect(query.params).toContain("usr_stale_admin");
});
it("legacy feature changes require a live staff grant and advance the moderation revision", async () => {
  const audit = {
    id: "aud_a",
    actorId: "usr_mod",
    actorType: "admin" as const,
    action: "admin.feature",
    targetType: "product",
    targetId: "prd_a",
  };
  state.results = [[["prd_a"]], [["user"]]];
  await expect(
    new ProductRepository().updateWithAudit("prd_a", { isFeatured: true }, audit, modToken),
  ).rejects.toMatchObject({ statusCode: 403 });
  expect(state.queries.some((query) => query.sql.startsWith("update"))).toBe(false);
  state.queries = [];
  state.results = [[["prd_a"]], [["moderator"]], liveSession, [], []];
  await new ProductRepository().updateWithAudit("prd_a", { isFeatured: true }, audit, modToken);
  expect(state.queries.find((query) => query.sql.startsWith("update"))?.sql).toContain(
    "interval '1 millisecond'",
  );
  const sessionQuery = state.queries.find((query) => query.sql.includes('"sessions"'));
  expect(sessionQuery?.sql).toContain("for update");
  expect(sessionQuery?.params).toContain(createHash("sha256").update(modToken).digest("hex"));
  expect(sessionQuery?.params).not.toContain(modToken);
});
it("refuses a product moderation write when the initiating session is missing or expired", async () => {
  const audit = {
    id: "aud_a",
    actorId: "usr_mod",
    actorType: "admin" as const,
    action: "admin.feature",
    targetType: "product",
    targetId: "prd_a",
  };
  state.results = [[["prd_a"]], [["moderator"]]];
  await expect(
    new ProductRepository().updateWithAudit("prd_a", { isFeatured: true }, audit, modToken),
  ).rejects.toThrow("Authentication required");
  expect(state.queries.some((query) => query.sql.startsWith("update"))).toBe(false);
  const selection = state.queries[2]?.sql.split(" from ")[0] ?? "";
  expect(selection).toContain('"expires_at"');
  expect(selection).not.toContain('"token"');
  state.queries = [];
  state.results = [[product()], [["admin"]], [["ses_mod", "2000-01-01T00:00:00.000Z"]]];
  await expect(moderation.command(modInput)).rejects.toThrow("Authentication required");
  expect(state.queries.some((query) => query.sql.startsWith("update"))).toBe(false);
});
