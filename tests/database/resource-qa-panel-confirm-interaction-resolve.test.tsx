import { expect, it, vi } from "vitest";
import {
  answerId,
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
vi.mock("../../apps/web/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ usePathname: () => "/market/example" }));

import { ResourceQaPanel } from "../../apps/web/src/components/resource-qa-panel";
import { resourceQaCopy } from "../../apps/web/src/lib/resource-qa-i18n";

const { render, control } = createResourceQaPanelConfirmInteractionHelpers(
  harness,
  ResourceQaPanel,
  confirmAction,
);

it("confirms resolve before posting the useful-answer write", async () => {
  const copy = resourceQaCopy("en");
  harness.fetch
    .mockResolvedValueOnce(response({ success: true, status: "resolved" }))
    .mockResolvedValueOnce(response(resolvedDetail));

  await (control(render(openDetail), copy.resolve).props.onClick as () => Promise<void>)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalled());

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.resolveConfirmTitle,
    object: openDetail.thread.body,
    consequences: copy.resolveConfirm,
    confirmLabel: copy.resolve,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: false,
  });
  expect(harness.fetch.mock.calls[0]?.[0]).toBe(
    `/api/products/${productId}/qa/${encodeURIComponent(threadId)}/resolve`,
  );
  expect(harness.fetch.mock.calls[0]?.[1]).toMatchObject({
    method: "POST",
    body: JSON.stringify({
      action: "resolve",
      answerId,
      expectedRevision: openDetail.thread.revision,
    }),
  });
});

it("skips resolve when confirmation is cancelled", async () => {
  const copy = resourceQaCopy("en");
  confirmAction.mockResolvedValueOnce(false);
  await (control(render(openDetail), copy.resolve).props.onClick as () => Promise<void>)();
  expect(harness.fetch).not.toHaveBeenCalled();
});
