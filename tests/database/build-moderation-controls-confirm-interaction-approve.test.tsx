import { expect, it, vi } from "vitest";
import {
  buildId,
  createBuildModerationControlsConfirmInteractionHelpers,
  expectedRevision,
  mockReactHooks,
  notes,
  response,
} from "../helpers/build-moderation-controls-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../site/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: harness.refresh }),
}));
vi.mock("../../site/src/components/locale-context", async () => {
  const { getDictionary } = await import("../../site/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en" as const, dictionary: getDictionary("en") }),
  };
});

import { BuildModerationControls } from "../../site/src/components/build-moderation-controls";
import { getDictionary } from "../../site/src/lib/i18n";
import { verificationCopy } from "../../site/src/lib/verification-workspace-copy";

const { render, actionButton } = createBuildModerationControlsConfirmInteractionHelpers(
  harness,
  BuildModerationControls,
  confirmAction,
);

it("confirms build approve before posting the admin action", async () => {
  const copy = getDictionary("en").admin;
  const labels = verificationCopy("en");
  harness.fetch.mockResolvedValueOnce(
    response({ success: true, targetId: buildId, action: "approve" }),
  );

  (actionButton(render(), copy.approve).props.onClick as () => void)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.approve,
    object: buildId,
    consequences: copy.approveBuildConfirm,
    confirmLabel: copy.approve,
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
        action: "approve",
        notes,
        expectedRevision,
      }),
    }),
  );
  expect(harness.refresh).toHaveBeenCalledOnce();
});

it("does not approve a build when confirmation is cancelled", async () => {
  const copy = getDictionary("en").admin;
  const labels = verificationCopy("en");
  const slotsBefore = structuredClone(harness.slots);
  confirmAction.mockResolvedValueOnce(false);

  (actionButton(render(), copy.approve).props.onClick as () => void)();
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.approve,
    object: buildId,
    consequences: copy.approveBuildConfirm,
    confirmLabel: copy.approve,
    cancelLabel: labels.cancel,
    closeLabel: labels.cancel,
    danger: false,
  });
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(harness.slots).toEqual(slotsBefore);
});
