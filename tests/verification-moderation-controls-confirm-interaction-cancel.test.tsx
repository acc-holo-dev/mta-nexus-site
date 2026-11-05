import { expect, it, vi } from "vitest";
import {
  createVerificationApplicationsInteractionHelpers,
  mockReactHooks,
} from "./helpers/verification-applications-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  fetch: vi.fn(),
  refresh: vi.fn(),
  reload: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../apps/web/src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock("../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../apps/web/src/lib/i18n");
  return { useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }) };
});

import { VerificationApplicationAmend } from "../apps/web/src/components/verification-application-amend";
import { VerificationModerationControls } from "../apps/web/src/components/verification-moderation-controls";
import { getDictionary } from "../apps/web/src/lib/i18n";
import { verificationCopy } from "../apps/web/src/lib/verification-workspace-copy";

const { moderation, actionButton, reviewNotes } = createVerificationApplicationsInteractionHelpers(
  harness,
  VerificationApplicationAmend,
  VerificationModerationControls,
  confirmAction,
);

it("does not approve a verification request when confirmation is cancelled", async () => {
  const copy = getDictionary("en").admin;
  const labels = verificationCopy("en");
  reviewNotes();
  const slotsBefore = structuredClone(harness.slots);
  confirmAction.mockResolvedValueOnce(false);

  (actionButton(moderation(), copy.approve).props.onClick as () => void)();
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.approve,
    object: "request",
    consequences: copy.approveVerificationConfirm,
    confirmLabel: copy.approve,
    cancelLabel: labels.cancel,
    closeLabel: labels.cancel,
    danger: false,
  });
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(harness.slots).toEqual(slotsBefore);
});

it("does not reject a verification request when confirmation is cancelled", async () => {
  const copy = getDictionary("en").admin;
  const labels = verificationCopy("en");
  reviewNotes();
  const slotsBefore = structuredClone(harness.slots);
  confirmAction.mockResolvedValueOnce(false);

  (actionButton(moderation(), copy.reject).props.onClick as () => void)();
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.reject,
    object: "request",
    consequences: copy.rejectVerificationConfirm,
    confirmLabel: copy.reject,
    cancelLabel: labels.cancel,
    closeLabel: labels.cancel,
  });
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(harness.slots).toEqual(slotsBefore);
});
