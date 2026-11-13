import { expect, it, vi } from "vitest";
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
vi.mock("../../site/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" as const }),
}));

import { ServerReviewPanel } from "../../site/src/components/server-review-panel";

const { render } = createServerReviewDraftRefreshInteractionHelpers(harness, ServerReviewPanel);

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
