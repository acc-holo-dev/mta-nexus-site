import { expect, it, vi } from "vitest";
import {
  createServerReviewPanelConfirmInteractionHelpers,
  mockReactHooks,
  reviewText,
} from "../helpers/server-review-panel-confirm-interaction-harness";

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
  usePathname: () => "/servers/demo",
  useRouter: () => ({ refresh: harness.refresh }),
}));
vi.mock("../../site/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" as const }),
}));

import { ServerReviewPanel } from "../../site/src/components/server-review-panel";
import { serverReviewCopy } from "../../site/src/lib/server-review-i18n";

const { render, control } = createServerReviewPanelConfirmInteractionHelpers(
  harness,
  ServerReviewPanel,
  confirmAction,
);

it("does not withdraw a server review when confirmAction is cancelled", async () => {
  const copy = serverReviewCopy("en");
  confirmAction.mockResolvedValueOnce(false);
  await (control(render(), copy.withdraw).props.onClick as () => Promise<void>)();
  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.withdrawConfirmTitle,
    object: reviewText,
    consequences: copy.withdrawConfirm,
    confirmLabel: copy.withdraw,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: true,
  });
  expect(harness.fetch).not.toHaveBeenCalled();
});
