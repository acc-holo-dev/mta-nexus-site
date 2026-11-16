import { AppError } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
  session: vi.fn(),
  applications: vi.fn(),
  application: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/workspace/verification/history",
}));
vi.mock("../../src/lib/i18n-server", () => ({
  getRequestLocale: async () => state.locale,
}));
vi.mock("../../src/lib/services/auth-service", () => ({
  authService: { getSession: state.session },
}));
vi.mock("../../src/lib/services/verification-workspace-service", () => ({
  verificationWorkspaceService: state,
}));

import Detail, {
  generateMetadata as detailMetadata,
} from "../../src/app/workspace/verification/[id]/page";
import Loading from "../../src/app/workspace/verification/history/loading";
import History, {
  generateMetadata as historyMetadata,
} from "../../src/app/workspace/verification/history/page";
import { verificationApplicationsCopy } from "../../src/lib/verification-applications-copy";
import { verificationCopy } from "../../src/lib/verification-workspace-copy";

const time = "2026-10-11T00:00:00.123456Z",
  params = { params: Promise.resolve({ id: "request" }) },
  cursor = JSON.stringify({
    id: "request",
    createdAt: time,
    context: "a".repeat(64),
    version: 1,
    direction: "older",
  });
const application = {
  id: "request",
  targetType: "developer",
  status: "pending",
  proofUrl: "https://example.test/proof",
  notes: "<script>proof</script>",
  reviewNotes: "<img src=x>",
  truncated: true,
  createdAt: time,
  resolvedAt: null,
  revision: "a".repeat(64),
  profileState: "changed",
  editable: true,
  events: [{ id: "event", action: "verification.application_updated", createdAt: time }],
  hasEarlierEvents: true,
};
beforeEach(() => {
  vi.clearAllMocks();
  state.locale = "en";
  state.session.mockResolvedValue({ id: "actor" });
  state.applications.mockResolvedValue({
    items: [application],
    olderCursor: cursor,
    newerCursor: null,
  });
  state.application.mockResolvedValue(application);
});
it.each(["en", "ru"] as const)(
  "renders searchable private history and exact navigation in %s",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(
      await History({
        searchParams: Promise.resolve({ q: " Lua ", status: "pending", type: "developer" }),
      }),
    );
    expect(state.applications).toHaveBeenCalledWith(
      { id: "actor" },
      expect.objectContaining({ query: "Lua", status: "pending", type: "developer" }),
    );
    expect(html).toContain('action="/workspace/verification/history"');
    expect(html).toContain(`<search aria-label="${verificationApplicationsCopy(locale).query}"`);
    expect(html).toContain('href="/workspace/verification/request"');
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain(`dateTime="${time}"`);
    expect(html).toContain(verificationApplicationsCopy(locale).live);
    const links = [...html.matchAll(/href="([^"]+)"/gu)].map(
      (match) => new URL(match[1].replaceAll("&amp;", "&"), "https://nexus.test"),
    );
    expect(
      links.find((url) => url.searchParams.get("cursor") === cursor)?.searchParams.get("status"),
    ).toBe("pending");
    expect((await historyMetadata()).robots.index).toBe(false);
    expect(renderToStaticMarkup(await Loading())).toContain(
      verificationApplicationsCopy(locale).loading,
    );
  },
);
it.each(["en", "ru"] as const)(
  "renders private current-profile warning, activity, genuine update form and safe feedback in %s",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(await Detail(params));
    const copy = verificationApplicationsCopy(locale);
    expect(state.application).toHaveBeenCalledWith({ id: "actor" }, "request");
    expect(html).toContain(copy.profileChanged.replaceAll("'", "&#x27;"));
    expect(html).toContain(copy.amend);
    expect(html).toContain(copy.updated);
    expect(html).toContain(copy.earlier);
    expect(html).toContain(copy.truncated.replaceAll("'", "&#x27;"));
    expect(html).toContain('href="/settings/developer"');
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html).toContain('rel="noopener noreferrer"');
    expect((await detailMetadata()).robots.index).toBe(false);
  },
);
it.each(["approved", "rejected", "server"])(
  "renders read-only applications without an amendment form for %s",
  async (value) => {
    state.application.mockResolvedValue({
      ...application,
      status: value === "server" ? "pending" : value,
      targetType: value === "server" ? "server" : "developer",
      editable: false,
      profileState: null,
    });
    const html = renderToStaticMarkup(await Detail(params));
    expect(html).not.toContain("<form");
    expect(html).toContain(verificationApplicationsCopy("en").readOnly);
    expect(html).toContain('id="verification-application-readonly"');
    expect(html).toContain('role="alert"');
  },
);
it("rejects duplicate filters and does not read private data without a session", async () => {
  const html = renderToStaticMarkup(
    await History({ searchParams: Promise.resolve({ q: ["one", "two"] }) }),
  );
  expect(html).toContain(verificationApplicationsCopy("en").invalid);
  expect(state.applications).not.toHaveBeenCalled();
  state.session.mockResolvedValue(null);
  expect(renderToStaticMarkup(await History({}))).toContain(
    'href="/auth/login?next=%2Fworkspace%2Fverification%2Fhistory"',
  );
  expect(renderToStaticMarkup(await History({}))).toContain(
    'href="/auth/register?next=%2Fworkspace%2Fverification%2Fhistory"',
  );
  expect(renderToStaticMarkup(await Detail(params))).toContain(
    'href="/auth/login?next=%2Fworkspace%2Fverification%2Frequest"',
  );
  expect(renderToStaticMarkup(await Detail(params))).toContain(
    'href="/auth/register?next=%2Fworkspace%2Fverification%2Frequest"',
  );
  expect(
    renderToStaticMarkup(
      await History({
        searchParams: Promise.resolve({ q: " Lua ", status: "pending", type: "developer" }),
      }),
    ),
  ).toContain(
    'href="/auth/login?next=%2Fworkspace%2Fverification%2Fhistory%3Fq%3D%2BLua%2B%26status%3Dpending%26type%3Ddeveloper"',
  );
  expect(
    renderToStaticMarkup(
      await History({
        searchParams: Promise.resolve({ q: " Lua ", status: "pending", type: "developer" }),
      }),
    ),
  ).toContain(
    'href="/auth/register?next=%2Fworkspace%2Fverification%2Fhistory%3Fq%3D%2BLua%2B%26status%3Dpending%26type%3Ddeveloper"',
  );
  expect(state.application).not.toHaveBeenCalled();
});
it("distinguishes never-empty history from filtered-empty results", async () => {
  state.applications.mockResolvedValue({ items: [], olderCursor: null, newerCursor: null });
  const never = renderToStaticMarkup(await History({}));
  const copy = verificationApplicationsCopy("en");
  expect(never).toContain(copy.emptyNever);
  expect(never).toContain(copy.emptyNeverHint);
  expect(never).not.toContain(copy.emptyFiltered);
  expect(never).toContain('href="/workspace/verification"');
  expect(never).toContain("overflow-x-clip");
  expect(never).toContain("min-w-0");
  const filtered = renderToStaticMarkup(
    await History({ searchParams: Promise.resolve({ status: "pending" }) }),
  );
  expect(filtered).toContain(copy.emptyFiltered);
  expect(filtered).toContain(copy.emptyFilteredHint);
  expect(filtered).not.toContain(copy.emptyNever);
  expect(filtered).toContain(copy.clear);
  expect(filtered).toContain('href="/workspace/verification/history"');
});
it("distinguishes safe auth and target errors from an empty history", async () => {
  state.session.mockRejectedValueOnce(Error("PRIVATE_AUTH"));
  const history = renderToStaticMarkup(await History({}));
  expect(history).toContain('href="/auth/login?next=%2Fworkspace%2Fverification%2Fhistory"');
  expect(history).toContain('href="/auth/register?next=%2Fworkspace%2Fverification%2Fhistory"');
  expect(history).not.toContain("PRIVATE_AUTH");
  expect(history).not.toContain(verificationApplicationsCopy("en").emptyNever);
  expect(history).not.toContain(verificationApplicationsCopy("en").emptyFiltered);
  expect(history).not.toContain(verificationApplicationsCopy("en").title);
  state.application.mockRejectedValueOnce(new AppError("PRIVATE_TARGET", 404, "NOT_FOUND"));
  const detail = renderToStaticMarkup(await Detail(params));
  expect(detail).toContain('role="alert"');
  expect(detail).toContain('href="/workspace/verification/request"');
  expect(detail).toContain("overflow-x-clip");
  expect(detail).not.toContain("PRIVATE_TARGET");
});
it.each(["en", "ru"] as const)(
  "offers ErrorState retry on application load failure and EmptyState on empty events in %s",
  async (locale) => {
    state.locale = locale;
    const copy = verificationApplicationsCopy(locale);
    const labels = verificationCopy(locale);
    state.applications.mockRejectedValueOnce(new AppError("PRIVATE_LIST", 500, "INTERNAL_ERROR"));
    const history = renderToStaticMarkup(await History({ searchParams: Promise.resolve({}) }));
    expect(history).toContain('role="alert"');
    expect(history).toContain(labels.unavailable);
    expect(history).toContain('href="/workspace/verification/history"');
    expect(history).toContain("overflow-x-clip");
    expect(history).not.toContain("PRIVATE_LIST");
    expect(history).not.toContain(copy.emptyNever);
    state.application.mockResolvedValueOnce({
      ...application,
      events: [],
      hasEarlierEvents: false,
    });
    const detail = renderToStaticMarkup(await Detail(params));
    expect(detail).toContain(copy.noEvents);
    expect(detail).toContain(copy.noEventsHint);
    expect(detail).toContain("overflow-x-clip");
    expect(detail).toContain("min-h-11");
  },
);
it("clips honest verification application loading shells on narrow layouts", async () => {
  const { default: HistoryLoading } = await import(
    "../../src/app/workspace/verification/history/loading"
  );
  const { default: DetailLoading } = await import(
    "../../src/app/workspace/verification/[id]/loading"
  );
  for (const LoadingShell of [HistoryLoading, DetailLoading]) {
    const html = renderToStaticMarkup(await LoadingShell());
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-w-0");
  }
});
