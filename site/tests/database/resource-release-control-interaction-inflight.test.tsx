import { expect, it, vi } from "vitest";
import type { Locale } from "../../src/lib/platform/i18n";
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
vi.mock("../../src/features/shell/locale", () => ({
  useNexusLocale: () => ({ locale: harness.locale }),
}));

import { LibraryReleaseSelectionControls } from "../../src/features/library/release-selection";

const { button, click } = createResourceReleaseControlInteractionHelpers(
  harness,
  LibraryReleaseSelectionControls,
);

it("coalesces duplicate clicks and prevents reload during an in-flight request", async () => {
  let resolve: (value: unknown) => void = () => {};
  harness.fetch.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  await click("Use this version: 2");
  await click("Use this version: 2");
  expect(harness.fetch).toHaveBeenCalledOnce();
  expect(button("Reload current state").props.disabled).toBe(true);
  const init = harness.fetch.mock.calls[0][1] as RequestInit;
  resolve({ ok: true, status: 200, json: async () => ack(init) });
  await new Promise((r) => setTimeout(r, 0));
  expect(harness.refresh).toHaveBeenCalledOnce();
});
