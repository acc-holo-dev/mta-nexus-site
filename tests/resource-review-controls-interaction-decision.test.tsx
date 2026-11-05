import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  createResourceReviewControlsInteractionHelpers,
  mockReactHooks,
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

const { renderDecision, submit } = createResourceReviewControlsInteractionHelpers(
  harness,
  ResourceReviewDecisionForm,
  ResourceReviewEditor,
  confirmAction,
);

it.each(["en", "ru"] as const)(
  "confirms remove_review with localized copy before posting a decision in %s",
  async (locale) => {
    const copy = resourceReviewCopy(locale);
    submit(renderDecision(locale));
    await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));
    expect(confirmAction).toHaveBeenCalledWith({
      title: copy.removeReviewConfirmTitle,
      object: "Reported review body",
      consequences: copy.removeReviewConfirm,
      confirmLabel: copy.remove_review,
      cancelLabel: copy.cancel,
      closeLabel: copy.cancel,
      danger: true,
    });
    expect(JSON.parse(harness.fetch.mock.calls[0][1].body)).toMatchObject({
      action: "remove_review",
      expectedRevision: 2,
      notes: "Reviewed reason",
    });
  },
);

it("skips confirmation for non-destructive decisions", async () => {
  submit(renderDecision("en", "dismiss"));
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));
  expect(confirmAction).not.toHaveBeenCalled();
});

it("cancels remove_review before any request when confirmation is declined", () => {
  confirmAction.mockResolvedValueOnce(false);
  submit(renderDecision("en"));
  expect(harness.fetch).not.toHaveBeenCalled();
});
