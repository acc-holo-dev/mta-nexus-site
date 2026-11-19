import type { Metadata } from "next";
import { librarySelectionBatchesCopy } from "../../../../../../features/library/library-selection-batches-i18n";
import { LibrarySelectionBatchScreen } from "../../../../../../features/library/selection-batch-server";
import { getRequestLocale } from "../../../../../../lib/i18n/server";

const pageShellClass = "min-w-0 overflow-x-clip";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${librarySelectionBatchesCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export default function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className={pageShellClass}>
      <LibrarySelectionBatchScreen {...props} />
    </div>
  );
}
