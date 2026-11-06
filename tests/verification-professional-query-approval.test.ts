import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createVerificationProfessionalQueryDbMock } = await import(
    "./helpers/verification-professional-query-harness"
  );
  return createVerificationProfessionalQueryDbMock();
});
vi.mock("../packages/db/src/repositories/web-push-admission-recovery", async () => {
  const { createVerificationProfessionalQueryPushMock } = await import(
    "./helpers/verification-professional-query-harness"
  );
  return createVerificationProfessionalQueryPushMock();
});

import { developerExperienceRevision } from "../packages/db/src/repositories/developer-profile";
import { VerificationRepository } from "../packages/db/src/repositories/verification";
import { verificationWorkspaceRepository } from "../packages/db/src/repositories/verification-workspace";
import {
  installVerificationProfessionalQueryHooks,
  verificationProfessionalQueryRequest as request,
  verificationProfessionalQueryState as state,
  verificationProfessionalQueryWrites as writes,
} from "./helpers/verification-professional-query-harness";

installVerificationProfessionalQueryHooks();

it("stores a private profile revision with the serialized developer application", async () => {
  state.rows = [
    [],
    [["developer", true]],
    [[["Lua"], "https://github.com/example", false]],
    [],
    [["developer"]],
    [["ses_developer", "2099-01-01T00:00:00.000Z"]],
    [request({ status: "pending" })],
    [["ses_developer", "2099-01-01T00:00:00.000Z"]],
  ];
  await new VerificationRepository().createRequest({
    requesterId: "developer",
    currentToken: "tok_developer",
    targetType: "developer",
    targetId: "developer",
    proofUrl: "https://example.test/evidence",
  });
  expect(state.queries[0].sql).toContain("pg_advisory_xact_lock");
  const audit = writes("audit_events")[0];
  expect(audit.params.join(" ")).toContain(
    developerExperienceRevision({ specialties: ["Lua"], githubUrl: "https://github.com/example" }),
  );
  expect(audit.params.join(" ")).not.toContain("https://github.com/example");
});
function approvalRows(extra: { snapshot?: string; finalRole?: string } = {}) {
  const revision = developerExperienceRevision({
    specialties: ["Lua"],
    githubUrl: "https://github.com/example",
  });
  state.rows = [
    [["moderator"]],
    [["ses_staff", "2099-01-01T00:00:00.000Z"]],
    [request()],
    [["submission", "verification.requested", extra.snapshot ?? revision]],
    [["developer"], ["moderator"]],
    [["developer", true]],
    [[["Lua"], "https://github.com/example", false]],
    [["developer"]],
    [[extra.finalRole ?? "moderator"]],
    [["notification", "developer"]],
  ];
}
it("sets the genuine professional flag, audits and delivers one inbox result after independent current-profile approval", async () => {
  approvalRows();
  const result = await new VerificationRepository().resolveRequest({
    id: "ver_request",
    reviewerId: "moderator",
    decision: "approved",
    currentToken: "staff-session",
  });
  expect(result?.status).toBe("approved");
  expect(writes("developer_profiles")[0].params).toEqual([true, "developer"]);
  expect(state.queries[1].sql).toContain('from "sessions"');
  expect(state.queries[1].sql).toContain("for update");
  expect(state.queries[1].params).toContain("moderator");
  expect(state.queries[4].sql).toContain('order by "users"."id" asc');
  expect(state.queries[4].sql).toContain("for update");
  expect(writes("notifications")).toHaveLength(1);
  expect(writes("notifications")[0].params).toContain("/workspace/verification?view=history");
  expect(writes("audit_events")).toHaveLength(1);
});
it("refuses changed or legacy missing profile revisions before setting verified experience", async () => {
  approvalRows({ snapshot: "outdated" });
  await expect(
    new VerificationRepository().resolveRequest({
      id: "ver_request",
      reviewerId: "moderator",
      decision: "approved",
      currentToken: "staff-session",
    }),
  ).rejects.toMatchObject({ code: "VERIFICATION_PROFILE_CHANGED" });
  expect(writes("developer_profiles")).toHaveLength(0);
  expect(writes("notifications")).toHaveLength(0);
});
it("rejects a revoked reviewer both before processing and before audit/notification", async () => {
  state.rows = [[["user"]]];
  await expect(
    new VerificationRepository().resolveRequest({
      id: "ver_request",
      reviewerId: "moderator",
      decision: "approved",
      currentToken: "staff-session",
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(writes("verification_requests")).toHaveLength(0);
  state.queries = [];
  approvalRows({ finalRole: "user" });
  await expect(
    new VerificationRepository().resolveRequest({
      id: "ver_request",
      reviewerId: "moderator",
      decision: "approved",
      currentToken: "staff-session",
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(writes("audit_events")).toHaveLength(0);
  expect(writes("notifications")).toHaveLength(0);
});
it("refuses a missing or expired initiating session before changing the request", async () => {
  for (const session of [[], [["ses_staff", "2000-01-01T00:00:00.000Z"]]] as unknown[][][]) {
    state.queries = [];
    state.rows = [[["moderator"]], session];
    await expect(
      new VerificationRepository().resolveRequest({
        id: "ver_request",
        reviewerId: "moderator",
        decision: "approved",
        currentToken: "staff-session",
      }),
    ).rejects.toMatchObject({ statusCode: 401, code: "UNAUTHORIZED" });
    expect(writes("verification_requests")).toHaveLength(0);
    expect(writes("audit_events")).toHaveLength(0);
    expect(writes("notifications")).toHaveLength(0);
  }
});
it("prevents self approval and retains pending-state compare-and-set", async () => {
  state.rows = [
    [["moderator"]],
    [["ses_staff", "2099-01-01T00:00:00.000Z"]],
    [request({ requesterId: "moderator" })],
  ];
  await expect(
    new VerificationRepository().resolveRequest({
      id: "ver_request",
      reviewerId: "moderator",
      decision: "approved",
      currentToken: "staff-session",
    }),
  ).rejects.toMatchObject({ code: "VERIFICATION_SELF_REVIEW" });
  expect(writes("developer_profiles")).toHaveLength(0);
  state.queries = [];
  state.rows = [[["moderator"]], [["ses_staff", "2099-01-01T00:00:00.000Z"]], []];
  expect(
    await new VerificationRepository().resolveRequest({
      id: "ver_request",
      reviewerId: "moderator",
      decision: "approved",
      currentToken: "staff-session",
    }),
  ).toBeNull();
  expect(writes("verification_requests")[0].params).toContain("pending");
  expect(writes("notifications")).toHaveLength(0);
});
it("uses private bounded history and searches only current owners/admins without N+1 reads", async () => {
  await verificationWorkspaceRepository.history("actor", {
    view: "history",
    page: 2,
    type: "developer",
  });
  let query = state.queries[0];
  expect(query.params).toEqual(["actor", "approved", "rejected", "developer", 21, 20]);
  expect(query.sql).toContain(
    'order by "verification_requests"."created_at" desc, "verification_requests"."id" desc',
  );
  expect(query.sql.split(" from ")[0]).not.toMatch(/requester_id|reviewer_id|password|email/u);
  state.queries = [];
  await verificationWorkspaceRepository.targets("actor", 2, "50%_team");
  query = state.queries[0];
  expect(query.params).toEqual(
    expect.arrayContaining(["actor", "admin", "%50\\%\\_team%", 21, 20]),
  );
  expect(query.params).not.toContain("owner");
  expect(state.queries).toHaveLength(1);
  expect(query.sql).toContain("exists");
});
