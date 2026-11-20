vi.mock("server-only", () => ({}));

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
  session: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/link", () => ({ default: "a" }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace/organizations",
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("../../src/lib/i18n/server", () => ({
  getRequestLocale: async () => state.locale,
}));
vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: { getSession: state.session },
}));
vi.mock("../../src/lib/services/organizations/organization-workspace-service", () => ({
  organizationWorkspaceService: { list: state.list, get: state.get },
}));

import NewOrganization from "../../src/app/workspace/organizations/new/page";
import { getOrganizationCopy } from "../../src/features/organizations/organization-workspace-copy";
import { OrganizationsPage as Directory } from "../../src/features/organizations/server/directory-page";
import Workspace from "../../src/features/organizations/server/workspace-page";

beforeEach(() => {
  vi.resetAllMocks();
  state.locale = "en";
  state.session.mockResolvedValue({ id: "actor", role: "user" });
});

it.each(["en", "ru"] as const)(
  "preserves directory and workspace filters when session lookup fails in %s",
  async (locale) => {
    state.locale = locale;
    state.session.mockRejectedValue(new Error("PRIVATE_SESSION"));
    const directory = renderToStaticMarkup(
      await Directory({ searchParams: Promise.resolve({ q: "team & maps", page: "2" }) }),
    );
    const workspace = renderToStaticMarkup(
      await Workspace({
        params: Promise.resolve({ id: "org" }),
        searchParams: Promise.resolve({ q: "team & maps", page: "2" }),
      }),
    );
    for (const html of [directory, workspace]) {
      expect(html).toContain(`>${getOrganizationCopy(locale).title}</h1>`);
      expect(html).toContain(getOrganizationCopy(locale).unavailable);
      expect(html).not.toContain("/auth/login");
      expect(html).not.toContain("PRIVATE_SESSION");
    }
    expect(directory).toContain('href="/workspace/organizations?q=team+%26+maps&amp;page=2"');
    expect(workspace).toContain('href="/workspace/organizations/org?q=team+%26+maps&amp;page=2"');
    expect(state.list).not.toHaveBeenCalled();
    expect(state.get).not.toHaveBeenCalled();
    const invalid = renderToStaticMarkup(
      await Workspace({
        params: Promise.resolve({ id: "../private" }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(invalid).toContain('href="/workspace/organizations"');
    expect(invalid).not.toContain("../private");
  },
);
it.each(["en", "ru"] as const)(
  "offers a safe retry before creating an organization in %s",
  async (locale) => {
    state.locale = locale;
    state.session.mockRejectedValueOnce(new Error("PRIVATE_SESSION"));
    const html = renderToStaticMarkup(await NewOrganization());
    const copy = getOrganizationCopy(locale);
    expect(html).toContain(`>${copy.create}</h1>`);
    expect(html).toContain(copy.unavailable);
    expect(html).toContain('href="/workspace/organizations/new"');
    expect(html).not.toContain("/auth/login");
    expect(html).not.toContain("PRIVATE_SESSION");
  },
);

it("retains a workspace heading when its data cannot be read", async () => {
  state.get.mockRejectedValue(new Error("offline"));
  const html = renderToStaticMarkup(
    await Workspace({ params: Promise.resolve({ id: "org" }), searchParams: Promise.resolve({}) }),
  );
  expect(html).toContain(`>${getOrganizationCopy("en").title}</h1>`);
  expect(html).toContain(getOrganizationCopy("en").unavailable);
});
it("keeps filters in workspace retry and guest sign-in links", async () => {
  const props = {
    params: Promise.resolve({ id: "org" }),
    searchParams: Promise.resolve({ q: "maps", page: "2" }),
  };
  state.get.mockRejectedValue(new Error("offline"));
  const failed = renderToStaticMarkup(await Workspace(props));
  expect(failed).toContain('href="/workspace/organizations/org?q=maps&amp;page=2"');
  state.session.mockResolvedValue(null);
  const guest = renderToStaticMarkup(await Workspace(props));
  expect(guest).toContain("next=%2Fworkspace%2Forganizations%2Forg%3Fq%3Dmaps%26page%3D2");
  const directory = renderToStaticMarkup(
    await Directory({ searchParams: Promise.resolve({ q: "maps", page: "2" }) }),
  );
  expect(directory).toContain("next=%2Fworkspace%2Forganizations%3Fq%3Dmaps%26page%3D2");
});
