import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ session: vi.fn(), locale: "en" as "ru" | "en" }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => mocks.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));
import { SupportPageSurface, supportMetadata } from "../apps/web/src/components/support-page";
import { SupportCaseActions } from "../apps/web/src/components/support-case-actions";
import { SupportCenter } from "../apps/web/src/components/support-center";
import { LocaleProvider } from "../apps/web/src/components/locale-context";
import { supportWorkspaceCopy } from "../apps/web/src/lib/support-workspace-copy";
import { getDictionary } from "../apps/web/src/lib/i18n";
const supportCase = {
  id: `sup_${"a".repeat(24)}`,
  category: "account",
  subject: "Access",
  status: "open" as const,
  updatedAt: "2026-10-11T00:00:00.000Z",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.locale = "en";
  mocks.session.mockResolvedValue({ id: "actor", role: "user" });
});
it.each(["ru", "en"] as const)(
  "renders requester controls and staff-only closure with working role boundaries in %s",
  (locale) => {
    const props = {
      supportCase,
      staff: false,
      requester: true,
      busy: false,
      locale,
      onChangeStatus: vi.fn(),
    };
    const own = renderToStaticMarkup(<SupportCaseActions {...props} />);
    expect(own).toContain(supportWorkspaceCopy(locale).resolveOwn);
    expect(own).not.toContain(getDictionary(locale).support.close);
    const closed = renderToStaticMarkup(
      <SupportCaseActions {...props} supportCase={{ ...supportCase, status: "closed" }} />,
    );
    expect(closed).toBe("");
    expect(renderToStaticMarkup(<SupportCaseActions {...props} requester={false} />)).toBe("");
    expect(
      renderToStaticMarkup(
        <SupportCaseActions {...props} supportCase={{ ...supportCase, updatedAt: undefined }} />,
      ),
    ).toBe("");
    expect(renderToStaticMarkup(<SupportCaseActions {...props} staff />)).toContain(
      getDictionary(locale).support.close,
    );
    expect(renderToStaticMarkup(<SupportCaseActions {...props} busy />)).toContain('disabled=""');
    const staff = renderToStaticMarkup(<SupportCaseActions {...props} staff />);
    expect(staff).toContain("border border-base bg-surface");
    expect(staff).toContain("min-h-10 text-accent");
  },
);
it("renders URL-based escaped search inputs and role-specific create forms", () => {
  const html = renderToStaticMarkup(
    <LocaleProvider locale="en">
      <SupportCenter
        initialFilters={{
          page: 2,
          q: '<script>alert("x")</script>',
          status: "resolved",
          category: "account",
        }}
      />
    </LocaleProvider>,
  );
  expect(html).toContain('method="get"');
  expect(html).toContain('name="q"');
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  expect(html).toContain('value="resolved" selected=""');
  expect(html).toContain(supportWorkspaceCopy("en").apply);
  expect(html).toContain("border border-base bg-surface");
  expect(html).toContain("bg-accent text-white");
  expect(html).toContain("font-label");
  const staff = renderToStaticMarkup(
    <LocaleProvider locale="en">
      <SupportCenter staffMode />
    </LocaleProvider>,
  );
  expect(staff).not.toContain(getDictionary("en").support.newCase);
});
it("gates server-rendered support pages before showing private controls", async () => {
  mocks.session.mockResolvedValue(null);
  const guest = renderToStaticMarkup(await SupportPageSurface({}));
  expect(guest).toContain("/auth/login");
  expect(guest).toContain(
    `<h1 class="font-display text-primary">${getDictionary("en").support.title}</h1>`,
  );
  mocks.session.mockResolvedValue({ id: "actor", role: "user" });
  expect(renderToStaticMarkup(await SupportPageSurface({ staff: true }))).toContain(
    supportWorkspaceCopy("en").forbidden,
  );
  expect(renderToStaticMarkup(await SupportPageSurface({ id: "../private" }))).toContain(
    supportWorkspaceCopy("en").notFound,
  );
});
it("rejects duplicate/unknown page filters and localizes no-index support metadata", async () => {
  mocks.locale = "ru";
  expect(
    renderToStaticMarkup(
      await SupportPageSurface({ searchParams: Promise.resolve({ requesterId: "victim" }) }),
    ),
  ).toContain(supportWorkspaceCopy("ru").queryInvalid);
  expect(
    renderToStaticMarkup(
      await SupportPageSurface({ searchParams: Promise.resolve({ status: ["open", "closed"] }) }),
    ),
  ).toContain(supportWorkspaceCopy("ru").queryInvalid);
  expect(await supportMetadata()).toEqual({
    title: getDictionary("ru").support.title,
    robots: { index: false, follow: false },
  });
});
