import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  createResourceReviewControlsInteractionHelpers,
  mockReactHooks,
  productId,
  publishedReview,
} from "./helpers/resource-review-controls-interaction-harness";

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

import {
  ResourceReviewDecisionForm,
  ResourceReviewEditor,
} from "../apps/web/src/components/resource-review-controls";
import { resourceReviewCopy } from "../apps/web/src/lib/resource-review-i18n";

const { renderEditor } = createResourceReviewControlsInteractionHelpers(
  harness,
  ResourceReviewDecisionForm,
  ResourceReviewEditor,
  confirmAction,
);

it("confirms withdrawal before posting a withdraw command", async () => {
  harness.cursor = 0;
  const nodes = renderEditor(publishedReview);
  const withdraw = nodes.find(
    (node) => node.type === "button" && node.props.children === resourceReviewCopy("en").withdraw,
  );
  if (!withdraw) throw new Error("Missing withdraw control");
  (withdraw.props.onClick as () => void)();
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));
  expect(harness.fetch).toHaveBeenCalledWith(
    `/api/library/review/${productId}`,
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ action: "withdraw", expectedRevision: 2 }),
    }),
  );
});
