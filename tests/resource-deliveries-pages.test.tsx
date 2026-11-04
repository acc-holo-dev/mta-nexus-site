import { AppError } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "usr_a" } as { id: string } | null,
  locale: "en" as "en" | "ru",
  page: vi.fn(),
  detail: vi.fn(),
  publisher: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/workspace/library/downloads/dlv_a",
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("../apps/web/src/lib/services/resource-deliveries-service", () => ({
  resourceDeliveriesService: { page: state.page, detail: state.detail, publisher: state.publisher },
}));
vi.mock("../apps/web/src/components/resource-download-button", () => ({
  ResourceDownloadButton: ({ productId, buildId }: { productId: string; buildId: string }) => (
    <button type="button" data-product={productId} data-build={buildId}>
      download
    </button>
  ),
}));

import Detail from "../apps/web/src/app/workspace/library/downloads/[id]/page";
import Page from "../apps/web/src/app/workspace/library/downloads/page";
import Publisher from "../apps/web/src/app/workspace/resources/[id]/deliveries/page";
import { resourceDeliveriesCopy } from "../apps/web/src/lib/resource-deliveries-i18n";

const context = { params: Promise.resolve({ id: "dlv_a" }) };
beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: "usr_a" };
  state.locale = "en";
  const receipt = {
    id: "dlv_a",
    resourceId: "prd_a",
    buildId: "bld_old",
    version: "1.0.0",
    sha256Hash: "a".repeat(64),
    expectedBytes: 7,
    bytesSent: 3,
    status: "cancelled",
    errorCode: null,
    pinned: true,
    startedAt: new Date("2026-10-11T00:00:00Z"),
    finishedAt: new Date("2026-10-11T00:00:01Z"),
    title: "<Archive>",
    downloadable: true,
    userId: "DO_NOT_RENDER",
    storageKey: "DO_NOT_RENDER",
  };
  state.detail.mockResolvedValue(receipt);
  state.page.mockResolvedValue({
    items: [receipt],
    counts: { all: 22, started: 1, served: 9, cancelled: 11, failed: 1 },
    page: 2,
    totalPages: 3,
  });
  state.publisher.mockResolvedValue({
    product: { id: "prd_a", title: "<Archive>" },
    counts: { all: 22, started: 1, served: 9, cancelled: 11, failed: 1 },
    items: [
      {
        buildId: "bld_old",
        version: "1.0.0",
        started: 1,
        served: 9,
        cancelled: 11,
        failed: 1,
        lastStartedAt: new Date("2026-10-11T00:00:00Z"),
      },
    ],
    page: 2,
    totalPages: 3,
  });
});
it.each(["en", "ru"] as const)(
  "renders localized evidence, exact-version retry and stable filter links (%s)",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(
      await Page({
        searchParams: Promise.resolve({
          days: "30",
          status: "cancelled",
          resourceId: "prd_a",
          page: "2",
        }),
      }),
    );
    expect(html).toContain("&lt;Archive&gt;");
    expect(html).toContain('data-build="bld_old"');
    expect(html).toContain("days=30");
    expect(html).toContain("resourceId=prd_a");
    expect(html).toContain("/api/library/downloads/export?");
    expect(html).not.toContain("DO_NOT_RENDER");
    expect(html).toContain(locale === "ru" ? "сохранение архива" : "whether your browser saved");
    const detail = renderToStaticMarkup(await Detail(context));
    expect(detail).toContain("dlv_a");
    expect(detail).toContain('data-build="bld_old"');
    expect(detail).not.toContain("DO_NOT_RENDER");
  },
);
it("withdrawn access keeps private evidence but removes retry", async () => {
  const row = await state.detail();
  state.detail.mockResolvedValue({ ...row, title: null, downloadable: false });
  const html = renderToStaticMarkup(await Detail(context));
  expect(html).toContain("Resource currently unavailable");
  expect(html).not.toContain("<button");
  expect(html).not.toContain("Archive&gt;");
});
it("publisher summary contains aggregate states and preserves the chosen period", async () => {
  const html = renderToStaticMarkup(
    await Publisher({
      params: Promise.resolve({ id: "prd_a" }),
      searchParams: Promise.resolve({ days: "7", page: "2" }),
    }),
  );
  expect(html).toContain("without buyer identities");
  expect(html).toContain("days=7");
  expect(html).toContain("1.0.0");
  expect(html).not.toContain("DO_NOT_RENDER");
  expect(html).toContain('scope="col"');
});
it("distinguishes empty inventory from filtered download history", async () => {
  state.page.mockResolvedValueOnce({
    items: [],
    counts: { all: 0, started: 0, served: 0, cancelled: 0, failed: 0 },
    page: 1,
    totalPages: 1,
  });
  const never = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  expect(never).toContain(resourceDeliveriesCopy("en").emptyNever);
  expect(never).not.toContain(resourceDeliveriesCopy("en").clearFilters);

  state.page.mockResolvedValueOnce({
    items: [],
    counts: { all: 4, started: 1, served: 2, cancelled: 1, failed: 0 },
    page: 1,
    totalPages: 1,
  });
  const filtered = renderToStaticMarkup(
    await Page({ searchParams: Promise.resolve({ status: "failed" }) }),
  );
  expect(filtered).toContain(resourceDeliveriesCopy("en").emptyFiltered);
  expect(filtered).toContain(resourceDeliveriesCopy("en").clearFilters);
  expect(filtered).not.toContain(resourceDeliveriesCopy("en").emptyNever);

  state.page.mockResolvedValueOnce({
    items: [],
    counts: { all: 4, started: 1, served: 2, cancelled: 1, failed: 0 },
    page: 3,
    totalPages: 3,
  });
  const emptyPage = renderToStaticMarkup(
    await Page({ searchParams: Promise.resolve({ page: "3" }) }),
  );
  expect(emptyPage).toContain(resourceDeliveriesCopy("en").emptyFiltered);
  expect(emptyPage).toContain(resourceDeliveriesCopy("en").clearFilters);
  expect(emptyPage).not.toContain(resourceDeliveriesCopy("en").emptyNever);
});
it("distinguishes empty publisher inventory from filtered version summary", async () => {
  state.publisher.mockResolvedValueOnce({
    product: { id: "prd_a", title: "Archive" },
    counts: { all: 0, started: 0, served: 0, cancelled: 0, failed: 0 },
    items: [],
    page: 1,
    totalPages: 1,
  });
  const never = renderToStaticMarkup(
    await Publisher({
      params: Promise.resolve({ id: "prd_a" }),
      searchParams: Promise.resolve({}),
    }),
  );
  expect(never).toContain(resourceDeliveriesCopy("en").publisherEmptyNever);
  expect(never).not.toContain(resourceDeliveriesCopy("en").clearFilters);

  state.publisher.mockResolvedValueOnce({
    product: { id: "prd_a", title: "Archive" },
    counts: { all: 4, started: 1, served: 2, cancelled: 1, failed: 0 },
    items: [],
    page: 1,
    totalPages: 1,
  });
  const filtered = renderToStaticMarkup(
    await Publisher({
      params: Promise.resolve({ id: "prd_a" }),
      searchParams: Promise.resolve({ days: "7" }),
    }),
  );
  expect(filtered).toContain(resourceDeliveriesCopy("en").emptyFiltered);
  expect(filtered).toContain(resourceDeliveriesCopy("en").clearFilters);
  expect(filtered).toContain("days=all");
  expect(filtered).not.toContain(resourceDeliveriesCopy("en").publisherEmptyNever);
});
it("authenticates before reading or validating account histories", async () => {
  state.user = null;
  expect(
    renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ owner: "other" }) })),
  ).toContain('href="/auth/login?next=%2Fworkspace%2Flibrary%2Fdownloads"');
  expect(renderToStaticMarkup(await Detail(context))).toContain(
    'href="/auth/login?next=%2Fworkspace%2Flibrary%2Fdownloads%2Fdlv_a"',
  );
  expect(state.page).not.toHaveBeenCalled();
  expect(state.detail).not.toHaveBeenCalled();
});
it("invalid filters cause no repository query and foreign receipt IDs are not found", async () => {
  expect(
    renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ days: ["7", "30"] }) })),
  ).toContain("Invalid filters");
  expect(state.page).not.toHaveBeenCalled();
  state.detail.mockRejectedValue(new AppError("private", 404, "NOT_FOUND"));
  await expect(Detail(context)).rejects.toThrow("NEXT_NOT_FOUND");
  await expect(Detail({ params: Promise.resolve({ id: "bad" }) })).rejects.toThrow(
    "NEXT_NOT_FOUND",
  );
});
it("shows an honest publisher recovery state when delivery evidence fails", async () => {
  state.publisher.mockRejectedValue(new Error("publisher unavailable"));
  const copy = resourceDeliveriesCopy("en");
  const html = renderToStaticMarkup(
    await Publisher({
      params: Promise.resolve({ id: "prd_a" }),
      searchParams: Promise.resolve({ days: "7", page: "2" }),
    }),
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.loadUnavailable);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain("days=7");
});
