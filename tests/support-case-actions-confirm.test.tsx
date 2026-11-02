import type { ReactElement, ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../apps/web/src/components/confirm-action", () => ({ confirmAction }));

import { SupportCaseActions } from "../apps/web/src/components/support-case-actions";
import { getDictionary } from "../apps/web/src/lib/i18n";
import { supportWorkspaceCopy } from "../apps/web/src/lib/support-workspace-copy";

const supportCase = {
  id: `sup_${"a".repeat(24)}`,
  category: "account" as const,
  subject: "Access",
  status: "open" as const,
  updatedAt: "2026-10-11T00:00:00.000Z",
};

type Element = ReactElement<Record<string, unknown>>;

function buttons(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(buttons);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  const type = element.type as { displayName?: string } | string;
  if (typeof type === "object" && type?.displayName === "Button") {
    return [{ ...element, type: "button" } as Element];
  }
  return buttons(element.props.children as ReactNode);
}

function render(staff = false) {
  return buttons(
    SupportCaseActions({
      supportCase,
      staff,
      requester: true,
      busy: false,
      locale: "en",
      onChangeStatus: onChangeStatus,
    }),
  );
}

const onChangeStatus = vi.fn();

beforeEach(() => {
  confirmAction.mockReset();
  confirmAction.mockResolvedValue(true);
  onChangeStatus.mockReset();
});

it("confirms a requester status change before applying it", async () => {
  const copy = supportWorkspaceCopy("en");
  const action = buttons(
    SupportCaseActions({
      supportCase,
      staff: false,
      requester: true,
      busy: false,
      locale: "en",
      onChangeStatus,
    }),
  ).find((node) => node.props.children === copy.resolveOwn);
  if (!action) throw new Error("missing resolve control");
  await (action.props.onClick as () => Promise<void>)();
  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.confirmStatus,
    object: supportCase.subject,
    consequences: copy.confirmStatusNote,
    confirmLabel: copy.resolveOwn,
    cancelLabel: copy.cancel,
    closeLabel: copy.cancel,
    danger: false,
  });
  expect(onChangeStatus).toHaveBeenCalledWith("resolved");
});

it("does not change status when confirmation is cancelled", async () => {
  confirmAction.mockResolvedValueOnce(false);
  const [action] = render();
  if (!action) throw new Error("missing action");
  await (action.props.onClick as () => Promise<void>)();
  expect(onChangeStatus).not.toHaveBeenCalled();
});

it("marks staff close as a dangerous confirmation", async () => {
  const close = getDictionary("en").support.close;
  const action = render(true).find((node) => node.props.children === close);
  if (!action) throw new Error("missing close control");
  await (action.props.onClick as () => Promise<void>)();
  expect(confirmAction).toHaveBeenCalledWith(
    expect.objectContaining({ danger: true, confirmLabel: close }),
  );
  expect(onChangeStatus).toHaveBeenCalledWith("closed");
});
