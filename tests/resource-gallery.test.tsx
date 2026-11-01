import type { ResourceMediaItem } from "@nexus/domain";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResourceGallery } from "../apps/web/src/components/resource-gallery";
import {
  shouldOpenGalleryLightbox,
  stepGalleryIndex,
} from "../apps/web/src/components/resource-gallery-interaction";

const items: ResourceMediaItem[] = [
  {
    id: "rmi_a",
    caption: "First",
    position: 0,
    width: 20,
    height: 10,
    url: "/api/resource-media/rmi_a",
  },
  {
    id: "rmi_b",
    caption: "",
    position: 1,
    width: 20,
    height: 10,
    url: "/api/resource-media/rmi_b",
  },
];

describe("resource gallery lightbox interaction", () => {
  it("opens only on unmodified primary clicks", () => {
    expect(
      shouldOpenGalleryLightbox({
        button: 0,
        defaultPrevented: false,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe(true);
    expect(
      shouldOpenGalleryLightbox({
        button: 0,
        defaultPrevented: false,
        metaKey: false,
        ctrlKey: true,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe(false);
    expect(
      shouldOpenGalleryLightbox({
        button: 1,
        defaultPrevented: false,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe(false);
  });

  it("steps within gallery bounds", () => {
    expect(stepGalleryIndex(0, -1, 2)).toBeNull();
    expect(stepGalleryIndex(0, 1, 2)).toBe(1);
    expect(stepGalleryIndex(1, 1, 2)).toBeNull();
  });
});

describe("resource gallery markup", () => {
  it.each(["en", "ru"] as const)("keeps original links and expand affordance in %s", (locale) => {
    const html = renderToStaticMarkup(
      createElement(ResourceGallery, { items, title: "Product", locale }),
    );
    expect(html).toContain('href="/api/resource-media/rmi_a"');
    expect(html).toContain('href="/api/resource-media/rmi_b"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain(locale === "ru" ? "Увеличить в галерее" : "View larger in gallery");
    expect(html).not.toContain("<dialog");
  });
});
