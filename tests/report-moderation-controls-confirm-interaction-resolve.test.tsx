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
vi.mock("../site/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: harness.refresh }),
}));
vi.mock("../site/src/components/locale-context", async () => {
  const { getDictionary } = await import("../site/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en" as const, dictionary: getDictionary("en") }),
  };
});

import { ReportModerationControls } from "../site/src/components/report-moderation-controls";
import { communityReportCopy } from "../site/src/lib/community-report-copy";
import { getDictionary } from "../site/src/lib/i18n";

const { render, actionButton } = createReportModerationControlsConfirmInteractionHelpers(
  harness,
  ReportModerationControls,
  confirmAction,
);

it("confirms report resolve before posting the admin action", async () => {
  const copy = getDictionary("en").admin;
  const labels = communityReportCopy("en");
  harness.fetch.mockResolvedValueOnce(
    response({ success: true, targetId: reportId, action: "resolve" }),
  );

  (actionButton(render(), copy.resolveReport).props.onClick as () => void)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.resolveReport,
    object: reportId,
    consequences: copy.resolveReportConfirm,
    confirmLabel: copy.resolveReport,
    cancelLabel: labels.cancel,
    closeLabel: labels.cancel,
    danger: false,
  });
  expect(harness.fetch).toHaveBeenCalledWith(
    "/api/admin/actions",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        targetType: "report",
        targetId: reportId,
        action: "resolve",
        notes,
      }),
    }),
  );
  expect(harness.refresh).toHaveBeenCalledOnce();
});

it("does not resolve a report when confirmation is cancelled", async () => {
  const copy = getDictionary("en").admin;
  const labels = communityReportCopy("en");
  const slotsBefore = structuredClone(harness.slots);
  confirmAction.mockResolvedValueOnce(false);

  (actionButton(render(), copy.resolveReport).props.onClick as () => void)();
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.resolveReport,
    object: reportId,
    consequences: copy.resolveReportConfirm,
    confirmLabel: copy.resolveReport,
    cancelLabel: labels.cancel,
    closeLabel: labels.cancel,
    danger: false,
  });
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(harness.slots).toEqual(slotsBefore);
});
