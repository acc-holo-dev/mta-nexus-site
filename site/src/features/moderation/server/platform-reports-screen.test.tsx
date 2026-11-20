import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { platformReportCopy } from "../platform-report-i18n";

const state = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  locale: "en" as "en" | "ru",
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("../../../lib/i18n/server", () => ({
  getRequestLocale: async () => state.locale,
}));
vi.mock("../../../lib/services/accounts/auth-service", () => ({
  authService: { getSession: async () => ({ id: "member" }) },
}));
vi.mock("../../../lib/services/moderation/platform-report-service", () => ({
  platformReportService: { listForReporter: state.list, detailForReporter: state.detail },
}));

import { PlatformReportsScreen } from "./platform-reports-screen";

beforeEach(() => {
  state.list.mockReset().mockResolvedValue({ reports: [], hasMore: false });
  state.detail.mockReset().mockResolvedValue(null);
});

it.each(["en", "ru"] as const)(
  "labels the reports page for %s in empty and unavailable states",
  async (locale) => {
    state.locale = locale;
    const copy = platformReportCopy(locale);
    const empty = renderToStaticMarkup(await PlatformReportsScreen({}));
    expect(empty).toContain(`<h1 class="break-words font-heading text-primary">${copy.title}</h1>`);
    expect(empty).toContain(copy.empty);
    state.list.mockRejectedValueOnce(new Error("unavailable"));
    const error = renderToStaticMarkup(await PlatformReportsScreen({}));
    expect(error).toContain(`<h1 class="break-words font-heading text-primary">${copy.title}</h1>`);
    expect(error).toContain(copy.unavailable);
  },
);

it("retains a page heading when a report detail is unavailable", async () => {
  state.locale = "en";
  const html = renderToStaticMarkup(await PlatformReportsScreen({ id: "missing" }));
  expect(html).toContain(
    `<h1 class="break-words font-heading text-primary">${platformReportCopy("en").detail}</h1>`,
  );
  expect(html).toContain(platformReportCopy("en").notFound);
});
