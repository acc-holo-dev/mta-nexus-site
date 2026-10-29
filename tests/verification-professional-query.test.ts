import { getTableColumns } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  failAudit: false,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.failAudit && sql.startsWith('insert into "audit_events"'))
      throw new Error("audit failure");
    return {
      rows:
        sql.startsWith("select") || sql.includes(" returning ") ? (state.rows.shift() ?? []) : [],
    };
  });
  const proxy = new Proxy(database, {
    get(target, key) {
      if (key === "transaction")
        return (callback: (tx: typeof database) => unknown) => callback(proxy);
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { db: proxy };
});
vi.mock("../packages/db/src/repositories/web-push-admission-recovery", () => ({
  enqueueWebPushWithRecoveryWithin: async () => ({ queued: 0, reason: "no_subscriptions" }),
}));

import { db } from "../packages/db/src/client";
import {
  developerExperienceRevision,
  developerProfileRepository,
} from "../packages/db/src/repositories/developer-profile";
import { VerificationRepository } from "../packages/db/src/repositories/verification";
import { verificationTargetAuthority } from "../packages/db/src/repositories/verification-authority";
import { verificationWorkspaceRepository } from "../packages/db/src/repositories/verification-workspace";
import { verificationRequests } from "../packages/db/src/schema";

const authority = (requesterId: string, type: string, targetId: string, applying: boolean) =>
  db.transaction((tx) => verificationTargetAuthority(tx, requesterId, type, targetId, applying));
const time = "2026-10-10T00:00:00.000Z",
  later = "2026-10-10T00:00:01.000Z";
const row = (table: PgTable, values: Record<string, unknown>) =>
  Object.keys(getTableColumns(table)).map((key) => values[key] ?? null);
const request = (extra = {}) =>
  row(verificationRequests, {
    id: "ver_request",
    requesterId: "developer",
    targetType: "developer",
    targetId: "developer",
    status: "approved",
    createdAt: time,
    resolvedAt: later,
    ...extra,
  });
const profileInput = {
  actorId: "developer",
  expectedUpdatedAt: new Date(time),
  specialties: ["Lua"],
  githubUrl: "https://github.com/example",
  discordTag: "new-discord",
  profileId: "profile",
  auditId: "audit",
};
const writes = (table: string) =>
  state.queries.filter(
    (query) =>
      query.sql.startsWith(`insert into "${table}"`) || query.sql.startsWith(`update "${table}"`),
  );
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.failAudit = false;
});
it("reads only public experience/contact fields for current developer roles", async () => {
  await developerProfileRepository.publicProfile("developer");
  const query = state.queries[0];
  expect(query.params).toEqual(["developer", "developer", "admin", 1]);
  expect(query.sql.split(" from ")[0]).not.toMatch(
    /email|reputation_score|completed_deals|password/u,
  );
});
it("preserves experience for Discord-only edits, bumps shared CAS and never overwrites commerce counters", async () => {
  state.rows = [
    [["developer", time]],
    [[["Lua"], "https://github.com/example", "old", true]],
    [[later]],
  ];
  const result = await developerProfileRepository.update(profileInput);
  expect(result.verifiedDeveloper).toBe(true);
  expect(result.updatedAt.toISOString()).toBe(later);
  const upsert = writes("developer_profiles")[0];
  expect(upsert.sql).toContain("on conflict");
  expect(upsert.sql.split("do update set")[1]).not.toMatch(
    /reputation_score|completed_deals_count/u,
  );
  expect(state.queries[0].sql).toContain("for update");
  expect(state.queries[1].sql).toContain("for update");
  expect(writes("users")[0].sql).toContain("interval '1 millisecond'");
  expect(writes("audit_events")[0].params).toContain(
    JSON.stringify({
      fields: ["specialties", "githubUrl", "discordTag"],
      experienceVerificationInvalidated: false,
    }),
  );
});
it.each([{ specialties: ["TypeScript"] }, { githubUrl: "https://github.com/changed" }])(
  "invalidates verified experience for material professional changes %j",
  async (extra) => {
    state.rows = [
      [["developer", time]],
      [[["Lua"], "https://github.com/example", "old", true]],
      [[later]],
    ];
    expect(
      (await developerProfileRepository.update({ ...profileInput, ...extra })).verifiedDeveloper,
    ).toBe(false);
    expect(writes("audit_events")[0].params.join(" ")).toContain(
      '"experienceVerificationInvalidated":true',
    );
  },
);
it.each([
  { role: "user", updated: time, code: "FORBIDDEN" },
  { role: "developer", updated: later, code: "CONFLICT" },
])(
  "rejects live role/version changes before professional writes %j",
  async ({ role, updated, code }) => {
    state.rows = [[[role, updated]]];
    await expect(developerProfileRepository.update(profileInput)).rejects.toMatchObject({ code });
    expect(writes("developer_profiles")).toHaveLength(0);
    expect(writes("audit_events")).toHaveLength(0);
  },
);
it("propagates audit failures instead of confirming an unaudited edit", async () => {
  state.rows = [[["developer", time]], [], [[later]]];
  state.failAudit = true;
  await expect(developerProfileRepository.update(profileInput)).rejects.toMatchObject({
    cause: expect.objectContaining({ message: "audit failure" }),
  });
});
it("keeps identity and expertise separate and locks current profile before producing a revision", async () => {
  state.rows = [[["developer", true]], [[["Lua"], "https://github.com/example", false]]];
  expect(await authority("developer", "developer", "developer", true)).toBe(
    developerExperienceRevision({ specialties: ["Lua"], githubUrl: "https://github.com/example" }),
  );
  expect(state.queries.every((query) => query.sql.includes("for share"))).toBe(true);
});
it.each(["user", "owner", "editor"])(
  "does not treat a stale organization membership %s as ownership",
  async (role) => {
    state.rows = [[["actual-owner", false]], [[role]]];
    await expect(authority("former-owner", "organization", "org", true)).rejects.toMatchObject({
      statusCode: 403,
      code: "VERIFICATION_AUTHORITY_CHANGED",
    });
  },
);
it("checks current organization administration again under an approval lock", async () => {
  state.rows = [[["actual-owner", false]], [["admin"]]];
  await authority("admin-member", "organization", "org", false);
  expect(state.queries[0].sql).toContain("for update");
  expect(state.queries[1].sql).toContain("for share");
});
it("blocks forged identities, missing specialties and already verified professional profiles", async () => {
  await expect(authority("other", "user", "developer", true)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(state.queries).toHaveLength(0);
  state.rows = [[["developer", false]], []];
  await expect(authority("developer", "developer", "developer", true)).rejects.toMatchObject({
    code: "VERIFICATION_PROFILE_REQUIRED",
  });
  state.rows = [[["developer", false]], [[["Lua"], null, true]]];
  await expect(authority("developer", "developer", "developer", true)).rejects.toMatchObject({
    code: "VERIFICATION_ALREADY_VERIFIED",
  });
});
it("stores a private profile revision with the serialized developer application", async () => {
  state.rows = [
    [],
    [["developer", true]],
    [[["Lua"], "https://github.com/example", false]],
    [],
    [request({ status: "pending" })],
  ];
  await new VerificationRepository().createRequest({
    requesterId: "developer",
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
