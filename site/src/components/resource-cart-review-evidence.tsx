import type { ResourceCartReviewItem } from "@nexus/domain";
import type { Locale } from "../lib/i18n";
import { resourceCartReceiptsCopy } from "../lib/resource-cart-receipts-i18n";
export function ResourceCartReviewEvidence({
  item,
  locale,
}: {
  item: Pick<
    ResourceCartReviewItem,
    "version" | "sha256Hash" | "fileSizeBytes" | "mtaMinVersion" | "dependencies"
  >;
  locale: Locale;
}) {
  const copy = resourceCartReceiptsCopy(locale);
  return (
    <dl className="space-y-2 text-sm text-secondary">
      <div>
        <dt>{copy.version}</dt>
        <dd>{item.version}</dd>
      </div>
      <div>
        <dt>{copy.size}</dt>
        <dd>{item.fileSizeBytes}</dd>
      </div>
      <div>
        <dt>{copy.hash}</dt>
        <dd className="break-all font-mono text-xs">{item.sha256Hash}</dd>
      </div>
      <div>
        <dt>{copy.minimum}</dt>
        <dd>{item.mtaMinVersion ?? copy.none}</dd>
      </div>
      <div>
        <dt>{copy.dependencies}</dt>
        <dd className="break-words">{item.dependencies?.join(", ") || copy.none}</dd>
      </div>
    </dl>
  );
}
