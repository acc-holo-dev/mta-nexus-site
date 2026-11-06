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

import { discoveryService as discovery } from "../apps/web/src/lib/services/discovery-service";
import {
  parseDiscoveryStreamQuery,
  discoveryStreamHref,
} from "../apps/web/src/lib/discovery-stream-contract";
import { discoveryStreamCopy } from "../apps/web/src/lib/discovery-stream-copy";
import {
  discoveryModerationContractMocks as mocks,
  discoveryModerationContractTime as time,
  setupDiscoveryModerationContract,
} from "./helpers/discovery-moderation-contract-service-harness";

setupDiscoveryModerationContract();

it.each([
  "?type=resources",
  "?type=content",
  "?page=2",
  "?sort=name",
  "?type=creators&language=ru",
  "?q=%0A",
  "?q=a&q=b",
  "?cursor=bad",
  "?ownerId=private",
])("rejects incompatible/injected stream filters %s", (params) =>
  expect(parseDiscoveryStreamQuery(new URLSearchParams(params))).toBeNull(),
);

it("keeps filters in stream continuations and rejects reuse in another entity family before DB", async () => {
  const input = parseDiscoveryStreamQuery(
    new URLSearchParams("type=servers&q=Lua&language=ru&verified=1"),
  );
  if (!input) throw Error("Expected stream filters");
  const page = await discovery.stream(input);
  expect(mocks.servers).toHaveBeenCalledWith(
    expect.objectContaining({ keyset: true, query: "Lua", language: "ru" }),
  );
  const next = parseDiscoveryStreamQuery(
    new URLSearchParams(
      new URL(discoveryStreamHref(input, page.nextCursor), "https://nexus.test").search,
    ),
  );
  expect(next?.cursor?.createdAt).toBe(time);
  if (!next) throw Error("Expected continuation");
  vi.clearAllMocks();
  await expect(discovery.stream({ ...next, type: "organizations" })).rejects.toMatchObject({
    code: "INVALID_CURSOR",
  });
  expect(mocks.organizations).not.toHaveBeenCalled();
  await expect(discovery.stream({ ...next, verified: false })).rejects.toMatchObject({
    code: "INVALID_CURSOR",
  });
  expect(mocks.servers).not.toHaveBeenCalled();
});

it.each(["creators", "organizations"] as const)(
  "reuses existing %s directory selection and public-media sanitation",
  async (type) => {
    const mock = mocks[type];
    mock.mockResolvedValue({
      items: [{ id: "public", avatarUrl: "javascript:bad", logoUrl: "javascript:bad" }],
      page: 1,
      hasMore: false,
      nextCursor: null,
      previousCursor: null,
    });
    const input = parseDiscoveryStreamQuery(new URLSearchParams({ type }));
    if (!input) throw Error("Expected filters");
    const page = await discovery.stream(input);
    expect(page.nextCursor).toBeNull();
    expect(page.items[0]).toMatchObject(
      type === "creators" ? { avatarUrl: null } : { logoUrl: null },
    );
  },
);

it("keeps discovery stream RU/EN copy complete", () => {
  expect(Object.keys(discoveryStreamCopy("ru"))).toEqual(Object.keys(discoveryStreamCopy("en")));
});
