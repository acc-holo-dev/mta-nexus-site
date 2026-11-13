import { expect, it, vi } from "vitest";
import {
  createResourceModerationControlsConfirmInteractionHelpers,
  mockReactHooks,
  nextUpdatedAt,
  productId,
  reason,
  response,
  updatedAt,
} from "./helpers/resource-moderation-controls-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../site/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: harness.refresh }),
}));
vi.mock("../site/src/components/locale-context", async () => {
  const { getDictionary } = await import("../site/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en" as const, dictionary: getDictionary("en") }),
  };
});

import { ResourceModerationControls } from "../site/src/components/resource-moderation-controls";
import { getResourceReleaseControlCopy } from "../site/src/lib/resource-release-control-i18n";

const { render, submit, seedSuspend } = createResourceModerationControlsConfirmInteractionHelpers(
  harness,
  ResourceModerationControls,
  confirmAction,
);

it("confirms resource suspend before posting the moderation action", async () => {
  const copy = getResourceReleaseControlCopy("en");
  seedSuspend();
  harness.fetch.mockResolvedValueOnce(
    response({
      product: { id: productId, status: "suspended", updatedAt: nextUpdatedAt },
    }),
  );

  await submit(render("published"));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.suspend,
    object: productId,
    consequences: copy.confirmSuspend,
    confirmLabel: copy.suspend,
    cancelLabel: copy.back,
    closeLabel: copy.back,
  });
  expect(harness.fetch).toHaveBeenCalledWith(
    `/api/admin/resources/${productId}`,
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        action: "suspend",
        reason,
        expectedUpdatedAt: updatedAt,
      }),
    }),
  );
  expect(harness.refresh).toHaveBeenCalledOnce();
});

it("does not suspend a resource when confirmation is cancelled", async () => {
  const copy = getResourceReleaseControlCopy("en");
  seedSuspend();
  const slotsBefore = structuredClone(harness.slots);
  confirmAction.mockResolvedValueOnce(false);

  await submit(render("published"));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.suspend,
    object: productId,
    consequences: copy.confirmSuspend,
    confirmLabel: copy.suspend,
    cancelLabel: copy.back,
    closeLabel: copy.back,
  });
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(harness.slots).toEqual(slotsBefore);
});
