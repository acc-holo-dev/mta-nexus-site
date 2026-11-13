import { expect, it, vi } from "vitest";
import {
  createCommunityModerationInteractionHelpers,
  mockReactHooks,
} from "../helpers/community-moderation-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  refresh: vi.fn(),
  fetch: vi.fn(),
  reload: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../site/src/components/confirm-action", () => ({
  confirmAction,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));
vi.mock("../../site/src/components/locale-context", async () => {
  const { getDictionary } = await import("../../site/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }),
  };
});

import { ContentModerationControls } from "../../site/src/components/content-moderation-controls";
import { moderationCopy } from "../../site/src/lib/community-moderation-copy";
import { getDictionary } from "../../site/src/lib/i18n";

const { click, ready } = createCommunityModerationInteractionHelpers(
  harness,
  ContentModerationControls,
  confirmAction,
);

it("asks for confirmation before publishing and skips the mutation when cancelled", async () => {
  const copy = getDictionary("en").admin;
  const general = moderationCopy("en");
  const nodes = ready();
  const slotsBefore = structuredClone(harness.slots);
  confirmAction.mockResolvedValueOnce(false);

  click(nodes, "Publish");
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.publish,
    object: "post",
    consequences: copy.publishContentConfirm,
    confirmLabel: copy.publish,
    cancelLabel: general.back,
    closeLabel: general.back,
    danger: false,
  });
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(harness.slots).toEqual(slotsBefore);
});

it("asks for confirmation before archiving and skips the mutation when cancelled", async () => {
  const copy = getDictionary("en").admin;
  const general = moderationCopy("en");
  const nodes = ready();
  const slotsBefore = structuredClone(harness.slots);
  confirmAction.mockResolvedValueOnce(false);

  click(nodes, "Archive");
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.archive,
    object: "post",
    consequences: copy.archiveContentConfirm,
    confirmLabel: copy.archive,
    cancelLabel: general.back,
    closeLabel: general.back,
  });
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(harness.slots).toEqual(slotsBefore);
});
