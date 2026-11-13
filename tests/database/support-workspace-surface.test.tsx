import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), locale: "en" as "ru" | "en" }));
vi.mock("next/navigation", () => ({ usePathname: () => "/support" }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("../../site/src/lib/i18n-server", () => ({
  getRequestLocale: async () => mocks.locale,
}));
vi.mock("../../site/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));

import { LocaleProvider } from "../../site/src/components/locale-context";
import { SupportCaseActions } from "../../site/src/components/support-case-actions";
import { SupportCenter } from "../../site/src/components/support-center";
import { SupportPageSurface, supportMetadata } from "../../site/src/components/support-page";
import { getDictionary } from "../../site/src/lib/i18n";
import { supportWorkspaceCopy } from "../../site/src/lib/support-workspace-copy";

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
    expect(staff).toContain("min-h-11");
    expect(staff).toContain("text-accent");
  },
);
it("renders URL-based escaped search inputs and role-specific create forms", () => {
  const html = renderToStaticMarkup(
    <LocaleProvider locale="en">
      <SupportCenter
        actorId="usr_member"
        initialFilters={{
          page: 2,
          q: '<script>alert("x")</script>',
          status: "resolved",
          category: "account",
        }}
      />
    </LocaleProvider>,
  );
  expect(html).toContain(`<search aria-label="${getDictionary("en").support.staffFilters}"`);
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
      <SupportCenter actorId="usr_member" staffMode />
    </LocaleProvider>,
  );
  expect(staff).toContain(`<search aria-label="${getDictionary("en").support.staffFilters}"`);
  expect(staff).not.toContain(getDictionary("en").support.newCase);
});
it("gates server-rendered support pages before showing private controls", async () => {
  mocks.session.mockResolvedValue(null);
  const guest = renderToStaticMarkup(await SupportPageSurface({}));
  expect(guest).toContain(
    `<h1 class="font-display text-primary">${getDictionary("en").support.title}</h1>`,
  );
  expect(guest).toContain("min-w-0 max-w-5xl");
  expect(guest).toContain("overflow-x-clip");
  expect(guest).toContain('href="/auth/login?next=%2Fsupport"');
  expect(guest).toContain('href="/auth/register?next=%2Fsupport"');
  expect(guest).toContain(getDictionary("en").workspace.createAccount);
  expect(guest).toContain(getDictionary("en").workspace.signInRequired);
  expect(guest).toContain(getDictionary("en").workspace.signInMessage);
  const filtered = renderToStaticMarkup(
    await SupportPageSurface({
      searchParams: Promise.resolve({ q: "billing", status: "open", category: "account" }),
    }),
  );
  expect(filtered).toContain(
    'href="/auth/login?next=%2Fsupport%3Fq%3Dbilling%26status%3Dopen%26category%3Daccount"',
  );
  expect(filtered).toContain(
    'href="/auth/register?next=%2Fsupport%3Fq%3Dbilling%26status%3Dopen%26category%3Daccount"',
  );
  expect(filtered).toContain(getDictionary("en").workspace.signInMessage);
  const caseGuest = renderToStaticMarkup(await SupportPageSurface({ id: `sup_${"a".repeat(24)}` }));
  expect(caseGuest).toContain(`href="/auth/login?next=%2Fsupport%2Fsup_${"a".repeat(24)}"`);
  expect(caseGuest).toContain(`href="/auth/register?next=%2Fsupport%2Fsup_${"a".repeat(24)}"`);
  mocks.session.mockResolvedValue({ id: "actor", role: "user" });
  const forbidden = renderToStaticMarkup(await SupportPageSurface({ staff: true }));
  expect(forbidden).toContain('role="alert"');
  expect(forbidden).toContain(supportWorkspaceCopy("en").forbidden);
  expect(forbidden).toContain('href="/support"');
  const missing = renderToStaticMarkup(await SupportPageSurface({ id: "../private" }));
  expect(missing).toContain('role="alert"');
  expect(missing).toContain(supportWorkspaceCopy("en").notFound);
  expect(missing).toContain('href="/support"');
  expect(missing).toContain(getDictionary("en").support.back);
});
it("rejects duplicate/unknown page filters and localizes no-index support metadata", async () => {
  mocks.locale = "ru";
  const invalidRequester = renderToStaticMarkup(
    await SupportPageSurface({ searchParams: Promise.resolve({ requesterId: "victim" }) }),
  );
  expect(invalidRequester).toContain('role="alert"');
  expect(invalidRequester).toContain(supportWorkspaceCopy("ru").queryInvalid);
  expect(invalidRequester).toContain('href="/support"');
  expect(
    renderToStaticMarkup(
      await SupportPageSurface({ searchParams: Promise.resolve({ status: ["open", "closed"] }) }),
    ),
  ).toContain(supportWorkspaceCopy("ru").queryInvalid);
  expect(await supportMetadata()).toEqual({
    title: getDictionary("ru").support.title,
    robots: { index: false, follow: false },
  });
  expect(await supportMetadata(true)).toEqual({
    title: getDictionary("ru").support.staffQueue,
    robots: { index: false, follow: false },
  });
});
it("remounts support list and thread when the authenticated actor changes", async () => {
  const id = `sup_${"a".repeat(24)}`;
  mocks.session.mockResolvedValue({ id: "actor_a", role: "user" });
  const listA = await SupportPageSurface({});
  const threadA = await SupportPageSurface({ id });
  mocks.session.mockResolvedValue({ id: "actor_b", role: "user" });
  const listB = await SupportPageSurface({});
  const threadB = await SupportPageSurface({ id });
  expect(listA.key).not.toBe(listB.key);
  expect(threadA.key).not.toBe(threadB.key);
});
