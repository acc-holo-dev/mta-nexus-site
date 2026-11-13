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

it("ignores an older response that arrives after a newer refresh", async () => {
  let resolveOld!: (value: Response) => void;
  harness.fetch
    .mockReturnValueOnce(new Promise<Response>((resolve) => (resolveOld = resolve)))
    .mockResolvedValueOnce(response(review("Newer review", 3)));
  render();
  const cleanup = harness.effects[1]?.();
  harness.focus?.();
  await vi.waitFor(() =>
    expect(render().find((node) => node.type === "textarea")?.props.value).toBe("Newer review"),
  );
  resolveOld(response(review("Old review", 2)));
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(2));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(render().find((node) => node.type === "textarea")?.props.value).toBe("Newer review");
  if (typeof cleanup === "function") cleanup();
});
