import { expect, it, vi } from "vitest";
import {
  createResourceQaPanelConfirmInteractionHelpers,
  followingDetail,
  mockReactHooks,
  productId,
  response,
  threadId,
} from "./helpers/resource-qa-panel-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../site/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ usePathname: () => "/market/example" }));

import { ResourceQaPanel } from "../site/src/components/resource-qa-panel";
import { resourceQaCopy } from "../site/src/lib/resource-qa-i18n";

const { render, control } = createResourceQaPanelConfirmInteractionHelpers(
  harness,
  ResourceQaPanel,
  confirmAction,
);

it("confirms unfollow before posting the follow write", async () => {
  const copy = resourceQaCopy("en");
  harness.fetch
    .mockResolvedValueOnce(response({ success: true, following: false }))
    .mockResolvedValueOnce(
      response({ ...followingDetail, thread: { ...followingDetail.thread, following: false } }),
    );

  await (control(render(followingDetail), copy.unfollow).props.onClick as () => Promise<void>)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalled());

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.unfollowConfirmTitle,
    object: followingDetail.thread.body,
    consequences: copy.unfollowConfirm,
    confirmLabel: copy.unfollow,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: true,
  });
  expect(harness.fetch.mock.calls[0]?.[0]).toBe(
    `/api/products/${productId}/qa/${encodeURIComponent(threadId)}/follow`,
  );
  expect(harness.fetch.mock.calls[0]?.[1]).toMatchObject({
    method: "POST",
    body: JSON.stringify({
      action: "unfollow",
      expectedRevision: followingDetail.thread.followRevision,
    }),
  });
});

it("skips unfollow when confirmation is cancelled", async () => {
  const copy = resourceQaCopy("en");
  confirmAction.mockResolvedValueOnce(false);
  await (control(render(followingDetail), copy.unfollow).props.onClick as () => Promise<void>)();
  expect(harness.fetch).not.toHaveBeenCalled();
});
