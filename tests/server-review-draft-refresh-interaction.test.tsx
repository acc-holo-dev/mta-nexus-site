import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { findTestButton, flattenReactTestTree } from "./helpers/flatten-react-test-tree";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as Array<() => undefined | (() => void)>,
  fetch: vi.fn(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots))
      harness.slots[index] = typeof initial === "function" ? (initial as () => unknown)() : initial;
    return [
      harness.slots[index],
      (value: unknown) => {
        harness.slots[index] = typeof value === "function" ? value(harness.slots[index]) : value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = { current: initial };
    return harness.slots[index];
  },
  useCallback: (fn: unknown) => fn,
  useEffect: (effect: () => undefined | (() => void)) => {
    harness.effects.push(effect);
  },
  useId: () => "server-review-status",
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/servers/demo",
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" as const }),
}));

import { ServerReviewPanel } from "../apps/web/src/components/server-review-panel";
import { serverReviewCopy } from "../apps/web/src/lib/server-review-i18n";

const page = { reviews: [], total: 0, page: 1, totalPages: 1 };
const review = (text: string, revision: number) => ({
  review: {
    id: "review",
    text,
    rating: 4,
    status: "published",
    revision,
    interactionSource: "follow",
  },
  canReview: true,
  eligibility: "ok",
});
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function render(serverId = "srv_demo") {
  harness.cursor = 0;
  harness.effects = [];
  return flattenReactTestTree(ServerReviewPanel({ serverId, initialPage: page }) as ReactNode);
}
let focus: () => void;
beforeEach(() => {
  vi.clearAllMocks();
  harness.slots = [];
  harness.fetch.mockReset();
  vi.stubGlobal("fetch", harness.fetch);
  vi.stubGlobal("document", {
    visibilityState: "visible",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal("window", {
    addEventListener: (name: string, cb: () => void) => {
      if (name === "focus") focus = cb;
    },
    removeEventListener: vi.fn(),
    location: { pathname: "/servers/demo", search: "", hash: "" },
  });
});
afterEach(() => vi.unstubAllGlobals());

it("keeps an edited draft and its original revision across a background refresh", async () => {
  harness.fetch.mockResolvedValueOnce(response(review("Original review", 2)));
  render();
  const cleanup = harness.effects[1]?.();
  await vi.waitFor(() => expect(render().some((node) => node.type === "textarea")).toBe(true));
  const textarea = render().find((node) => node.type === "textarea");
  if (!textarea) throw new Error("Missing review editor");
  (textarea.props.onChange as (event: unknown) => void)({ target: { value: "My unsaved review" } });
  harness.fetch.mockResolvedValueOnce(response(review("Changed elsewhere", 3)));
  focus();
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

it("ignores a save response after the panel is removed", async () => {
  harness.fetch.mockResolvedValueOnce(response(review("Original", 2)));
  render();
  const stopRefresh = harness.effects[1]?.();
  const stopScope = harness.effects[2]?.();
  await vi.waitFor(() => expect(render().some((node) => node.type === "textarea")).toBe(true));
  let finish!: (value: Response) => void;
  harness.fetch.mockReturnValueOnce(new Promise<Response>((resolve) => (finish = resolve)));
  const form = render().find((node) => node.type === "form");
  if (!form) throw new Error("Missing review form");
  (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
  if (typeof stopScope === "function") stopScope();
  if (typeof stopRefresh === "function") stopRefresh();
  finish(response({ success: true, id: "review", status: "published", revision: 3 }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(harness.slots[10]).toBe(false);
  expect(harness.fetch).toHaveBeenCalledTimes(2);
});

it("does not apply an old save after switching servers", async () => {
  harness.fetch.mockResolvedValueOnce(response(review("First server", 2)));
  render();
  const stopRefresh = harness.effects[1]?.();
  const stopScope = harness.effects[2]?.();
  await vi.waitFor(() => expect(render().some((node) => node.type === "textarea")).toBe(true));
  let finish!: (value: Response) => void;
  harness.fetch.mockReturnValueOnce(new Promise<Response>((resolve) => (finish = resolve)));
  const form = render().find((node) => node.type === "form");
  if (!form) throw new Error("Missing review form");
  (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
  if (typeof stopRefresh === "function") stopRefresh();
  if (typeof stopScope === "function") stopScope();
  harness.fetch.mockResolvedValueOnce(response(review("Second server", 7)));
  render("srv_other");
  const stopNext = harness.effects[1]?.();
  await vi.waitFor(() =>
    expect(render("srv_other").find((node) => node.type === "textarea")?.props.value).toBe(
      "Second server",
    ),
  );
  finish(response({ id: "review", status: "published", revision: 3 }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(render("srv_other").find((node) => node.type === "textarea")?.props.value).toBe(
    "Second server",
  );
  expect(harness.slots[10]).toBe(false);
  expect(harness.fetch).toHaveBeenCalledTimes(3);
  if (typeof stopNext === "function") stopNext();
});

it("keeps a confirmed save when the public review list fails to refresh", async () => {
  harness.fetch.mockResolvedValueOnce(response(review("Original", 2)));
  render();
  const cleanup = harness.effects[1]?.();
  await vi.waitFor(() => expect(render().some((node) => node.type === "textarea")).toBe(true));
  harness.fetch
    .mockResolvedValueOnce(response({ id: "review", status: "published", revision: 3 }))
    .mockRejectedValueOnce(new Error("network"));
  const form = render().find((node) => node.type === "form");
  if (!form) throw new Error("Missing review form");
  (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
  await vi.waitFor(() => expect(harness.slots[2]).toBe(true));
  expect(harness.slots[10]).toBe(true);
  expect(harness.slots[9]).toContain(serverReviewCopy("en").saved);
  if (typeof cleanup === "function") cleanup();
});

it("ignores an older response that arrives after a newer refresh", async () => {
  let resolveOld!: (value: Response) => void;
  harness.fetch
    .mockReturnValueOnce(new Promise<Response>((resolve) => (resolveOld = resolve)))
    .mockResolvedValueOnce(response(review("Newer review", 3)));
  render();
  const cleanup = harness.effects[1]?.();
  focus();
  await vi.waitFor(() =>
    expect(render().find((node) => node.type === "textarea")?.props.value).toBe("Newer review"),
  );
  resolveOld(response(review("Old review", 2)));
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(2));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(render().find((node) => node.type === "textarea")?.props.value).toBe("Newer review");
  if (typeof cleanup === "function") cleanup();
});
