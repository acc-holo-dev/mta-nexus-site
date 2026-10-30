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
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../apps/web/src/lib/services/storage-maintenance-service", () => ({
  storageMaintenanceService: { list: state.list, detail: state.detail },
}));

import Detail from "../apps/web/src/app/admin/storage/objects/[id]/page";
import Page from "../apps/web/src/app/admin/storage/page";
import { StorageCleanupControls } from "../apps/web/src/components/storage-maintenance-controls";

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
});
it("does not load journal data for moderators or signed-out visitors", async () => {
  for (const actor of [null, { id: "usr_mod", role: "moderator" }]) {
    state.actor = actor;
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND");
  }
  expect(state.list).not.toHaveBeenCalled();
});
it("requires an initially unchecked confirmation before cleanup", () => {
  const html = renderToStaticMarkup(<StorageCleanupControls id="smo_a" revision={1} locale="en" />);
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
});
