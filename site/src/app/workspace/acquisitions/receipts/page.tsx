import {
  AcquisitionReceiptsScreen,
  acquisitionReceiptsMetadata,
} from "../../../../features/resources/acquisition-receipts-server";

export const dynamic = "force-dynamic";

export const generateMetadata = acquisitionReceiptsMetadata;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return AcquisitionReceiptsScreen({ searchParams });
}
