import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  createResourceCartControlsConfirmInteractionHelpers,
  initialCart,
  item,
  mockReactHooks,
  response,
} from "../helpers/resource-cart-controls-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../apps/web/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("../../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" as const }),
}));

import { ResourceCartControls } from "../../apps/web/src/components/resource-cart-controls";
import { getResourceCommerceCopy } from "../../apps/web/src/lib/resource-commerce-i18n";

const { render, removeButton } = createResourceCartControlsConfirmInteractionHelpers(
  harness,
  ResourceCartControls,
  confirmAction,
);

it("confirms cart item removal before DELETE", async () => {
  const copy = getResourceCommerceCopy("en");
  harness.fetch
    .mockResolvedValueOnce(response({ productId: item.productId, inCart: false }))
    .mockResolvedValueOnce(response({ items: [], limit: initialCart.limit }));

  (removeButton(render()).props.onClick as () => void)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalled());

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.removeConfirmTitle,
    object: item.title,
    consequences: copy.removeConfirm,
    confirmLabel: copy.remove,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: true,
  });
  expect(harness.fetch).toHaveBeenCalledWith(
    "/api/resources/cart",
    expect.objectContaining({
      method: "DELETE",
      body: JSON.stringify({ productId: item.productId }),
    }),
  );
});
