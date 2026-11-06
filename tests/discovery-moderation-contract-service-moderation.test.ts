import { expect, it, vi } from "vitest";

vi.mock("@nexus/db", async () => {
  const { discoveryModerationContractMocks } = await import(
    "./helpers/discovery-moderation-contract-service-harness"
  );
  return {
    publicDirectoryRepository: {
      pageServers: discoveryModerationContractMocks.servers,
      pageCreators: discoveryModerationContractMocks.creators,
      pageOrganizations: discoveryModerationContractMocks.organizations,
    },
    communityModerationWorkspaceRepository: {
      page: discoveryModerationContractMocks.page,
      detail: discoveryModerationContractMocks.detail,
    },
  };
});
vi.mock("../apps/web/src/lib/services/product-service", () => ({ productService: {} }));
vi.mock("../apps/web/src/lib/services/content-service", async () => {
  const { discoveryModerationContractMocks } = await import(
    "./helpers/discovery-moderation-contract-service-harness"
  );
  return { contentService: { moderateContent: discoveryModerationContractMocks.command } };
});
vi.mock("../apps/web/src/lib/services/mta-master-directory-service", () => ({
  mtaMasterDirectoryService: {},
  indexMtaObservations: vi.fn(),
  matchesMtaEndpoint: vi.fn(),
}));
vi.mock("@nexus/security", async () => {
  const { discoveryModerationContractMocks } = await import(
    "./helpers/discovery-moderation-contract-service-harness"
  );
  return { can: discoveryModerationContractMocks.allowed };
});

import { communityModerationService as moderation } from "../apps/web/src/lib/services/community-moderation-service";
import {
  parseModerationQuery,
  parseModerationDetailQuery,
  moderationCommandSchema,
  moderationPageSchema,
  moderationDetailSchema,
  moderationHref,
  confirmsModerationCommand,
} from "../apps/web/src/lib/community-moderation-contract";
import { moderationCopy } from "../apps/web/src/lib/community-moderation-copy";
import {
  discoveryModerationContractActor as actor,
  discoveryModerationContractDate as date,
  discoveryModerationContractMocks as mocks,
  discoveryModerationContractRow as row,
  discoveryModerationContractTime as time,
  setupDiscoveryModerationContract,
} from "./helpers/discovery-moderation-contract-service-harness";

setupDiscoveryModerationContract();

it.each([
  "?status=pending",
  "?type=resource",
  "?q=%00",
  "?status=draft&status=all",
  "?author=..",
  "?actorId=other",
  "?cursor=bad",
  "?page=2",
])("rejects malformed/private moderation filters %s", (params) =>
  expect(parseModerationQuery(new URLSearchParams(params))).toBeNull(),
);

it("keeps exact-author/status/type/search filters in queue links and separates detail continuation", () => {
  const filters = parseModerationQuery(
    new URLSearchParams("q=+Lua+&status=all&author=writer&type=post"),
  );
  if (!filters) throw Error("Expected filters");
  expect(filters).toMatchObject({
    query: "Lua",
    status: undefined,
    author: "writer",
    type: "post",
  });
  expect(moderationHref(filters, "a&b")).toContain("cursor=a%26b");
  expect(parseModerationDetailQuery(new URLSearchParams("q=private"))).toBeNull();
});

