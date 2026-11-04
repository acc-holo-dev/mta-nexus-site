import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../apps/web/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = initial;
    return [
      harness.slots[index],
      (value: unknown) => {
        harness.slots[index] =
          typeof value === "function"
            ? (value as (current: unknown) => unknown)(harness.slots[index])
            : value;
      },
    ];
  },
}));
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

type Element = ReactElement<Record<string, unknown>>;
function descendants(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  const type = element.type as { displayName?: string } | string;
  if (typeof type === "object" && type?.displayName === "Button") {
    return [
      { ...element, type: "button" } as Element,
      ...descendants(element.props.children as ReactNode),
    ];
  }
  return [element, ...descendants(element.props.children as ReactNode)];
}
function renderDecision(locale: "en" | "ru" = "en", action = "remove_review") {
  harness.slots = ["Reviewed reason", action, false, "", false];
  harness.cursor = 0;
  return descendants(
    ResourceReviewDecisionForm({
      id: "rpt_a",
      status: "open",
      revision: 2,
      reviewText: "Reported review body",
      locale,
    }),
  );
}
function submit(nodes: Element[]) {
  const form = nodes.find((node) => node.type === "form");
  if (!form) throw new Error("Missing decision form");
  (form.props.onSubmit as (event: { preventDefault: () => void }) => void)({ preventDefault() {} });
}
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
beforeEach(() => {
  vi.clearAllMocks();
  harness.slots = [];
  harness.cursor = 0;
  confirmAction.mockReset().mockResolvedValue(true);
  harness.fetch
    .mockReset()
    .mockResolvedValue(response({ id: "rpt_a", status: "resolved", reviewRemoved: true }));
  vi.stubGlobal("fetch", harness.fetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
});
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

it("unlocks after the confirmed review revision is visible on refresh", async () => {
  const original = { text: "Original review", rating: 4, status: "published", revision: 2 };
  const saved = { ...original, text: "Saved draft", revision: 3 };
  const copy = resourceReviewCopy("en");
  function renderEditor(review: typeof original) {
    harness.cursor = 0;
    return descendants(
      ResourceReviewEditor({ productId: "prd_a", review, canReview: true, locale: "en" }),
    );
  }
  const editor = renderEditor(original).find((node) => node.type === "textarea");
  if (!editor) throw new Error("Missing editor");
  (editor.props.onChange as (event: unknown) => void)({ target: { value: "Saved draft" } });
  harness.fetch.mockResolvedValueOnce(response({ id: "review", status: "published", revision: 3 }));
  submit(renderEditor(original));
  await vi.waitFor(() =>
    expect(
      renderEditor(original).find(
        (node) => node.type === "button" && node.props.children === copy.save,
      )?.props.disabled,
    ).toBe(true),
  );
  const refreshed = renderEditor(saved);
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
  const published = { text: "Published review", rating: 4, status: "published", revision: 2 };
  function renderEditor(review: typeof published) {
    harness.cursor = 0;
    return descendants(
      ResourceReviewEditor({ productId: "prd_a", review, canReview: true, locale: "en" }),
    );
  }
  harness.fetch.mockResolvedValueOnce(response({ id: "review", status: "withdrawn", revision: 2 }));
  const withdraw = renderEditor(published).find(
    (node) => node.type === "button" && node.props.children === resourceReviewCopy("en").withdraw,
  );
  if (!withdraw) throw new Error("Missing withdraw control");
  (withdraw.props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(
      renderEditor(published).find(
        (node) => node.type === "button" && node.props.children === resourceReviewCopy("en").save,
      )?.props.disabled,
    ).toBe(true),
  );
  const refreshed = renderEditor({ ...published, status: "withdrawn" });
  expect(
    refreshed.find(
      (node) => node.type === "button" && node.props.children === resourceReviewCopy("en").save,
    )?.props.disabled,
  ).toBe(false);
});
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
it("confirms withdrawal before posting a withdraw command", async () => {
  harness.cursor = 0;
  const nodes = descendants(
    ResourceReviewEditor({
      productId: "prd_a",
      review: { text: "Published review", rating: 4, status: "published", revision: 2 },
      canReview: true,
      locale: "en",
    }),
  );
  const withdraw = nodes.find(
    (node) => node.type === "button" && node.props.children === resourceReviewCopy("en").withdraw,
  );
  if (!withdraw) throw new Error("Missing withdraw control");
  (withdraw.props.onClick as () => void)();
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));
  expect(harness.fetch).toHaveBeenCalledWith(
    "/api/library/review/prd_a",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ action: "withdraw", expectedRevision: 2 }),
    }),
  );
});

it.each(["en", "ru"] as const)(
  "preserves a draft and requires an explicit new revision after refresh in %s",
  async (locale) => {
    const copy = resourceReviewCopy(locale);
    const initial = { text: "Original review", rating: 4, status: "published", revision: 2 };
    const latest = { text: "Changed elsewhere", rating: 3, status: "published", revision: 3 };
    function renderEditor(review: typeof initial, canReview = true) {
      harness.cursor = 0;
      return descendants(ResourceReviewEditor({ productId: "prd_a", review, canReview, locale }));
    }
    const textarea = renderEditor(initial).find((node) => node.type === "textarea");
    if (!textarea) throw new Error("Missing editor");
    (textarea.props.onChange as (event: unknown) => void)({
      target: { value: "My unsaved draft" },
    });
    const changed = renderEditor(latest);
    expect(changed.find((node) => node.type === "textarea")?.props.value).toBe("My unsaved draft");
    expect(
      changed.find((node) => node.type === "button" && node.props.children === copy.save)?.props
        .disabled,
    ).toBe(true);
    expect(changed.some((node) => node.props.children === copy.latestReview)).toBe(true);
    submit(changed);
    expect(harness.fetch).not.toHaveBeenCalled();
    const accept = renderEditor(latest).find(
      (node) => node.type === "button" && node.props.children === copy.useLatest,
    );
    if (!accept) throw new Error("Missing accept control");
    (accept.props.onClick as () => void)();
    harness.fetch.mockResolvedValueOnce(response({ code: "REVIEW_CHANGED" }, 409));
    submit(renderEditor(latest));
    await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledOnce());
    expect(JSON.parse(harness.fetch.mock.calls[0][1].body)).toMatchObject({
      action: "save",
      text: "My unsaved draft",
      rating: 4,
      expectedRevision: 3,
    });
    const revoked = renderEditor(latest, false);
    const retained = revoked.find((node) => node.type === "textarea");
    expect(retained?.props.value).toBe("My unsaved draft");
    expect(retained?.props.readOnly).toBe(true);
    expect(revoked.some((node) => node.props.children === copy.retainedDraft)).toBe(true);
  },
);
