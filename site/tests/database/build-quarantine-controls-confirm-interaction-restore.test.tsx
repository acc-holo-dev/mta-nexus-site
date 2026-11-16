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

import { BuildQuarantineControls } from "../../src/features/resources/components/build-quarantine-controls";
import { getDictionary } from "../../src/lib/i18n";
import { verificationCopy } from "../../src/lib/verification-workspace-copy";

const { render, actionButton } = createBuildQuarantineControlsConfirmInteractionHelpers(
  harness,
  BuildQuarantineControls,
  confirmAction,
);

it("confirms restore before posting the admin action", async () => {
  const copy = getDictionary("en").admin;
  const labels = verificationCopy("en");
  harness.fetch.mockResolvedValueOnce(
    response({ success: true, targetId: buildId, action: "restore" }),
  );

  (actionButton(render("quarantined"), copy.restoreBuild).props.onClick as () => void)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.restoreBuild,
    object: buildId,
    consequences: copy.restoreBuildConfirm,
    confirmLabel: copy.restoreBuild,
    cancelLabel: labels.cancel,
    closeLabel: labels.cancel,
    danger: false,
  });
  expect(harness.fetch).toHaveBeenCalledWith(
    "/api/admin/actions",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        targetType: "build",
        targetId: buildId,
        action: "restore",
        notes: reason,
      }),
    }),
  );
  expect(harness.refresh).toHaveBeenCalledOnce();
});
