import type { Metadata } from "next";
import { resourceCopyCopy } from "../../../../../../features/resources/resource-copy-i18n";
import { ResourceCopyReceiptScreen } from "../../../../../../features/resources/resource-copy-receipt-server";
import { getRequestLocale } from "../../../../../../lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${resourceCopyCopy(await getRequestLocale()).recorded} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page(props: {
  params: Promise<{ id: string; receiptId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ResourceCopyReceiptScreen(props);
}
