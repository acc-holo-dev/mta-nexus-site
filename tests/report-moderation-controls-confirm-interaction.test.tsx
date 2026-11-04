import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
}));
const confirmAction = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../apps/web/src/components/confirm-action", () => ({ confirmAction }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = initial;
    return [
      harness.slots[index],
      (value: unknown) => {
        harness.slots[index] =
          typeof value === "function"
            ? (value as (current: unknown) => unknown)(harness.slots[index])
            : value;
      },
    ];
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: harness.refresh }),
}));
vi.mock("../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../apps/web/src/lib/i18n");
  return {
    useNexusLocale: () => ({ locale: "en" as const, dictionary: getDictionary("en") }),
  };
});

import { ReportModerationControls } from "../apps/web/src/components/report-moderation-controls";
import { communityReportCopy } from "../apps/web/src/lib/community-report-copy";
import { getDictionary } from "../apps/web/src/lib/i18n";

type Element = ReactElement<Record<string, unknown>>;

const reportId = "rep_dddddddddddddddddddddddd";
const notes = "Reviewed evidence and queue notes";

function descendants(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  const type = element.type as { displayName?: string } | string;
  if (typeof type === "object" && type?.displayName === "Button") {
    return [
      { ...element, type: "button" } as Element,
      ...descendants(element.props.children as ReactNode),
    ];
  }
  return [element, ...descendants(element.props.children as ReactNode)];
}

function seedControls() {
  // notes, pending, error
  harness.slots = [notes, null, null];
}

function render() {
  harness.cursor = 0;
  return descendants(ReportModerationControls({ reportId }));
}

function actionButton(nodes: Element[], label: string) {
  const found = nodes.find((node) => {
    if (node.type !== "button") return false;
    const children = node.props.children;
    if (children === label) return true;
    return Array.isArray(children) && children.includes(label);
  });
  if (!found) throw new Error(`Missing ${label}`);
  return found;
}

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  harness.cursor = 0;
  seedControls();
  confirmAction.mockResolvedValue(true);
  harness.fetch.mockReset();
  harness.refresh.mockReset();
  vi.stubGlobal("fetch", harness.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("confirms report resolve before posting the admin action", async () => {
  const copy = getDictionary("en").admin;
  const labels = communityReportCopy("en");
  harness.fetch.mockResolvedValueOnce(
    response({ success: true, targetId: reportId, action: "resolve" }),
  );

  (actionButton(render(), copy.resolveReport).props.onClick as () => void)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.resolveReport,
    object: reportId,
    consequences: copy.resolveReportConfirm,
    confirmLabel: copy.resolveReport,
    cancelLabel: labels.cancel,
    closeLabel: labels.cancel,
    danger: false,
  });
  expect(harness.fetch).toHaveBeenCalledWith(
    "/api/admin/actions",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        targetType: "report",
        targetId: reportId,
        action: "resolve",
        notes,
      }),
    }),
  );
  expect(harness.refresh).toHaveBeenCalledOnce();
});

it("confirms report dismiss before posting the admin action", async () => {
  const copy = getDictionary("en").admin;
  const labels = communityReportCopy("en");
  seedControls();
  harness.fetch.mockResolvedValueOnce(
    response({ success: true, targetId: reportId, action: "dismiss" }),
  );

  (actionButton(render(), copy.dismissReport).props.onClick as () => void)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.dismissReport,
    object: reportId,
    consequences: copy.dismissReportConfirm,
    confirmLabel: copy.dismissReport,
    cancelLabel: labels.cancel,
    closeLabel: labels.cancel,
  });
  expect(harness.fetch).toHaveBeenCalledWith(
    "/api/admin/actions",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        targetType: "report",
        targetId: reportId,
        action: "dismiss",
        notes,
      }),
    }),
  );
  expect(harness.refresh).toHaveBeenCalledOnce();
});

it("skips resolve and dismiss when confirmation is cancelled", async () => {
  const copy = getDictionary("en").admin;
  confirmAction.mockResolvedValue(false);

  (actionButton(render(), copy.resolveReport).props.onClick as () => void)();
  seedControls();
  (actionButton(render(), copy.dismissReport).props.onClick as () => void)();

  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(2));
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(harness.refresh).not.toHaveBeenCalled();
});
