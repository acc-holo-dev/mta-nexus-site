import type { ResourceMediaItem } from "@nexus/domain";
import { createElement, createRef, type MouseEvent, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ResourceGallery } from "../apps/web/src/components/resource-gallery";
import { ResourceGalleryLightbox } from "../apps/web/src/components/resource-gallery-lightbox";
import {
  shouldOpenGalleryLightbox,
  stepGalleryIndex,
} from "../apps/web/src/components/resource-gallery-interaction";
import { resourceMediaCopy } from "../apps/web/src/lib/resource-media-i18n";
import { clickedDialogBackdrop } from "../apps/web/src/components/use-modal-dialog";

vi.mock("../apps/web/src/components/use-modal-dialog", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../apps/web/src/components/use-modal-dialog")>();
  return {
    ...original,
    useModalDialog: () => createRef<HTMLDialogElement>(),
  };
});

vi.mock("@nexus/ui", async () => {
  const React = await import("react");
  return {
    Button: ({
      children,
      type,
      disabled,
      onClick,
      "aria-label": ariaLabel,
    }: {
      children: ReactNode;
      type?: "button";
      disabled?: boolean;
      onClick?: () => void;
      "aria-label"?: string;
    }) =>
      React.createElement(
        "button",
        { type: type ?? "button", disabled, onClick, "aria-label": ariaLabel },
        children,
      ),
    buttonClassName: () => "mock-button-primary",
  };
});

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
        defaultPrevented: true,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      }),
    ).toBe(false);
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
        button: 0,
        defaultPrevented: false,
        metaKey: true,
        ctrlKey: false,
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
    expect(stepGalleryIndex(0, 1, 0)).toBeNull();
  });

  it("treats only outside-dialog clicks as backdrop dismiss", () => {
    const dialog = {
      left: 100,
      right: 300,
      top: 50,
      bottom: 250,
    } as DOMRect;
    const currentTarget = {
      getBoundingClientRect: () => dialog,
    } as HTMLDialogElement;

    expect(
      clickedDialogBackdrop({
        target: currentTarget,
        currentTarget,
        clientX: 50,
        clientY: 150,
      } as unknown as MouseEvent<HTMLDialogElement>),
    ).toBe(true);
    expect(
      clickedDialogBackdrop({
        target: {} as EventTarget,
        currentTarget,
        clientX: 150,
        clientY: 150,
      } as unknown as MouseEvent<HTMLDialogElement>),
    ).toBe(false);
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

describe("ResourceGalleryLightbox", () => {
  it.each(["en", "ru"] as const)(
    "exposes modal dialog controls and navigation labels in %s",
    (locale) => {
      const copy = resourceMediaCopy(locale);
      const html = renderToStaticMarkup(
        createElement(ResourceGalleryLightbox, {
          items,
          activeIndex: 0,
          title: "Product",
          locale,
          onClose: () => undefined,
          onActiveIndexChange: () => undefined,
        }),
      );

      expect(html).toContain("<dialog");
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain(`aria-label="${copy.lightboxTitle}"`);
      expect(html).toContain(`aria-label="${copy.lightboxClose}"`);
      expect(html).toContain(`aria-label="${copy.lightboxNext}"`);
      expect(html).toContain(`aria-label="${copy.lightboxPrevious}"`);
      expect(html).toContain('alt="First"');
      expect(html).toContain('href="/api/resource-media/rmi_a"');
      expect(html).toContain(copy.lightboxOpenOriginal);
      expect(html).toContain("disabled");
    },
  );
});
