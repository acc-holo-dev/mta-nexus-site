import { expect, it, vi } from "vitest";
import { findTestButton } from "../helpers/flatten-react-test-tree";
import {
  createServerReviewDraftRefreshInteractionHelpers,
  mockReactHooks,
  response,
  review,
} from "../helpers/server-review-draft-refresh-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as Array<() => undefined | (() => void)>,
  fetch: vi.fn(),
  focus: null as (() => void) | null,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({
  usePathname: () => "/servers/demo",
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("../../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" as const }),
}));

import { ServerReviewPanel } from "../../apps/web/src/components/server-review-panel";
import { serverReviewCopy } from "../../apps/web/src/lib/server-review-i18n";

const { render } = createServerReviewDraftRefreshInteractionHelpers(harness, ServerReviewPanel);

it("keeps an edited draft and its original revision across a background refresh", async () => {
  harness.fetch.mockResolvedValueOnce(response(review("Original review", 2)));
  render();
  const cleanup = harness.effects[1]?.();
  await vi.waitFor(() => expect(render().some((node) => node.type === "textarea")).toBe(true));
  const textarea = render().find((node) => node.type === "textarea");
  if (!textarea) throw new Error("Missing review editor");
  (textarea.props.onChange as (event: unknown) => void)({ target: { value: "My unsaved review" } });
  harness.fetch.mockResolvedValueOnce(response(review("Changed elsewhere", 3)));
  harness.focus?.();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(2));
  // Wait for the response body and state update before inspecting the form.
  await vi.waitFor(() =>
    expect((harness.slots[4] as { review: { revision: number } }).review.revision).toBe(3),
  );
  const nodes = render();
  expect(nodes.find((node) => node.type === "textarea")?.props.value).toBe("My unsaved review");
  harness.fetch.mockResolvedValueOnce(response({ code: "REVIEW_CHANGED" }, 409));
  const form = nodes.find((node) => node.type === "form");
  if (!form) throw new Error("Missing review form");
  (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(3));
  expect(JSON.parse(String(harness.fetch.mock.calls[2]?.[1]?.body))).toMatchObject({
    action: "save",
    text: "My unsaved review",
    expectedRevision: 2,
  });
  const copy = serverReviewCopy("en");
  await vi.waitFor(() => expect(findTestButton(render(), copy.checkLatest)).toBeDefined());
  harness.fetch.mockResolvedValueOnce(response(review("Changed elsewhere", 3)));
  (findTestButton(render(), copy.checkLatest).props.onClick as () => void)();
  await vi.waitFor(() => expect(findTestButton(render(), copy.useLatest)).toBeDefined());
  expect(render().find((node) => node.type === "textarea")?.props.value).toBe("My unsaved review");
  (findTestButton(render(), copy.useLatest).props.onClick as () => void)();
  harness.fetch.mockResolvedValueOnce(response({ code: "REVIEW_CHANGED" }, 409));
  const retryForm = render().find((node) => node.type === "form");
  if (!retryForm) throw new Error("Missing review form");
  (retryForm.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(5));
  expect(JSON.parse(String(harness.fetch.mock.calls[4]?.[1]?.body))).toMatchObject({
    text: "My unsaved review",
    expectedRevision: 3,
  });
  if (typeof cleanup === "function") cleanup();
});
