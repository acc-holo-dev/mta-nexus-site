import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", async () => {
  const ReactModule = await import("react");
  return {
    default: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children?: React.ReactNode;
      [key: string]: unknown;
    }) => ReactModule.createElement("a", { href, ...props }, children),
  };
});

import GlobalError, { detectGlobalErrorLocale } from "../apps/web/src/app/global-error";
import ErrorPage from "../apps/web/src/app/error";
import { LocaleProvider } from "../apps/web/src/components/locale-context";
import { getDictionary } from "../apps/web/src/lib/i18n";
import { readSafePublicErrorReference } from "../apps/web/src/lib/safe-public-error-reference";

const SECRET = "super-secret-token-do-not-leak";
const STACK_LINE = "    at boom (/app/secret.ts:1:1)";

function makeError(message: string, digest?: string): Error & { digest?: string } {
  const error = new Error(message) as Error & { digest?: string };
  error.stack = `Error: ${message}\n${STACK_LINE}`;
  if (digest !== undefined) {
    error.digest = digest;
  }
  return error;
}

describe("safe public error reference helper", () => {
  it("returns only a truthy opaque digest and never invents one", () => {
    expect(readSafePublicErrorReference(undefined)).toBeNull();
    expect(readSafePublicErrorReference({})).toBeNull();
    expect(readSafePublicErrorReference({ digest: "" })).toBeNull();
    expect(readSafePublicErrorReference({ digest: "   " })).toBeNull();
    expect(readSafePublicErrorReference({ digest: "has spaces" })).toBeNull();
    expect(readSafePublicErrorReference({ digest: "line\nbreak" })).toBeNull();
    expect(readSafePublicErrorReference({ digest: "a".repeat(129) })).toBeNull();
    expect(readSafePublicErrorReference({ digest: "  abc123DEF  " })).toBe("abc123DEF");
  });
});

describe("global-error autonomy and public reference", () => {
  it("stays autonomous: Retry/Home, locale cookie, no shell/provider CSS classes", () => {
    expect(detectGlobalErrorLocale("nexus_locale=ru")).toBe("ru");

    const html = renderToStaticMarkup(
      React.createElement(GlobalError, {
        error: makeError("boom"),
        reset: () => undefined,
      }),
    );

    expect(html).toMatch(/^<html lang="en">/u);
    expect(html).toContain("<body");
    expect(html).toContain("style=");
    expect(html).toContain(">Try again</button>");
    expect(html).toContain('href="/"');
    expect(html).toContain(">Home</a>");
    expect(html).not.toContain("class=");
    expect(html).not.toContain("nexus-shell");
    expect(html).not.toContain("data-testid=\"error-public-reference\"");
  });

  it("shows digest only when present and never leaks message/stack/secrets", () => {
    const withDigest = renderToStaticMarkup(
      React.createElement(GlobalError, {
        error: makeError(`leak:${SECRET}`, "digest_9f3a2c"),
        reset: () => undefined,
      }),
    );

    expect(withDigest).toContain('data-testid="error-public-reference"');
    expect(withDigest).toContain(">digest_9f3a2c</code>");
    expect(withDigest).toContain("Support reference");
    expect(withDigest).toContain("Include this code when contacting support.");
    expect(withDigest).toContain(">Copy reference</button>");
    expect(withDigest).not.toContain(SECRET);
    expect(withDigest).not.toContain("leak:");
    expect(withDigest).not.toContain(STACK_LINE);
    expect(withDigest).not.toContain("/app/secret.ts");

    const withoutDigest = renderToStaticMarkup(
      React.createElement(GlobalError, {
        error: makeError(`leak:${SECRET}`),
        reset: () => undefined,
      }),
    );

    expect(withoutDigest).not.toContain("data-testid=\"error-public-reference\"");
    expect(withoutDigest).not.toContain("Support reference");
    expect(withoutDigest).not.toContain(SECRET);
    expect(withoutDigest).not.toMatch(/ref[_-]?[0-9a-f]{8,}/iu);
  });

  it("keeps EN fallback for static markup while cookie detection supports RU", () => {
    expect(detectGlobalErrorLocale("foo=1; nexus_locale=ru")).toBe("ru");
    expect(detectGlobalErrorLocale("nexus_locale=en")).toBe("en");

    const html = renderToStaticMarkup(
      React.createElement(GlobalError, {
        error: makeError("x", "ru_ref_01"),
        reset: () => undefined,
      }),
    );

    // Cookie locale applies client-side; SSR/static markup stays EN fallback.
    expect(html).toMatch(/^<html lang="en">/u);
    expect(html).toContain("Support reference");
    expect(html).not.toContain("Код для поддержки");
    expect(html).toContain(">ru_ref_01</code>");
  });
});

describe("segment error boundary public reference", () => {
  it.each(["en", "ru"] as const)(
    "renders localized Retry/Home and optional digest in %s without leaking internals",
    (locale) => {
      const dictionary = getDictionary(locale);
      const html = renderToStaticMarkup(
        <LocaleProvider locale={locale}>
          <ErrorPage error={makeError(`leak:${SECRET}`, "seg_digest_42")} reset={() => undefined} />
        </LocaleProvider>,
      );

      expect(html).toContain(`>${dictionary.errors.retry}</span>`);
      expect(html).toContain(`>${dictionary.errors.home}</span>`);
      expect(html).toContain('href="/"');
      expect(html).toContain(dictionary.errors.referenceLabel);
      expect(html).toContain(dictionary.errors.referenceHint);
      expect(html).toContain(dictionary.errors.copyReference);
      expect(html).toContain(">seg_digest_42</code>");
      expect(html).not.toContain(SECRET);
      expect(html).not.toContain(STACK_LINE);
    },
  );

  it("omits reference UI when digest is absent and does not invent an ID", () => {
    const html = renderToStaticMarkup(
      <LocaleProvider locale="en">
        <ErrorPage error={makeError(`leak:${SECRET}`)} reset={() => undefined} />
      </LocaleProvider>,
    );

    expect(html).not.toContain("data-testid=\"error-public-reference\"");
    expect(html).not.toContain("Support reference");
    expect(html).not.toContain(SECRET);
    expect(html).not.toMatch(/ref[_-]?[0-9a-f]{8,}/iu);
  });
});
