import { expect, it, vi } from "vitest";
import {
  createReportModerationControlsConfirmInteractionHelpers,
  mockReactHooks,
  notes,
  reportId,
  response,
} from "./helpers/report-moderation-controls-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../apps/web/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: harness.refresh }),
}));
vi.mock("../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../apps/web/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en" as const, dictionary: getDictionary("en") }),
  };
});

import { ReportModerationControls } from "../apps/web/src/components/report-moderation-controls";
import { communityReportCopy } from "../apps/web/src/lib/community-report-copy";
import { getDictionary } from "../apps/web/src/lib/i18n";

const { render, actionButton, seedControls } =
  createReportModerationControlsConfirmInteractionHelpers(
    harness,
    ReportModerationControls,
    confirmAction,
  );

it("confirms report dismiss before posting the admin action", async () => {
  const copy = getDictionary("en").admin;
  const labels = communityReportCopy("en");
  seedControls();
  harness.fetch.mockResolvedValueOnce(
    response({ success: true, targetId: reportId, action: "dismiss" }),
  );

  (actionButton(render(), copy.dismissReport).props.onClick as () => void)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.dismissReport,
    object: reportId,
    consequences: copy.dismissReportConfirm,
    confirmLabel: copy.dismissReport,
    cancelLabel: labels.cancel,
    closeLabel: labels.cancel,
  });
  expect(harness.fetch).toHaveBeenCalledWith(
    "/api/admin/actions",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        targetType: "report",
        targetId: reportId,
        action: "dismiss",
        notes,
      }),
    }),
  );
  expect(harness.refresh).toHaveBeenCalledOnce();
});

it("does not dismiss a report when confirmation is cancelled", async () => {
  const copy = getDictionary("en").admin;
  const labels = communityReportCopy("en");
  const slotsBefore = structuredClone(harness.slots);
  confirmAction.mockResolvedValueOnce(false);

  (actionButton(render(), copy.dismissReport).props.onClick as () => void)();
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.dismissReport,
    object: reportId,
    consequences: copy.dismissReportConfirm,
    confirmLabel: copy.dismissReport,
    cancelLabel: labels.cancel,
    closeLabel: labels.cancel,
  });
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(harness.slots).toEqual(slotsBefore);
});
