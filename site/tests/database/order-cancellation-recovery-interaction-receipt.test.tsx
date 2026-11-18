import { expect, it, vi } from "vitest";
import { getDictionary } from "../../src/lib/i18n";
import {
  createOrderCancellationRecoveryInteractionHelpers,
  mockReactHooks,
  reply,
} from "../helpers/order-cancellation-recovery-interaction-harness";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  fetch: vi.fn(),
  refresh: vi.fn(),
  actor: "usr_a",
  canCancel: true,
}));
vi.mock("react", (original) => mockReactHooks(h)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock("../../src/features/shell/locale", () => ({
  useNexusLocale: () => ({ locale: "en", dictionary: getDictionary("en") }),
}));

import { OrderCancellationForm } from "../../src/features/commerce/order-cancellation";

const { render, mount, prepare, submit } = createOrderCancellationRecoveryInteractionHelpers(
  h,
  OrderCancellationForm,
);

it.each(["2026-10-10T12:00:00.000Z", "2026-10-10T11:59:59.999Z"])(
  "keeps the intent when a receipt timestamp is not newer: %s",
  async (cancelledAt) => {
    await mount();
    prepare();
    h.fetch.mockImplementationOnce(async (_url, options) => {
      const command = JSON.parse(options.body);
      return reply({
        actorId: "usr_a",
        kind: "unpaid_order_cancelled",
        orderId: "ord_a",
        requestId: command.requestId,
        cancelledAt,
      });
    });
    await submit();
    expect(sessionStorage.getItem("nexus:order-cancel:v1:usr_a:ord_a")).not.toBeNull();
    expect(h.refresh).not.toHaveBeenCalled();
    expect(
      render().some((n) => n.type === "button" && n.props.children === "Retry the same request"),
    ).toBe(true);
  },
);
