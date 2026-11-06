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

it("edits rejected metadata into a draft without touching uploaded identity", async () => {
  state.rows = [
    [parent],
    [["usr_a", "developer"]],
    [build("rejected")],
    [build("draft", 4, "Fixed notes")],
    [["1.1.0"]],
    [],
    [],
    [],
  ];
  await repo.command({
    ...input,
    command: {
      action: "save",
      expectedRevision: 3,
      releaseNotes: "Fixed notes",
      mtaVersionTarget: "",
    },
  });
  const update = state.queries.find((q) => q.sql.startsWith('update "builds"'));
  expect(update?.sql.split(" where ")[0]).toContain('"release_notes"');
  for (const field of [
    "storage_key",
    "sha256_hash",
    "version",
    "scan_status",
    "scanner",
    "scanned_at",
  ])
    expect(update?.sql.split(" where ")[0]).not.toContain(`"${field}"`);
  expect(state.queries.at(-1)?.params).not.toContain("Fixed notes");
});
it("does not write or audit an identical draft save", async () => {
  state.rows = [[parent], [["usr_a", "developer"]], [build("draft")]];
  expect(
    await repo.command({
      ...input,
      command: { action: "save", expectedRevision: 3, releaseNotes: "", mtaVersionTarget: "" },
    }),
  ).toMatchObject({ revision: 3 });
  expect(state.queries).toHaveLength(3);
});
it("requires clean scanner provenance in the resubmission SQL", async () => {
  state.rows = [[parent], [["usr_a", "developer"]], [build("rejected")], []];
  await expect(
    repo.command({ ...input, command: { ...input.command, action: "submit" } }),
  ).rejects.toMatchObject({ code: "BUILD_SCAN_NOT_CLEAN" });
  expect(state.queries[3].sql).toContain('"builds"."scan_status" =');
  expect(state.queries[3].sql).toContain('"builds"."scanned_at" is not null');
  expect(state.queries).toHaveLength(4);
});
it.each(["retired", "quarantined", "published"])("cannot resubmit %s", async (status) => {
  state.rows = [[parent], [["usr_a", "developer"]], [build(status)]];
  await expect(
    repo.command({ ...input, command: { ...input.command, action: "submit" } }),
  ).rejects.toMatchObject({ code: "BUILD_TRANSITION_INVALID" });
});
it.each(["archived", "suspended"])("does not submit a %s resource", async (status) => {
  const product = [...parent];
  product[3] = status;
  state.rows = [[product], [["usr_a", "developer"]], [build("draft")]];
  await expect(
    repo.command({ ...input, command: { ...input.command, action: "submit" } }),
  ).rejects.toMatchObject({ code: "PRODUCT_STATE_CHANGED" });
});
it("returns only private presentation fields and bounded event history", async () => {
  state.rows = [[parent], [["usr_a", "developer"]], [build()], []];
  const result = await repo.detail("prd_a", "bld_a", "usr_a");
  expect(result.build).not.toHaveProperty("storageKey");
  expect(result.product).not.toHaveProperty("authorId");
  expect(state.queries[3].params.at(-1)).toBe(20);
  expect(state.queries[3].sql).not.toContain('"actor_id"');
  expect(state.queries[3].sql).toContain("->>'reason'");
  expect(state.queries[2].sql).not.toContain("storage_key");
});
it("staff history rechecks the live role", async () => {
  state.rows = [[parent], [["user"]]];
  await expect(repo.detail("prd_a", "bld_a", "usr_a", true)).rejects.toMatchObject({
    statusCode: 403,
  });
  expect(state.queries).toHaveLength(2);
});
it("moderation also compares the reviewer-observed build revision under the product lock", async () => {
  const { buildRepository } = await import("../packages/db/src/repositories/builds");
  state.rows = [
    [["prd_a"]],
    [["prd_a", "published", "usr_a", null]],
    [["moderator"]],
    [["ses_staff", "2099-01-01T00:00:00.000Z"]],
    [],
  ];
  const audit = {
    id: "aud_review",
    actorId: "usr_staff",
    actorType: "user" as const,
    action: "build.approved",
    targetId: "bld_a",
    targetType: "build",
  };
  expect(
    await buildRepository.moderatePending("bld_a", "approve", audit, 3, "staff-session"),
  ).toBeNull();
  expect(state.queries[1].sql).toContain("for no key update");
  expect(state.queries[2].sql).toContain("for share");
  expect(state.queries[3].sql).toContain('"sessions"');
  expect(state.queries[3].sql).toContain("for update");
  expect(state.queries[4].sql).toContain('"builds"."revision" =');
  expect(state.queries[4].params).toContain(3);
  expect(state.queries).toHaveLength(5);
});
