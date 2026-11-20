import {
  LicensesHistoryScreen,
  licensesHistoryMetadata,
} from "../../../features/commerce/licenses-history-server";

export const dynamic = "force-dynamic";
export const generateMetadata = () => licensesHistoryMetadata();
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return LicensesHistoryScreen({ query: await searchParams });
}
