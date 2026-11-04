import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const state = vi.hoisted(() => ({ locale: "en" as "en" | "ru" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({
    locale: state.locale,
    dictionary: getDictionary(state.locale),
  }),
}));

import { BuildModerationControls } from "../apps/web/src/components/build-moderation-controls";
import { BuildQuarantineControls } from "../apps/web/src/components/build-quarantine-controls";
import { NewResourceForm } from "../apps/web/src/components/new-resource-form";
import { ReportModerationControls } from "../apps/web/src/components/report-moderation-controls";

const exclusive = [
  "apps/web/src/components/new-resource-form.tsx",
  "apps/web/src/components/author-resource-forms.tsx",
  "apps/web/src/components/resource-media-editor.tsx",
  "apps/web/src/components/resource-compatibility-form.tsx",
  "apps/web/src/components/resource-variants-form.tsx",
  "apps/web/src/components/resource-copy-form.tsx",
  "apps/web/src/components/resource-lifecycle-controls.tsx",
  "apps/web/src/components/resource-moderation-controls.tsx",
  "apps/web/src/components/build-moderation-controls.tsx",
  "apps/web/src/components/build-quarantine-controls.tsx",
  "apps/web/src/components/content-moderation-controls.tsx",
  "apps/web/src/components/report-moderation-controls.tsx",
  "apps/web/src/components/verification-moderation-controls.tsx",
  "apps/web/src/components/resource-release-watch-control.tsx",
  "apps/web/src/components/resource-release-watch-batch-controls.tsx",
] as const;

it("locks resource and moderation form sources to ErrorState honesty chrome", () => {
  for (const path of exclusive) {
    const source = read(path);
    expect(source).toContain("ErrorState");
    expect(source).toContain("min-h-11");
    expect(source).not.toContain('role="alert"');
  }
});

it("keeps additive honesty descriptions for form failure recovery", () => {
  expect(read("apps/web/src/lib/i18n/en/publishing.ts")).toContain("createErrorDescription");
  expect(read("apps/web/src/lib/i18n/ru/publishing.ts")).toContain("createErrorDescription");
  expect(read("apps/web/src/lib/i18n/en/workspace.ts")).toContain("failedDescription");
  expect(read("apps/web/src/lib/i18n/ru/workspace.ts")).toContain("uploadFailedDescription");
  expect(read("apps/web/src/lib/resource-management-i18n.ts")).toContain("actionFailedDescription");
  expect(read("apps/web/src/lib/resource-commerce-i18n.ts")).toContain("actionFailedDescription");
  expect(read("apps/web/src/lib/resource-release-control-i18n.ts")).toContain(
    "actionFailedDescription",
  );
  expect(read("apps/web/src/lib/resource-media-i18n.ts")).toContain("errorDescription");
  expect(read("apps/web/src/lib/resource-copy-i18n.ts")).toContain("errorDescription");
  expect(read("apps/web/src/lib/resource-release-watches-i18n.ts")).toContain("failedDescription");
  expect(read("apps/web/src/lib/community-moderation-copy.ts")).toContain(
    "decisionFailedDescription",
  );
  expect(read("apps/web/src/lib/verification-workspace-copy.ts")).toContain(
    "decisionFailedDescription",
  );
  expect(read("apps/web/src/lib/resource-build-workspace-i18n.ts")).toContain("failedDescription");
  expect(read("apps/web/src/lib/i18n/en/admin.ts")).toContain("quarantineBuildFailedDescription");
  expect(read("apps/web/src/lib/i18n/ru/admin.ts")).toContain("reportDecisionFailedDescription");
});

it.each(["en", "ru"] as const)(
  "renders new resource and moderation control shells with touch CTAs in %s",
  (locale) => {
    state.locale = locale;
    const form = renderToStaticMarkup(<NewResourceForm actorId="author" />);
    expect(form).toContain("min-h-11");
    expect(form).toContain("min-w-0");
    expect(form).toContain("overflow-x-clip");

    const build = renderToStaticMarkup(
      <BuildModerationControls buildId="bld_clean" scanStatus="clean" hasScanProvenance />,
    );
    expect(build).toContain("min-h-11");

    const quarantine = renderToStaticMarkup(
      <BuildQuarantineControls buildId="bld_pub" status="published" />,
    );
    expect(quarantine).toContain("min-h-11");

    const report = renderToStaticMarkup(<ReportModerationControls reportId="rep_1" />);
    expect(report).toContain("min-h-11");
  },
);
