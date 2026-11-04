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

import { BuildQuarantineControls } from "../apps/web/src/components/build-quarantine-controls";
import { getDictionary } from "../apps/web/src/lib/i18n";
import { verificationCopy } from "../apps/web/src/lib/verification-workspace-copy";

type Element = ReactElement<Record<string, unknown>>;

const buildId = "bld_cccccccccccccccccccccccc";
const reason = "Evidence for operator review";

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

function seedControls(notifyAffectedDownloaders = false) {
  // reason, notifyAffectedDownloaders, pending, error
  harness.slots = [reason, notifyAffectedDownloaders, null, null];
}

function render(status: "published" | "quarantined") {
  harness.cursor = 0;
  return descendants(BuildQuarantineControls({ buildId, status }));
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

it("confirms quarantine before posting the admin action", async () => {
  const copy = getDictionary("en").admin;
  const labels = verificationCopy("en");
  harness.fetch.mockResolvedValueOnce(
    response({ success: true, targetId: buildId, action: "quarantine" }),
  );

  (actionButton(render("published"), copy.quarantineBuild).props.onClick as () => void)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.quarantineBuild,
    object: buildId,
    consequences: copy.quarantineBuildConfirm,
    confirmLabel: copy.quarantineBuild,
    cancelLabel: labels.cancel,
    closeLabel: labels.cancel,
  });
  expect(harness.fetch).toHaveBeenCalledWith(
    "/api/admin/actions",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        targetType: "build",
        targetId: buildId,
        action: "quarantine",
        notes: reason,
        notifyAffectedDownloaders: false,
      }),
    }),
  );
  expect(harness.refresh).toHaveBeenCalledOnce();
});

it("confirms quarantine with downloader notify copy when the checkbox is set", async () => {
  const copy = getDictionary("en").admin;
  const labels = verificationCopy("en");
  seedControls(true);
  harness.fetch.mockResolvedValueOnce(
    response({ success: true, targetId: buildId, action: "quarantine" }),
  );

  (actionButton(render("published"), copy.quarantineBuild).props.onClick as () => void)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.quarantineBuild,
    object: buildId,
    consequences: copy.quarantineBuildNotifyConfirm,
    confirmLabel: copy.quarantineBuild,
    cancelLabel: labels.cancel,
    closeLabel: labels.cancel,
  });
  expect(harness.fetch).toHaveBeenCalledWith(
    "/api/admin/actions",
    expect.objectContaining({
      body: JSON.stringify({
        targetType: "build",
        targetId: buildId,
        action: "quarantine",
        notes: reason,
        notifyAffectedDownloaders: true,
      }),
    }),
  );
});

it("confirms restore before posting the admin action", async () => {
  const copy = getDictionary("en").admin;
  const labels = verificationCopy("en");
  harness.fetch.mockResolvedValueOnce(
    response({ success: true, targetId: buildId, action: "restore" }),
  );

  (actionButton(render("quarantined"), copy.restoreBuild).props.onClick as () => void)();
  await vi.waitFor(() => expect(harness.fetch).toHaveBeenCalledTimes(1));

  expect(confirmAction).toHaveBeenCalledWith({
    title: copy.restoreBuild,
    object: buildId,
    consequences: copy.restoreBuildConfirm,
    confirmLabel: copy.restoreBuild,
    cancelLabel: labels.cancel,
    closeLabel: labels.cancel,
    danger: false,
  });
  expect(harness.fetch).toHaveBeenCalledWith(
    "/api/admin/actions",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        targetType: "build",
        targetId: buildId,
        action: "restore",
        notes: reason,
      }),
    }),
  );
  expect(harness.refresh).toHaveBeenCalledOnce();
});

it("skips quarantine and restore when confirmation is cancelled", async () => {
  const copy = getDictionary("en").admin;
  confirmAction.mockResolvedValue(false);

  (actionButton(render("published"), copy.quarantineBuild).props.onClick as () => void)();
  seedControls();
  (actionButton(render("quarantined"), copy.restoreBuild).props.onClick as () => void)();

  await vi.waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(2));
  expect(harness.fetch).not.toHaveBeenCalled();
  expect(harness.refresh).not.toHaveBeenCalled();
});
