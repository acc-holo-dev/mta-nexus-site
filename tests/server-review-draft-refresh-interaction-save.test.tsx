import { expect, it, vi } from "vitest";
import {
  createServerReviewDraftRefreshInteractionHelpers,
  mockReactHooks,
  response,
  review,
} from "./helpers/server-review-draft-refresh-interaction-harness";

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
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" as const }),
}));

import { ServerReviewPanel } from "../apps/web/src/components/server-review-panel";
import { serverReviewCopy } from "../apps/web/src/lib/server-review-i18n";

const { render } = createServerReviewDraftRefreshInteractionHelpers(harness, ServerReviewPanel);

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
  expect((harness.slots[9] as { text: string; error: boolean }).text).toContain(
    serverReviewCopy("en").saved,
  );
  expect((harness.slots[9] as { text: string; error: boolean }).error).toBe(false);
  if (typeof cleanup === "function") cleanup();
});
