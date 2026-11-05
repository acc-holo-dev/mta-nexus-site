import { expect, it, vi } from "vitest";
import type { Locale } from "../apps/web/src/lib/i18n";
import {
  createResourceReleaseControlInteractionHelpers,
  mockReactHooks,
} from "./helpers/resource-release-control-interaction-harness";

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
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: harness.locale }),
}));

import { LibraryReleaseSelectionControls } from "../apps/web/src/components/library-release-selection-controls";

const { button, click } = createResourceReleaseControlInteractionHelpers(
  harness,
  LibraryReleaseSelectionControls,
);

it("disables malformed archive identities instead of falling back to an unreviewed fixed command", async () => {
  harness.artifactValid = false;
  expect(button("Use this version: 2").props.disabled).toBe(true);
  await click("Use this version: 2");
  expect(harness.fetch).not.toHaveBeenCalled();
});
