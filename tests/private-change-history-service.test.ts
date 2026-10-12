import { AppError } from "@nexus/domain";
import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => vi.fn());
vi.mock("@nexus/db", () => ({ profileChangeHistoryRepository: { page: mock } }));

import { parseProfileChangeHistoryQuery } from "../apps/web/src/lib/profile-change-history-contract";
import { profileChangeHistoryService as service } from "../apps/web/src/lib/services/profile-change-history-service";

const stamp = "2026-10-12T00:00:00.123456Z",
  filters = { period: "30" as const, group: "privacy" as const, query: "" };
const record = {
  id: "audit",
  action: "user.privacy_updated",
  createdAt: stamp,
  fields: ["showActivity"],
  experienceVerificationInvalidated: false,
  actor: "you",
};
const page = {
  username: "owner",
  period: "30",
  group: "privacy",
  until: stamp,
  items: [record],
  hasMore: false,
  nextCursor: null,
};
beforeEach(() => {
  vi.resetAllMocks();
  mock.mockResolvedValue(page);
});
it("projects profile history without forwarding unknown audit/account fields", async () => {
  mock.mockResolvedValue({
    ...page,
    raw: "PRIVATE",
    items: [
      {
        ...record,
        email: "PRIVATE",
        details: { body: "PRIVATE" },
        targetId: "PRIVATE",
        ipAddress: "PRIVATE",
      },
    ],
  });
  expect(await service.page("owner", filters)).toEqual(page);
  expect(mock).toHaveBeenCalledExactlyOnceWith("owner", filters);
});
it("encodes a strict exact-time cursor for the next page", async () => {
  const cursor = { version: 1, context: "a".repeat(64), until: stamp, id: "audit" };
  mock.mockResolvedValue({ ...page, hasMore: true, nextCursor: cursor });
  const result = await service.page("owner", filters);
  if (!result.nextCursor) throw Error("Missing next cursor");
  expect(
    parseProfileChangeHistoryQuery(
      new URLSearchParams({ period: "30", group: "privacy", cursor: result.nextCursor }),
    ),
  ).toMatchObject({ cursor });
});
it.each([
  { group: "profile" },
  { period: "7" },
  { until: "invalid" },
  { hasMore: true },
  { items: [{ ...record, fields: ["password"] }] },
  { items: Array(21).fill(record) },
])(
  "rejects malformed storage output rather than returning misleading success %j",
  async (change) => {
    mock.mockResolvedValue({ ...page, ...change });
    await expect(service.page("owner", filters)).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
  },
);
it("preserves explicit denied and expired storage boundaries", async () => {
  mock.mockRejectedValue(new AppError("Private detail", 404, "CHANGE_HISTORY_EXPIRED"));
  await expect(service.page("owner", filters)).rejects.toMatchObject({
    code: "CHANGE_HISTORY_EXPIRED",
  });
});
