"use client";

import type { ResourceMediaItem } from "@nexus/domain";
import { useState } from "react";
import { panelSpace4P5 } from "../../shell/panel-shell";
import { typeBreakSmSecondary, typeGrid2Gap4, typeLgSemiboldPrimary } from "../../shell/type-shell";
import { shouldOpenGalleryLightbox } from "../model/resource-gallery-interaction";
import { resourceMediaCopy } from "../resource-media-i18n";
import { ResourceGalleryLightbox } from "./resource-gallery-lightbox";
import { ResourcePreview } from "./resource-preview";

export function ResourceGallery({
  items,
  title,
  locale,
}: {
  items: ResourceMediaItem[];
  title: string;
  locale: "ru" | "en";
}) {
  const copy = resourceMediaCopy(locale);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  if (!items.length) return null;
  return (
    <section className={panelSpace4P5} aria-label={copy.title}>
      <h2 className={typeLgSemiboldPrimary}>{copy.title}</h2>
      <ul className={typeGrid2Gap4}>
        {items.map((item, index) => (
          <li key={item.id}>
            <figure className="space-y-2">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-haspopup="dialog"
                aria-label={copy.lightboxExpand}
                className="group block aspect-video overflow-hidden rounded-lg border border-base bg-inset"
                onClick={(event) => {
                  if (!shouldOpenGalleryLightbox(event)) return;
                  event.preventDefault();
                  setActiveIndex(index);
                }}
              >
                <ResourcePreview
                  src={item.url}
                  title={item.caption || title}
                  fallback={copy.previewUnavailable}
                />
              </a>
              {item.caption && (
                <figcaption className={typeBreakSmSecondary}>{item.caption}</figcaption>
              )}
            </figure>
          </li>
        ))}
      </ul>
      {activeIndex !== null && (
        <ResourceGalleryLightbox
          items={items}
          activeIndex={activeIndex}
          title={title}
          locale={locale}
          onClose={() => setActiveIndex(null)}
          onActiveIndexChange={setActiveIndex}
        />
      )}
    </section>
  );
}
