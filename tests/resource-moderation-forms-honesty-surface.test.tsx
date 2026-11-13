import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { getDictionary } from "../site/src/lib/i18n";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const state = vi.hoisted(() => ({ locale: "en" as "en" | "ru" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("../site/src/components/locale-context", () => ({
  useNexusLocale: () => ({
    locale: state.locale,
    dictionary: getDictionary(state.locale),
  }),
}));

import { BuildModerationControls } from "../site/src/components/build-moderation-controls";
import { BuildQuarantineControls } from "../site/src/components/build-quarantine-controls";
import { NewResourceForm } from "../site/src/components/new-resource-form";
import { ReportModerationControls } from "../site/src/components/report-moderation-controls";

const exclusive = [
  "site/src/components/new-resource-form.tsx",
  "site/src/components/author-resource-forms.tsx",
  "site/src/components/resource-media-editor.tsx",
  "site/src/components/resource-compatibility-form.tsx",
  "site/src/components/resource-variants-form.tsx",
  "site/src/components/resource-copy-form.tsx",
  "site/src/components/resource-lifecycle-controls.tsx",
  "site/src/components/resource-moderation-controls.tsx",
  "site/src/components/build-moderation-controls.tsx",
  "site/src/components/build-quarantine-controls.tsx",
  "site/src/components/content-moderation-controls.tsx",
  "site/src/components/report-moderation-controls.tsx",
  "site/src/components/verification-moderation-controls.tsx",
  "site/src/components/resource-release-watch-control.tsx",
  "site/src/components/resource-release-watch-batch-controls.tsx",
] as const;

it("locks resource and moderation form sources to ErrorState honesty chrome", () => {
  for (const path of exclusive) {
    const source = read(path);
    expect(source).toContain("ErrorState");
    expect(source).toContain("min-h-11");
    expect(source).not.toContain('role="alert"');
  }
});

it("locks resource media editor reorder/remove CTAs to size=touch", () => {
  const source = read("site/src/components/resource-media-editor.tsx");
  expect(source).toContain("EmptyState");
  expect(source).toContain('size="touch"');
  expect(source).not.toContain('size="sm"');
  expect(source.match(/size="touch"/gu)?.length ?? 0).toBeGreaterThanOrEqual(4);
});

it("locks resource variants reorder/remove to size=touch and noCandidates to EmptyState", () => {
  const source = read("site/src/components/resource-variants-form.tsx");
  expect(source).toContain("EmptyState");
  expect(source).toContain("copy.noCandidates");
  expect(source).toContain("copy.noCandidatesHint");
  expect(source).not.toMatch(/<p className="text-sm text-muted">\{copy\.noCandidates\}<\/p>/u);
  expect(source).toContain('size="touch"');
  expect(source).not.toContain('size="sm"');
  expect(source.match(/size="touch"/gu)?.length ?? 0).toBeGreaterThanOrEqual(3);

  const i18n = read("site/src/lib/resource-management-i18n.ts");
  expect(i18n).toContain("noCandidates:");
  expect(i18n).toContain("noCandidatesHint:");
  expect(i18n.match(/noCandidatesHint:/gu)?.length).toBe(2);
});

it("locks new resource post-create CTA to size=touch", () => {
  const source = read("site/src/components/new-resource-form.tsx");
  expect(source).toMatch(
    /onClick=\{startNewSubmission\}[\s\S]{0,80}?size="touch"|size="touch"[\s\S]{0,80}?onClick=\{startNewSubmission\}/u,
  );
  expect(source).not.toMatch(
    /onClick=\{startNewSubmission\}[\s\S]{0,80}?size="sm"|size="sm"[\s\S]{0,80}?onClick=\{startNewSubmission\}/u,
  );
});

it("locks new resource native controls to fieldControlClass without h-10 chrome", () => {
  const source = read("site/src/components/new-resource-form.tsx");
  expect(source).toContain("fieldControlClass");
  expect(source).toContain('className: "min-h-11"');
  expect(source).not.toContain("h-10");
  expect(source).not.toMatch(/const controlClass\s*=/u);
  expect(source).not.toMatch(/const textareaClass\s*=/u);
});

it("keeps additive honesty descriptions for form failure recovery", () => {
  expect(read("site/src/lib/i18n/en/publishing.ts")).toContain("createErrorDescription");
  expect(read("site/src/lib/i18n/ru/publishing.ts")).toContain("createErrorDescription");
  expect(read("site/src/lib/i18n/en/workspace.ts")).toContain("failedDescription");
  expect(read("site/src/lib/i18n/ru/workspace.ts")).toContain("uploadFailedDescription");
  expect(read("site/src/lib/resource-management-i18n.ts")).toContain("actionFailedDescription");
  expect(read("site/src/lib/resource-commerce-i18n.ts")).toContain("actionFailedDescription");
  expect(read("site/src/lib/resource-release-control-i18n.ts")).toContain(
    "actionFailedDescription",
  );
  expect(read("site/src/lib/resource-media-i18n.ts")).toContain("errorDescription");
  expect(read("site/src/lib/resource-copy-i18n.ts")).toContain("errorDescription");
  expect(read("site/src/lib/resource-release-watches-i18n.ts")).toContain("failedDescription");
  expect(read("site/src/lib/community-moderation-copy.ts")).toContain("decisionFailedDescription");
  expect(read("site/src/lib/verification-workspace-copy.ts")).toContain(
    "decisionFailedDescription",
  );
  expect(read("site/src/lib/resource-build-workspace-i18n.ts")).toContain("failedDescription");
  expect(read("site/src/lib/i18n/en/admin.ts")).toContain("quarantineBuildFailedDescription");
  expect(read("site/src/lib/i18n/ru/admin.ts")).toContain("reportDecisionFailedDescription");
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
