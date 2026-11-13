import { expect, it, vi } from "vitest";
import {
  createRetireBuildFormConfirmInteractionHelpers,
  mockReactHooks,
} from "../helpers/retire-build-form-confirm-interaction-harness";

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

import { RetireBuildForm } from "../../site/src/components/author-resource-forms";

const { render, submit } = createRetireBuildFormConfirmInteractionHelpers(
  harness,
  RetireBuildForm,
  confirmAction,
);

it("does not retire a build when confirmation is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  await submit(render());
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(harness.refresh).not.toHaveBeenCalled();
});
