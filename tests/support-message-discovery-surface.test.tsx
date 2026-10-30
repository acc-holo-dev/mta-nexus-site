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
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => mock.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mock.session },
}));
vi.mock("../apps/web/src/lib/services/support-message-discovery-service", () => ({
  supportMessageDiscoveryService: { page: mock.page },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: mock.rate }));

import { SupportMessageBrowser } from "../apps/web/src/components/support-message-browser";
import {
  SupportMessagePage,
  supportMessageMetadata,
} from "../apps/web/src/components/support-message-page";
import { supportMessageCopy } from "../apps/web/src/lib/support-message-discovery-copy";

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
    expect(html).toContain(copy.focused);
    expect(html).toContain(copy.truncated);
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
  const html = renderToStaticMarkup(
    <SupportMessageBrowser
      page={{ ...page, items: [], olderCursor: null, newerCursor: null }}
      filters={{ group: "all", query: "" }}
      locale="ru"
      staff
    />,
  );
  expect(html).toContain(supportMessageCopy("ru").empty);
  expect(html).toContain(`/admin/support/${id}`);
  expect(html).not.toContain("?cursor=");
});
it("gates anonymous reads and validates duplicate filters before loading data", async () => {
  mock.session.mockResolvedValue(null);
  expect(
    renderToStaticMarkup(await SupportMessagePage({ id, searchParams: Promise.resolve({}) })),
  ).toContain("/auth/login");
  expect(mock.page).not.toHaveBeenCalled();
  mock.session.mockResolvedValue({ id: "owner" });
  expect(
    renderToStaticMarkup(
      await SupportMessagePage({ id, searchParams: Promise.resolve({ q: ["x", "y"] }) }),
    ),
  ).toContain(supportMessageCopy("en").invalid);
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
  );
  expect(html).toContain('role="alert"');
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
  expect(mock.page).not.toHaveBeenCalled();
});
