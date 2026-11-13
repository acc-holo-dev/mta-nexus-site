import { expect, it, vi } from "vitest";
import type { Locale } from "../../site/src/lib/i18n";
import {
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
vi.mock("../../site/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: harness.locale }),
}));

import { LibraryReleaseSelectionControls } from "../../site/src/components/library-release-selection-controls";

const { render, button, click } = createResourceReleaseControlInteractionHelpers(
  harness,
  LibraryReleaseSelectionControls,
);

it("keeps a malformed success response unresolved until the same request is confirmed", async () => {
  harness.fetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ success: true }),
  });
  await click("Use latest approved version");
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(render().some((n) => n.props.role === "alert")).toBe(true);
  expect(button("Retry the same request").props.disabled).toBe(false);
  await click("Reload current state");
  expect(harness.refresh).toHaveBeenCalledOnce();
});

it.each([400, 401, 403, 404, 409])(
  "requires reloading after a definitive rejection %s",
  async (status) => {
    harness.fetch.mockResolvedValueOnce({
      ok: false,
      status,
      json: async () => ({ code: "LIBRARY_RELEASE_CONFLICT" }),
    });
    await click("Use this version: 2");
    expect(
      render().some((n) => n.type === "button" && n.props.children === "Retry the same request"),
    ).toBe(false);
    expect(harness.refresh).not.toHaveBeenCalled();
    expect(button("Use this version: 3").props.disabled).toBe(true);
    await click("Reload current state");
    expect(harness.refresh).toHaveBeenCalledOnce();
  },
);
