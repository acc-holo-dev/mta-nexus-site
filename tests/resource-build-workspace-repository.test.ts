import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createResourceBuildWorkspaceRepositoryDbMock } = await import(
    "./helpers/resource-build-workspace-repository-harness"
  );
  return createResourceBuildWorkspaceRepositoryDbMock();
});

import { resourceBuildWorkspaceRepository as repo } from "../packages/db/src/repositories/resource-build-workspace";
import {
  installResourceBuildWorkspaceRepositoryHooks,
  resourceBuildWorkspaceRepositoryBuild as build,
  resourceBuildWorkspaceRepositoryInput as input,
  resourceBuildWorkspaceRepositoryParent as parent,
  resourceBuildWorkspaceRepositoryState as state,
} from "./helpers/resource-build-workspace-repository-harness";

installResourceBuildWorkspaceRepositoryHooks();

it("does not republish unreviewed resource metadata when withdrawing another pending version", async () => {
  state.rows = [
    [[...parent.slice(0, 3), "pending_review", ...parent.slice(4), true]],
    [["usr_a", "developer"]],
    [build()],
    [build("draft", 4)],
    [["0.9.0"]],
    [],
    [],
    [],
  ];
  expect(await repo.command(input)).toMatchObject({ status: "draft" });
  const product = state.queries.find((q) => q.sql.startsWith('update "products"'));
  expect(product?.params).toContain("draft");
  expect(product?.params).not.toContain("published");
});
it("withdraws atomically and keeps another pending build in review", async () => {
  state.rows = [
    [parent],
    [["usr_a", "developer"]],
    [build()],
    [build("draft", 4)],
    [],
    [["2.0.0"]],
    [],
    [],
  ];
  expect(await repo.command(input)).toMatchObject({ status: "draft", revision: 4 });
  expect(state.queries[0].sql).toContain("for no key update");
  expect(state.queries[1].sql).toContain("for share");
  expect(state.queries[2].sql).toContain("for update");
  expect(state.queries[3].sql).toContain('"builds"."revision" =');
  expect(state.queries[3].params).toEqual(["draft", "bld_a", "prd_a", 3, "pending_review"]);
  const product = state.queries.find((q) => q.sql.startsWith('update "products"'));
  expect(product?.params).toContain("pending_review");
  expect(product?.params).toContain("2.0.0");
  expect(product?.sql).toContain("interval '1 millisecond'");
  expect(state.queries.at(-1)?.sql).toContain('insert into "audit_events"');
});
it("rejects stale revisions before any write or artifact read", async () => {
  state.rows = [[parent], [["usr_a", "developer"]], [build("pending_review", 5)]];
  await expect(repo.command(input)).rejects.toMatchObject({ code: "BUILD_REVISION_CONFLICT" });
  expect(state.queries).toHaveLength(3);
});
it("rechecks current organization grants instead of the original author", async () => {
  state.rows = [
    [parent.slice(0, 5).concat("org_a")],
    [["usr_other"]],
    [["usr_a", "developer"]],
    [],
  ];
  await expect(repo.command(input)).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries[1].sql).toContain('from "organizations"');
  expect(state.queries[3].sql).toContain('from "organization_members"');
  expect(state.queries.every((q) => !q.sql.startsWith("update"))).toBe(true);
});
it("allows withdrawal during suspension without reviving the resource", async () => {
  const product = [...parent];
  product[3] = "suspended";
  state.rows = [[product], [["usr_a", "developer"]], [build()], [build("draft", 4)], []];
  await repo.command(input);
  expect(state.queries.some((q) => q.sql.startsWith('update "products"'))).toBe(false);
});
