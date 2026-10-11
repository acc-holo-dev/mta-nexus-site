import { expect, it } from "vitest";
import { resourceBuildTargetStatus, type BuildStatus } from "@nexus/domain";
import { resourceBuildCommandSchema } from "@nexus/validation";
import { confirmedBuildCommand } from "../apps/web/src/lib/resource-build-workspace-response";
const states: BuildStatus[] = [
  "draft",
  "testing",
  "pending_review",
  "published",
  "rejected",
  "deprecated",
  "quarantined",
  "retired",
];
it.each(states)("keeps %s within explicit author transitions", (status) => {
  expect(resourceBuildTargetStatus(status, "save")).toBe(
    ["draft", "rejected"].includes(status) ? "draft" : null,
  );
  expect(resourceBuildTargetStatus(status, "submit")).toBe(
    ["draft", "rejected"].includes(status) ? "pending_review" : null,
  );
  expect(resourceBuildTargetStatus(status, "withdraw")).toBe(
    status === "pending_review" ? "draft" : null,
  );
  expect(resourceBuildTargetStatus(status, "retire")).toBe(
    ["retired", "quarantined"].includes(status) ? null : "retired",
  );
});
it.each([undefined, 0, -1, 1.5, "1", 2147483647])(
  "requires a bounded observed revision %s",
  (expectedRevision) => {
    expect(
      resourceBuildCommandSchema.safeParse({
        action: "withdraw",
        expectedRevision,
        reason: "Fix notes",
      }).success,
    ).toBe(false);
  },
);
it.each(["storageKey", "sha256Hash", "scanStatus", "version", "status", "isSigned", "productId"])(
  "rejects caller-supplied %s",
  (field) => {
    expect(
      resourceBuildCommandSchema.safeParse({
        action: "save",
        expectedRevision: 1,
        releaseNotes: "Notes",
        mtaVersionTarget: "1.6.0",
        [field]: "override",
      }).success,
    ).toBe(false);
  },
);
it("bounds metadata, trims reason and disallows mixed command fields", () => {
  expect(
    resourceBuildCommandSchema.parse({
      action: "submit",
      expectedRevision: 1,
      reason: " Fix notes ",
    }),
  ).toMatchObject({ reason: "Fix notes" });
  expect(
    resourceBuildCommandSchema.safeParse({
      action: "save",
      expectedRevision: 1,
      releaseNotes: "a".repeat(10001),
      mtaVersionTarget: "",
    }).success,
  ).toBe(false);
  expect(
    resourceBuildCommandSchema.safeParse({
      action: "submit",
      expectedRevision: 1,
      reason: "why",
      releaseNotes: "bypass",
    }).success,
  ).toBe(false);
  expect(
    resourceBuildCommandSchema.safeParse({
      action: "save",
      expectedRevision: 1,
      releaseNotes: "notes",
      mtaVersionTarget: "arbitrary",
    }).success,
  ).toBe(false);
});
const before = {
  id: "bld_a",
  productId: "prd_a",
  version: "1.0.0",
  status: "pending_review" as const,
  revision: 3,
};
const command = { action: "withdraw" as const, expectedRevision: 3, reason: "Fix notes" };
const result = {
  ...before,
  status: "draft",
  revision: 4,
  releaseNotes: null,
  mtaVersionTarget: null,
};
it("confirms only the exact target, state and incremented revision", () => {
  expect(confirmedBuildCommand(200, { build: result }, before, command)).toEqual(result);
  for (const overrides of [
    { id: "bld_other" },
    { productId: "prd_other" },
    { version: "2.0.0" },
    { status: "published" },
    { revision: 3 },
    { revision: 5 },
    { releaseNotes: 42 },
  ])
    expect(
      confirmedBuildCommand(200, { build: { ...result, ...overrides } }, before, command),
    ).toBeNull();
  for (const body of [null, {}, { success: true }, { build: true }])
    expect(confirmedBuildCommand(200, body, before, command)).toBeNull();
  expect(confirmedBuildCommand(409, { build: result }, before, command)).toBeNull();
});
it("accepts a confirmed no-op draft save only with exact normalized metadata", () => {
  const draft = { ...before, status: "draft" as const };
  const input = {
    action: "save" as const,
    expectedRevision: 3,
    releaseNotes: " Notes ",
    mtaVersionTarget: "",
  };
  expect(
    confirmedBuildCommand(
      200,
      { build: { ...result, revision: 3, releaseNotes: "Notes" } },
      draft,
      input,
    ),
  ).not.toBeNull();
  expect(
    confirmedBuildCommand(
      200,
      { build: { ...result, revision: 3, releaseNotes: "Different" } },
      draft,
      input,
    ),
  ).toBeNull();
});
