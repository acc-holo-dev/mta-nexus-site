import type { ResourceCopyMetadata } from "@nexus/domain";
import type { Locale } from "../lib/i18n";
import { resourceCopyCopy } from "../lib/resource-copy-i18n";
export function ResourceCopyMetadataView({
  metadata,
  locale,
}: {
  metadata: ResourceCopyMetadata;
  locale: Locale;
}) {
  const c = resourceCopyCopy(locale);
  const rows = [
    [c.type, c.types[metadata.type]],
    [c.shortDescription, metadata.shortDescription || c.none],
    [c.description, metadata.description],
    [c.tags, metadata.tags.join(", ") || c.none],
    [c.minimum, metadata.compatibility.mtaMinVersion || c.none],
    [c.dependencies, metadata.compatibility.dependencies.join(", ") || c.none],
  ];
  return (
    <dl className="nexus-panel space-y-4 p-5">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-sm text-secondary">{label}</dt>
          <dd className="whitespace-pre-wrap break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
