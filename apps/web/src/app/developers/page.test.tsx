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

import { getDictionary } from "../../lib/i18n";
import DevelopersLoading from "./loading";
import DevelopersPage from "./page";

beforeEach(() => {
  mocks.locale = "en";
  mocks.directory.mockReset();
  mocks.directory.mockResolvedValue(<p>directory-results</p>);
});

it("clips the developers directory shell", async () => {
  const html = renderToStaticMarkup(await DevelopersPage({ searchParams: Promise.resolve({}) }));
  expect(html).toContain("min-w-0 space-y-6 overflow-x-clip");
  expect(html).toContain("MTA Developer");
  expect(html).toContain("directory-results");
});

it("clips the developers loading shell on narrow layouts", async () => {
  const html = renderToStaticMarkup(await DevelopersLoading());
  expect(html).toContain("min-w-0");
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain(getDictionary("en").developers.loading);
});
