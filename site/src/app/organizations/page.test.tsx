import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
  directory: vi.fn(),
}));

vi.mock("../../lib/i18n-server", () => ({ getRequestLocale: async () => mocks.locale }));
vi.mock("../../components/discovery-directory", () => ({
  DirectoryFilters: () => <form aria-label="filters" />,
  DirectoryResults: mocks.directory,
}));

import { discoveryCopy } from "../../lib/discovery-copy";
import OrganizationsLoading from "./loading";
import OrganizationsPage from "./page";

beforeEach(() => {
  mocks.locale = "en";
  mocks.directory.mockReset();
  mocks.directory.mockResolvedValue(<p>directory-results</p>);
});

it("clips the organizations directory shell", async () => {
  const html = renderToStaticMarkup(await OrganizationsPage({ searchParams: Promise.resolve({}) }));
  expect(html).toContain("min-w-0 space-y-6 overflow-x-clip");
  expect(html).toContain(discoveryCopy("en").organizationsTitle);
  expect(html).toContain("directory-results");
});

it("clips the organizations loading shell on narrow layouts", async () => {
  const html = renderToStaticMarkup(await OrganizationsLoading());
  expect(html).toContain("min-w-0");
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain(discoveryCopy("en").organizationsLoading);
});
