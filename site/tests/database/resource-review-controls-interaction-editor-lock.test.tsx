import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  createResourceReviewControlsInteractionHelpers,
  mockReactHooks,
  originalReview,
  publishedReview,
  response,
  savedReview,
  withdrawnReview,
} from "../helpers/resource-review-controls-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

import {
  ResourceReviewDecisionForm,
  ResourceReviewEditor,
} from "../../src/components/resource-review-controls";
import { resourceReviewCopy } from "../../src/lib/resource-review-i18n";

const { renderEditor, submit } = createResourceReviewControlsInteractionHelpers(
  harness,
  ResourceReviewDecisionForm,
  ResourceReviewEditor,
  confirmAction,
);

it("unlocks after the confirmed review revision is visible on refresh", async () => {
  const copy = resourceReviewCopy("en");
  const editor = renderEditor(originalReview).find((node) => node.type === "textarea");
  if (!editor) throw new Error("Missing editor");
  (editor.props.onChange as (event: unknown) => void)({ target: { value: "Saved draft" } });
  harness.fetch.mockResolvedValueOnce(response({ id: "review", status: "published", revision: 3 }));
  submit(renderEditor(originalReview));
  await vi.waitFor(() =>
    expect(
      renderEditor(originalReview).find(
        (node) => node.type === "button" && node.props.children === copy.save,
      )?.props.disabled,
    ).toBe(true),
  );
  const refreshed = renderEditor(savedReview);
  expect(
    refreshed.find((node) => node.type === "button" && node.props.children === copy.save)?.props
      .disabled,
  ).toBe(false);
  expect(refreshed.find((node) => node.type === "textarea")?.props.value).toBe("Saved draft");
  harness.fetch.mockResolvedValueOnce(response({ code: "REVIEW_CHANGED" }, 409));
  submit(refreshed);
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(2));
  expect(JSON.parse(harness.fetch.mock.calls[1][1].body).expectedRevision).toBe(3);
});

it("waits for the confirmed status when withdrawal does not advance the revision", async () => {
  harness.fetch.mockResolvedValueOnce(response({ id: "review", status: "withdrawn", revision: 2 }));
  const withdraw = renderEditor(publishedReview).find(
    (node) => node.type === "button" && node.props.children === resourceReviewCopy("en").withdraw,
  );
  if (!withdraw) throw new Error("Missing withdraw control");
  (withdraw.props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(
      renderEditor(publishedReview).find(
        (node) => node.type === "button" && node.props.children === resourceReviewCopy("en").save,
      )?.props.disabled,
    ).toBe(true),
  );
  const refreshed = renderEditor(withdrawnReview);
  expect(
    refreshed.find(
      (node) => node.type === "button" && node.props.children === resourceReviewCopy("en").save,
    )?.props.disabled,
  ).toBe(false);
});
