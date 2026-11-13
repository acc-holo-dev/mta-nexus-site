import { expect, it, vi } from "vitest";
import {
  createServerReviewPanelConfirmInteractionHelpers,
  emptyPage,
  mockReactHooks,
  response,
  reviewText,
  serverId,
} from "../helpers/server-review-panel-confirm-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));

vi.mock("../../src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({
  usePathname: () => "/servers/demo",
  useRouter: () => ({ refresh: harness.refresh }),
}));
vi.mock("../../src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: "en" as const }),
}));

import { ServerReviewPanel } from "../../src/components/server-review-panel";
import { serverReviewCopy } from "../../src/lib/server-review-i18n";

const { render, control } = createServerReviewPanelConfirmInteractionHelpers(
  harness,
  ServerReviewPanel,
  confirmAction,
);

it("withdraws a server review only after confirmAction approves", async () => {
  const copy = serverReviewCopy("en");
  harness.fetch
    .mockResolvedValueOnce(
      response({ id: "cmt_server", revision: 3, status: "withdrawn", success: true }),
    )
    .mockResolvedValueOnce(response(emptyPage));

  await (control(render(), copy.withdraw).props.onClick as () => Promise<void>)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalled());

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.withdrawConfirmTitle,
    object: reviewText,
    consequences: copy.withdrawConfirm,
    confirmLabel: copy.withdraw,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: true,
  });
  expect(harness.fetch.mock.calls[0]?.[0]).toBe(`/api/servers/${serverId}/reviews`);
  expect(JSON.parse(String(harness.fetch.mock.calls[0]?.[1]?.body))).toMatchObject({
    action: "withdraw",
    expectedRevision: 2,
  });
});
