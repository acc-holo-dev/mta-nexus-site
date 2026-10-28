import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";

const state = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
}));

vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({
    locale: state.locale,
    dictionary: getDictionary(state.locale),
  }),
}));

import { NewResourceForm } from "../apps/web/src/components/new-resource-form";
import {
  MtaMetaInspectorPanel,
  metaInspectorClientPolicy,
  metaInspectorPreview,
  requestMtaMetaInspection,
} from "../apps/web/src/components/mta-meta-inspector-panel";

describe("author-facing MTA meta inspector", () => {
  it.each(["en", "ru"] as const)(
    "renders the optional structural inspector before resource submission in %s",
    (locale) => {
      state.locale = locale;
      const html = renderToStaticMarkup(<NewResourceForm actorId="author" />);
      const copy = getDictionary(locale).metaInspector;

      expect(html).toContain(copy.title);
      expect(html).toContain(copy.description);
      expect(html).toContain(`accept="${metaInspectorClientPolicy.fileAccept}"`);
      expect(html.indexOf(copy.title)).toBeLessThan(html.indexOf("<form"));
      expect(html).not.toMatch(/Resource is safe|Verified resource/u);
    },
  );

  it("keeps the inspector action separate from form submission", () => {
    state.locale = "en";
    const html = renderToStaticMarkup(
      <MtaMetaInspectorPanel onApplyMinimumVersion={() => undefined} />,
    );
    const copy = getDictionary("en").metaInspector;

    expect(html).toContain(`type="button"`);
    expect(html).toContain(copy.inspect);
    expect(html).toContain(copy.fileLabel);
    expect(html).not.toContain("<form");
  });

  it("performs one authenticated uncached bounded inspection request", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            inspection: {
              byteLength: 7,
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
    );

    const result = await requestMtaMetaInspection("<meta/>", fetcher as typeof fetch);

    expect(result.response.status).toBe(200);
    expect(result.data).toMatchObject({
      inspection: {
        byteLength: 7,
      },
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/resources/inspect-meta",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
        body: "<meta/>",
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("keeps client limits explicit and bounds ACL/export previews", () => {
    expect(metaInspectorClientPolicy).toEqual({
      maxBytes: 256 * 1024,
      previewEntries: 20,
      requestTimeoutMs: 10_000,
      fileAccept: ".xml,text/xml,text/plain",
    });

    const entries = Array.from({ length: 25 }, (_, index) => index);
    expect(metaInspectorPreview(entries)).toEqual(entries.slice(0, 20));
    expect(entries).toHaveLength(25);
  });
});
