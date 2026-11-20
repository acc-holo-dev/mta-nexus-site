import {
  AcquisitionReceiptDetailScreen,
  acquisitionReceiptDetailMetadata,
} from "../../../../../features/resources/acquisition-receipt-detail-server";

export const dynamic = "force-dynamic";

export const generateMetadata = acquisitionReceiptDetailMetadata;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return AcquisitionReceiptDetailScreen({ params });
}
