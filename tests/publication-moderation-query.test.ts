import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/repositories/publication-notice", async () => {
  const { publicationModerationQueryState } = await import(
    "./helpers/publication-moderation-query-harness"
  );
  return { publicationNotice: publicationModerationQueryState.notice };
});

vi.mock("../packages/db/src/client", async () => {
  const { createPublicationModerationQueryDbMock } = await import(
    "./helpers/publication-moderation-query-harness"
  );
  return createPublicationModerationQueryDbMock();
});

import { contentRepository } from "../packages/db/src/repositories/content";
import {
  installPublicationModerationQueryHooks,
  publicationModerationQueryAudit as audit,
  publicationModerationQueryLiveSession as liveSession,
  publicationModerationQueryRow as row,
  publicationModerationQueryState as state,
  publicationModerationQueryTime as time,
  publicationModerationQueryToken as token,
} from "./helpers/publication-moderation-query-harness";

installPublicationModerationQueryHooks();

it("locks content then current moderator authority, versions the update and stores the notice after audit", async () => {
  state.rows = [
    [row()],
    [["moderator"]],
    liveSession,
    [row({ status: "published", updatedAt: "2026-10-11T00:00:00.001Z" })],
  ];
  expect(
    await contentRepository.moderateStatusWithAudit(
      "item",
      "published",
      "draft",
      audit,
      token,
      new Date(time),
    ),
  ).toMatchObject({ status: "published" });
  expect(state.queries[0].sql).toContain("for update");
  expect(state.queries[1].sql).toContain("for share");
  expect(state.queries[2].sql).toContain('"sessions"');
  expect(state.queries[2].sql).toContain("for update");
  expect(state.queries[3].sql).toContain("interval '1 millisecond'");
  expect(state.queries[4].sql).toContain('insert into "audit_events"');
  expect(state.notice).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ id: "item" }),
    "mod",
    "published",
    "audit",
  );
});
it.each(["user", "developer", "server_owner", null])(
  "denies revoked moderator role %s before writes and notices",
  async (role) => {
    state.rows = [[row()], role ? [[role]] : []];
    await expect(
      contentRepository.moderateStatusWithAudit(
        "item",
        "published",
        "draft",
        audit,
        token,
        new Date(time),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.queries.some((q) => /^(update|insert)/u.test(q.sql))).toBe(false);
    expect(state.notice).not.toHaveBeenCalled();
  },
);
it.each([{ status: "archived" }, { updatedAt: "2026-10-11T00:00:00.001Z" }])(
  "rejects status changes and draft-to-draft edits without publishing new text %j",
  async (extra) => {
    state.rows = [[row(extra)], [["admin"]], liveSession];
    expect(
      await contentRepository.moderateStatusWithAudit(
        "item",
        "published",
        "draft",
        audit,
        token,
        new Date(time),
      ),
    ).toBeNull();
    expect(state.queries.some((q) => q.sql.startsWith("update"))).toBe(false);
    expect(state.notice).not.toHaveBeenCalled();
  },
);
