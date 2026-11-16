import { AppError } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  actor: { id: "usr_admin", role: "admin" } as { id: string; role: string } | null,
  locale: "en",
  list: vi.fn(),
  detail: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/admin/storage",
}));
vi.mock("../../src/lib/i18n-server", () => ({
  getRequestLocale: async () => state.locale,
}));
vi.mock("../../src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../../src/lib/services/storage-maintenance-service", () => ({
  storageMaintenanceService: { list: state.list, detail: state.detail },
}));

import ListLoading from "../../src/app/admin/storage/loading";
import DetailLoading from "../../src/app/admin/storage/objects/[id]/loading";
import Detail from "../../src/app/admin/storage/objects/[id]/page";
import Page from "../../src/app/admin/storage/page";
import { StorageCleanupControls } from "../../src/components/storage-maintenance-controls";
import { storageMaintenanceCopy } from "../../src/lib/storage-maintenance-i18n";

const stamp = new Date("2026-10-01T00:00:00Z"),
  item = {
    id: "smo_a",
    storageKey: "assets/usr_a/ast_a.zip",
    identity: { sizeBytes: 16, sha256Hash: "a".repeat(64) },
    state: "observed",
    revision: 1,
    modifiedAt: stamp,
    observedAt: stamp,
    retiredAt: null,
    leaseExpiresAt: null,
    eligible: true,
    referenced: false,
    resultCode: null,
  };
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "usr_admin", role: "admin" };
  state.locale = "en";
  state.list.mockResolvedValue({ items: [item], deletedBytes: "0", page: 1, totalPages: 2 });
  state.detail.mockResolvedValue(item);
});
it.each(["en", "ru"])("renders discovery, private journal and inspection in %s", async (locale) => {
  state.locale = locale;
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  expect(html).toContain(locale === "ru" ? "Обслуживание хранилища" : "Storage maintenance");
  expect(html).toContain("/admin/storage/objects/smo_a");
  expect(html).toContain('type="number"');
  expect(html).toContain(locale === "ru" ? "Показать каталоги" : "List directories");
  expect(html).toContain(locale === "ru" ? "Сканировать окно" : "Scan window");
  expect(html).toContain("bg-accent text-white");
  expect(html).toContain("view=all&amp;page=2");
  expect(html).toContain("overflow-x-clip");
});
it("does not load journal data for moderators or signed-out visitors", async () => {
  state.actor = null;
  expect(renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }))).toContain(
    'href="/auth/login?next=%2Fadmin%2Fstorage"',
  );
  state.actor = { id: "usr_mod", role: "moderator" };
  await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND");
  expect(state.list).not.toHaveBeenCalled();
});
it("requires an initially unchecked confirmation before cleanup", () => {
  const html = renderToStaticMarkup(
    <StorageCleanupControls actorId="usr_admin" id="smo_a" revision={1} locale="en" />,
  );
  expect(html).toContain('type="checkbox"');
  expect(html).not.toContain("checked=");
  expect(html).toContain('disabled=""');
  expect(html).toContain("bg-danger-solid");
  expect(html).toContain("Deletion is irreversible");
});
it("omits cleanup for referenced objects", async () => {
  state.detail.mockResolvedValue({ ...item, referenced: true, eligible: false });
  const html = renderToStaticMarkup(await Detail({ params: Promise.resolve({ id: item.id }) }));
  expect(html).not.toContain('type="checkbox"');
});
it("permits an expired uncertain outcome to retry but not an active lease", async () => {
  state.detail.mockResolvedValue({
    ...item,
    state: "retired",
    eligible: false,
    leaseExpiresAt: new Date(Date.now() + 60000),
  });
  expect(
    renderToStaticMarkup(await Detail({ params: Promise.resolve({ id: item.id }) })),
  ).not.toContain('type="checkbox"');
  state.detail.mockResolvedValue({
    ...item,
    state: "retired",
    eligible: false,
    leaseExpiresAt: stamp,
  });
  expect(
    renderToStaticMarkup(await Detail({ params: Promise.resolve({ id: item.id }) })),
  ).toContain('type="checkbox"');
});
it("preserves terminal changed states without offering automatic deletion", async () => {
  state.detail.mockResolvedValue({ ...item, state: "changed", eligible: false, retiredAt: stamp });
  const html = renderToStaticMarkup(await Detail({ params: Promise.resolve({ id: item.id }) }));
  expect(html).toContain("Changed — preserved");
  expect(html).not.toContain('type="checkbox"');
  expect(html).toContain("overflow-x-clip");
});
it("surfaces a failed removal resultCode through ErrorState instead of bare danger text", async () => {
  state.detail.mockResolvedValue({
    ...item,
    state: "failed",
    eligible: false,
    resultCode: "STORAGE_REMOVAL_FAILED",
  });
  const copy = storageMaintenanceCopy("en");
  const html = renderToStaticMarkup(await Detail({ params: Promise.resolve({ id: item.id }) }));
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.error);
  expect(html).toContain("STORAGE_REMOVAL_FAILED");
  expect(html).not.toContain('<p class="text-danger">');
});
it("maps revoked admin privilege to not found before loading the journal", async () => {
  state.list.mockRejectedValue(new AppError("Revoked", 403, "FORBIDDEN"));
  await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND");
  expect(state.list).toHaveBeenCalled();
});
it("shows an honest recovery state when the storage journal fails", async () => {
  state.list.mockRejectedValue(new Error("inventory unavailable"));
  const copy = storageMaintenanceCopy("en");
  const html = renderToStaticMarkup(
    await Page({ searchParams: Promise.resolve({ view: "eligible", page: "2" }) }),
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.loadUnavailable);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain('href="/admin/storage?view=eligible&amp;page=2"');
  expect(html).not.toContain("assets/usr_a/ast_a.zip");
});
it("renders empty journal inventory with clear-filters recovery when a view filter is active", async () => {
  state.list.mockResolvedValue({ items: [], deletedBytes: "0", page: 1, totalPages: 1 });
  const copy = storageMaintenanceCopy("en");
  const html = renderToStaticMarkup(
    await Page({ searchParams: Promise.resolve({ view: "eligible" }) }),
  );
  expect(html).toContain(copy.empty);
  expect(html).toContain(copy.clearFilters);
  expect(html).toContain('href="/admin/storage"');
  expect(html).toContain("overflow-x-clip");
});
it("shows an honest recovery state when object inspection fails", async () => {
  state.detail.mockRejectedValue(new Error("detail unavailable"));
  const copy = storageMaintenanceCopy("en");
  const html = renderToStaticMarkup(await Detail({ params: Promise.resolve({ id: item.id }) }));
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.loadUnavailable);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain('href="/admin/storage/objects/smo_a"');
  expect(html).not.toContain('type="checkbox"');
});
it("maps missing object inspection to not found", async () => {
  state.detail.mockRejectedValue(new AppError("Missing", 404, "NOT_FOUND"));
  await expect(Detail({ params: Promise.resolve({ id: item.id }) })).rejects.toThrow("NOT_FOUND");
});
it("uses honest loading shells with storage maintenance copy", async () => {
  const copy = storageMaintenanceCopy("en");
  const listHtml = renderToStaticMarkup(await ListLoading());
  expect(listHtml).toContain("overflow-x-clip");
  expect(listHtml).toContain(copy.title);
  const detailHtml = renderToStaticMarkup(await DetailLoading());
  expect(detailHtml).toContain("overflow-x-clip");
  expect(detailHtml).toContain(copy.detail);
  expect(detailHtml).not.toContain("Administration");
});
