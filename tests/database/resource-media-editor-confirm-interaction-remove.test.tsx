import { expect, it, vi } from "vitest";
import {
  createResourceMediaEditorConfirmInteractionHelpers,
  initial,
  mockReactHooks,
  response,
} from "../helpers/resource-media-editor-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../site/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));

import { ResourceMediaEditor } from "../../site/src/components/resource-media-editor";
import { resourceMediaCopy } from "../../site/src/lib/resource-media-i18n";

const { render, removeButton } = createResourceMediaEditorConfirmInteractionHelpers(
  harness,
  ResourceMediaEditor,
  confirmAction,
);

it("confirms gallery image removal before PATCH remove", async () => {
  const copy = resourceMediaCopy("en");
  const item = initial.items[0];
  harness.fetch.mockResolvedValueOnce(
    response({
      product: initial.product,
      items: [],
    }),
  );

  await (removeButton(render()).props.onClick as () => Promise<void>)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalled());

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.removeConfirmTitle,
    object: item.caption,
    consequences: copy.removeConfirm,
    confirmLabel: copy.confirm,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: true,
  });
  expect(harness.fetch).toHaveBeenCalledWith(
    `/api/products/${encodeURIComponent(initial.product.id)}/media`,
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({
        action: "remove",
        mediaId: item.id,
        expectedUpdatedAt: initial.product.updatedAt,
      }),
    }),
  );
});
