import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/repositories/publication-notice", async () => {
  const { organizationPublicationHistoryQueryState } = await import(
    "./helpers/organization-publication-history-query-harness"
  );
  return { publicationNotice: organizationPublicationHistoryQueryState.notice };
});
vi.mock("../packages/db/src/client", async () => {
  const { createOrganizationPublicationHistoryQueryDbMock } = await import(
    "./helpers/organization-publication-history-query-harness"
  );
  return createOrganizationPublicationHistoryQueryDbMock();
});

import { authorContentRepository as repo } from "../packages/db/src/repositories/author-content";
import {
  installOrganizationPublicationHistoryQueryHooks,
  organizationPublicationHistoryQueryOrg as org,
  organizationPublicationHistoryQueryState as state,
  organizationPublicationHistoryQueryTime as time,
} from "./helpers/organization-publication-history-query-harness";

installOrganizationPublicationHistoryQueryHooks();

it("lets a current editor inspect shared history without full text, audit details or moderator identities", async () => {
  state.rows = [
    [org("owner")],
    [["admin"]],
    [["post", "Title", "archived", time, true]],
    Array.from({ length: 21 }, (_, i) => [
      "editor",
      "Editor",
      `event-${i}`,
      "content.archived_by_organization",
      time,
      "published",
      "archived",
    ]),
  ];
  const result = await repo.history("post", "actor", undefined, "org");
  expect(result.organization).toEqual({ id: "org", name: "Team" });
  expect(result.events).toHaveLength(20);
  expect(JSON.parse(result.olderCursor ?? "")).toMatchObject({
    createdAt: time,
    context: createHash("sha256")
      .update(JSON.stringify([1, "organization-publication-history", "actor", "org", "post"]))
      .digest("hex"),
  });
  const scope = state.queries[2];
  expect(scope.params).toEqual(expect.arrayContaining(["post", "org"]));
  expect(scope.sql).not.toContain('"content"."author_id" =');
  expect(scope.sql).toContain('"content"."server_id" is null');
  expect(scope.sql).toContain('"content"."product_id" is null');
  const selected = state.queries[3].sql.split(" from ")[0];
  expect(selected).not.toMatch(/details,|email|ip_address|user_agent|notes/u);
  expect(selected).toContain("'content.published','content.archived'");
  expect(state.queries[3].params).toContain("content.restored_by_organization");
});
it.each([null, "developer", "member", "owner"])(
  "denies non-editor and legacy-owner memberships (%s) before shared history",
  async (role) => {
    state.rows = [[org("owner")], role ? [[role]] : []];
    await expect(repo.history("post", "actor", undefined, "org")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(state.queries).toHaveLength(2);
  },
);
it("rejects a personal/foreign cursor only after current team authority", async () => {
  state.rows = [[org()]];
  await expect(
    repo.history(
      "post",
      "actor",
      { id: "audit", createdAt: time, context: "a".repeat(64), direction: "older" },
      "org",
    ),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  expect(state.queries).toHaveLength(1);
});
