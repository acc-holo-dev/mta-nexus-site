import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/repositories/publication-notice", () => ({
  publicationNotice: vi.fn(),
}));
vi.mock("../packages/db/src/client", async () => {
  const { createOrganizationContentQueryDbMock } = await import(
    "./helpers/organization-content-query-harness"
  );
  return createOrganizationContentQueryDbMock();
});

import { organizationContentRepository as team } from "../packages/db/src/repositories/organization-content";
import {
  installOrganizationContentQueryHooks,
  organizationContentQueryOrg as org,
  organizationContentQueryPublication as publication,
  organizationContentQueryState as state,
  organizationContentQueryWrites as writes,
} from "./helpers/organization-content-query-harness";

installOrganizationContentQueryHooks();

it("authorizes the owner and scopes a bounded searchable list of all team authors in one read snapshot", async () => {
  state.rows = [[org()], []];
  const result = await team.page("org", "actor", {
    page: 2,
    query: "%_",
    status: "draft",
    type: "news",
  });
  expect(result.organization).toEqual({ id: "org", name: "Team", slug: "team" });
  expect(state.transactions).toEqual([
    { isolationLevel: "repeatable read", accessMode: "read only" },
  ]);
  const query = state.queries[1];
  expect(query.params).toEqual(["org", "draft", "news", "%\\%\\_%", "%\\%\\_%", 21, 20]);
  expect(query.sql).toContain('order by "content"."updated_at" desc, "content"."id" desc');
  expect(query.sql.split(" from ")[0]).not.toMatch(/body|email|password/u);
  expect(query.sql).not.toContain('"content"."author_id" =');
});
it.each(["member", "developer", "owner", null])(
  "denies private drafts to non-editors or stale ownership %s before content queries",
  async (role) => {
    state.rows = [[org("actual-owner")], role ? [[role]] : []];
    await expect(team.page("org", "actor")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.queries).toHaveLength(2);
    expect(writes()).toHaveLength(0);
  },
);
it("lets a current team administrator read another author's draft but never a foreign organization record", async () => {
  state.rows = [[org("actual-owner")], [["admin"]], [publication({ status: "draft" })]];
  expect(await team.get("org", "actor", "content")).toMatchObject({
    content: { authorId: "original", status: "draft" },
  });
  expect(state.queries[2].params).toEqual(["content", "org", 1]);
  state.rows = [[org()], []];
  await expect(team.get("org", "actor", "foreign")).rejects.toMatchObject({ code: "NOT_FOUND" });
});
