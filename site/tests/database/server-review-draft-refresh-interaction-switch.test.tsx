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
vi.mock("../../src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" as const }),
}));

import { ServerReviewPanel } from "../../src/components/server-review-panel";

const { render } = createServerReviewDraftRefreshInteractionHelpers(harness, ServerReviewPanel);

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
