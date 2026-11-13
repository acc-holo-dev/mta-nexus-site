import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("../../src/lib/i18n-server", () => ({
  getRequestLocale: vi.fn(async () => "en"),
}));

import Loading from "../../src/app/settings/loading";
import { getDictionary } from "../../src/lib/i18n";

beforeEach(() => {
  vi.clearAllMocks();
});

it("renders an honest settings loading shell", async () => {
  const copy = getDictionary("en").settings;
  const html = renderToStaticMarkup(await Loading());
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain('id="settings-loading-heading"');
  expect(html).toContain(`>${copy.title}<`);
  expect(html).toContain(copy.loading);
  expect(html).toContain('aria-live="polite"');
  expect(html).toContain("min-w-0");
  expect(html).toContain("overflow-x-clip");
});
