import { expect, it, vi } from "vitest";
import {
  createCommunityModerationInteractionHelpers,
  mockReactHooks,
  previous,
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
vi.mock("../../apps/web/src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock("../../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../../apps/web/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }),
  };
});

import { ContentModerationControls } from "../../apps/web/src/components/content-moderation-controls";
import { moderationCopy } from "../../apps/web/src/lib/community-moderation-copy";
import { getDictionary } from "../../apps/web/src/lib/i18n";

const { render, button, click, ready } = createCommunityModerationInteractionHelpers(
  harness,
  ContentModerationControls,
  confirmAction,
);

it("submits only observed publication fields, saves a confirmed revision and blocks a second decision", async () => {
  click(ready(), "Publish");
  await vi.waitFor(() => expect(harness.refresh).toHaveBeenCalledTimes(1));
  const copy = getDictionary("en").admin;
  const general = moderationCopy("en");
  expect(confirmAction).toHaveBeenCalledWith(
    expect.objectContaining({
      title: copy.publish,
      object: "post",
      consequences: copy.publishContentConfirm,
      confirmLabel: copy.publish,
      cancelLabel: general.back,
      closeLabel: general.back,
      danger: false,
    }),
  );
  const [url, init] = harness.fetch.mock.calls[0];
  expect(url).toBe("/api/admin/community/post");
  expect(JSON.parse(init.body)).toEqual({
    action: "publish",
    notes: "Reviewed reason",
    expectedUpdatedAt: previous,
  });
  expect(init).toMatchObject({ method: "POST", credentials: "same-origin", cache: "no-store" });
  expect(init.signal).toBeInstanceOf(AbortSignal);
  const nodes = render();
  expect(nodes.some((node) => node.props.role === "status")).toBe(true);
  expect(button(nodes, "Publish").props.disabled).toBe(true);
  click(nodes, "Archive");
  expect(harness.fetch).toHaveBeenCalledTimes(1);
});
