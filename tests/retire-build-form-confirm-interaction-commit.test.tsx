import { expect, it, vi } from "vitest";
import {
  buildId,
  createRetireBuildFormConfirmInteractionHelpers,
  mockReactHooks,
  productId,
  reason,
  response,
  revision,
  version,
} from "./helpers/retire-build-form-confirm-interaction-harness";

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

import { RetireBuildForm } from "../apps/web/src/components/author-resource-forms";
import { getDictionary } from "../apps/web/src/lib/i18n";

const { render, submit } = createRetireBuildFormConfirmInteractionHelpers(
  harness,
  RetireBuildForm,
  confirmAction,
);

it("confirms build retirement before PATCH", async () => {
  const copy = getDictionary("en").authorResources;
  harness.fetch.mockResolvedValueOnce(
    response({
      build: {
        id: buildId,
        productId,
        status: "retired",
      },
    }),
  );

  await submit(render());

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.retireConfirmTitle,
    object: version,
    consequences: copy.retireHint,
    confirmLabel: copy.retire,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: true,
  });
  expect(harness.fetch).toHaveBeenCalledWith(
    `/api/products/${productId}/builds/${buildId}`,
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({
        action: "retire",
        expectedRevision: revision,
        reason,
      }),
    }),
  );
  expect(harness.refresh).toHaveBeenCalledOnce();
});
