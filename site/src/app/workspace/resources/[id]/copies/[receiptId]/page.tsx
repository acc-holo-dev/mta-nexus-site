import {
  ResourceCopyReceiptScreen,
  resourceCopyReceiptMetadata,
} from "../../../../../../features/resources/resource-copy-receipt-server";

export const dynamic = "force-dynamic";

export const generateMetadata = resourceCopyReceiptMetadata;

export default async function Page(props: {
  params: Promise<{ id: string; receiptId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ResourceCopyReceiptScreen(props);
}
