import { expect, it, vi } from "vitest";
import {
  createResourceQaPanelConfirmInteractionHelpers,
  mockReactHooks,
  openDetail,
  productId,
  resolvedDetail,
  response,
  threadId,
} from "../helpers/resource-qa-panel-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ usePathname: () => "/market/example" }));

import { ResourceQaPanel } from "../../src/features/resources/client";
import { resourceQaCopy } from "../../src/lib/resource-qa-i18n";

const { render, control } = createResourceQaPanelConfirmInteractionHelpers(
  harness,
  ResourceQaPanel,
  confirmAction,
);

it("confirms reopen before posting the reopen write", async () => {
  const copy = resourceQaCopy("en");
  harness.fetch
    .mockResolvedValueOnce(response({ success: true, status: "open" }))
    .mockResolvedValueOnce(response(openDetail));

  await (control(render(resolvedDetail), copy.reopen).props.onClick as () => Promise<void>)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalled());

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.reopenConfirmTitle,
    object: resolvedDetail.thread.body,
    consequences: copy.reopenConfirm,
    confirmLabel: copy.reopen,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: true,
  });
  expect(harness.fetch.mock.calls[0]?.[0]).toBe(
    `/api/products/${productId}/qa/${encodeURIComponent(threadId)}/resolve`,
  );
  expect(harness.fetch.mock.calls[0]?.[1]).toMatchObject({
    method: "POST",
    body: JSON.stringify({
      action: "reopen",
      expectedRevision: resolvedDetail.thread.revision,
    }),
  });
});

it("skips reopen when confirmation is cancelled", async () => {
  const copy = resourceQaCopy("en");
  confirmAction.mockResolvedValueOnce(false);
  await (control(render(resolvedDetail), copy.reopen).props.onClick as () => Promise<void>)();
  expect(harness.fetch).not.toHaveBeenCalled();
});
