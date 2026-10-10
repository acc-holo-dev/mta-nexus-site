import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NotFoundError } from "@nexus/domain";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "usr_a", role: "user" } as null | { id: string; role: "user" },
  locale: "en" as "en" | "ru",
  history: vi.fn(),
  report: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({
      href,
      children,
      ...rest
    }: {
      href: string;
      children: ReactNode;
      [key: string]: unknown;
    }) => React.createElement("a", { href, ...rest }, children),
  };
});
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/resource-activity-service", () => ({
  resourceActivityService: { buyerHistory: state.history, publisherReport: state.report },
}));

import History, { metadata as historyMeta } from "../apps/web/src/app/workspace/acquisitions/page";
import Activity, {
  metadata as activityMeta,
} from "../apps/web/src/app/workspace/resources/[id]/activity/page";
import {
  acquisitionPage,
  acquisitionSource,
  resourceActivityDays,
} from "../apps/web/src/lib/resource-activity-view";

const now = new Date("2026-10-10T12:00:00Z");
beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: "usr_a", role: "user" };
  state.locale = "en";
  state.history
    .mockReset()
    .mockResolvedValue({
      items: [
        {
          id: "ent_a",
          productId: "prd_a",
          source: "cart",
          acquiredAt: now,
          title: "PRIVATE-DRAFT-TITLE",
          slug: "private-draft",
          hasCurrentAccess: true,
          downloadable: false,
          requestId: "PRIVATE-REQUEST",
          licenseKey: "PRIVATE-KEY",
        },
      ],
      total: 21,
      page: 2,
      totalPages: 2,
      filter: "cart",
    });
  state.report
    .mockReset()
    .mockResolvedValue({
      product: {
        id: "prd_a",
        title: "<script>Title</script>",
        status: "published",
        privateField: "PRIVATE-PUBLISHER",
      },
      days: 7,
      from: now,
      through: now,
      acquisitions: 2,
      direct: 1,
      cart: 1,
      retainedGrants: 2,
      downloadStarts: 4,
      timeline: [{ day: "2026-10-10", acquisitions: 2, downloadStarts: 4 }],
      buyerIdentity: "PRIVATE-BUYER",
    });
});
const historyInput = { searchParams: Promise.resolve({ page: "2", source: "cart" }) };
const activityInput = {
  params: Promise.resolve({ id: "prd_a" }),
  searchParams: Promise.resolve({ days: "7" }),
};

it("keeps acquisition history private and paginated without rendering withdrawn metadata", async () => {
  const html = renderToStaticMarkup(await History(historyInput));
  expect(state.history).toHaveBeenCalledWith(state.user, 2, "cart");
  expect(html).toContain("Resource unavailable");
  expect(html).toContain("source=cart&amp;page=1");
  expect(html).not.toContain("PRIVATE-");
  expect(html).not.toContain("/market/private-draft");
  expect(historyMeta.robots).toEqual({ index: false, follow: false });
});
it("renders only escaped publisher aggregates and bounded period/export links", async () => {
  const html = renderToStaticMarkup(await Activity(activityInput));
  expect(state.report).toHaveBeenCalledWith(state.user, "prd_a", 7);
  expect(html).toContain("&lt;script&gt;Title&lt;/script&gt;");
  expect(html).not.toContain("PRIVATE-");
  expect(html).toContain("activity?days=365");
  expect(html).toContain("/activity/export?days=7");
  expect(html).toContain("Daily activity (UTC)");
  expect(html).toContain('scope="col"');
  expect(activityMeta.robots).toEqual({ index: false, follow: false });
});
it.each(["ru", "en"] as const)("supports %s acquisition and publisher copy", async (locale) => {
  state.locale = locale;
  const buyer = renderToStaticMarkup(await History(historyInput));
  const seller = renderToStaticMarkup(await Activity(activityInput));
  expect(buyer).toContain(locale === "ru" ? "История приобретений" : "Acquisition history");
  expect(seller).toContain(locale === "ru" ? "Новые бесплатные права" : "New free grants");
});
it("does not query commerce data before login", async () => {
  state.user = null;
  expect(renderToStaticMarkup(await History(historyInput))).toContain("/auth/login");
  expect(renderToStaticMarkup(await Activity(activityInput))).toContain("/auth/login");
  expect(state.history).not.toHaveBeenCalled();
  expect(state.report).not.toHaveBeenCalled();
});
it("hides activity when current management permission is lost", async () => {
  state.report.mockRejectedValue(new NotFoundError("Resource", "prd_a"));
  await expect(Activity(activityInput)).rejects.toThrow("NEXT_NOT_FOUND");
});
it("normalizes ambiguous UI filters without accepting unsupported periods", () => {
  expect(acquisitionSource(["cart", "direct"])).toBe("all");
  expect(acquisitionPage("-1")).toBe(1);
  expect(acquisitionPage("Infinity")).toBe(1);
  expect(resourceActivityDays("8")).toBe(30);
  expect(resourceActivityDays(["7", "30"])).toBe(30);
});
