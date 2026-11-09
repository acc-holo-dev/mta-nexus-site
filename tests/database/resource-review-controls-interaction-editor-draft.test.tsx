import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  createResourceReviewControlsInteractionHelpers,
  latestReview,
  mockReactHooks,
  originalReview,
  response,
} from "../helpers/resource-review-controls-interaction-harness";

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

import {
  ResourceReviewDecisionForm,
  ResourceReviewEditor,
} from "../../apps/web/src/components/resource-review-controls";
import { resourceReviewCopy } from "../../apps/web/src/lib/resource-review-i18n";

const { renderEditor, submit } = createResourceReviewControlsInteractionHelpers(
  harness,
  ResourceReviewDecisionForm,
  ResourceReviewEditor,
  confirmAction,
);

it.each(["en", "ru"] as const)(
  "preserves a draft and requires an explicit new revision after refresh in %s",
  async (locale) => {
    const copy = resourceReviewCopy(locale);
    const textarea = renderEditor(originalReview, locale).find((node) => node.type === "textarea");
    if (!textarea) throw new Error("Missing editor");
    (textarea.props.onChange as (event: unknown) => void)({
      target: { value: "My unsaved draft" },
    });
    const changed = renderEditor(latestReview, locale);
    expect(changed.find((node) => node.type === "textarea")?.props.value).toBe("My unsaved draft");
    expect(
      changed.find((node) => node.type === "button" && node.props.children === copy.save)?.props
        .disabled,
    ).toBe(true);
    expect(changed.some((node) => node.props.children === copy.latestReview)).toBe(true);
    submit(changed);
    expect(harness.fetch).not.toHaveBeenCalled();
    const accept = renderEditor(latestReview, locale).find(
      (node) => node.type === "button" && node.props.children === copy.useLatest,
    );
    if (!accept) throw new Error("Missing accept control");
    (accept.props.onClick as () => void)();
    harness.fetch.mockResolvedValueOnce(response({ code: "REVIEW_CHANGED" }, 409));
    submit(renderEditor(latestReview, locale));
    await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledOnce());
    expect(JSON.parse(harness.fetch.mock.calls[0][1].body)).toMatchObject({
      action: "save",
      text: "My unsaved draft",
      rating: 4,
      expectedRevision: 3,
    });
    const revoked = renderEditor(latestReview, locale, false);
    const retained = revoked.find((node) => node.type === "textarea");
    expect(retained?.props.value).toBe("My unsaved draft");
    expect(retained?.props.readOnly).toBe(true);
    expect(revoked.some((node) => node.props.children === copy.retainedDraft)).toBe(true);
  },
);
