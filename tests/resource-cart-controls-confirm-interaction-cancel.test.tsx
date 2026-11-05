import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  createResourceCartControlsConfirmInteractionHelpers,
  mockReactHooks,
} from "./helpers/resource-cart-controls-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../apps/web/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" as const }),
}));

import { ResourceCartControls } from "../apps/web/src/components/resource-cart-controls";

const { render, removeButton } = createResourceCartControlsConfirmInteractionHelpers(
  harness,
  ResourceCartControls,
  confirmAction,
);

it("does not remove a cart item when confirmation is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  (removeButton(render()).props.onClick as () => void)();
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));
  expect(harness.fetch).not.toHaveBeenCalled();
});
