import { expect, it, vi } from "vitest";
import {
  createResourceLifecycleControlsConfirmInteractionHelpers,
  mockReactHooks,
  nextUpdatedAt,
  productId,
  reason,
  response,
  updatedAt,
} from "./helpers/resource-lifecycle-controls-confirm-interaction-harness";

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

import { ResourceLifecycleControls } from "../site/src/components/resource-lifecycle-controls";
import { getResourceCommerceCopy } from "../site/src/lib/resource-commerce-i18n";

const { render, submit, seedControls } = createResourceLifecycleControlsConfirmInteractionHelpers(
  harness,
  ResourceLifecycleControls,
  confirmAction,
);

it("confirms resource archive before posting the lifecycle action", async () => {
  const copy = getResourceCommerceCopy("en");
  seedControls("published", "archive");
  harness.fetch.mockResolvedValueOnce(
    response({
      product: {
        id: productId,
        status: "archived",
        updatedAt: nextUpdatedAt,
      },
    }),
  );

  await submit(render("published"));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.archive,
    object: productId,
    consequences: copy.archiveNote,
    confirmLabel: copy.archive,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
  });
  expect(harness.fetch).toHaveBeenCalledWith(
    `/api/products/${productId}/lifecycle`,
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        action: "archive",
        expectedUpdatedAt: updatedAt,
        reason,
      }),
    }),
  );
  expect(harness.refresh).toHaveBeenCalledOnce();
});
