import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createVerificationApplicationsQueryDbMock } = await import(
    "./helpers/verification-applications-query-harness"
  );
  return createVerificationApplicationsQueryDbMock();
});

vi.mock("../packages/db/src/repositories/web-push-admission-recovery", async () => {
  const { createVerificationApplicationsQueryWebPushMock } = await import(
    "./helpers/verification-applications-query-harness"
  );
  return createVerificationApplicationsQueryWebPushMock();
});

import { VerificationRepository } from "../packages/db/src/repositories/verification";
import { verificationApplicationRevision as version } from "../packages/db/src/repositories/verification-application-version";
import { verificationWorkspaceRepository as repo } from "../packages/db/src/repositories/verification-workspace";
import {
  verificationApplicationsQueryAudit as audit,
  installVerificationApplicationsQueryHooks,
  verificationApplicationsQueryInput as input,
  verificationApplicationsQueryRequest as request,
  verificationApplicationsQueryStamp as stamp,
  verificationApplicationsQueryState as state,
  verificationApplicationsQueryWrites as writes,
} from "./helpers/verification-applications-query-harness";

installVerificationApplicationsQueryHooks();

it("locks ownership and current profile before replacing only evidence, with a monotonically ordered mandatory audit stamp", async () => {
  state.rows = [
    [request()],
    [["submission"]],
    [["developer", false]],
    [[["Lua"], "https://example.test", false]],
    [["actor"]],
    [["session", "2099-01-01T00:00:00.000Z"]],
    [["session", "2099-01-01T00:00:00.000Z"]],
  ];
  expect(await repo.amend("actor", "request", input, audit, "unit-token")).toEqual({
    id: "request",
    status: "pending",
    revision: version("request", "pending", "new-audit"),
  });
  expect(state.queries[0].sql).toContain("for update");
  expect(state.queries[0].params).toContain("actor");
  expect(state.queries[2].sql).toContain("for share");
  expect(state.queries[3].sql).toContain("for share");
  const set = writes("verification_requests")[0].sql.split(" set ")[1].split(" where ")[0];
  expect(set).toContain('"proof_url"');
  expect(set).toContain('"notes"');
  expect(set).not.toMatch(/status|created_at|resolved_at|reviewer_id|requester_id/u);
  expect(writes("audit_events")[0].sql).toContain("interval '1 microsecond'");
  expect(writes("audit_events")[0].params).toContain(
    JSON.stringify({ developerProfileRevision: stamp }),
  );
  expect(writes("audit_events")[0].params).not.toContain(input.proofUrl);
  expect(writes("developer_profiles")).toHaveLength(0);
  expect(writes("notifications")).toHaveLength(0);
});
it.each([
  { status: "approved", code: "VERIFICATION_APPLICATION_CHANGED" },
  { status: "rejected", code: "VERIFICATION_APPLICATION_CHANGED" },
  { targetType: "server", code: "VERIFICATION_APPLICATION_READ_ONLY" },
])("rejects resolved or MTA-proof mutations %j", async ({ code, ...extra }) => {
  state.rows = [[request(extra)]];
  await expect(repo.amend("actor", "request", input, audit, "unit-token")).rejects.toMatchObject({
    code,
  });
  expect(writes("verification_requests")).toHaveLength(0);
});
it("rejects an obsolete author version before target checks or evidence writes", async () => {
  state.rows = [[request()], [["newer-submission"]]];
  await expect(repo.amend("actor", "request", input, audit, "unit-token")).rejects.toMatchObject({
    code: "VERIFICATION_APPLICATION_CHANGED",
  });
  expect(state.queries).toHaveLength(2);
  expect(writes("verification_requests")).toHaveLength(0);
});
it.each(["member", "owner", null])(
  "requires current organization administration %s",
  async (role) => {
    state.rows = [
      [request({ targetType: "organization", targetId: "org" })],
      [["submission"]],
      [["other-owner", false]],
      role ? [[role]] : [],
    ];
    await expect(repo.amend("actor", "request", input, audit, "unit-token")).rejects.toMatchObject({
      code: "VERIFICATION_AUTHORITY_CHANGED",
    });
    expect(writes("verification_requests")).toHaveLength(0);
  },
);
it("propagates audit failures instead of reporting a saved version", async () => {
  state.rows = [
    [request()],
    [["submission"]],
    [["developer", false]],
    [[["Lua"], "https://example.test", false]],
    [["actor"]],
    [["session", "2099-01-01T00:00:00.000Z"]],
    [["session", "2099-01-01T00:00:00.000Z"]],
  ];
  state.failAudit = true;
  await expect(repo.amend("actor", "request", input, audit, "unit-token")).rejects.toMatchObject({
    cause: { message: "audit failed" },
  });
});
it.each([undefined, input.expectedRevision])(
  "rejects unbound or stale moderation after an evidence replacement (%s)",
  async (expectedApplicationRevision) => {
    state.rows = [
      [["moderator"]],
      [["ses_staff", "2099-01-01T00:00:00.000Z"]],
      [request({ status: "approved" })],
      [["updated-submission", "verification.application_updated", stamp]],
    ];
    await expect(
      new VerificationRepository().resolveRequest({
        id: "request",
        reviewerId: "reviewer",
        decision: "approved",
        expectedApplicationRevision,
        currentToken: "staff-session",
      }),
    ).rejects.toMatchObject({ code: "VERIFICATION_APPLICATION_CHANGED" });
    expect(writes("users")).toHaveLength(0);
    expect(writes("developer_profiles")).toHaveLength(0);
    expect(writes("audit_events")).toHaveLength(0);
    expect(writes("notifications")).toHaveLength(0);
  },
);
it("accepts a fresh version and profile stamp from amended evidence for independent approval", async () => {
  state.rows = [
    [["moderator"]],
    [["ses_staff", "2099-01-01T00:00:00.000Z"]],
    [request({ status: "approved" })],
    [["updated-submission", "verification.application_updated", stamp]],
    [["actor"], ["reviewer"]],
    [["developer", false]],
    [[["Lua"], "https://example.test", false]],
    [["actor"]],
    [["moderator"]],
    [["notice", "actor"]],
  ];
  expect(
    (
      await new VerificationRepository().resolveRequest({
        id: "request",
        reviewerId: "reviewer",
        decision: "approved",
        expectedApplicationRevision: version("request", "pending", "updated-submission"),
        currentToken: "staff-session",
      })
    )?.status,
  ).toBe("approved");
  expect(writes("developer_profiles")).toHaveLength(1);
  expect(writes("notifications")).toHaveLength(1);
});
