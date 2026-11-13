import { expect, it, vi } from "vitest";
import {
  createCommunityModerationInteractionHelpers,
  mockReactHooks,
  previous,
  response,
} from "../helpers/community-moderation-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  refresh: vi.fn(),
  fetch: vi.fn(),
  reload: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../site/src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock("../../site/src/components/locale-context", async () => {
  const { getDictionary } = await import("../../site/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }),
  };
});

import { ContentModerationControls } from "../../site/src/components/content-moderation-controls";

const { click, ready } = createCommunityModerationInteractionHelpers(
  harness,
  ContentModerationControls,
  confirmAction,
);

it("preserves the existing admin action contract and requires its exact acknowledgement", async () => {
  harness.fetch.mockResolvedValueOnce(
    response({ success: true, targetId: "post", action: "publish" }),
  );
  click(ready(false), "Publish");
  await vi.waitFor(() => expect(harness.refresh).toHaveBeenCalledTimes(1));
  const [url, init] = harness.fetch.mock.calls[0];
  expect(url).toBe("/api/admin/actions");
  expect(JSON.parse(init.body)).toEqual({
    targetType: "content",
    targetId: "post",
    action: "publish",
    notes: "Reviewed reason",
    expectedUpdatedAt: previous,
  });
});
