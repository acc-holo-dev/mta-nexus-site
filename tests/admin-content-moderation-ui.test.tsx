import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";

const state = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
}));

const refresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("../apps/web/src/components/locale-context", async () => {
  const actual = await vi.importActual<typeof import("../apps/web/src/lib/i18n")>(
    "../apps/web/src/lib/i18n",
  );
  return {
    useNexusLocale: () => ({
      locale: state.locale,
      dictionary: actual.getDictionary(state.locale),
    }),
  };
});

import { ContentModerationControls } from "../apps/web/src/components/content-moderation-controls";

describe("admin content moderation controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.locale = "en";
  });

  it.each(["en", "ru"] as const)(
    "renders localized %s moderation actions with review-note gating",
    (locale) => {
      state.locale = locale;
      const copy = getDictionary(locale).admin;
      const html = renderToStaticMarkup(
        <ContentModerationControls
          contentId="cnt_behavior"
          expectedUpdatedAt="2026-10-11T00:00:00.000Z"
        />,
      );

      expect(html).toContain(copy.reviewNote);
      expect(html).toContain(copy.reviewNoteAudit);
      expect(html).toContain(copy.reviewNoteHint);
      expect(html).toContain(`>${copy.publish}<`);
      expect(html).toContain(`>${copy.archive}<`);
      expect(html).toContain("bg-success-soft");
      expect(html).toContain("rounded-lg");
      expect((html.match(/disabled=""/gu) ?? []).length).toBe(2);
      expect(html).toContain('aria-busy="false"');
    },
  );

  it("keeps RU controls free of hard-coded English moderation labels", () => {
    state.locale = "ru";
    const html = renderToStaticMarkup(
      <ContentModerationControls
        contentId="cnt_behavior"
        expectedUpdatedAt="2026-10-11T00:00:00.000Z"
      />,
    );
    const en = getDictionary("en").admin;

    expect(html).not.toContain(`>${en.publish}<`);
    expect(html).not.toContain(`>${en.archive}<`);
  });
});
