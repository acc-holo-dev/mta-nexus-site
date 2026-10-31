import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";
import { resourceCopyCopy } from "../apps/web/src/lib/resource-copy-i18n";
import { getResourceManagementCopy } from "../apps/web/src/lib/resource-management-i18n";
import { getResourcePublisherCopy } from "../apps/web/src/lib/resource-publisher-i18n";
import { getUserPlatformCopy } from "../apps/web/src/lib/user-platform-copy";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children }: { href: string; children: ReactNode }) =>
      React.createElement("a", { href }, children),
  };
});

const localeState = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
}));

vi.mock("../apps/web/src/components/locale-context", async () => {
  const { getDictionary } = await import("../apps/web/src/lib/i18n");
  return {
    useNexusLocale: () => ({
      locale: localeState.locale,
      dictionary: getDictionary(localeState.locale),
    }),
  };
});

vi.mock("@nexus/ui", async () => {
  const { createElement } = await import("react");
  return {
    fieldClass: "mock-field",
    fieldClassBlock: "mock-field-block",
    Avatar: () => createElement("div", { "data-ui": "avatar" }),
    Button: ({
      children,
      type,
      isLoading,
      variant,
      disabled,
      onClick,
      className,
    }: {
      children: ReactNode;
      type?: "button" | "submit";
      isLoading?: boolean;
      variant?: string;
      disabled?: boolean;
      onClick?: () => void;
      className?: string;
    }) =>
      createElement(
        "button",
        {
          type,
          "data-ui": "button",
          "data-variant": variant || "primary",
          "aria-busy": isLoading || undefined,
          disabled: disabled || isLoading || undefined,
          onClick,
          className,
        },
        children,
      ),
    Input: ({
      label,
      id,
      error: _error,
      ...props
    }: {
      label?: string;
      id?: string;
      error?: string;
      name?: string;
      [key: string]: unknown;
    }) =>
      createElement(
        "div",
        { "data-ui": "input" },
        label ? createElement("label", { htmlFor: id }, label) : null,
        createElement("input", { id, ...props }),
      ),
  };
});

import { NewResourceForm } from "../apps/web/src/components/new-resource-form";
import { PublicProfileForm } from "../apps/web/src/components/public-profile-form";
import { ResourceCompatibilityForm } from "../apps/web/src/components/resource-compatibility-form";
import { ResourceCopyForm } from "../apps/web/src/components/resource-copy-form";
import { ResourceLifecycleControls } from "../apps/web/src/components/resource-lifecycle-controls";
import { ResourcePublisherFilters } from "../apps/web/src/components/resource-publisher-filters";

describe("workspace and resource UI surface", () => {
  it.each(["en", "ru"] as const)(
    "publishes new resources with labeled @nexus/ui inputs in %s",
    (locale) => {
      localeState.locale = locale;
      const copy = getDictionary(locale).publishing;
      const html = renderToStaticMarkup(createElement(NewResourceForm, { actorId: "author" }));
      expect(html).toContain(copy.resourceTitle);
      expect(html).toContain('data-ui="input"');
      expect(html).toContain('for="resource-title"');
      expect(html).toContain('for="resource-slug"');
      expect(html).toContain('for="resource-type"');
      expect(html).toContain('for="resource-build-file"');
      expect(html).toContain('data-ui="button"');
    },
  );

  it.each(["en", "ru"] as const)(
    "filters publisher resources with labeled controls in %s",
    (locale) => {
      localeState.locale = locale;
      const copy = getResourcePublisherCopy(locale);
      const html = renderToStaticMarkup(
        createElement(ResourcePublisherFilters, {
          locale,
          statusCounts: { draft: 1, published: 2 },
          query: {
            status: "all",
            q: "",
            type: "all",
            scope: "all",
            readiness: "all",
            sort: "updated",
            page: 1,
          },
        }),
      );
      expect(html).toContain(copy.search);
      expect(html).toContain('data-ui="input"');
      expect(html).toContain('for="publisher-search"');
      expect(html).toContain('for="publisher-type"');
      expect(html).toContain('data-ui="button"');
      expect(html).toContain(copy.apply);
    },
  );

  it("copies a resource through labeled Input fields", () => {
    localeState.locale = "en";
    const copy = resourceCopyCopy("en");
    const html = renderToStaticMarkup(
      createElement(ResourceCopyForm, {
        preview: {
          reviewDigest: "a".repeat(64),
          metadata: {
            description: "Resource description",
            shortDescription: "Resource summary",
            type: "script",
            tags: ["roleplay"],
            compatibility: { mtaMinVersion: "1.6.0", dependencies: ["core"] },
          },
          source: {
            id: "prd_source",
            title: "Source Resource",
            slug: "source-resource",
            status: "published",
            scope: "personal",
            updatedAt: "2026-10-10T12:00:00.000Z",
          },
        },
      }),
    );
    expect(html).toContain(copy.notice);
    expect(html).toContain('data-ui="input"');
    expect(html).toContain(copy.create);
    expect(html).toContain('data-ui="button"');
  });

  it("edits compatibility and lifecycle with shared buttons", () => {
    localeState.locale = "en";
    const management = getResourceManagementCopy("en");
    const compatibility = renderToStaticMarkup(
      createElement(ResourceCompatibilityForm, {
        product: {
          id: "prd_a",
          updatedAt: "2026-10-10T12:00:00.000Z",
          suspended: false,
          compatibility: { mtaMinVersion: "1.6.0", dependencies: ["core"] },
        },
      }),
    );
    expect(compatibility).toContain(management.mta);
    expect(compatibility).toContain('data-ui="input"');
    expect(compatibility).toContain('data-ui="button"');

    const lifecycle = renderToStaticMarkup(
      createElement(ResourceLifecycleControls, {
        product: {
          id: "prd_a",
          status: "draft",
          updatedAt: "2026-10-10T12:00:00.000Z",
        },
      }),
    );
    expect(lifecycle).toContain('data-ui="button"');
    expect(lifecycle).toContain('id="');
  });

  it.each(["en", "ru"] as const)("localizes the workspace profile editor shell in %s", (locale) => {
    localeState.locale = locale;
    const copy = getUserPlatformCopy(locale);
    const html = renderToStaticMarkup(createElement(PublicProfileForm));
    expect(html).toContain(copy.profile);
    expect(html).toContain(copy.loading);
    expect(html).toContain('id="public-profile-heading"');
  });

  it("keeps RU and EN resource workspace copy distinct", () => {
    const en = getDictionary("en");
    const ru = getDictionary("ru");
    expect(en.publishing.resourceTitle).not.toBe(ru.publishing.resourceTitle);
    expect(en.publishing.submit).not.toBe(ru.publishing.submit);
    expect(getResourcePublisherCopy("en").apply).not.toBe(getResourcePublisherCopy("ru").apply);
    expect(resourceCopyCopy("en").create).not.toBe(resourceCopyCopy("ru").create);
  });
});
