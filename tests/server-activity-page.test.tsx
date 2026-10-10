import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  user: { id: "actor", role: "user" } as { id: string; role: string } | null,
  locale: "en" as "en" | "ru",
  page: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "token" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@nexus/db", () => ({ auditRepository: { pageForManagedServer: state.page } }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
import ServerActivityPage, {
  metadata,
} from "../apps/web/src/app/workspace/servers/[id]/activity/page";
const event = {
  id: "aud_1",
  action: "server.updated",
  actorId: "editor",
  actorType: "user",
  actorUsername: "editor",
  actorDisplayName: "Editor",
  fields: ["name", "visibility"],
  createdAt: new Date("2026-10-10T10:20:30.000Z"),
};
beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: "actor", role: "user" };
  state.locale = "en";
  state.page.mockResolvedValue({
    server: { id: "server", name: "Private Server" },
    events: [event],
    nextCursor: "aud_1",
  });
});
const render = async (query: Record<string, string | string[] | undefined> = {}) =>
  renderToStaticMarkup(
    await ServerActivityPage({
      params: Promise.resolve({ id: "server" }),
      searchParams: Promise.resolve(query),
    }),
  );

it.each(["en", "ru"] as const)("renders a localized private history in %s", async (locale) => {
  state.locale = locale;
  const html = await render();
  expect(state.page).toHaveBeenCalledExactlyOnceWith(
    "server",
    { id: "actor", role: "user" },
    undefined,
  );
  expect(html).toContain(locale === "ru" ? "История сервера" : "Server activity");
  expect(html).toContain(locale === "ru" ? "Карточка обновлена" : "Listing updated");
  expect(html).toContain(locale === "ru" ? "Название, Видимость" : "Name, Visibility");
  expect(html).toContain("Editor (@editor)");
  expect(html).toMatch(/datetime="2026-10-10T10:20:30.000Z"/i);
  expect(html).toContain("UTC");
  expect(html).toContain('href="/workspace/servers/server/activity?before=aud_1"');
  expect(html).toContain('href="/workspace/servers/server"');
  expect(html).not.toContain('href="/servers/');
  expect(html).not.toContain("undefined");
});
it("does not read private history for an anonymous visitor", async () => {
  state.user = null;
  expect(await render()).toContain("Sign in");
  expect(state.page).not.toHaveBeenCalled();
  expect(metadata.robots).toEqual({ index: false, follow: false });
});
it("returns the same not-found boundary for missing and unauthorized listings", async () => {
  state.page.mockResolvedValue(null);
  await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");
});
it("keeps current actor and missing account/system fallbacks readable without internal IDs", async () => {
  state.page.mockResolvedValue({
    server: { id: "server", name: "Server" },
    nextCursor: null,
    events: [
      { ...event, id: "aud_self", actorId: "actor" },
      {
        ...event,
        id: "aud_unknown",
        actorId: "deleted_secret_id",
        actorUsername: null,
        actorDisplayName: null,
      },
      { ...event, id: "aud_system", actorType: "system", actorId: "system_secret_id" },
    ],
  });
  const html = await render();
  expect(html).toContain("By: You");
  expect(html).toContain("Account unavailable");
  expect(html).toContain("By: System");
  expect(html).not.toContain("secret_id");
  expect(html).not.toContain("Earlier activity");
});
it("distinguishes an empty initial history from an expired or exhausted cursor page", async () => {
  state.page.mockResolvedValue({
    server: { id: "server", name: "Server" },
    events: [],
    nextCursor: null,
  });
  expect(await render()).toContain("No recorded activity yet");
  const html = await render({ before: "aud_old" });
  expect(html).toContain("No earlier recorded activity");
  expect(html).toContain("Latest activity");
  expect(html).not.toContain("Earlier activity →");
});
it("ignores malformed or repeated URL cursors and cannot pass a caller-controlled page size", async () => {
  await render({ before: ["aud_1", "aud_2"], limit: "99999" });
  expect(state.page).toHaveBeenLastCalledWith("server", { id: "actor", role: "user" }, undefined);
});
it("escapes stored server and actor names", async () => {
  state.page.mockResolvedValue({
    server: { id: "server", name: "<script>server</script>" },
    nextCursor: null,
    events: [{ ...event, actorDisplayName: "<img src=x onerror=alert(1)>" }],
  });
  const html = await render();
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("<img");
  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain("&lt;img");
});
it("propagates a failed read instead of inventing an empty timeline", async () => {
  state.page.mockRejectedValue(new Error("Database unavailable"));
  await expect(render()).rejects.toThrow();
});

it("shows a moderation decision with its public reviewer identity", async () => {
  state.page.mockResolvedValue({ server: { id: "server", name: "Server" }, nextCursor: null,
    events: [{ ...event, action: "server.verification_approved", actorType: "admin", actorDisplayName: "Moderator" }],
  });
  const html = await render();
  expect(html).toContain("Verification approved");
  expect(html).toContain("Moderator (@editor)");
  expect(html).not.toContain("By: System");
});
