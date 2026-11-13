import { AppError } from "@nexus/domain";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  locale: "en" as "en" | "ru",
  staff: vi.fn(),
  staffDetail: vi.fn(),
  publisher: vi.fn(),
  managed: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/admin/resources",
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
      React.createElement("a", { href, ...props }, children),
  };
});
vi.mock("../../src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("../../src/lib/i18n-server", () => ({
  getRequestLocale: async () => state.locale,
}));
vi.mock("../../src/lib/services/resource-release-control-service", () => ({
  resourceModerationService: {
    page: state.staff,
    detail: state.staffDetail,
    publisherHistory: state.publisher,
  },
}));
vi.mock("../../src/lib/services/product-service", () => ({
  productService: { getManagedProduct: state.managed },
}));
vi.mock("../../src/components/resource-moderation-controls", () => ({
  ResourceModerationControls: ({ product }: { product: { status: string } }) => (
    <span data-status={product.status}>Moderation</span>
  ),
}));

import StaffDetail from "../../src/app/admin/resources/[id]/page";
import Staff from "../../src/app/admin/resources/page";
import Publisher from "../../src/app/workspace/resources/[id]/moderation/page";
import { getResourceReleaseControlCopy } from "../../src/lib/resource-release-control-i18n";

const input = {
  params: Promise.resolve({ id: "prd_a" }),
  searchParams: Promise.resolve({ page: "2" }),
};
const now = new Date("2026-10-10T12:00:00.000Z"),
  bounds = { page: 2, totalPages: 3, pageSize: 20, total: 41 };
beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: "usr_a", role: "user" };
  state.locale = "en";
  state.staff.mockReset().mockResolvedValue({
    resources: [
      {
        id: "prd_a",
        title: "<Resource>",
        status: "suspended",
        currentVersion: "1.0.0",
        updatedAt: now,
      },
    ],
    ...bounds,
  });
  state.staffDetail.mockReset().mockResolvedValue({
    product: {
      id: "prd_a",
      title: "<Resource>",
      status: "suspended",
      currentVersion: "1.0.0",
      updatedAt: now,
    },
    events: [
      {
        id: "aud_a",
        action: "product.moderation_suspended",
        reason: "<Evidence>",
        createdAt: now,
      },
    ],
    ...bounds,
  });
  state.managed
    .mockReset()
    .mockResolvedValue({ id: "prd_a", title: "<Resource>", status: "suspended" });
  state.publisher.mockReset().mockResolvedValue({
    events: [
      {
        id: "aud_a",
        action: "product.moderation_suspended",
        reason: "<Evidence>",
        createdAt: now,
      },
    ],
    internalNotes: "PRIVATE-STAFF-NOTES",
    ...bounds,
  });
});
it("rejects stale staff privilege before rendering the private queue", async () => {
  await expect(Staff(input)).rejects.toThrow("NEXT_NOT_FOUND");
  expect(state.staff).not.toHaveBeenCalled();
  state.user = { id: "usr_a", role: "moderator" };
  state.staff.mockRejectedValue(new AppError("Revoked", 403, "FORBIDDEN"));
  await expect(Staff(input)).rejects.toThrow("NEXT_NOT_FOUND");
});
it("shows an honest recovery state when staff moderation inventory fails", async () => {
  state.user = { id: "usr_a", role: "moderator" };
  state.staff.mockRejectedValue(new Error("inventory unavailable"));
  const copy = getResourceReleaseControlCopy("en");
  const html = renderToStaticMarkup(await Staff(input));
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.loadUnavailable);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain('href="/admin/resources?page=2"');
  expect(html).not.toContain("&lt;Resource&gt;");
});
it("renders empty staff inventory with clear-filters recovery when filters are active", async () => {
  state.user = { id: "usr_a", role: "moderator" };
  state.staff.mockResolvedValue({
    resources: [],
    page: 1,
    totalPages: 1,
    pageSize: 20,
    total: 0,
  });
  const copy = getResourceReleaseControlCopy("en");
  const filtered = renderToStaticMarkup(
    await Staff({
      searchParams: Promise.resolve({ status: "suspended", query: "alpha", page: "1" }),
    }),
  );
  expect(filtered).toContain(copy.empty);
  expect(filtered).toContain(copy.clearFilters);
  expect(filtered).toContain('href="/admin/resources"');
  expect(filtered).toContain("overflow-x-clip");
});
it("renders staff decisions with resource revision controls and bounded history", async () => {
  state.user = { id: "usr_a", role: "moderator" };
  const html = renderToStaticMarkup(await StaffDetail(input));
  expect(html).toContain('data-status="suspended"');
  expect(html).toContain("&lt;Evidence&gt;");
  expect(html).toContain("page=3");
  expect(html).toContain("overflow-x-clip");
  expect(state.staffDetail).toHaveBeenCalledWith(state.user, "prd_a", 2);
});
it("shows an honest recovery state when staff resource detail fails", async () => {
  state.user = { id: "usr_a", role: "moderator" };
  state.staffDetail.mockRejectedValue(new Error("detail unavailable"));
  const copy = getResourceReleaseControlCopy("en");
  const html = renderToStaticMarkup(await StaffDetail(input));
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.loadUnavailable);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain(`/admin/resources/prd_a?page=2`);
  expect(html).not.toContain("data-status");
});
it("renders empty staff moderation history without inventing events", async () => {
  state.user = { id: "usr_a", role: "moderator" };
  const detail = await state.staffDetail();
  state.staffDetail.mockResolvedValue({ ...detail, events: [], page: 1, totalPages: 1, total: 0 });
  const copy = getResourceReleaseControlCopy("en");
  const html = renderToStaticMarkup(
    await StaffDetail({
      params: Promise.resolve({ id: "prd_a" }),
      searchParams: Promise.resolve({ page: "1" }),
    }),
  );
  expect(html).toContain(copy.empty);
  expect(html).toContain("overflow-x-clip");
  expect(html).not.toContain("&lt;Evidence&gt;");
});
it("shows the author a reason and review requirement without staff action controls", async () => {
  const html = renderToStaticMarkup(await Publisher(input));
  expect(html).toContain("&lt;Evidence&gt;");
  expect(html).toContain("submit a clean version for review");
  expect(html).not.toContain("PRIVATE-STAFF-NOTES");
  expect(html).not.toContain("data-status");
  state.managed.mockResolvedValue(null);
  await expect(Publisher(input)).rejects.toThrow("NEXT_NOT_FOUND");
});
it("shows an honest publisher recovery state when restriction history fails", async () => {
  state.publisher.mockRejectedValue(new Error("history unavailable"));
  const copy = getResourceReleaseControlCopy("en");
  const html = renderToStaticMarkup(await Publisher(input));
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.loadUnavailable);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain("page=2");
});
