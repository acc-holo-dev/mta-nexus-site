import { expect, it, vi } from "vitest";
import {
  buildId,
  createBuildQuarantineControlsConfirmInteractionHelpers,
  mockReactHooks,
  reason,
  response,
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

import { BuildQuarantineControls } from "../../src/components/build-quarantine-controls";
import { getDictionary } from "../../src/lib/i18n";
import { verificationCopy } from "../../src/lib/verification-workspace-copy";

const { render, actionButton, seedControls } =
  createBuildQuarantineControlsConfirmInteractionHelpers(
    harness,
    BuildQuarantineControls,
    confirmAction,
  );

it("confirms quarantine before posting the admin action", async () => {
  const copy = getDictionary("en").admin;
  const labels = verificationCopy("en");
  harness.fetch.mockResolvedValueOnce(
    response({ success: true, targetId: buildId, action: "quarantine" }),
  );

  (actionButton(render("published"), copy.quarantineBuild).props.onClick as () => void)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.quarantineBuild,
    object: buildId,
    consequences: copy.quarantineBuildConfirm,
    confirmLabel: copy.quarantineBuild,
    cancelLabel: labels.cancel,
    closeLabel: labels.cancel,
  });
  expect(harness.fetch).toHaveBeenCalledWith(
    "/api/admin/actions",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        targetType: "build",
        targetId: buildId,
        action: "quarantine",
        notes: reason,
        notifyAffectedDownloaders: false,
      }),
    }),
  );
  expect(harness.refresh).toHaveBeenCalledOnce();
});

it("confirms quarantine with downloader notify copy when the checkbox is set", async () => {
  const copy = getDictionary("en").admin;
  const labels = verificationCopy("en");
  seedControls(true);
  harness.fetch.mockResolvedValueOnce(
    response({ success: true, targetId: buildId, action: "quarantine" }),
  );

  (actionButton(render("published"), copy.quarantineBuild).props.onClick as () => void)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.quarantineBuild,
    object: buildId,
    consequences: copy.quarantineBuildNotifyConfirm,
    confirmLabel: copy.quarantineBuild,
    cancelLabel: labels.cancel,
    closeLabel: labels.cancel,
  });
  expect(harness.fetch).toHaveBeenCalledWith(
    "/api/admin/actions",
    expect.objectContaining({
      body: JSON.stringify({
        targetType: "build",
        targetId: buildId,
        action: "quarantine",
        notes: reason,
        notifyAffectedDownloaders: true,
      }),
    }),
  );
});
