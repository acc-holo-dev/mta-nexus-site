import type { ResourceCopyMetadata } from "@nexus/domain";
import type { Locale } from "../../../lib/i18n";
import { panelSpace4P5 } from "../../shell/panel-shell";
import { typePrewrapBreak, typeSmSecondary } from "../../shell/type-shell";
import { resourceCopyCopy } from "../resource-copy-i18n";
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
    <dl className={panelSpace4P5}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className={typeSmSecondary}>{label}</dt>
          <dd className={typePrewrapBreak}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
