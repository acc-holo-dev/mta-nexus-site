import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createPrivateChangeHistoryQueryDbMock } = await import(
    "./helpers/private-change-history-query-harness"
  );
  return createPrivateChangeHistoryQueryDbMock();
});

import { profileChangeHistoryRepository as profile } from "../packages/db/src/repositories/profile-change-history";
import {
  installPrivateChangeHistoryQueryHooks,
  privateChangeHistoryQueryBase as base,
  privateChangeHistoryQueryFingerprint as fingerprint,
  privateChangeHistoryQueryStamp as stamp,
  privateChangeHistoryQueryState as state,
} from "./helpers/private-change-history-query-harness";

installPrivateChangeHistoryQueryHooks();

it("scopes profile history to the actual target account with bounded field-name projections", async () => {
  state.rows = [[["owner"]], [[stamp]], []];
  const result = await profile.page("owner", base);
  expect(result).toMatchObject({
    username: "owner",
    until: stamp,
    items: [],
    hasMore: false,
    nextCursor: null,
  });
  expect(state.config).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  expect(state.queries).toHaveLength(3);
  const page = state.queries[2];
  expect(page.params).toEqual(
    expect.arrayContaining([
      "user",
      "owner",
      "user.profile_updated",
      "developer.profile_updated",
      "user.privacy_updated",
      stamp,
      21,
    ]),
  );
  expect(page.sql).toContain('order by "audit_events"."created_at" desc, "audit_events"."id" desc');
  expect(page.sql).toContain("with ordinality");
  expect(page.sql).toContain("field.ordinal between 4 and 6");
  expect(page.sql).toContain("'true'::jsonb");
  expect(page.sql.split(' from "audit_events"')[0]).not.toMatch(
    /ip_address|user_agent|password|email|"details"[, ]/u,
  );
});
it.each([
  ["profile", "user.profile_updated"],
  ["professional", "developer.profile_updated"],
  ["privacy", "user.privacy_updated"],
] as const)(
  "filters %s operations before applying the precise seven-day window",
  async (group, action) => {
    state.rows = [[["owner"]], [[stamp]], []];
    await profile.page("owner", { ...base, period: "7", group });
    const query = state.queries[2];
    expect(query.params).toContain(action);
    expect(query.params).toContain(7);
    expect(query.sql).toContain("interval '1 day'");
    expect(query.sql).toContain("::timestamptz");
    for (const other of [
      "user.profile_updated",
      "developer.profile_updated",
      "user.privacy_updated",
    ].filter((value) => value !== action))
      expect(query.params).not.toContain(other);
  },
);
it("returns twenty rows and a bound cursor even when timestamps tie at microsecond precision", async () => {
  state.rows = [
    [["owner"]],
    [[stamp]],
    Array.from({ length: 21 }, (_, i) => [
      `a${i}`,
      "user.profile_updated",
      stamp,
      ["bio"],
      false,
      "you",
    ]),
  ];
  const result = await profile.page("owner", base);
  expect(result.items).toHaveLength(20);
  expect(result.nextCursor).toEqual({
    version: 1,
    context: fingerprint("profile-change-history", "owner", "owner", "all", "all"),
    until: stamp,
    id: "a19",
  });
});
it("resolves a profile anchor within the same actor, filters and retained cutoff", async () => {
  const cursor = {
    version: 1 as const,
    context: fingerprint("profile-change-history", "owner", "owner", "30", "privacy"),
    until: stamp,
    id: "anchor",
  };
  state.rows = [[["owner"]], [["2026-10-12T00:01:00.000000Z"]], [["anchor", stamp]], []];
  await profile.page("owner", { ...base, period: "30", group: "privacy", cursor, until: stamp });
  expect(state.queries[2].params).toEqual(
    expect.arrayContaining(["owner", "user.privacy_updated", stamp, 30, "anchor", 1]),
  );
  expect(state.queries[3].params).toEqual(expect.arrayContaining([stamp, "anchor", 21]));
  expect(state.queries[3].sql).toContain('("audit_events"."created_at","audit_events"."id")<');
});
it("rejects missing anchors without falling back to the latest page", async () => {
  state.rows = [[["owner"]], [[stamp]], []];
  await expect(
    profile.page("owner", {
      ...base,
      cursor: {
        version: 1,
        context: fingerprint("profile-change-history", "owner", "owner", "all", "all"),
        until: stamp,
        id: "gone",
      },
    }),
  ).rejects.toMatchObject({ code: "CHANGE_HISTORY_EXPIRED" });
  expect(state.queries).toHaveLength(3);
});
it.each(["actor", "group", "period"])(
  "rejects replayed profile cursor after changing %s before database access",
  async (change) => {
    const cursor = {
      version: 1 as const,
      context: fingerprint("profile-change-history", "owner", "owner", "all", "all"),
      until: stamp,
      id: "anchor",
    };
    await expect(
      profile.page(change === "actor" ? "foreign" : "owner", {
        ...base,
        group: change === "group" ? "privacy" : "all",
        period: change === "period" ? "7" : "all",
        cursor,
      }),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    expect(state.queries).toHaveLength(0);
  },
);
it.each(["bad", "2026-02-30T00:00:00.123456Z", "0000-01-01T00:00:00.000000Z", ""])(
  "rejects invalid explicit cutoff %s at storage",
  async (until) => {
    await expect(profile.page("owner", { ...base, until })).rejects.toMatchObject({
      code: "INVALID_CURSOR",
    });
    expect(state.queries).toHaveLength(0);
  },
);
it("rejects a missing account and a future cutoff rather than producing an empty success", async () => {
  await expect(profile.page("missing", base)).rejects.toMatchObject({ code: "NOT_FOUND" });
  state.rows = [[["owner"]], [[stamp]]];
  await expect(
    profile.page("owner", { ...base, until: "2026-10-13T00:00:00.000000Z" }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
});
it("fails closed when the database clock is absent or malformed", async () => {
  state.rows = [[["owner"]], [["bad"]]];
  await expect(profile.page("owner", base)).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
  expect(state.queries).toHaveLength(2);
});
