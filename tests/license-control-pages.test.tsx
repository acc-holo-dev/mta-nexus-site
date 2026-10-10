import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const state = vi.hoisted(() => ({
  user: { id: "usr_a", role: "user" } as { id: string; role: "user" | "moderator" } | null,
  locale: "en" as "ru" | "en", detail: vi.fn(), servers: vi.fn(), moderationDetail: vi.fn(), moderationPage: vi.fn(), panel: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({ authService: { getSession: async () => state.user } }));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/license-control-service", () => ({ licenseControlService: {
  detail: state.detail, servers: state.servers, moderationDetail: state.moderationDetail, moderationPage: state.moderationPage,
} }));
vi.mock("../apps/web/src/components/license-control-panel", () => ({ LicenseControlPanel: (props: unknown) => { state.panel(props); return <section>Controls</section>; } }));
import OwnerPage, { metadata } from "../apps/web/src/app/workspace/licenses/[id]/page";
import ModeratorPage from "../apps/web/src/app/admin/licenses/[id]/page";
import QueuePage from "../apps/web/src/app/admin/licenses/page";
const params = { params: Promise.resolve({ id: "lic_a" }) };
const license = {
  id: "lic_a", productId: "prd_a", productTitle: "<script>product</script>", model: "single_server", status: "active", effectiveStatus: "active",
  createdAt: new Date("2026-10-10T00:00:00Z"), updatedAt: new Date("2026-10-10T00:00:00Z"), expiresAt: new Date("2027-01-01T00:00:00Z"),
  canActivate: true, bindingReady: true, boundServerId: "srv_a", serverName: "Server A", tokenActive: false,
  legacyServerBound: true, history: [{ id: "aud_a", action: "license.bound", reason: "<script>reason</script>", createdAt: new Date("2026-10-10T00:00:00Z") }],
  key: "DO-NOT-SERIALIZE-KEY", tokenDigest: "DO-NOT-SERIALIZE-DIGEST", userId: "DO-NOT-SERIALIZE-ACCOUNT",
};
beforeEach(() => {
  state.user = { id: "usr_a", role: "user" }; state.locale = "en";
  state.detail.mockReset().mockResolvedValue(license); state.moderationDetail.mockReset().mockResolvedValue(license);
  state.servers.mockReset().mockResolvedValue({ servers: [{ id: "srv_a", name: "Server A" }], page: 1, totalPages: 1 });
  state.panel.mockReset(); state.moderationPage.mockReset().mockResolvedValue({ licenses: [], page: 1, totalPages: 1 });
});
it("requires sign-in and does not load private license data for guests", async () => {
  state.user = null;
  expect(renderToStaticMarkup(await OwnerPage(params))).toContain("Sign in");
  expect(state.detail).not.toHaveBeenCalled();
  expect(metadata.robots).toEqual({ index: false, follow: false });
});
it("hides missing or foreign licenses", async () => {
  state.detail.mockResolvedValue(null);
  await expect(OwnerPage(params)).rejects.toThrow("NOT_FOUND");
  expect(state.servers).not.toHaveBeenCalled();
});
it("renders escaped localized history and gives the client only control fields", async () => {
  for (const locale of ["en", "ru"] as const) {
    state.locale = locale;
    const markup = renderToStaticMarkup(await OwnerPage(params));
    expect(markup).toContain("&lt;script&gt;product&lt;/script&gt;");
    expect(markup).toContain("&lt;script&gt;reason&lt;/script&gt;");
    expect(markup).toContain(locale === "ru" ? "Привязать сервер" : "Bind server");
    for (const secret of [license.key, license.tokenDigest, license.userId]) {
      expect(markup).not.toContain(secret);
      expect(JSON.stringify(state.panel.mock.calls.at(-1))).not.toContain(secret);
    }
    expect(state.panel.mock.calls.at(-1)?.[0].license.updatedAt).toBe("2026-10-10T00:00:00.000Z");
  }
});
it("loads candidates only for an activatable unbound license", async () => {
  await OwnerPage(params); expect(state.servers).not.toHaveBeenCalled();
  state.detail.mockResolvedValue({ ...license, boundServerId: null });
  await OwnerPage(params); expect(state.servers).toHaveBeenCalledWith(state.user, "lic_a");
});
it("blocks buyer access to moderator pages before reading any license", async () => {
  await expect(ModeratorPage(params)).rejects.toThrow("NOT_FOUND");
  await expect(QueuePage({ searchParams: Promise.resolve({}) })).rejects.toThrow("NOT_FOUND");
  expect(state.moderationDetail).not.toHaveBeenCalled(); expect(state.moderationPage).not.toHaveBeenCalled();
});
it("uses bounded filters and an effective expiry filter for the moderator queue", async () => {
  state.user = { id: "usr_a", role: "moderator" }; state.locale = "ru";
  const markup = renderToStaticMarkup(await QueuePage({ searchParams: Promise.resolve({ page: "99999999", status: "expired", q: "x".repeat(1000) }) }));
  expect(state.moderationPage).toHaveBeenCalledWith(state.user, 1, "expired", "x".repeat(120));
  expect(markup).toContain("Модерация лицензий");
  expect(markup).not.toContain(license.key);
});