it("requires current-session staff privilege before any workspace read or command", async () => {
  mocks.allowed.mockReturnValue(false);
  await expect(moderation.page(actor, { query: "" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(moderation.detail(actor, "item")).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(mocks.page).not.toHaveBeenCalled();
  expect(mocks.detail).not.toHaveBeenCalled();
});

it("whitelists queue/detail/history DTOs, validates legacy states and retains exact cursor time", async () => {
  const page = await moderation.page(actor, { query: "" }),
    detail = await moderation.detail(actor, "item");
  expect(moderationPageSchema.safeParse(page).success).toBe(true);
  expect(moderationDetailSchema.safeParse(detail).success).toBe(true);
  expect(detail.history[0].from).toBeNull();
  expect(detail.item.author.avatar).toBeNull();
  expect(JSON.stringify({ page, detail })).not.toContain("PRIVATE");
  expect(
    parseModerationQuery(new URLSearchParams({ cursor: page.nextCursor ?? "" }))?.cursor?.createdAt,
  ).toBe(time);
});

it("routes decisions through existing content moderation with observed revision and locked publication scope", async () => {
  const command = {
    action: "publish" as const,
    notes: "Reviewed",
    expectedUpdatedAt: date.toISOString(),
  };
  const saved = await moderation.command(actor, "item", command, "staff-session");
  expect(mocks.command).toHaveBeenCalledWith(
    "item",
    "publish",
    actor,
    "staff-session",
    "Reviewed",
    date,
    true,
  );
  expect(saved).toEqual({
    id: "item",
    action: "publish",
    status: "published",
    updatedAt: "2026-10-11T00:00:01.000Z",
  });
  expect(confirmsModerationCommand(saved, "item", "publish", date.toISOString())).toEqual(saved);
});

it("accepts complete Unicode previews and retained notes with PostgreSQL character limits", async () => {
  const detail = await moderation.detail(actor, "item");
  detail.item.excerpt = "😀".repeat(350);
  detail.item.body = "😀".repeat(100000);
  detail.item.tags = ["😀".repeat(30)];
  detail.history[0].notes = "😀".repeat(2000);
  expect(moderationDetailSchema.safeParse(detail).success).toBe(true);
  for (const invalid of [
    { ...detail, item: { ...detail.item, excerpt: "😀".repeat(351) } },
    { ...detail, item: { ...detail.item, body: "😀".repeat(100001) } },
    { ...detail, item: { ...detail.item, tags: ["😀".repeat(31)] } },
    { ...detail, history: [{ ...detail.history[0], notes: "😀".repeat(2001) }] },
  ])
    expect(moderationDetailSchema.safeParse(invalid).success).toBe(false);
});

it("blocks publishing an incomplete legacy preview without issuing a write", async () => {
  mocks.detail.mockResolvedValueOnce({ item: { ...row, truncated: true } });
  await expect(
    moderation.command(
      actor,
      "item",
      {
        action: "publish",
        notes: "Reviewed",
        expectedUpdatedAt: date.toISOString(),
      },
      "staff-session",
    ),
  ).rejects.toMatchObject({ code: "CONTENT_REVIEW_TOO_LARGE" });
  expect(mocks.command).not.toHaveBeenCalled();
});

it.each([
  { actorId: "foreign" },
  { action: "delete" },
  { notes: "x" },
  { expectedUpdatedAt: "bad" },
  { ownerId: "foreign" },
])("rejects unsafe command overrides %j", (extra) =>
  expect(
    moderationCommandSchema.safeParse({
      action: "archive",
      notes: "Reviewed",
      expectedUpdatedAt: date.toISOString(),
      ...extra,
    }).success,
  ).toBe(false),
);

it.each([
  {},
  null,
  { id: "other", action: "publish", status: "published", updatedAt: "2026-10-11T00:00:01.000Z" },
  { id: "item", action: "publish", status: "draft", updatedAt: "2026-10-11T00:00:01.000Z" },
  { id: "item", action: "publish", status: "published", updatedAt: date.toISOString() },
  { id: "item", action: "publish", status: "published", updatedAt: "2026-10-10T00:00:00.000Z" },
])("rejects wrong/stale/uncertain decision acknowledgement %j", (value) =>
  expect(confirmsModerationCommand(value, "item", "publish", date.toISOString())).toBeNull(),
);

it("keeps moderation RU/EN copy complete", () => {
  expect(Object.keys(moderationCopy("ru"))).toEqual(Object.keys(moderationCopy("en")));
});
