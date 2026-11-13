import { expect, it, vi } from "vitest";
import {
  createResourceModerationControlsConfirmInteractionHelpers,
  mockReactHooks,
  nextUpdatedAt,
  productId,
  reason,
  response,
  updatedAt,
} from "../helpers/resource-moderation-controls-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../../src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: harness.refresh }),
}));
vi.mock("../../src/components/locale-context", async () => {
  const { getDictionary } = await import("../../src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en" as const, dictionary: getDictionary("en") }),
  };
});

import { ResourceModerationControls } from "../../src/components/resource-moderation-controls";
import { getResourceReleaseControlCopy } from "../../src/lib/resource-release-control-i18n";

const { render, submit, seedRelease } = createResourceModerationControlsConfirmInteractionHelpers(
  harness,
  ResourceModerationControls,
  confirmAction,
);

it("confirms resource release before posting the moderation action", async () => {
  const copy = getResourceReleaseControlCopy("en");
  seedRelease();
  harness.fetch.mockResolvedValueOnce(
    response({
      product: { id: productId, status: "draft", updatedAt: nextUpdatedAt },
    }),
  );

  await submit(render("suspended"));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.release,
    object: productId,
    consequences: copy.confirmRelease,
    confirmLabel: copy.release,
    cancelLabel: copy.back,
    closeLabel: copy.back,
    danger: false,
  });
  expect(harness.fetch).toHaveBeenCalledWith(
    `/api/admin/resources/${productId}`,
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        action: "release",
        reason,
        expectedUpdatedAt: updatedAt,
      }),
    }),
  );
  expect(harness.refresh).toHaveBeenCalledOnce();
});

it("does not release a resource when confirmation is cancelled", async () => {
  const copy = getResourceReleaseControlCopy("en");
  seedRelease();
  const slotsBefore = structuredClone(harness.slots);
  confirmAction.mockResolvedValueOnce(false);

  await submit(render("suspended"));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.release,
    object: productId,
    consequences: copy.confirmRelease,
    confirmLabel: copy.release,
    cancelLabel: copy.back,
    closeLabel: copy.back,
    danger: false,
  });
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(harness.refresh).not.toHaveBeenCalled();
  expect(harness.slots).toEqual(slotsBefore);
});
