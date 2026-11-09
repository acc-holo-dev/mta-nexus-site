import { expect, it, vi } from "vitest";
import type { Locale } from "../../apps/web/src/lib/i18n";
import {
  ack,
  createResourceReleaseControlInteractionHelpers,
  mockReactHooks,
} from "../helpers/resource-release-control-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanup: undefined as (() => void) | undefined,
  fetch: vi.fn(),
  refresh: vi.fn(),
  reload: vi.fn(),
  locale: "en" as Locale,
  productId: "prd_a",
  actorId: "usr_a",
  revision: 3,
  artifactValid: true,
  uiUpdates: 0,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock("../../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: harness.locale }),
}));

import { LibraryReleaseSelectionControls } from "../../apps/web/src/components/library-release-selection-controls";

const { render, button, click } = createResourceReleaseControlInteractionHelpers(
  harness,
  LibraryReleaseSelectionControls,
);

it("aborts on unmount and ignores a late success without updating UI or refreshing another page", async () => {
  let resolve: (value: unknown) => void = () => {};
  harness.fetch.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const stale = button("Use this version: 2").props.onClick as () => void;
  stale();
  const init = harness.fetch.mock.calls[0]?.[1] as RequestInit;
  harness.cleanup?.();
  expect(init.signal?.aborted).toBe(true);
  const updates = harness.uiUpdates;
  resolve({ ok: true, status: 200, json: async () => ack(init) });
  await new Promise((r) => setTimeout(r, 0));
  stale();
  expect(harness.uiUpdates).toBe(updates);
  expect(harness.fetch).toHaveBeenCalledOnce();
  expect(harness.refresh).not.toHaveBeenCalled();
});

it("ignores a late response and hides the previous actor's pending command after identity changes", async () => {
  let complete!: (value: unknown) => void;
  harness.fetch.mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  await click("Use this version: 2");
  const init = harness.fetch.mock.calls[0][1] as RequestInit;
  harness.actorId = "usr_b";
  expect(
    render().some((n) => n.type === "button" && n.props.children === "Retry the same request"),
  ).toBe(false);
  complete({ ok: true, status: 200, json: async () => ack(init) });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(render().some((n) => n.props.role === "status")).toBe(false);
});
