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

it("rechecks the noncommercial publication scope under the authoritative content lock", async () => {
  state.rows = [[row({ type: "resource" })], [["moderator"]], liveSession];
  await expect(
    contentRepository.moderateStatusWithAudit(
      "item",
      "published",
      "draft",
      audit,
      token,
      new Date(time),
      true,
    ),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(state.queries.some((query) => /^(update|insert)/u.test(query.sql))).toBe(false);
  expect(state.notice).not.toHaveBeenCalled();
});
it("rejects incomplete legacy publishing under lock, while permitting complete Unicode text at the preview boundary", async () => {
  state.rows = [[row({ body: "x".repeat(100001) })], [["moderator"]], liveSession];
  await expect(
    contentRepository.moderateStatusWithAudit(
      "item",
      "published",
      "draft",
      audit,
      token,
      new Date(time),
      true,
    ),
  ).rejects.toMatchObject({ code: "CONTENT_REVIEW_TOO_LARGE" });
  expect(state.notice).not.toHaveBeenCalled();
  state.rows = [
    [row({ body: "😀".repeat(60000) })],
    [["moderator"]],
    liveSession,
    [row({ status: "published" })],
  ];
  expect(
    await contentRepository.moderateStatusWithAudit(
      "item",
      "published",
      "draft",
      audit,
      token,
      new Date(time),
      true,
    ),
  ).toMatchObject({ status: "published" });
});
