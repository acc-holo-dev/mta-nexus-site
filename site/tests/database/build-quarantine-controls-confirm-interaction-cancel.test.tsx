import { expect, it, vi } from "vitest";
import {
  buildId,
  createBuildQuarantineControlsConfirmInteractionHelpers,
  mockReactHooks,
} from "../helpers/build-quarantine-controls-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: harness.refresh }),
}));
vi.mock("../../src/components/locale-context", async () => {
  const { getDictionary } = await import("../../src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en" as const, dictionary: getDictionary("en") }),
  };
});

import { BuildQuarantineControls } from "../../src/features/resources/components/build-quarantine-controls";
import { getDictionary } from "../../src/lib/i18n";
import { verificationCopy } from "../../src/lib/verification-workspace-copy";

const { render, actionButton } = createBuildQuarantineControlsConfirmInteractionHelpers(
  harness,
  BuildQuarantineControls,
  confirmAction,
);

it("does not quarantine a build when confirmation is cancelled", async () => {
  const copy = getDictionary("en").admin;
  const labels = verificationCopy("en");
  const slotsBefore = structuredClone(harness.slots);
  confirmAction.mockResolvedValueOnce(false);

  (actionButton(render("published"), copy.quarantineBuild).props.onClick as () => void)();
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.quarantineBuild,
    object: buildId,
    consequences: copy.quarantineBuildConfirm,
    confirmLabel: copy.quarantineBuild,
    cancelLabel: labels.cancel,
    closeLabel: labels.cancel,
  });
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(harness.slots).toEqual(slotsBefore);
});

it("does not restore a build when confirmation is cancelled", async () => {
  const copy = getDictionary("en").admin;
  const labels = verificationCopy("en");
  const slotsBefore = structuredClone(harness.slots);
  confirmAction.mockResolvedValueOnce(false);

  (actionButton(render("quarantined"), copy.restoreBuild).props.onClick as () => void)();
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.restoreBuild,
    object: buildId,
    consequences: copy.restoreBuildConfirm,
    confirmLabel: copy.restoreBuild,
    cancelLabel: labels.cancel,
    closeLabel: labels.cancel,
    danger: false,
  });
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(harness.slots).toEqual(slotsBefore);
});
