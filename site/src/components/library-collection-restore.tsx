"use client";
import type { LibraryCollectionChangesPreview } from "@nexus/domain";
import { useState } from "react";
import { LibraryCollectionReconcileForm } from "./library-collection-reconcile";
import {
  collectionReceiptHref,
  libraryCollectionReceiptsCopy,
} from "../lib/library-collection-receipts-i18n";
export function LibraryCollectionRestoreControls({
  preview,
  receiptId,
  locale,
}: {
  preview: LibraryCollectionChangesPreview;
  receiptId: string;
  locale: "ru" | "en";
}) {
  const [frozen, setFrozen] = useState<{
    preview: LibraryCollectionChangesPreview;
    receiptId: string;
  } | null>(null);
  const shown = frozen ?? { preview, receiptId };
  return (
    <section className="space-y-4" aria-label={libraryCollectionReceiptsCopy(locale).restore}>
      <h2>{libraryCollectionReceiptsCopy(locale).restore}</h2>
      <LibraryCollectionReconcileForm
        preview={shown.preview}
        locale={locale}
        returnHref={collectionReceiptHref(shown.receiptId)}
        onFreeze={() => setFrozen({ preview, receiptId })}
      />
    </section>
  );
}
