import { AppError } from "@nexus/domain";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "developer" } as { id: string; role: string } | null,
  locale: "en" as "en" | "ru",
  preview: vi.fn(),
  page: vi.fn(),
  detail: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
      React.createElement("a", { href, ...props }, children),
  };
});
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/resource-copy-service", () => ({
  resourceCopyService: { preview: state.preview, page: state.page, detail: state.detail },
}));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: state.locale }),
}));

import Detail from "../apps/web/src/app/workspace/resources/[id]/copies/[receiptId]/page";
import History from "../apps/web/src/app/workspace/resources/[id]/copies/page";
import New from "../apps/web/src/app/workspace/resources/[id]/copy/page";
import { resourceCopyCopy } from "../apps/web/src/lib/resource-copy-i18n";
import { date, preview, receipt, receiptId, sourceId } from "./resource-copy-fixtures";

const context = {
  params: Promise.resolve({ id: sourceId, receiptId }),
  searchParams: Promise.resolve({}),
};
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "usr_a", role: "developer" };
  state.locale = "en";
  state.preview.mockResolvedValue(preview);
  state.detail.mockResolvedValue({ receipt, targetStatus: "archived" });
  state.page.mockResolvedValue({
    source: preview.source,
    copies: [{ id: receiptId, createdAt: date, target: receipt.target, targetStatus: "archived" }],
    page: 2,
    totalPages: 3,
    total: 41,
  });
});
it("requires sign-in before reading any private resource data", async () => {
  state.actor = null;
  for (const page of [New, History, Detail]) {
    const html = renderToStaticMarkup(await page(context));
    expect(html).toContain("/auth/login");
    expect(html).not.toContain(receipt.target.title);
  }
  expect(state.preview).not.toHaveBeenCalled();
  expect(state.detail).not.toHaveBeenCalled();
  expect(state.page).not.toHaveBeenCalled();
});
it.each(["ru", "en"] as const)(
  "renders review metadata and form limitations in %s",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(await New(context)),
      copy = resourceCopyCopy(locale);
    expect(html).toContain(copy.title);
    expect(html).toContain(copy.notice);
    expect(html).toContain("core");
    expect(html).toContain("1.6.0");
    expect(html).toContain('maxLength="120"');
  },
);
it("renders frozen metadata separately from the current archived target", async () => {
  const html = renderToStaticMarkup(await Detail(context));
  expect(html).toContain(receipt.target.title);
  expect(html).toContain("Archived");
  expect(html).toContain("Created as an unreviewed draft");
  expect(html).toContain(`/api/products/${sourceId}/copies/${receiptId}/export`);
});
it("supports filtered history, stable pagination and target management", async () => {
  const html = renderToStaticMarkup(
    await History({ ...context, searchParams: Promise.resolve({ days: "30", page: "2" }) }),
  );
  expect(state.page).toHaveBeenCalledWith(state.actor, sourceId, { days: 30, page: 2 });
  expect(html).toContain("page=1&amp;days=30");
  expect(html).toContain("page=3&amp;days=30");
  expect(html).toContain(receipt.target.id);
});
it("escapes source descriptions and copied titles", async () => {
  state.detail.mockResolvedValue({
    receipt: {
      ...receipt,
      target: { ...receipt.target, title: "<script>bad</script>" },
      metadata: { ...receipt.metadata, description: "<img src=x onerror=bad>" },
    },
    targetStatus: "draft",
  });
  const html = renderToStaticMarkup(await Detail(context));
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("<img");
});
it("masks revoked access and rejects invalid query recovery without service reads", async () => {
  state.detail.mockRejectedValue(new AppError("private", 404, "NOT_FOUND"));
  await expect(Detail(context)).rejects.toThrow("NOT_FOUND");
  const html = renderToStaticMarkup(
    await New({ ...context, searchParams: Promise.resolve({ actorId: "other" }) }),
  );
  expect(html).toContain('role="alert"');
  expect(state.preview).not.toHaveBeenCalled();
});
it("renders empty history with valid filters", async () => {
  state.page.mockResolvedValue({
    source: preview.source,
    copies: [],
    page: 1,
    totalPages: 1,
    total: 0,
  });
  const html = renderToStaticMarkup(await History(context));
  expect(html).toContain(resourceCopyCopy("en").empty);
  expect(html).not.toContain("Manage new resource");
});
