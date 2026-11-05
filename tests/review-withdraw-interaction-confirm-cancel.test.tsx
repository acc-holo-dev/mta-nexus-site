import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  createReviewWithdrawInteractionHelpers,
  mockReactHooks,
  publishedReview,
} from "./helpers/review-withdraw-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../apps/web/src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children }: { href: string; children: ReactNode }) =>
      React.createElement("a", { href }, children),
  };
});

import { ResourceReviewEditor } from "../apps/web/src/components/resource-review-controls";

const { withdrawButton, copy } = createReviewWithdrawInteractionHelpers(
  harness,
  ResourceReviewEditor,
  confirmAction,
);

it("does not withdraw a resource review when confirmAction is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  const labels = copy();
  await (withdrawButton().props.onClick as () => Promise<void>)();
  expect(confirmAction).toHaveBeenCalledWith(
    expect.objectContaining({
      title: labels.withdrawConfirmTitle,
      object: publishedReview.text,
      consequences: labels.withdrawConfirm,
      danger: true,
    }),
  );
  expect(harness.fetch).not.toHaveBeenCalled();
});
