import { expect, it, vi } from "vitest";
import {
  build,
  createResourceBuildControlsConfirmInteractionHelpers,
  mockReactHooks,
  response,
} from "../helpers/resource-build-controls-confirm-interaction-harness";

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
vi.mock("../../site/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" as const }),
}));

import { ResourceBuildControls } from "../../site/src/components/resource-build-controls";
import { getResourceBuildWorkspaceCopy } from "../../site/src/lib/resource-build-workspace-i18n";

const { render, control, reason } = createResourceBuildControlsConfirmInteractionHelpers(
  harness,
  ResourceBuildControls,
  confirmAction,
);

it("confirms withdraw before PATCH", async () => {
  const copy = getResourceBuildWorkspaceCopy("en");
  harness.fetch.mockResolvedValueOnce(
    response({
      build: {
        ...build,
        status: "draft",
        revision: 5,
      },
    }),
  );

  (control(render(), copy.withdraw).props.onClick as () => void)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.withdrawConfirmTitle,
    object: `${build.version} · ${copy.revision} ${build.revision}`,
    consequences: copy.withdrawConfirm,
    confirmLabel: copy.withdraw,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: true,
  });
  expect(harness.fetch).toHaveBeenCalledWith(
    `/api/products/${build.productId}/builds/${build.id}`,
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({
        action: "withdraw",
        expectedRevision: 4,
        reason,
      }),
    }),
  );
});

it("does not withdraw a build when confirmation is cancelled", async () => {
  const copy = getResourceBuildWorkspaceCopy("en");
  confirmAction.mockResolvedValueOnce(false);

  (control(render(), copy.withdraw).props.onClick as () => void)();
  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.withdrawConfirmTitle,
    object: `${build.version} · ${copy.revision} ${build.revision}`,
    consequences: copy.withdrawConfirm,
    confirmLabel: copy.withdraw,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: true,
  });
  expect(harness.fetch).not.toHaveBeenCalled();
});
