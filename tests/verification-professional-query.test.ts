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

import { db } from "../packages/db/src/client";
import {
  developerExperienceRevision,
  developerProfileRepository,
} from "../packages/db/src/repositories/developer-profile";
import { verificationTargetAuthority } from "../packages/db/src/repositories/verification-authority";
import {
  installVerificationProfessionalQueryHooks,
  verificationProfessionalQueryLater as later,
  verificationProfessionalQueryProfileInput as profileInput,
  verificationProfessionalQueryState as state,
  verificationProfessionalQueryTime as time,
  verificationProfessionalQueryWrites as writes,
} from "./helpers/verification-professional-query-harness";

installVerificationProfessionalQueryHooks();

const authority = (requesterId: string, type: string, targetId: string, applying: boolean) =>
  db.transaction((tx) => verificationTargetAuthority(tx, requesterId, type, targetId, applying));

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
    [["ses_developer", "2099-01-01T00:00:00.000Z"]],
    [[later]],
    [["ses_developer", "2099-01-01T00:00:00.000Z"]],
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
      [["ses_developer", "2099-01-01T00:00:00.000Z"]],
      [[later]],
      [["ses_developer", "2099-01-01T00:00:00.000Z"]],
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
  state.rows = [
    [["developer", time]],
    [],
    [["ses_developer", "2099-01-01T00:00:00.000Z"]],
    [[later]],
  ];
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
