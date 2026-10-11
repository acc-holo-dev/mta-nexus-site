import type { ResourceMediaItem } from "@nexus/domain";
import { resourceMediaCopy } from "../lib/resource-media-i18n";
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
  if (!items.length) return null;
  return (
    <section className="nexus-panel space-y-4 p-5" aria-label={copy.title}>
      <h2 className="text-lg font-semibold text-primary">{copy.title}</h2>
      <ul className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.id}>
            <figure className="space-y-2">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block aspect-video overflow-hidden rounded-lg border border-base bg-inset"
              >
                <ResourcePreview
                  src={item.url}
                  title={item.caption || title}
                  fallback={copy.previewUnavailable}
                />
              </a>
              {item.caption && (
                <figcaption className="break-words text-sm text-secondary">
                  {item.caption}
                </figcaption>
              )}
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
