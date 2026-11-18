vi.mock("server-only", () => ({}));

import { AppError } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  session: vi.fn(),
  page: vi.fn(),
  rate: vi.fn(),
  locale: "en" as "en" | "ru",
}));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("../../src/lib/i18n/server", () => ({
  getRequestLocale: async () => mock.locale,
}));
vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: { getSession: mock.session },
}));
vi.mock("../../src/lib/services/support/support-message-discovery-service", () => ({
  supportMessageDiscoveryService: { page: mock.page },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: mock.rate }));

import { SupportMessageBrowser } from "../../src/features/support/components/support-message-browser";
import {
  SupportMessagePage,
  supportMessageMetadata,
} from "../../src/features/support/messages-server";
import { supportMessageCopy } from "../../src/features/support/support-message-discovery-copy";
import { getDictionary } from "../../src/lib/i18n";

const id = `sup_${"a".repeat(24)}`,
  messageId = `spm_${"b".repeat(24)}`,
  stamp = "2026-10-12T00:00:00.123456Z";
const cursor = {
  version: 1 as const,
  context: "a".repeat(64),
  until: stamp,
  id: messageId,
  direction: "older" as const,
};
const page = {
  supportCase: { id, subject: "Private subject", status: "open" as const },
  items: [
    {
      id: messageId,
      authorRole: "requester" as const,
      body: '<script>alert("x")</script>\nSaved message',
      truncated: true,
      createdAt: stamp,
    },
  ],
  until: stamp,
  olderCursor: cursor,
  newerCursor: { ...cursor, direction: "newer" as const },
  focus: messageId,
};
beforeEach(() => {
  vi.resetAllMocks();
  mock.locale = "en";
  mock.session.mockResolvedValue({ id: "owner", role: "user" });
  mock.rate.mockResolvedValue({ success: true });
  mock.page.mockResolvedValue(page);
});
it.each(["en", "ru"] as const)(
  "offers a safe localized retry when conversation session lookup fails in %s",
  async (locale) => {
    mock.locale = locale;
    mock.session.mockRejectedValue(new Error("PRIVATE_SESSION_ERROR"));
    const html = renderToStaticMarkup(
      await SupportMessagePage({
        id,
        searchParams: Promise.resolve({ q: "billing & access", group: "staff" }),
      }),
    );
    expect(html).toContain(`>${supportMessageCopy(locale).title}</h1>`);
    expect(html).toContain(supportMessageCopy(locale).unavailable);
    expect(html).toContain(getDictionary(locale).errors.retry);
    expect(html).toContain(`href="/support/${id}/messages?q=billing+%26+access&amp;group=staff"`);
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("PRIVATE_SESSION_ERROR");
    expect(html).not.toContain("/auth/login");
    expect(mock.page).not.toHaveBeenCalled();
    expect(mock.rate).not.toHaveBeenCalled();
    const invalid = renderToStaticMarkup(
      await SupportMessagePage({
        id: "../private",
        staff: true,
        searchParams: Promise.resolve({ q: "x" }),
      }),
    );
    expect(invalid).toContain('href="/admin/support"');
    expect(invalid).not.toContain("../private");
  },
);
it.each(["en", "ru"] as const)(
  "renders accessible localized search, focused links, navigation and bounded export in %s",
  (locale) => {
    const copy = supportMessageCopy(locale),
      html = renderToStaticMarkup(
        <SupportMessageBrowser
          page={page}
          filters={{ group: "all", query: "", focus: messageId }}
          locale={locale}
        />,
      );
    expect(html).toContain(copy.title);
    expect(html).toContain("min-w-0 max-w-4xl");
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain(copy.focused);
    expect(html).toContain(copy.truncated);
    expect(html).toContain(`<search aria-label="${copy.filters}"`);
    expect(html).toContain('method="get"');
    expect(html).toContain("bg-accent text-white");
    expect(html).toContain('maxLength="80"');
    expect(html).toContain('htmlFor="support-message-query"'.replace("htmlFor", "for"));
    expect(html).toContain(`id="message-${messageId}"`);
    expect(html).toContain(stamp);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain(copy.older);
    expect(html).toContain(copy.newer);
    expect(html).toContain(`/api/support/${id}/messages/export?focus=`);
    expect(html).toContain(copy.exportHelp);
  },
);
it("shows a localized empty state and retains staff paths", () => {
  const copy = supportMessageCopy("ru");
  const html = renderToStaticMarkup(
    <SupportMessageBrowser
      page={{ ...page, items: [], olderCursor: null, newerCursor: null }}
      filters={{ group: "all", query: "" }}
      locale="ru"
      staff
    />,
  );
  expect(html).toContain(copy.empty);
  expect(html).toContain(copy.emptyDescription);
  expect(html).not.toContain(copy.emptyFiltered);
  expect(html).not.toContain(copy.emptyFilteredDescription);
  expect(html).toContain(`/admin/support/${id}`);
  expect(html).not.toContain("?cursor=");
});
it.each(["en", "ru"] as const)(
  "distinguishes an empty filtered conversation from an empty case in %s",
  (locale) => {
    const copy = supportMessageCopy(locale);
    expect(copy.emptyFiltered).not.toBe(copy.empty);
    expect(copy.emptyFilteredDescription).not.toBe(copy.emptyDescription);
    const filtered = renderToStaticMarkup(
      <SupportMessageBrowser
        page={{ ...page, items: [], olderCursor: null, newerCursor: null }}
        filters={{ group: "staff", query: "billing" }}
        locale={locale}
      />,
    );
    expect(filtered).toContain(copy.emptyFiltered);
    expect(filtered).toContain(copy.emptyFilteredDescription);
    expect(filtered).toContain(copy.reset);
    expect(filtered).not.toContain(copy.empty);
    expect(filtered).not.toContain(copy.emptyDescription);
  },
);
it("gates anonymous reads and validates duplicate filters before loading data", async () => {
  mock.session.mockResolvedValue(null);
  expect(
    renderToStaticMarkup(await SupportMessagePage({ id, searchParams: Promise.resolve({}) })),
  ).toContain("/auth/login");
  expect(mock.page).not.toHaveBeenCalled();
  mock.session.mockResolvedValue({ id: "owner" });
  const invalid = renderToStaticMarkup(
    await SupportMessagePage({ id, searchParams: Promise.resolve({ q: ["x", "y"] }) }),
  );
  expect(invalid).toContain('role="alert"');
  expect(invalid).toContain(supportMessageCopy("en").invalid);
  expect(invalid).toContain(supportMessageCopy("en").reset);
  expect(invalid).toContain("overflow-x-clip");
  expect(mock.page).not.toHaveBeenCalled();
});
it("delegates the staff-only requirement to a fresh server-side grant check", async () => {
  mock.session.mockResolvedValue({ id: "old-staff", role: "moderator" });
  mock.page.mockRejectedValue(new AppError("revoked", 403, "FORBIDDEN"));
  const html = renderToStaticMarkup(
    await SupportMessagePage({ id, searchParams: Promise.resolve({}), staff: true }),
  );
  expect(mock.page).toHaveBeenCalledExactlyOnceWith(
    id,
    "old-staff",
    { group: "all", query: "", focus: undefined, until: undefined, cursor: undefined },
    true,
    "session",
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain(`/admin/support/${id}/messages`);
  expect(html).not.toContain("Private subject");
});
it("returns private RU/EN metadata and handles search limits", async () => {
  mock.locale = "ru";
  expect(await supportMessageMetadata()).toEqual({
    title: supportMessageCopy("ru").title,
    robots: { index: false, follow: false },
  });
  mock.rate.mockResolvedValue({ success: false });
  const html = renderToStaticMarkup(
    await SupportMessagePage({ id, searchParams: Promise.resolve({}) }),
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain(supportMessageCopy("ru").reset);
  expect(mock.page).not.toHaveBeenCalled();
});
