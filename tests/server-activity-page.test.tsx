import { NotFoundError } from "@nexus/domain";
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
    throw Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("../apps/web/src/lib/services/server-workspace-history-service", () => ({
  serverWorkspaceHistoryService: { page: state.page },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));

import ServerActivityPage, {
  generateMetadata,
} from "../apps/web/src/app/workspace/servers/[id]/activity/page";

const until = "2026-10-12T00:00:00.123456Z",
  cursor = "YQ";
const event = {
  id: "aud",
  action: "server.updated",
  actor: "team",
  identity: { username: "editor", name: "Editor" },
  fields: ["name", "visibility"],
  createdAt: "2026-10-10T10:20:30.000Z",
  transition: { before: "public", after: "private" },
};
const data = {
  server: { id: "server", name: "Private Server" },
  until,
  period: "all",
  action: "all",
  events: [event],
  nextCursor: cursor,
};
beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: "actor", role: "user" };
  state.locale = "en";
  state.page.mockResolvedValue(data);
});
const render = async (query: Record<string, string | string[] | undefined> = {}) =>
  renderToStaticMarkup(
    await ServerActivityPage({
      params: Promise.resolve({ id: "server" }),
      searchParams: Promise.resolve(query),
    }),
  );
it.each(["en", "ru"] as const)(
  "renders private localized filters, transitions and stable-window export in %s",
  async (locale) => {
    state.locale = locale;
    const html = await render();
    expect(state.page).toHaveBeenCalledExactlyOnceWith("actor", "server", {
      period: "all",
      action: "all",
      cursor: undefined,
      legacyCursor: undefined,
      until: undefined,
    });
    expect(html).toContain(locale === "ru" ? "История сервера" : "Server activity");
    expect(html).toContain(locale === "ru" ? "Название, Видимость" : "Name, Visibility");
    expect(html).toContain("Editor (@editor)");
    expect(html).toContain('href="/users/editor"');
    expect(html).toContain('name="period"');
    expect(html).toContain('name="action"');
    expect(html).toContain(`until=${encodeURIComponent(until)}`);
    expect(html).toContain('href="/workspace/servers/server/activity?cursor=YQ"');
    expect(html).not.toContain("undefined");
    expect((await generateMetadata()).robots).toEqual({ index: false, follow: false });
  },
);
it("does not read server activity for an anonymous visitor", async () => {
  state.user = null;
  expect(await render()).toContain("Sign in");
  expect(state.page).not.toHaveBeenCalled();
});
it("uses the same not-found boundary for missing or unavailable current server grants", async () => {
  state.page.mockRejectedValue(new NotFoundError("Server"));
  await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");
});
it.each([
  { before: ["a", "b"] },
  { limit: "99999" },
  { period: "invalid" },
  { action: "commercial" },
  { cursor: "../invalid" },
])("rejects malformed filters before a private read: %j", async (query) => {
  const html = await render(query);
  expect(state.page).not.toHaveBeenCalled();
  expect(html).toContain("invalid");
  expect(html).not.toContain("Private Server");
});
it("preserves validated legacy anchors without allowing mixed filters", async () => {
  await render({ before: "aud_old" });
  expect(state.page.mock.calls[0][2]).toMatchObject({
    legacyCursor: "aud_old",
    action: "all",
    period: "all",
  });
  state.page.mockClear();
  expect(await render({ before: "aud_old", period: "7" })).toContain("invalid");
  expect(state.page).not.toHaveBeenCalled();
});
it("retains current-user, missing-public-account and system labels without raw identities", async () => {
  state.page.mockResolvedValue({
    ...data,
    nextCursor: null,
    events: [
      { ...event, id: "self", actor: "you", identity: null },
      { ...event, id: "gone", actor: "team", identity: null },
      { ...event, id: "system", actor: "system", identity: null },
    ],
  });
  const html = await render();
  expect(html).toContain("By: You");
  expect(html).toContain("Account unavailable");
  expect(html).toContain("By: System");
  expect(html).not.toContain("Earlier activity");
});
it("keeps public reviewer attribution and omits internal audit details", async () => {
  state.page.mockResolvedValue({
    ...data,
    events: [
      {
        ...event,
        action: "server.verification_approved",
        actor: "moderation",
        identity: { username: "reviewer", name: "Reviewer" },
        fields: [],
        transition: null,
      },
    ],
  });
  const html = await render();
  expect(html).toContain("Verification approved");
  expect(html).toContain("Platform moderation");
  expect(html).toContain("Reviewer (@reviewer)");
  expect(html).not.toMatch(/actorId|ipAddress|token_digest/u);
});
it("escapes stored names and shows a safe failure without an empty success state", async () => {
  state.page.mockResolvedValue({
    ...data,
    server: { id: "server", name: "<script>server</script>" },
    events: [{ ...event, identity: { username: "editor", name: "<img src=x>" } }],
  });
  const html = await render();
  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain("&lt;img");
  expect(html).not.toContain("<script>");
  state.page.mockRejectedValue(Error("Private database detail"));
  const failure = await render();
  expect(failure).toContain("temporarily unavailable");
  expect(failure).not.toContain("Private database detail");
  expect(failure).not.toContain("No recorded events");
});
it("keeps filters in page links and blocks wrong-server acknowledgements", async () => {
  state.page.mockResolvedValue({ ...data, period: "30", action: "visibility" });
  const html = await render({ period: "30", action: "visibility" });
  expect(html).toContain("period=30&amp;action=visibility&amp;cursor=YQ");
  state.page.mockResolvedValue({
    ...data,
    server: { id: "foreign", name: "Foreign private name" },
  });
  const failed = await render();
  expect(failed).not.toContain("Foreign private name");
  expect(failed).toContain("temporarily unavailable");
});
it("renders an empty filtered history without an export of any extra rows", async () => {
  state.page.mockResolvedValue({ ...data, events: [], nextCursor: null });
  const html = await render();
  expect(html).toContain("No recorded events match");
  expect(html).toContain("activity/export");
  expect(html).not.toContain("Earlier activity");
});
